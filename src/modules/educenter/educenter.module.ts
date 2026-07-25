import { Module } from "@nestjs/common";
import { EduCenterController } from "./educenter.controller";
import { EduCenterService } from "./educenter.service";
import { AlocService } from "./services/aloc.service";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../database/redis.service";
import { LmsController } from "./lms/lms.controller";
import { LmsService } from "./lms/lms.service";
import { SchoolController } from "./school/school.controller";
import { SchoolService } from "./school/school.service";

@Module({
  imports: [AuthModule],
  controllers: [EduCenterController, LmsController, SchoolController],
  providers: [
    EduCenterService,
    AlocService,
    PrismaService,
    RedisService,
    LmsService,
    SchoolService,
  ],
  exports: [EduCenterService, AlocService],
})
export class EduCenterModule {}
