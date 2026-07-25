import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "../api-key/api-key.guard";
import { ApiRateLimitGuard } from "../rate-limit/api-rate-limit.guard";
import { ApiScopes } from "../../../common/decorators/api-scopes.decorator";
import { EnterpriseService } from "./enterprise.service";
import {
  ExamQuestionsQueryDto,
  GenerateCaptionDto,
  GenerateLogoDto,
  JoinWaitlistDto,
  SubmitExamAnswersDto,
} from "./enterprise.dto";

@Controller("public")
@UseGuards(ApiKeyGuard, ApiRateLimitGuard)
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get("amebogist/posts")
  @ApiScopes("amebogist:read")
  listPosts(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.enterprise.listPublishedPosts({
      page,
      pageSize: Math.min(pageSize, 50),
    });
  }

  @Get("amebogist/posts/:slug")
  @ApiScopes("amebogist:read")
  getPost(@Param("slug") slug: string) {
    return this.enterprise.getPostBySlug(slug);
  }

  @Get("educenter/questions")
  @ApiScopes("educenter:questions")
  getQuestions(@Query() query: ExamQuestionsQueryDto) {
    return this.enterprise.getExamQuestions(query);
  }

  @Post("educenter/submit")
  @ApiScopes("educenter:submit")
  submitAnswers(@Body() dto: SubmitExamAnswersDto) {
    return this.enterprise.submitExamAnswers(dto.sessionId, dto.answers);
  }

  @Post("planai/social/caption")
  @ApiScopes("planai:social:generate")
  generateCaption(@Body() dto: GenerateCaptionDto) {
    return this.enterprise.generateCaption(dto);
  }

  @Post("planai/branding/logo")
  @ApiScopes("planai:branding:logo")
  generateLogo(@Body() dto: GenerateLogoDto) {
    return this.enterprise.generateLogo(dto);
  }

  @Post("villagecircle/waitlist/:slug")
  @ApiScopes("villagecircle:waitlist")
  joinWaitlist(@Param("slug") slug: string, @Body() dto: JoinWaitlistDto) {
    return this.enterprise.joinWaitlist(slug, dto.email, dto.name);
  }

  @Get("payments/verify/:reference")
  @ApiScopes("payments:verify")
  verifyPayment(@Param("reference") reference: string) {
    return this.enterprise.verifyPaymentByReference(reference);
  }
}
