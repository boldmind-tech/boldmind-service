import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/user.decorator";
import { SchoolService } from "./school.service";
import {
  BulkEnrollStudentsDto,
  CreateAssignmentDto,
  RegisterSchoolDto,
} from "./dto/school.dto";

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Controller("educenter/schools")
@UseGuards(JwtAuthGuard)
export class SchoolController {
  constructor(private readonly school: SchoolService) {}

  @Post("register")
  register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterSchoolDto) {
    return this.school.register(user.sub, dto);
  }

  @Get("me")
  getMine(@CurrentUser() user: JwtPayload) {
    return this.school.getMySchool(user.sub);
  }

  @Post("me/students")
  bulkEnroll(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkEnrollStudentsDto,
  ) {
    return this.school.bulkEnrollStudents(user.sub, dto);
  }

  @Get("me/students")
  listStudents(
    @CurrentUser() user: JwtPayload,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query("search") search?: string,
  ) {
    return this.school.listStudents(user.sub, page, pageSize, search);
  }

  @Get("me/performance")
  getPerformance(
    @CurrentUser() user: JwtPayload,
    @Query("examType") examType?: string,
    @Query("subject") subject?: string,
  ) {
    return this.school.getPerformance(user.sub, examType, subject);
  }

  @Post("me/assignments")
  createAssignment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.school.createAssignment(user.sub, dto);
  }
}
