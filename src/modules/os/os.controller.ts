import {
    Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards,
    HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OsService } from './os.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@ApiTags('OS — Workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('os')
export class OsController {
    constructor(private readonly osService: OsService) { }

    // ─── WORKSPACES ───────────────────────────────────────────

    @Post('workspaces')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new workspace' })
    createWorkspace(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateWorkspaceDto,
    ) {
        return this.osService.createWorkspace(userId, dto);
    }

    @Get('workspaces')
    @ApiOperation({ summary: 'Get my workspaces' })
    getMyWorkspaces(@CurrentUser('id') userId: string) {
        return this.osService.getMyWorkspaces(userId);
    }

    @Get('workspaces/:id')
    @ApiOperation({ summary: 'Get workspace details' })
    getWorkspace(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.osService.getWorkspace(id, userId);
    }

    @Patch('workspaces/:id')
    @ApiOperation({ summary: 'Update workspace' })
    updateWorkspace(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateWorkspaceDto,
    ) {
        return this.osService.updateWorkspace(id, userId, dto);
    }

    @Delete('workspaces/:id')
    @ApiOperation({ summary: 'Delete workspace (owner only)' })
    deleteWorkspace(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.osService.deleteWorkspace(id, userId);
    }

    // ─── MEMBERS ──────────────────────────────────────────────

    @Post('workspaces/:id/members')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Invite a member to workspace' })
    inviteMember(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Body() dto: InviteMemberDto,
    ) {
        return this.osService.inviteMember(id, userId, dto);
    }

    @Delete('workspaces/:id/members/:targetUserId')
    @ApiOperation({ summary: 'Remove a member from workspace' })
    removeMember(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Param('targetUserId') targetUserId: string,
    ) {
        return this.osService.removeMember(id, userId, targetUserId);
    }

    @Patch('workspaces/:id/members/:targetUserId/role')
    @ApiOperation({ summary: 'Update member role' })
    updateMemberRole(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Param('targetUserId') targetUserId: string,
        @Body('role') role: any,
    ) {
        return this.osService.updateMemberRole(id, userId, targetUserId, role);
    }

    // ─── PROJECTS ─────────────────────────────────────────────

    @Post('workspaces/:id/projects')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a project in workspace' })
    createProject(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Body() data: { name: string; description?: string; color?: string },
    ) {
        return this.osService.createProject(id, userId, data);
    }

    @Get('workspaces/:id/projects')
    @ApiOperation({ summary: 'Get workspace projects' })
    getProjects(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.osService.getProjects(id, userId);
    }

    // ─── TASKS ────────────────────────────────────────────────

    @Post('workspaces/:id/tasks')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a task in workspace' })
    createTask(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Body() dto: CreateTaskDto,
    ) {
        return this.osService.createTask(id, userId, dto);
    }

    @Get('workspaces/:id/tasks')
    @ApiOperation({ summary: 'Get workspace tasks with filters' })
    getTasks(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Query() filters: { projectId?: string; status?: string; assigneeId?: string; page?: number; limit?: number },
    ) {
        return this.osService.getTasks(id, userId, filters);
    }

    @Patch('tasks/:taskId')
    @ApiOperation({ summary: 'Update a task' })
    updateTask(
        @Param('taskId') taskId: string,
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateTaskDto,
    ) {
        return this.osService.updateTask(taskId, userId, dto);
    }

    @Delete('tasks/:taskId')
    @ApiOperation({ summary: 'Delete a task' })
    deleteTask(
        @Param('taskId') taskId: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.osService.deleteTask(taskId, userId);
    }

    // ─── DASHBOARD ────────────────────────────────────────────

    @Get('dashboard')
    @ApiOperation({ summary: 'Get OS dashboard for current user' })
    getDashboard(@CurrentUser('id') userId: string) {
        return this.osService.getDashboard(userId);
    }
}
