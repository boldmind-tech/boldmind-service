import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ApiKeyGuard, AuthedApiRequest } from "./api-key.guard";
import { CurrentUser } from "../../../common/decorators/user.decorator";
import { ApiKeyService } from "./api-key.service";
import { CreateApiKeyDto } from "./api-key.dto";

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Controller("developer/keys")
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.create(user.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: JwtPayload) {
    return this.apiKeyService.list(user.sub);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  revoke(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.apiKeyService.revoke(user.sub, id);
  }

  /** X-API-Key auth (not JWT) — lets a caller confirm their key is live. */
  @Get("validate")
  @UseGuards(ApiKeyGuard)
  validate(@Req() req: AuthedApiRequest) {
    return this.apiKeyService.validate(req.apiKey);
  }
}
