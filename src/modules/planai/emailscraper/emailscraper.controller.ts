import {
    Controller, Post, Get, Body, Query, UseGuards,
    HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmailScraperService } from './emailscraper.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

class SearchEmailsDto {
    domain?: string;
    company?: string;
    industry?: string;
    location?: string;
    state?: string;
    title?: string;
    saveToListId?: string;
    limit?: number;
}

@ApiTags('Email Scraper')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('planai/emailscraper')
export class EmailScraperController {
    constructor(private readonly emailScraperService: EmailScraperService) { }

    @Post('search')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Search for emails by domain, company, or industry' })
    searchEmails(@Body() dto: SearchEmailsDto, @CurrentUser() user: { id: string }) {
        return this.emailScraperService.searchEmails(dto, user.id);
    }

    @Post('verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify a single email address' })
    verifyEmail(@Body('email') email: string, @CurrentUser() user: { id: string }) {
        return this.emailScraperService.verifyEmail(email);
    }

    @Post('bulk-verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Bulk verify multiple email addresses' })
    bulkVerify(@Body('emails') emails: string[], @CurrentUser() user: { id: string }) {
        return this.emailScraperService.bulkVerify(emails, user.id);
    }

    @Get('leads')
    @ApiOperation({ summary: 'Get user leads with pagination and filters' })
    getLeads(
        @CurrentUser() user: { id: string },
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('listId') listId?: string,
        @Query('status') status?: string,
    ) {
        return this.emailScraperService.getUserLeads(user.id, page, listId, status);
    }

    @Get('leads/export')
    @ApiOperation({ summary: 'Export leads as CSV or JSON' })
    exportLeads(
        @CurrentUser() user: { id: string },
        @Query('listId') listId?: string,
        @Query('format') format: 'csv' | 'json' = 'csv',
    ) {
        return this.emailScraperService.exportLeads(user.id, listId, format);
    }

    @Post('lists')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new lead list' })
    createList(@Body() dto: { name: string; description?: string }, @CurrentUser() user: { id: string }) {
        return this.emailScraperService.createList(dto.name, dto.description, user.id);
    }

    @Get('lists')
    @ApiOperation({ summary: 'Get all user lead lists' })
    getLists(@CurrentUser() user: { id: string }) {
        return this.emailScraperService.getUserLists(user.id);
    }

    @Get('jobs')
    @ApiOperation({ summary: 'Get recent scrape job history' })
    getScrapeJobs(@CurrentUser() user: { id: string }) {
        return this.emailScraperService.getUserJobs(user.id);
    }
}