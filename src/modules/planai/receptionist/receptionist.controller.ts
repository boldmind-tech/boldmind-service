// src/modules/receptionist/receptionist.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  RawBodyRequest,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { MetaWebhookService } from './metawebhook.service';
import { ReceptionistService } from './receptionist.service';
import { CreateReceptionistDto } from './dto/create-receptionist.dto';
import { UpdateReceptionistDto } from './dto/update-receptionist.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('AI Receptionist')
@Controller('receptionist')
export class ReceptionistController {
  constructor(
    private readonly webhookService: MetaWebhookService,
    private readonly receptionistService: ReceptionistService,
  ) { }

  // ─── META WEBHOOK ───────────────────────────────────────────────────────────

  @Public()
  @Get('webhook')
  @ApiOperation({ summary: 'Meta webhook verification (GET)' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.webhookService.verifyWebhook(mode, token, challenge);
    res.status(200).send(result);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta webhook event receiver (POST)' })
  async receiveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    return this.webhookService.processWebhook(payload, req.rawBody, signature);
  }

  // ─── RECEPTIONIST CONFIG (per business) ────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('setup')
  @ApiOperation({ summary: 'Create AI Receptionist for my business' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReceptionistDto) {
    return this.receptionistService.createReceptionist(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiOperation({ summary: 'Get my receptionist config' })
  getMine(@CurrentUser('id') userId: string) {
    return this.receptionistService.getMyReceptionist(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('my')
  @ApiOperation({ summary: 'Update my receptionist config' })
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateReceptionistDto) {
    return this.receptionistService.updateReceptionist(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('my/toggle')
  @ApiOperation({ summary: 'Toggle AI Receptionist on/off' })
  toggle(@CurrentUser('id') userId: string) {
    return this.receptionistService.toggleReceptionist(userId);
  }

  // ─── CONVERSATIONS ──────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations for my receptionist' })
  getConversations(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.receptionistService.getConversations(userId, { page: +page, limit: +limit, search });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('conversations/:phone')
  @ApiOperation({ summary: 'Get conversation thread by phone number' })
  getThread(@CurrentUser('id') userId: string, @Param('phone') phone: string) {
    return this.receptionistService.getConversationThread(userId, phone);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('conversations/:phone/reply')
  @ApiOperation({ summary: 'Send manual reply in a conversation' })
  manualReply(
    @CurrentUser('id') userId: string,
    @Param('phone') phone: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.receptionistService.sendManualReply(userId, phone, dto.message);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('conversations/:phone/resolve')
  @ApiOperation({ summary: 'Mark conversation as resolved' })
  resolve(@CurrentUser('id') userId: string, @Param('phone') phone: string) {
    return this.receptionistService.resolveConversation(userId, phone);
  }

  // ─── KNOWLEDGE BASE ─────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('knowledge')
  @ApiOperation({ summary: 'Add FAQ / knowledge base entry' })
  addKnowledge(
    @CurrentUser('id') userId: string,
    @Body() dto: { question: string; answer: string },
  ) {
    return this.receptionistService.addKnowledgeEntry(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('knowledge')
  getKnowledge(@CurrentUser('id') userId: string) {
    return this.receptionistService.getKnowledge(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('knowledge/:id')
  deleteKnowledge(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receptionistService.deleteKnowledgeEntry(userId, id);
  }

  // ─── ANALYTICS ──────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('analytics')
  @ApiOperation({ summary: 'Receptionist analytics dashboard' })
  analytics(@CurrentUser('id') userId: string) {
    return this.receptionistService.getAnalytics(userId);
  }

  // ─── ADMIN ──────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @Get('admin/all')
  @ApiOperation({ summary: '[Admin] List all receptionists' })
  adminList(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.receptionistService.adminListAll(+page, +limit);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @Patch('admin/:id/suspend')
  adminSuspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.receptionistService.adminSuspend(id);
  }
}