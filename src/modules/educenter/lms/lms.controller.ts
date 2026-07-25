import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/user.decorator";
import { LmsService } from "./lms.service";
import {
  CreateLmsCourseDto,
  CreateLmsLessonDto,
  GenerateLmsCourseDto,
  UpdateLmsCourseDto,
  UpdateLmsLessonDto,
} from "./dto/lms.dto";

interface JwtPayload {
  sub: string;
  name?: string;
  [key: string]: unknown;
}

@Controller("educenter/lms")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("creator", "admin", "super_admin")
export class LmsController {
  constructor(private readonly lms: LmsService) {}

  @Post("courses")
  createCourse(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLmsCourseDto,
  ) {
    return this.lms.createCourse(user.sub, user.name ?? "Instructor", dto);
  }

  @Get("courses")
  listCourses(
    @CurrentUser() user: JwtPayload,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.lms.listMyCourses(user.sub, page, pageSize);
  }

  @Get("courses/:id")
  getCourse(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.lms.getMyCourse(user.sub, id);
  }

  @Patch("courses/:id")
  updateCourse(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateLmsCourseDto,
  ) {
    return this.lms.updateCourse(user.sub, id, dto);
  }

  @Post("courses/:id/publish")
  publishCourse(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.lms.publishCourse(user.sub, id);
  }

  @Post("courses/:id/lessons")
  addLesson(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: CreateLmsLessonDto,
  ) {
    return this.lms.addLesson(user.sub, id, dto);
  }

  @Patch("lessons/:id")
  updateLesson(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateLmsLessonDto,
  ) {
    return this.lms.updateLesson(user.sub, id, dto);
  }

  @Delete("lessons/:id")
  deleteLesson(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.lms.deleteLesson(user.sub, id);
  }

  @Get("courses/:id/students")
  getStudents(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.lms.getStudents(user.sub, id, page, pageSize);
  }

  @Get("courses/:id/earnings")
  getEarnings(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.lms.getEarnings(user.sub, id);
  }

  @Post("generate")
  generate(@CurrentUser() user: JwtPayload, @Body() dto: GenerateLmsCourseDto) {
    return this.lms.generateCourse(user.sub, dto);
  }
}
