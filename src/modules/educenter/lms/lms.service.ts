import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../../database/prisma.service";
import { QUEUES } from "../../../common/constants/queues";
import slugify from "slugify";
import {
  CreateLmsCourseDto,
  CreateLmsLessonDto,
  GenerateLmsCourseDto,
  UpdateLmsCourseDto,
  UpdateLmsLessonDto,
} from "./dto/lms.dto";

@Injectable()
export class LmsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.AI_GENERATION) private readonly aiQueue: Queue,
  ) {}

  // ── Courses ────────────────────────────────────────────────────────────

  async createCourse(
    instructorId: string,
    instructorName: string,
    dto: CreateLmsCourseDto,
  ) {
    const slug = await this.uniqueSlug(dto.title);
    return this.prisma.course.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        price: dto.price ?? 0,
        isPremium: dto.isPremium ?? false,
        instructorId,
        instructorName,
        status: "DRAFT",
      },
    });
  }

  async listMyCourses(instructorId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where: { instructorId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.course.count({ where: { instructorId } }),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getMyCourse(instructorId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: { orderBy: { sortOrder: "asc" } } },
    });
    this.assertOwner(course, instructorId);
    return course;
  }

  async updateCourse(
    instructorId: string,
    courseId: string,
    dto: UpdateLmsCourseDto,
  ) {
    await this.getMyCourse(instructorId, courseId);
    return this.prisma.course.update({ where: { id: courseId }, data: dto });
  }

  async publishCourse(instructorId: string, courseId: string) {
    const course = await this.getMyCourse(instructorId, courseId);
    if (!course.totalLessons) {
      throw new ForbiddenException("Add at least one lesson before publishing");
    }
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: "PUBLISHED" },
    });
  }

  // ── Lessons ────────────────────────────────────────────────────────────

  async addLesson(
    instructorId: string,
    courseId: string,
    dto: CreateLmsLessonDto,
  ) {
    const course = await this.getMyCourse(instructorId, courseId);
    const sortOrder = course.lessons?.length ?? 0;

    const lesson = await this.prisma.courseLesson.create({
      data: { courseId, sortOrder, ...dto },
    });
    await this.prisma.course.update({
      where: { id: courseId },
      data: { totalLessons: { increment: 1 } },
    });
    return lesson;
  }

  async updateLesson(
    instructorId: string,
    lessonId: string,
    dto: UpdateLmsLessonDto,
  ) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    if (lesson.course.instructorId !== instructorId) {
      throw new ForbiddenException("Not your course");
    }
    return this.prisma.courseLesson.update({
      where: { id: lessonId },
      data: dto,
    });
  }

  async deleteLesson(instructorId: string, lessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    if (lesson.course.instructorId !== instructorId) {
      throw new ForbiddenException("Not your course");
    }
    await this.prisma.courseLesson.delete({ where: { id: lessonId } });
    await this.prisma.course.update({
      where: { id: lesson.courseId },
      data: { totalLessons: { decrement: 1 } },
    });
    return { deleted: true };
  }

  // ── Students & earnings ───────────────────────────────────────────────

  async getStudents(
    instructorId: string,
    courseId: string,
    page = 1,
    pageSize = 20,
  ) {
    await this.getMyCourse(instructorId, courseId);
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where: { courseId },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.courseEnrollment.count({ where: { courseId } }),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Earnings estimate derived from enrollment count × course price.
   * NOTE: there is no dedicated CourseOrder/ledger model yet — once
   * Paystack split payments land for LMS purchases (system-design-v2 §7.1),
   * swap this for a real Payment-linked query keyed on productSlug
   * `lms-course:{courseId}`.
   */
  async getEarnings(instructorId: string, courseId: string) {
    const course = await this.getMyCourse(instructorId, courseId);
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { courseId },
      select: { createdAt: true },
    });

    const byMonthMap = new Map<string, number>();
    for (const e of enrollments) {
      const key = e.createdAt.toISOString().slice(0, 7); // YYYY-MM
      byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + course.price);
    }
    const byMonth = Array.from(byMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, kobo]) => ({ month, totalKobo: kobo }));

    return { totalKobo: enrollments.length * course.price, byMonth };
  }

  // ── AI course generator ───────────────────────────────────────────────

  async generateCourse(instructorId: string, dto: GenerateLmsCourseDto) {
    const job = await this.aiQueue.add("generate-lms-course", {
      type: "lms-course-generate",
      instructorId,
      ...dto,
    });
    return { jobId: job.id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private assertOwner(
    course: { instructorId: string | null } | null,
    instructorId: string,
  ): asserts course {
    if (!course) throw new NotFoundException("Course not found");
    if (course.instructorId !== instructorId)
      throw new ForbiddenException("Not your course");
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await this.prisma.course.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }
}
