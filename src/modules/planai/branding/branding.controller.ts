
import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { BrandingService } from './branding.service';
import {
    GenerateLogoDto,
    GenerateBrandKitDto,
    GenerateFlyerDto,
    GenerateColorPaletteDto,
} from '../dto/all-planai.dto';

@Controller('planai/branding')
@UseGuards(JwtAuthGuard)
export class BrandingController {
    constructor(private readonly brandingService: BrandingService) { }

    @Post('logo')
    generateLogo(
        @Body() dto: GenerateLogoDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.brandingService.generateLogo(dto, user.id);
    }

    @Post('brand-kit')
    generateBrandKit(
        @Body() dto: GenerateBrandKitDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.brandingService.generateBrandKit(dto, user.id);
    }

    @Post('flyer')
    generateMarketingFlyer(
        @Body() dto: GenerateFlyerDto,
        @CurrentUser() user: { id: string },
    ) {
        return this.brandingService.generateMarketingFlyer(dto, user.id);
    }

    @Post('color-palette')
    generateColorPalette(@Body() dto: GenerateColorPaletteDto) {
        return this.brandingService.generateColorPalette(dto);
    }

    @Get('jobs')
    listJobs(@CurrentUser() user: { id: string }) {
        return this.brandingService.listUserJobs(user.id);
    }
}