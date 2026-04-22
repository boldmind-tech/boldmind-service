import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PlanAIService {
  private readonly logger = new Logger(PlanAIService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    @InjectQueue('planai-jobs') private readonly planaiQueue: Queue,
  ) {}

  // ── Job management ────────────────────────────────────────

  async createJob(userId: string, tool: string, input: any) {
    // Map tool string to PlanAIJobType enum if possible, else default to BUSINESS_PLAN
    // In a real app, this should be a robust mapping or passed from caller
    const typeMap: Record<string, any> = {
      'business-planning': 'BUSINESS_PLAN',
      'financial-forecasting': 'FINANCIAL_FORECAST',
      'branding-design': 'BRANDING_PACKAGE',
      'marketing-automation': 'MARKETING_CAMPAIGN',
      'credibility-hubs': 'CREDIBILITY_HUB',
      'investor-readiness': 'INVESTOR_DECK',
      'digital-storefronts': 'STOREFRONT_SETUP',
      'analytics-dashboard': 'ANALYTICS_REPORT',
    };

    const job = await this.prisma.planAIJob.create({
      data: {
        userId,
        tool,
        type: typeMap[tool] || 'BUSINESS_PLAN',
        status: 'QUEUED',
        productSlug: 'planai',
        input
      },
    });

    await this.planaiQueue.add('process', { jobId: job.id, tool, input, userId }, {
      jobId: job.id,
      priority: 1,
    });

    return job;
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.planAIJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getUserJobs(userId: string, tool?: string, page = 1, limit = 20) {
    const where: any = { userId };
    if (tool) where.tool = tool;
    const skip = (page - 1) * limit;
    const [jobs, total] = await Promise.all([
      this.prisma.planAIJob.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.planAIJob.count({ where }),
    ]);
    return { data: jobs, meta: { total, page, limit } };
  }

  // ── TOOL 1: Business Planning ─────────────────────────────

  async generateBusinessPlan(userId: string, input: {
    businessName: string;
    industry: string;
    targetMarket: string;
    initialCapital: number;
    location: string;
    products: string;
    competitiveAdvantage: string;
  }) {
    const businessContext = `You are a Nigerian business advisor. ${input.businessName} is in the ${input.industry} industry, located in ${input.location}.`;
    
    const { content: plan } = await this.ai.generateJson<any>(
      businessContext,
      `Generate a comprehensive, bank-ready Nigerian business plan for:
Business: ${input.businessName}
Industry: ${input.industry}
Target Market: ${input.targetMarket}
Starting Capital: ₦${input.initialCapital.toLocaleString()}
Location: ${input.location}
Products/Services: ${input.products}
Competitive Advantage: ${input.competitiveAdvantage}

Return JSON with: executiveSummary, companyDescription, marketAnalysis (size, competitors, opportunity), 
productsServices, marketingStrategy, operationalPlan, managementTeam, financialProjections (3-year), 
fundingRequirements, appendix, swotAnalysis.`,
      { task: 'reasoning' },
    );

    return this.createJob(userId, 'business-planning', { input, output: plan });
  }

  // ── TOOL 2: Financial Forecasting ─────────────────────────

  async generateFinancialForecast(userId: string, input: {
    monthlyRevenue: number;
    monthlyExpenses: { category: string; amount: number }[];
    growthRate: number;
    scenario: 'conservative' | 'realistic' | 'optimistic';
  }) {
    const { content: forecast } = await this.ai.generateJson<any>(
      'You are a Nigerian financial analyst. Generate accurate cash flow projections in NGN.',
      `Generate 12-month financial forecast:
Current Monthly Revenue: ₦${input.monthlyRevenue.toLocaleString()}
Monthly Expenses: ${JSON.stringify(input.monthlyExpenses)}
Expected Growth Rate: ${input.growthRate}%/month
Scenario: ${input.scenario}

Return JSON with: months (array of 12 month projections with revenue, expenses, profit, cashFlow),
breakEvenMonth, totalYear1Revenue, totalYear1Expenses, totalYear1Profit, 
burnRate, runwayMonths, keyRisks, recommendations.`,
      { task: 'reasoning' }
    );

    return this.createJob(userId, 'financial-forecasting', { input, output: forecast });
  }

  // ── TOOL 3: AI Branding ───────────────────────────────────

  async generateBrandKit(userId: string, input: {
    businessName: string;
    industry: string;
    targetAudience: string;
    brandPersonality: string;
    generateLogo?: boolean;
  }) {
    const [brandKitResponse, logoResult] = await Promise.all([
      this.ai.generateJson<any>(
        `You are a Nigerian branding expert. Business: ${input.businessName}, Industry: ${input.industry}.`,
        `Create a complete brand kit for "${input.businessName}" in ${input.industry}.
Target: ${input.targetAudience}. Personality: ${input.brandPersonality}.
Return JSON: tagline, brandVoice, colorPalette (primary/secondary/accent hex codes + rationale),
typography (heading/body font recommendations), brandValues (5 core values),
marketingMessages (5 key messages), socialBioTemplates (Instagram/LinkedIn/Twitter),
emailSignatureTemplate, logoPrompt (DALL-E 3 prompt for logo generation).`,
      ),
      input.generateLogo
        ? this.ai.generateLogo({
            brandName: input.businessName,
            industry: input.industry,
            style: 'minimalist professional',
            colors: ['#000000'], // Default or derived
          })
        : Promise.resolve(null),
    ]);

    const brandKit = brandKitResponse.content;
    const logoUrls = logoResult?.url ? [logoResult.url] : [];

    return this.createJob(userId, 'branding-design', {
      input,
      output: { ...brandKit, logoUrls },
    });
  }

  // ── TOOL 4: Marketing Automation copy ────────────────────

  async generateMarketingCopy(userId: string, input: {
    businessName: string;
    product: string;
    platform: 'instagram' | 'whatsapp' | 'email' | 'facebook' | 'tiktok';
    tone: string;
    callToAction: string;
    language: 'english' | 'pidgin' | 'yoruba_style';
  }) {
    const { content: copies } = await this.ai.generateJson<any>(
      'You are an expert Nigerian social media copywriter. You understand Pidgin English, Nigerian slang, and local marketing culture.',
      `Create ${input.platform} marketing copy for:
Business: ${input.businessName}
Product: ${input.product}
Tone: ${input.tone}
CTA: ${input.callToAction}
Language style: ${input.language}

Return JSON with: 5 caption variations (each with text, hashtags, emojis), 
3 story/status ideas, 2 broadcast message templates, 1 WhatsApp status idea.`,
    );

    return this.createJob(userId, 'marketing-automation', { input, output: copies });
  }

  // ── TOOL 5: Credibility Hub content ──────────────────────

  async generateCredibilityContent(userId: string, input: {
    name: string;
    title: string;
    industry: string;
    yearsExperience: number;
    achievements: string[];
    skills: string[];
    targetRole?: string;
  }) {
    const { content } = await this.ai.generateJson<any>(
      'You are a Nigerian professional branding expert who helps people stand out on LinkedIn and in job applications.',
      `Create professional credibility content for:
Name: ${input.name}
Title: ${input.title}
Industry: ${input.industry}
Experience: ${input.yearsExperience} years
Key Achievements: ${input.achievements.join(', ')}
Skills: ${input.skills.join(', ')}
Target: ${input.targetRole || 'General professional visibility'}

Return JSON: linkedinHeadline (3 variations), linkedinSummary (2 versions, 1 formal 1 conversational),
resumeSummary (ATS-optimized), elevatorPitch (30-sec verbal), portfolioTagline,
twitterBio, instagramBio, recommendationRequestTemplate, coldOutreachTemplate.`,
    );

    return this.createJob(userId, 'credibility-hubs', { input, output: content });
  }

  // ── TOOL 6: Investor Readiness ────────────────────────────

  async generateInvestorDocs(userId: string, input: {
    startupName: string;
    problem: string;
    solution: string;
    traction: string;
    fundingAmount: number;
    useOfFunds: string;
    teamBackground: string;
  }) {
    const { content: docs } = await this.ai.generateJson<any>(
      'You are a Nigerian startup funding advisor with knowledge of SEC Nigeria, Venture Gardens, Future Africa, and Lagos startup ecosystem.',
      `Generate investor readiness documents for:
Startup: ${input.startupName}
Problem: ${input.problem}
Solution: ${input.solution}
Traction: ${input.traction}
Funding Ask: ₦${input.fundingAmount.toLocaleString()}
Use of Funds: ${input.useOfFunds}
Team: ${input.teamBackground}

Return JSON: executiveSummary (200 words), problemStatement, solutionStatement,
marketOpportunity, businessModel, tractionMetrics, competitiveLandscape,
teamBios, fundingAsk (with use of funds breakdown), financialHighlights,
exitStrategy, dueDiligenceChecklist, investorFAQ (10 likely questions + answers).`,
      { task: 'reasoning' }
    );

    return this.createJob(userId, 'investor-readiness', { input, output: docs });
  }

  // ── TOOL 7: HR Tools ──────────────────────────────────────

  async generateHRContent(userId: string, input: {
    type: 'job_description' | 'offer_letter' | 'performance_review' | 'handbook_section';
    role?: string;
    salary?: number;
    companyName: string;
    details: Record<string, any>;
  }) {
    const { content } = await this.ai.generateJson<any>(
      'You are a Nigerian HR expert. Create legally appropriate, culturally relevant HR documents for Nigerian businesses.',
      `Generate Nigerian HR document:
Type: ${input.type}
Company: ${input.companyName}
${input.role ? `Role: ${input.role}` : ''}
${input.salary ? `Salary: ₦${input.salary.toLocaleString()}/month` : ''}
Details: ${JSON.stringify(input.details)}

Return JSON with the complete document content and any required metadata.`,
    );

    return this.createJob(userId, 'planai', { tool: 'hr', input, output: content });
  }

  // ── TOOL 8: Legal Templates ───────────────────────────────

  async generateLegalTemplate(userId: string, input: {
    type: 'service_agreement' | 'nda' | 'terms_of_service' | 'privacy_policy' | 'partnership_agreement';
    partyAName: string;
    partyBName?: string;
    businessType: string;
    jurisdiction?: string;
    details: Record<string, any>;
  }) {
    const { content: template } = await this.ai.generateJson<any>(
      'You are a Nigerian commercial lawyer. Generate legally appropriate templates compliant with Nigerian law. Always include a disclaimer that this is a template and should be reviewed by a licensed attorney.',
      `Generate Nigerian ${input.type} template:
Party A: ${input.partyAName}
${input.partyBName ? `Party B: ${input.partyBName}` : ''}
Business Type: ${input.businessType}
Jurisdiction: ${input.jurisdiction || 'Federal Republic of Nigeria'}
Details: ${JSON.stringify(input.details)}

Return JSON with: title, disclaimer, preamble, clauses (array of {title, content}), signatures section.`,
    );

    return this.createJob(userId, 'planai', { tool: 'legal', input, output: template });
  }

  // ── TOOL 9: Storefront content ────────────────────────────

  async generateStorefrontContent(userId: string, input: {
    businessName: string;
    products: { name: string; price: number; description: string }[];
    tone: string;
  }) {
    const { content } = await this.ai.generateJson<any>(
      `You are a Nigerian business advisor. Business: ${input.businessName}.`,
      `Generate compelling product descriptions and store copy for ${input.businessName}.
Products: ${JSON.stringify(input.products)}
Tone: ${input.tone}

Return JSON with: storeTagline, storeDescription, productDescriptions (enhanced versions),
whatsappBroadcastTemplate, returnPolicyTemplate, shippingPolicyTemplate.`,
    );

    return this.createJob(userId, 'digital-storefronts', { input, output: content });
  }

  // ── TOOL 10: Analytics Insights ───────────────────────────

  async generateAnalyticsInsights(userId: string, input: {
    metrics: Record<string, number>;
    platform: string;
    period: string;
    industry: string;
  }) {
    const { content: insights } = await this.ai.generateJson<any>(
      'You are a Nigerian digital marketing analyst. Provide actionable insights for Nigerian businesses.',
      `Analyze these ${input.platform} metrics for a Nigerian business in ${input.industry}:
Period: ${input.period}
Metrics: ${JSON.stringify(input.metrics)}

Return JSON with: performanceSummary, topInsights (5), actionableRecommendations (5),
growthOpportunities (3), warningSignals (any), nextMonthForecast, competitorBenchmarks.`,
    );

    return this.createJob(userId, 'analytics-dashboard', { input, output: insights });
  }

  // ── TOOL 11: Operations ───────────────────────────────────

  async generateOperationsDoc(userId: string, input: {
    businessName: string;
    industry: string;
    docType: 'sop' | 'process_map' | 'kpi_framework' | 'org_chart';
    department: string;
    details: Record<string, any>;
  }) {
    const businessContext = `You are a Nigerian business advisor. ${input.businessName} is in the ${input.industry} industry.`;
    const { content: doc } = await this.ai.generateJson<any>(
      businessContext,
      `Generate a ${input.docType} for the ${input.department} department of ${input.businessName}.
Details: ${JSON.stringify(input.details)}

Return JSON with the complete operational document structure.`,
    );

    return this.createJob(userId, 'planai', { tool: 'operations', input, output: doc });
  }

  // ── TOOL 12: EmailScraper enhancement ────────────────────

  async enrichLeadData(userId: string, leads: { email: string; company?: string }[]) {
    const { content: enriched } = await this.ai.generateJson<any>(
      'You are a B2B lead researcher with knowledge of Nigerian businesses.',
      `Enrich these leads with likely information based on their email domains and company names:
Leads: ${JSON.stringify(leads.slice(0, 10))}

Return JSON with: enrichedLeads (array with added: industry, estimatedSize, 
linkedinSearchQuery, outreachPersonalization, qualificationScore 1-10).`,
    );

    return this.createJob(userId, 'emailscraper', { input: { leads }, output: enriched });
  }
}