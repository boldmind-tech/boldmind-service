// src/modules/planai/planai.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullModule as BullMQModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios'; // required for HttpService in MetaWebhookService

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

@Module({
  imports: [
    // Register queues used by PlanAI (uses @nestjs/bull)
    BullModule.registerQueue(
      { name: 'planai-jobs' },
    ),

    // Register queues used by MetaWebhookService (uses @nestjs/bullmq)
    BullMQModule.registerQueue(
      { name: 'receptionist' },
    ),

    // Required for HttpService used in MetaWebhookService
    HttpModule,
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
  ],
  exports: [PlanAIService, MetaWebhookService],
})
export class PlanAIModule {}