import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiModule } from "../api/api.module";
import { PolymindController } from "./polymind.controller";
import { PolymindService } from "./polymind.service";
import { PolyMindComparisonSchema } from "./schemas/comparison.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "PolyMindComparison", schema: PolyMindComparisonSchema },
    ]),
    // Reuses ApiModule's ApiKeyGuard / ApiRateLimitGuard — see api.module.ts exports.
    ApiModule,
  ],
  controllers: [PolymindController],
  providers: [PolymindService],
  exports: [PolymindService],
})
export class PolymindModule {}
