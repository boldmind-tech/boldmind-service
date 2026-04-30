// src/modules/planai/planai.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullModule as BullMQModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { PlanAIController } from './planai.controller';
import { PlanAIService } from './planai.service';
import { PlanAIProcessor } from './planai.processor';

// AI Receptionist
import { ReceptionistController } from './receptionist/receptionist.controller';
import { ReceptionistService } from './receptionist/receptionist.service';
import { MetaWebhookService } from './receptionist/metawebhook.service';

// Credibility AI
import { CredibilityController } from './credibility/credibility.controller';
import { CredibilityService } from './credibility/credibility.service';

// Financial AI
import { FinancialController } from './financial/financial.controller';
import { FinancialService } from './financial/financial.service';

// Analytics AI
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsReportService } from './analytics/analytics.service';

// Branding AI
import { BrandingController } from './branding/branding.controller';
import { BrandingService } from './branding/branding.service';

// Business Planning
import { PlanningController } from './business-planning/planning.controller';
import { PlanningService } from './business-planning/planning.service';

// Investor
import { InvestorController } from './investor/investor.controller';
import { InvestorService } from './investor/investor.service';

// Marketing AI
import { MarketingController } from './marketing/marketing.controller';
import { MarketingService } from './marketing/marketing.service';

// Storefronts AI
import { StorefrontsController } from './storefronts/storefronts.controller';
import { StorefrontsService } from './storefronts/storefronts.service';

// Email Scraper
import { EmailScraperController } from './emailscraper/emailscraper.controller';
import { EmailScraperService } from './emailscraper/emailscraper.service';
import { EmailLeadSchema, ScrapeJobSchema, LeadListSchema } from './emailscraper/emailscraper.schema';

// ViralKit
import { ViralKitController } from './viralkit/viralkit.controller';
import { ViralKitService } from './viralkit/viralkit.service';
import { FalProvider } from './viralkit/fal.provider';

// Fitness
import { FitnessController } from './fitness/fitness.controller';
import { FitnessService } from './fitness/fitness.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,

    // Bull queues (@nestjs/bull)
    BullModule.registerQueue(
      { name: 'planai-jobs' },
    ),

    // BullMQ queues (@nestjs/bullmq)
    BullMQModule.registerQueue(
      { name: 'receptionist' },
      { name: 'emailscraper' },
    ),

    // Mongoose schemas for EmailScraper
    MongooseModule.forFeature([
      { name: 'EmailLead', schema: EmailLeadSchema },
      { name: 'ScrapeJob', schema: ScrapeJobSchema },
      { name: 'LeadList', schema: LeadListSchema },
    ]),
  ],
  controllers: [
    PlanAIController,
    ReceptionistController,
    CredibilityController,
    FinancialController,
    AnalyticsController,
    BrandingController,
    PlanningController,
    InvestorController,
    MarketingController,
    StorefrontsController,
    EmailScraperController,
    ViralKitController,
    FitnessController,
  ],
  providers: [
    PlanAIService,
    PlanAIProcessor,
    ReceptionistService,
    MetaWebhookService,
    CredibilityService,
    FinancialService,
    AnalyticsReportService,
    BrandingService,
    PlanningService,
    InvestorService,
    MarketingService,
    StorefrontsService,
    EmailScraperService,
    ViralKitService,
    FalProvider,
    FitnessService,
  ],
  exports: [PlanAIService, MetaWebhookService],
})
export class PlanAIModule {}