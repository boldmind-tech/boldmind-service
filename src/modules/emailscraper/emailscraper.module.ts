import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { EmailScraperController } from './emailscraper.controller';
import { EmailScraperService } from './emailscraper.service';
import { EmailLeadSchema, ScrapeJobSchema, LeadListSchema } from './emailscraper.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'EmailLead', schema: EmailLeadSchema },
            { name: 'ScrapeJob', schema: ScrapeJobSchema },
            { name: 'LeadList', schema: LeadListSchema },
        ]),
        BullModule.registerQueue({ name: 'emailscraper' }),
    ],
    controllers: [EmailScraperController],
    providers: [EmailScraperService],
    exports: [EmailScraperService],
})
export class EmailScraperModule { }
