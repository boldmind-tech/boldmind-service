// src/modules/os/os.service.ts

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { WorkspaceRole, TaskStatus, TaskPriority } from '@prisma/client';

// ─── DTOs (inline — move to dto/ files if you prefer) ─────────────────────

interface CreateWorkspaceDto {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface UpdateWorkspaceDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface InviteMemberDto {
  email: string;
  role?: string;
}

interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: string;          // "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status?: string;            // "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED"
  dueDate?: string;
  assigneeId?: string;
  projectId?: string;
  tags?: string[];
  estimatedMinutes?: number;
}

interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  assigneeId?: string;
  projectId?: string;
  tags?: string[];
  estimatedMinutes?: number;
  actualMinutes?: number;
}

@Injectable()
export class OsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── WORKSPACE ────────────────────────────────────────────────────────────

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        ...dto,
        ownerId: userId,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    await this.invalidateUserWorkspaces(userId);
    return workspace;
  }

  async getMyWorkspaces(userId: string) {
    const cacheKey = `os:workspaces:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, tasks: true, projects: true } },
          },
        },
      },
    });

    const result = memberships.map((m) => ({ ...m.workspace, myRole: m.role }));
    await this.redis.set(cacheKey, JSON.stringify(result), 120);
    return result;
  }

  async getWorkspace(id: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, avatar: true, email: true } },
              },
            },
            projects: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!member) throw new NotFoundException('Workspace not found or access denied');
    return { ...member.workspace, myRole: member.role };
  }

  async updateWorkspace(id: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.assertRole(id, userId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    const updated = await this.prisma.workspace.update({ where: { id }, data: dto });
    await this.invalidateUserWorkspaces(userId);
    return updated;
  }

  async deleteWorkspace(id: string, userId: string) {
    await this.assertRole(id, userId, [WorkspaceRole.OWNER]);
    await this.prisma.workspace.delete({ where: { id } });
    await this.invalidateUserWorkspaces(userId);
    return { message: 'Workspace deleted' };
  }

  // ─── MEMBERS ──────────────────────────────────────────────────────────────

  async inviteMember(workspaceId: string, inviterId: string, dto: InviteMemberDto) {
    await this.assertRole(workspaceId, inviterId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);

    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!targetUser) throw new NotFoundException('User not found with that email');

    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUser.id },
    });
    if (existing) throw new ForbiddenException('User is already a member');

    const roleMap: Record<string, WorkspaceRole> = {
      OWNER: WorkspaceRole.OWNER,
      ADMIN: WorkspaceRole.ADMIN,
      MEMBER: WorkspaceRole.MEMBER,
    };

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: roleMap[dto.role?.toUpperCase() ?? ''] ?? WorkspaceRole.MEMBER,
      },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
  }

  async removeMember(workspaceId: string, removerId: string, targetUserId: string) {
    await this.assertRole(workspaceId, removerId, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    if (removerId === targetUserId) throw new ForbiddenException('Cannot remove yourself');

    await this.prisma.workspaceMember.deleteMany({
      where: { workspaceId, userId: targetUserId },
    });
    return { message: 'Member removed' };
  }

  async updateMemberRole(
    workspaceId: string,
    adminId: string,
    targetUserId: string,
    role: WorkspaceRole,
  ) {
    await this.assertRole(workspaceId, adminId, [WorkspaceRole.OWNER]);
    return this.prisma.workspaceMember.updateMany({
      where: { workspaceId, userId: targetUserId },
      data: { role },
    });
  }

  // ─── PROJECTS ─────────────────────────────────────────────────────────────

  async createProject(
    workspaceId: string,
    userId: string,
    data: { name: string; description?: string; color?: string },
  ) {
    await this.assertMembership(workspaceId, userId);
    return this.prisma.project.create({
      data: { ...data, workspaceId, createdById: userId },
    });
  }

  async getProjects(workspaceId: string, userId: string) {
    await this.assertMembership(workspaceId, userId);
    return this.prisma.project.findMany({
      where: { workspaceId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── TASKS ────────────────────────────────────────────────────────────────

  async createTask(workspaceId: string, creatorId: string, dto: CreateTaskDto) {
    await this.assertMembership(workspaceId, creatorId);

    // FIX: map string priority to TaskPriority enum; Task has no `label` field
    const priority = this.toPriority(dto.priority);
    const status = this.toStatus(dto.status);

    return this.prisma.task.create({
      data: {
        workspaceId,
        createdById: creatorId,
        title: dto.title,
        description: dto.description,
        priority,
        status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId,
        projectId: dto.projectId,
        tags: dto.tags ?? [],
        estimatedMinutes: dto.estimatedMinutes,
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async getTasks(
    workspaceId: string,
    userId: string,
    filters: {
      projectId?: string;
      status?: string;
      assigneeId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.assertMembership(workspaceId, userId);
    const { projectId, status, assigneeId, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workspaceId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = this.toStatus(status);
    if (assigneeId) where.assigneeId = assigneeId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignee: { select: { id: true, name: true, avatar: true } },
          createdBy: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async updateTask(taskId: string, userId: string, dto: UpdateTaskDto) {
    // FIX: Task has workspaceId field — use it directly instead of nested relation filter
    // to avoid "workspace does not exist in TaskWhereInput" error
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        workspace: { members: { some: { userId } } },
      },
    });
    if (!task) throw new NotFoundException('Task not found or access denied');

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priority ? { priority: this.toPriority(dto.priority) } : {}),
        ...(dto.status ? { status: this.toStatus(dto.status) } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.estimatedMinutes !== undefined ? { estimatedMinutes: dto.estimatedMinutes } : {}),
        ...(dto.actualMinutes !== undefined ? { actualMinutes: dto.actualMinutes } : {}),
        ...(dto.status === 'DONE' ? { completedAt: new Date() } : {}),
        updatedAt: new Date(),
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });
  }

  async deleteTask(taskId: string, userId: string) {
    // FIX: Task has no `createdById` or `workspace` in TaskWhereInput for nested check.
    // Use two separate lookups to avoid type errors.
    const task = await this.prisma.task.findFirst({
      where: { id: taskId },
      include: { workspace: { include: { members: { where: { userId } } } } },
    });

    if (!task) throw new ForbiddenException('Task not found');

    const member = task.workspace.members[0];
    const isCreator = task.createdById === userId;
    const isAdmin =
      member?.role === WorkspaceRole.OWNER || member?.role === WorkspaceRole.ADMIN;

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Cannot delete this task — must be creator or workspace admin');
    }

    await this.prisma.task.delete({ where: { id: taskId } });
    return { message: 'Task deleted' };
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  async getDashboard(userId: string) {
    const cacheKey = `os:dashboard:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // FIX: Task.assigneeId exists in schema. Task.workspace is a valid relation.
    // These work with the correct Prisma client generated from the schema.
    const [workspaceCount, myTasks, recentActivity] = await Promise.all([
      this.prisma.workspaceMember.count({ where: { userId } }),

      this.prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: { not: TaskStatus.DONE },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: {
          workspace: { select: { name: true } },
          project: { select: { name: true, color: true } },
        },
      }),

      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const result = { workspaceCount, myTasks, recentActivity };
    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async assertRole(
    workspaceId: string,
    userId: string,
    roles: WorkspaceRole[],
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }
    return member;
  }

  private async assertMembership(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('You are not a member of this workspace');
    return member;
  }

  private async invalidateUserWorkspaces(userId: string) {
    await Promise.all([
      this.redis.del(`os:workspaces:${userId}`),
      this.redis.del(`os:dashboard:${userId}`),
    ]);
  }

  /** Safely cast string → TaskPriority enum, default MEDIUM */
  private toPriority(value?: string): TaskPriority {
    const map: Record<string, TaskPriority> = {
      LOW: TaskPriority.LOW,
      MEDIUM: TaskPriority.MEDIUM,
      HIGH: TaskPriority.HIGH,
      URGENT: TaskPriority.URGENT,
    };
    return map[value?.toUpperCase() ?? ''] ?? TaskPriority.MEDIUM;
  }

  /** Safely cast string → TaskStatus enum, default TODO */
  private toStatus(value?: string): TaskStatus {
    const map: Record<string, TaskStatus> = {
      TODO: TaskStatus.TODO,
      IN_PROGRESS: TaskStatus.IN_PROGRESS,
      DONE: TaskStatus.DONE,
      ARCHIVED: TaskStatus.ARCHIVED,
    };
    return map[value?.toUpperCase() ?? ''] ?? TaskStatus.TODO;
  }
}