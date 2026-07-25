import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../database/prisma.service";
import { RedisService } from "../../../database/redis.service";
import { QUEUES } from "../../../common/constants/queues";
import { AiService } from "../../ai/ai.service";
import { IPost } from "../../amebogist/schemas/post.schema";

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly ai: AiService,
    @InjectQueue(QUEUES.AI_GENERATION) private readonly aiQueue: Queue,
    @InjectModel("Post") private readonly postModel: Model<IPost>,
  ) {}

  // ── amebogist:read ──────────────────────────────────────────────────────

  async listPublishedPosts({ page = 1, pageSize = 20 }: PaginationParams) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.postModel
        .find({ status: "published" })
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(Math.min(pageSize, 50))
        .lean(),
      this.postModel.countDocuments({ status: "published" }),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: skip + data.length < total,
      hasPrev: page > 1,
    };
  }

  async getPostBySlug(slug: string) {
    const post = await this.postModel
      .findOne({ slug, status: "published" })
      .lean();
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  // ── educenter:questions / educenter:submit ──────────────────────────────

  /**
   * Fetches (cache-first, REDIS_CACHE 24h TTL) a batch of exam questions
   * from the ALOC API. Key pattern matches educenter.module's own cache:
   * aloc:{subject}:{examType}:{year}
   */
  async getExamQuestions(params: {
    examType: string;
    subject: string;
    count: number;
    year?: number;
  }) {
    const { examType, subject, count } = params;
    const year = params.year ?? "all";

    const cached = await this.redis.getAlocQuestions(
      subject,
      examType,
      year as number | "all",
    );
    if (cached?.length) return cached.slice(0, count);

    const alocBase =
      this.config.get<string>("ALOC_API_URL") ??
      "https://questions.aloc.com.ng/api/v2";
    const token = this.config.get<string>("ALOC_API_TOKEN");
    const res = await fetch(
      `${alocBase}/q/${count}?subject=${encodeURIComponent(subject)}${
        year !== "all" ? `&year=${year}` : ""
      }`,
      { headers: token ? { AccessToken: token } : undefined },
    );

    if (!res.ok) {
      throw new BadRequestException(
        "Unable to fetch questions from ALOC at this time",
      );
    }
    const body = await res.json();
    const questions = Array.isArray(body?.data)
      ? body.data
      : body?.data
        ? [body.data]
        : [];

    await this.redis.setAlocQuestions(
      subject,
      examType,
      year as number | "all",
      questions,
    );
    return questions.slice(0, count);
  }

  /**
   * Grades answers submitted against a CBT session created via the
   * authenticated (JWT) EduCenter flow. External callers pass the
   * sessionId returned to their end user by the partner's own frontend.
   */
  async submitExamAnswers(
    sessionId: string,
    answers: Array<{ alocQuestionId: string; selectedAnswer: string }>,
  ) {
    const session = await this.prisma.cBTSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("CBT session not found");

    let correct = 0;
    for (const ans of answers) {
      const existing = await this.prisma.studentProgress.findFirst({
        where: { sessionId, alocQuestionId: ans.alocQuestionId },
      });
      const isCorrect = existing
        ? existing.correctAnswer === ans.selectedAnswer
        : false;
      if (isCorrect) correct += 1;
    }

    const percentage = answers.length ? (correct / answers.length) * 100 : 0;
    await this.prisma.cBTSession.update({
      where: { id: sessionId },
      data: {
        score: correct,
        percentage,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return { score: correct, total: answers.length, percentage };
  }

  // ── planai:social:generate ──────────────────────────────────────────────

  async generateCaption(params: {
    topic: string;
    platform: string;
    tone?: string;
  }) {
    const systemPrompt =
      "You are a Nigerian social media copywriter. Write short, scroll-stopping captions " +
      "calibrated for the given platform, with natural Nigerian cultural references where relevant.";
    const userPrompt = `Topic: ${params.topic}\nPlatform: ${params.platform}\nTone: ${
      params.tone ?? "engaging"
    }\n\nReturn only the caption text, under 220 characters, followed by 3-5 relevant hashtags.`;

    const result = await (this.ai as any).generateNigerianContent({
      provider: "openai",
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 300,
      language: "en",
    });

    return { caption: result.content, tokensUsed: result.tokensUsed };
  }

  // ── planai:branding:logo ─────────────────────────────────────────────────

  async generateLogo(params: {
    businessName: string;
    industry: string;
    style?: string;
    colors?: string;
  }) {
    const job = await this.aiQueue.add("generate-logo", {
      type: "logo-generation",
      businessName: params.businessName,
      industry: params.industry,
      style: params.style ?? "modern",
      colors: params.colors,
    });
    return { jobId: job.id };
  }

  // ── villagecircle:waitlist ───────────────────────────────────────────────

  async joinWaitlist(productSlug: string, email: string, name?: string) {
    const total = await this.prisma.waitlistEntry.count({
      where: { productSlug },
    });
    const entry = await this.prisma.waitlistEntry.upsert({
      where: { email_productSlug: { email, productSlug } },
      update: {},
      create: {
        email,
        name,
        productSlug,
        position: total + 1,
        source: "enterprise-api",
      },
    });
    return { position: entry.position, joined: true };
  }

  // ── payments:verify ───────────────────────────────────────────────────────

  async verifyPaymentByReference(reference: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { paystackRef: reference },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }
}
