import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import {
  BulkEnrollStudentsDto,
  CreateAssignmentDto,
  RegisterSchoolDto,
} from "./dto/school.dto";

/**
 * SchoolService — depends on two Prisma additions not yet in schema.prisma:
 * `UserProfile.schoolId` and the `SchoolAssignment` model. See
 * ./SCHEMA-ADDITIONS-REQUIRED.prisma for the exact diff + migration command.
 * Until that migration runs, the `schoolId` field access and
 * `prisma.schoolAssignment` calls below will fail at runtime (they will
 * still compile once `prisma generate` picks up the new fields).
 */
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

    const where = {
      schoolId: school.id,
      ...(search
        ? {
            user: {
              is: {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    email: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
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

    return this.prisma.subjectPerformance.findMany({
      where: {
        userId: { in: userIds },
        ...(examType ? { examType: examType as never } : {}),
        ...(subject ? { subject } : {}),
      },
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
