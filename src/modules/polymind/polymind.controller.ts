import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard, AuthedApiRequest } from "../api/api-key/api-key.guard";
import { ApiRateLimitGuard } from "../api/rate-limit/api-rate-limit.guard";
import { ApiScopes } from "../../common/decorators/api-scopes.decorator";
import { PolymindService } from "./polymind.service";
import {
  POLYMIND_PROVIDERS,
  PolyMindProvider,
  PolyMindQueryDto,
} from "./polymind.dto";

@Controller("polymind")
@UseGuards(ApiKeyGuard, ApiRateLimitGuard)
@ApiScopes("polymind:query")
export class PolymindController {
  constructor(private readonly polymind: PolymindService) {}

  @Post(":provider")
  query(
    @Param("provider") provider: string,
    @Body() dto: PolyMindQueryDto,
    @Req() req: AuthedApiRequest,
  ) {
    if (!POLYMIND_PROVIDERS.includes(provider as PolyMindProvider)) {
      throw new ForbiddenException(
        `Unsupported provider "${provider}". Valid: ${POLYMIND_PROVIDERS.join(", ")}`,
      );
    }
    return this.polymind.query(
      provider as PolyMindProvider,
      dto,
      req.apiKeyUserId,
      "extension",
    );
  }

  @Get("history")
  history(
    @Req() req: AuthedApiRequest,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.polymind.history(
      req.apiKeyUserId,
      page,
      Math.min(pageSize, 50),
    );
  }
}
