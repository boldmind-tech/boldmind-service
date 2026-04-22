// service/src/modules/storefronts/storefronts.service.ts

import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { generateSlug } from '../../../common/utils/slug.util';
import { StoreStatus } from '@prisma/client';
import {
  CreateStoreDto, UpdateStoreDto,
  CreateProductDto, UpdateProductDto,
  PlaceOrderDto, UpdateOrderStatusDto,
  GetProductsQueryDto, GetOrdersQueryDto,
} from './dto/storefronts.dto';

@Injectable()
export class StorefrontsService {
  private readonly logger = new Logger(StorefrontsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // STORE — public
  // ══════════════════════════════════════════════════════════════

  /**
   * Public storefront page — includes store info + first-page products.
   * Cached 5 min in Redis.
   */
  async getPublicStore(slug: string) {
    const cacheKey = `store:public:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        products: {
          where: { isActive: true },
          take: 24,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { products: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status === 'SUSPENDED') throw new ForbiddenException('This store is currently suspended');

    await this.redis.setex(cacheKey, 300, JSON.stringify(store));
    return store;
  }

  /**
   * Paginated, filterable product list for a public storefront.
   * Identified by slug (not ID) so it works from the public URL.
   */
  async getStoreProducts(slug: string, query: GetProductsQueryDto) {
    const { page = 1, limit = 20, category, search, sort, minPrice, maxPrice } = query;

    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const where: Record<string, unknown> = { storeId: store.id, isActive: true };
    if (category) where.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderByMap: Record<string, unknown> = {
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      newest: { createdAt: 'desc' },
      popular: { createdAt: 'desc' }, // swap for viewCount/orderCount when available
    };
    const orderBy = orderByMap[sort ?? 'newest'] ?? { createdAt: 'desc' };
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ══════════════════════════════════════════════════════════════
  // STORE — owner CRUD
  // ══════════════════════════════════════════════════════════════

  async createStore(dto: CreateStoreDto, userId: string) {
    // Normalise logo / banner aliases
    const logoUrl = dto.logoUrl ?? dto.logo;
    const coverImageUrl = dto.coverImageUrl ?? dto.banner;

    const rawSlug = dto.slug ?? generateSlug(dto.name);

    // Ensure slug is unique, append counter if needed
    let slug = rawSlug;
    let attempt = 0;
    while (await this.prisma.store.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${rawSlug}-${attempt}`;
    }

    return this.prisma.store.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        category: dto.category,
        address: dto.address,
        state: dto.state,
        whatsappNumber: dto.whatsappNumber,
        colorTheme: dto.colorTheme,
        paystackSubAccount: dto.paystackSubAccount,
        logoUrl,
        coverImageUrl,
        userId,
        status: 'ACTIVE',
      },
    });
  }

  async getOwnerStores(userId: string) {
    return this.prisma.store.findMany({
      where: { userId },
      include: {
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStore(storeId: string, dto: UpdateStoreDto, userId: string) {
    const store = await this.assertStoreOwner(storeId, userId);

    const logoUrl = dto.logoUrl ?? dto.logo ?? undefined;
    const coverImageUrl = dto.coverImageUrl ?? dto.banner ?? undefined;

    let status: StoreStatus | undefined = dto.status;
    if (dto.isActive !== undefined && !status) {
      status = dto.isActive ? StoreStatus.ACTIVE : StoreStatus.PAUSED;
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.state ? { state: dto.state } : {}),
        ...(dto.whatsappNumber !== undefined ? { whatsappNumber: dto.whatsappNumber } : {}),
        ...(dto.colorTheme !== undefined ? { colorTheme: dto.colorTheme } : {}),
        ...(dto.paystackSubAccount !== undefined ? { paystackSubAccount: dto.paystackSubAccount } : {}),
        ...(logoUrl ? { logoUrl } : {}),
        ...(coverImageUrl ? { coverImageUrl } : {}),
        ...(status ? { status } : {}),
      },
    });

    await this.invalidateStoreCache(store.slug);
    return updated;
  }

  async deleteStore(storeId: string, userId: string) {
    const store = await this.assertStoreOwner(storeId, userId);

    // Soft check — warn if active orders exist
    const pendingOrders = await this.prisma.order.count({
      where: { storeId, status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED'] } },
    });
    if (pendingOrders > 0) {
      throw new BadRequestException(
        `Cannot delete store with ${pendingOrders} active order(s). Resolve them first.`,
      );
    }

    await this.prisma.store.delete({ where: { id: storeId } });
    await this.invalidateStoreCache(store.slug);
    return { message: 'Store deleted successfully' };
  }

  // ══════════════════════════════════════════════════════════════
  // PRODUCTS
  // ══════════════════════════════════════════════════════════════

  async addProduct(storeId: string, dto: CreateProductDto, userId: string) {
    await this.assertStoreOwner(storeId, userId);

    // Normalise price: prefer `price` (kobo), fallback to priceNGN * 100
    const price = dto.price ?? (dto.priceNGN !== undefined ? Math.round(dto.priceNGN * 100) : undefined);
    if (!price) throw new BadRequestException('Either price (kobo) or priceNGN (naira) is required');

    const images = dto.imageUrls ?? dto.images ?? [];
    const stock = dto.stock ?? dto.stockQuantity ?? 0;

    return this.prisma.product.create({
      data: {
        storeId,
        name: dto.name,
        description: dto.description,
        price,
        comparePrice: dto.comparePrice,
        category: dto.category,
        sku: dto.sku,
        stock,
        trackInventory: dto.trackInventory ?? stock > 0,
        imageUrls: images,
        tags: dto.tags ?? [],
        weight: dto.weight,
        isActive: true,
        metadata: {
          isDigital: dto.isDigital ?? false,
          downloadUrl: dto.downloadUrl ?? null,
        },
      },
    });
  }

  async getProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { select: { id: true, name: true, slug: true, colorTheme: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async updateProduct(
    storeId: string,
    productId: string,
    dto: UpdateProductDto,
    userId: string,
  ) {
    await this.assertStoreOwner(storeId, userId);
    await this.assertProductBelongsToStore(productId, storeId);

    const price =
      dto.price !== undefined
        ? dto.price
        : dto.priceNGN !== undefined
          ? Math.round(dto.priceNGN * 100)
          : undefined;

    const images = dto.imageUrls ?? dto.images;
    const stock = dto.stock ?? dto.stockQuantity;

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(dto.comparePrice !== undefined ? { comparePrice: dto.comparePrice } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(stock !== undefined ? { stock } : {}),
        ...(dto.trackInventory !== undefined ? { trackInventory: dto.trackInventory } : {}),
        ...(images !== undefined ? { imageUrls: images } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isDigital !== undefined || dto.downloadUrl !== undefined
          ? { metadata: { isDigital: dto.isDigital, downloadUrl: dto.downloadUrl ?? null } }
          : {}),
      },
    });
  }

  async deleteProduct(storeId: string, productId: string, userId: string) {
    await this.assertStoreOwner(storeId, userId);
    await this.assertProductBelongsToStore(productId, storeId);

    // Check if product has unfulfilled orders
    const pendingOrderItems = await this.prisma.orderItem.count({
      where: {
        productId,
        order: { status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED'] } },
      },
    });
    if (pendingOrderItems > 0) {
      // Soft-delete: deactivate rather than hard delete
      await this.prisma.product.update({ where: { id: productId }, data: { isActive: false } });
      return { message: 'Product deactivated (has active orders — cannot hard delete)' };
    }

    await this.prisma.product.delete({ where: { id: productId } });
    return { message: 'Product deleted' };
  }

  // ══════════════════════════════════════════════════════════════
  // ORDERS
  // ══════════════════════════════════════════════════════════════

  async placeOrder(slug: string, dto: PlaceOrderDto) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status !== 'ACTIVE') throw new BadRequestException('This store is not currently accepting orders');

    // Validate all products exist, belong to the store, and have sufficient stock
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, storeId: store.id, isActive: true },
    });

    if (products.length !== productIds.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Product(s) not found or unavailable: ${missing.join(', ')}`);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Stock checks
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      if (product.trackInventory && product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.stock}`,
        );
      }
    }

    // Calculate totals (all in kobo)
    const subtotalKobo = dto.items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    // Generate human-readable order number e.g. BM-20260311-A3FX
    const orderNumber = `BM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Transactional: create order + decrement stock atomically
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          storeId: store.id,
          orderNumber,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          deliveryAddress: dto.deliveryAddress as any,
          notes: dto.notes,
          totalAmount: subtotalKobo, // delivery fee can be added later
          status: 'PENDING',
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              productName: productMap.get(item.productId)!.name,
              quantity: item.quantity,
              unitPrice: productMap.get(item.productId)!.price,
              totalPrice: productMap.get(item.productId)!.price * item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Decrement stock for tracked products
      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        if (product.trackInventory) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      return created;
    });

    // Invalidate store cache (product stock changed)
    await this.invalidateStoreCache(store.slug);

    return {
      ...order,
      message: 'Order placed successfully! The seller will contact you to confirm.',
      totalNGN: subtotalKobo / 100,
    };
  }

  async getStoreOrders(storeId: string, userId: string, query: GetOrdersQueryDto) {
    await this.assertStoreOwner(storeId, userId);

    const { status, page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { storeId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { name: true, imageUrls: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    // Enrich with Naira amounts
    const enriched = data.map((o) => ({
      ...o,
      totalNGN: o.totalAmount / 100,
      subtotalNGN: (o.totalAmount - o.shippingFee) / 100,
    }));

    return { data: enriched, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async updateOrderStatus(
    storeId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    userId: string,
  ) {
    await this.assertStoreOwner(storeId, userId);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Guard invalid state transitions
    this.assertValidStatusTransition(order.status, dto.status);

    // If cancelling a PENDING/CONFIRMED order — restore stock
    if (dto.status === 'CANCELLED' && ['PENDING', 'CONFIRMED'].includes(order.status)) {
      const items = await this.prisma.orderItem.findMany({ where: { orderId } });
      await this.prisma.$transaction(
        items.map((item) =>
          this.prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          }),
        ),
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status as never,
        ...(dto.trackingCode ? { trackingCode: dto.trackingCode } : {}),
        ...(dto.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(dto.status === 'SHIPPED' ? { shippedAt: new Date() } : {}),
      },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    return { ...updated, totalNGN: updated.totalAmount / 100 };
  }

  // ══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════

  async getStoreDashboard(storeId: string, userId: string) {
    await this.assertStoreOwner(storeId, userId);

    const cacheKey = `store:dashboard:${storeId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      productCount,
      activeProductCount,
      totalOrders,
      pendingOrders,
      thisMonthRevenue,
      lastMonthRevenue,
      totalRevenue,
      recentOrders,
      topProducts,
      ordersByStatus,
    ] = await Promise.all([
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.product.count({ where: { storeId, isActive: true } }),

      this.prisma.order.count({ where: { storeId } }),
      this.prisma.order.count({ where: { storeId, status: 'PENDING' } }),

      this.prisma.order.aggregate({
        where: { storeId, status: 'DELIVERED', createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId, status: 'DELIVERED', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: { storeId, status: 'DELIVERED' },
        _sum: { totalAmount: true },
      }),

      this.prisma.order.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, orderNumber: true, customerName: true,
          totalAmount: true, status: true, createdAt: true,
        },
      }),

      // Top selling products by order items
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { storeId } },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),

      // Orders grouped by status
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId },
        _count: true,
      }),
    ]);

    // Enrich top products with names
    const topProductIds = topProducts.map((p) => p.productId);
    const productNames = await this.prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, imageUrls: true },
    });
    const nameMap = new Map(productNames.map((p) => [p.id, p]));

    const thisMonthKobo = thisMonthRevenue._sum.totalAmount ?? 0;
    const lastMonthKobo = lastMonthRevenue._sum.totalAmount ?? 0;
    const revenueGrowth =
      lastMonthKobo > 0
        ? Math.round(((thisMonthKobo - lastMonthKobo) / lastMonthKobo) * 100)
        : thisMonthKobo > 0 ? 100 : 0;

    const dashboard = {
      overview: {
        totalProducts: productCount,
        activeProducts: activeProductCount,
        totalOrders,
        pendingOrders,
        totalRevenueKobo: totalRevenue._sum.totalAmount ?? 0,
        totalRevenueNGN: (totalRevenue._sum.totalAmount ?? 0) / 100,
      },
      thisMonth: {
        revenueKobo: thisMonthKobo,
        revenuNGN: thisMonthKobo / 100,
        revenueGrowthPercent: revenueGrowth,
      },
      ordersByStatus: ordersByStatus.reduce<Record<string, number>>(
        (acc, o) => { acc[o.status] = o._count; return acc; },
        {},
      ),
      recentOrders: recentOrders.map((o) => ({ ...o, totalNGN: o.totalAmount / 100 })),
      topProducts: topProducts.map((p) => ({
        product: nameMap.get(p.productId),
        totalSold: p._sum.quantity ?? 0,
        totalRevenueKobo: p._sum.totalPrice ?? 0,
        totalRevenueNGN: (p._sum.totalPrice ?? 0) / 100,
      })),
    };

    await this.redis.setex(cacheKey, 300, JSON.stringify(dashboard)); // 5 min cache
    return dashboard;
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════

  private async assertStoreOwner(storeId: string, userId: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, userId } });
    if (!store) throw new ForbiddenException('Store not found or access denied');
    return store;
  }

  private async assertProductBelongsToStore(productId: string, storeId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!product) throw new NotFoundException('Product not found in this store');
    return product;
  }

  /** Prevent nonsensical status transitions e.g. DELIVERED → PENDING */
  private assertValidStatusTransition(current: string, next: string) {
    const allowed: Record<string, string[]> = {
      PENDING:    ['CONFIRMED', 'CANCELLED'],
      CONFIRMED:  ['SHIPPED', 'CANCELLED'],
      SHIPPED:    ['DELIVERED', 'CANCELLED'],
      DELIVERED:  ['REFUNDED'],
      CANCELLED:  [],
      REFUNDED:   [],
    };
    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(
        `Cannot transition order from ${current} to ${next}. Allowed: ${allowed[current]?.join(', ') || 'none'}`,
      );
    }
  }

  private async invalidateStoreCache(slug: string) {
    await Promise.all([
      this.redis.del(`store:public:${slug}`),
    ]);
  }
}