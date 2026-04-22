// service/src/modules/storefronts/storefronts.controller.ts

import {
  Controller, Post, Get, Patch, Delete, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam,
} from '@nestjs/swagger';
import { StorefrontsService } from './storefronts.service';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateProductDto,
  UpdateProductDto,
  PlaceOrderDto,
  UpdateOrderStatusDto,
  GetProductsQueryDto,
  GetOrdersQueryDto,
} from './dto/storefronts.dto';

@ApiTags('Storefronts')
@Controller('storefronts')
export class StorefrontsController {
  constructor(private readonly service: StorefrontsService) {}

  // ══════════════════════════════════════════════════════════════
  // PUBLIC — no auth required
  // ══════════════════════════════════════════════════════════════

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get public storefront by slug' })
  @ApiParam({ name: 'slug', example: 'ade-fashion-store' })
  getPublicStore(@Param('slug') slug: string) {
    return this.service.getPublicStore(slug);
  }

  @Public()
  @Get(':slug/products')
  @ApiOperation({ summary: 'List products in a storefront' })
  getStoreProducts(
    @Param('slug') slug: string,
    @Query() query: GetProductsQueryDto,
  ) {
    return this.service.getStoreProducts(slug, query);
  }

  @Public()
  @Get('products/:productId')
  @ApiOperation({ summary: 'Get a single product' })
  getProduct(@Param('productId') productId: string) {
    return this.service.getProduct(productId);
  }

  @Public()
  @Post(':slug/orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place an order on a storefront' })
  placeOrder(
    @Param('slug') slug: string,
    @Body() dto: PlaceOrderDto,
  ) {
    return this.service.placeOrder(slug, dto);
  }

  // ══════════════════════════════════════════════════════════════
  // OWNER — authenticated store management
  // ══════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new storefront' })
  createStore(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStoreDto,
  ) {
    return this.service.createStore(dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('owner/my-stores')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all my storefronts' })
  getMyStores(@CurrentUser('id') userId: string) {
    return this.service.getOwnerStores(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('owner/:storeId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a storefront' })
  updateStore(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.service.updateStore(storeId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('owner/:storeId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a storefront' })
  deleteStore(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.deleteStore(storeId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('owner/:storeId/dashboard')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get store analytics dashboard' })
  getDashboard(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.getStoreDashboard(storeId, userId);
  }

  // ── Products (owner) ─────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('owner/:storeId/products')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a product to a storefront' })
  addProduct(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.addProduct(storeId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('owner/:storeId/products/:productId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a product' })
  updateProduct(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.updateProduct(storeId, productId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('owner/:storeId/products/:productId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a product' })
  deleteProduct(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.deleteProduct(storeId, productId, userId);
  }

  // ── Orders (owner) ───────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('owner/:storeId/orders')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get orders for a storefront' })
  getOrders(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.service.getStoreOrders(storeId, userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('owner/:storeId/orders/:orderId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update order status' })
  updateOrderStatus(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.service.updateOrderStatus(storeId, orderId, dto, userId);
  }
}