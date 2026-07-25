import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/user.decorator";
import { WebhookService } from "./webhook.service";
import { CreateWebhookDto } from "./webhook.dto";

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Controller("developer/webhooks")
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWebhookDto) {
    return this.webhookService.create(user.sub, dto.apiKeyId, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.webhookService.list(user.sub);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.webhookService.remove(user.sub, id);
  }
}
