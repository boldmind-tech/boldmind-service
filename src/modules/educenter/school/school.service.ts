import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import {
  BulkEnrollStudentsDto,
  CreateAssignmentDto,
  RegisterSchoolDto,
} from "./dto/school.dto";

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async register(adminUserId: string, dto: RegisterSchoolDto) {
    const existing = await this.prisma.school.findUnique({
      where: { adminUserId },
    });
    if (existing)
      throw new ConflictException("You have already registered a school");

    return this.prisma.school.create({
      data: {
        name: dto.name,
        state: dto.state,
        contactEmail: dto.contactEmail,
        adminUserId,
      },
    });
  }

  async getMySchool(adminUserId: string) {
    const school = await this.prisma.school.findUnique({
      where: { adminUserId },
    });
    if (!school)
      throw new NotFoundException("No school registered for this account");

    const studentCount = await this.prisma.userProfile.count({
      where: { schoolId: school.id },
    });

    return {
      ...school,
      stats: {
        studentCount,
        slotsRemaining: Math.max(0, school.studentSlots - school.usedSlots),
      },
    };
  }

  async bulkEnrollStudents(adminUserId: string, dto: BulkEnrollStudentsDto) {
    const school = await this.requireOwnSchool(adminUserId);

    const remaining = school.studentSlots - school.usedSlots;
    if (dto.students.length > remaining) {
      throw new ForbiddenException(
        `Only ${remaining} student slot(s) remaining on the "${school.plan}" plan`,
      );
    }

    let enrolled = 0;
    const errors: Array<{ email: string; reason: string }> = [];

    for (const student of dto.students) {
      const user = await this.prisma.user.findUnique({
        where: { email: student.email },
      });
      if (!user) {
        errors.push({
          email: student.email,
          reason: "No BoldmindNG account for this email yet",
        });
        continue;
      }
      await this.prisma.userProfile.upsert({
        where: { userId: user.id },
        update: { schoolId: school.id },
        create: { userId: user.id, schoolId: school.id },
      });
      enrolled += 1;
    }

    if (enrolled > 0) {
      await this.prisma.school.update({
        where: { id: school.id },
        data: { usedSlots: { increment: enrolled } },
      });
    }

    return { enrolled, errors };
  }

  async listStudents(
    adminUserId: string,
    page = 1,
    pageSize = 20,
    search?: string,
  ) {
    const school = await this.requireOwnSchool(adminUserId);
    const skip = (page - 1) * pageSize;

    // Explicitly typed as Prisma.UserProfileWhereInput so `mode` resolves to
    // the Prisma.QueryMode enum instead of widening to `string` (which is
    // what caused the "Type 'string' is not assignable to type 'never'"
    // error — an inline object literal has no way to narrow `mode` to the
    // enum without either `as const` on each literal or, more robustly, an
    // explicit variable type like this one).
    const where: Prisma.UserProfileWhereInput = {
      schoolId: school.id,
      ...(search
        ? {
            user: {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  email: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.userProfile.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        skip,
        take: pageSize,
      }),
      this.prisma.userProfile.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPerformance(
    adminUserId: string,
    examType?: string,
    subject?: string,
  ) {
    const school = await this.requireOwnSchool(adminUserId);

    const students = await this.prisma.userProfile.findMany({
      where: { schoolId: school.id },
      select: { userId: true },
    });
    const userIds = students.map((s) => s.userId);
    if (!userIds.length) return [];

    const where: Prisma.SubjectPerformanceWhereInput = {
      userId: { in: userIds },
      ...(examType
        ? {
            examType:
              examType as Prisma.SubjectPerformanceWhereInput["examType"],
          }
        : {}),
      ...(subject ? { subject } : {}),
    };

    return this.prisma.subjectPerformance.findMany({
      where,
      orderBy: { averagePercent: "desc" },
    });
  }

  async createAssignment(adminUserId: string, dto: CreateAssignmentDto) {
    const school = await this.requireOwnSchool(adminUserId);
    return this.prisma.schoolAssignment.create({
      data: {
        schoolId: school.id,
        classGroup: dto.classGroup,
        examType: dto.examType,
        subject: dto.subject,
        dueDate: new Date(dto.dueDate),
        questionCount: dto.questionCount,
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async requireOwnSchool(adminUserId: string) {
    const school = await this.prisma.school.findUnique({
      where: { adminUserId },
    });
    if (!school)
      throw new NotFoundException("No school registered for this account");
    return school;
  }
}
