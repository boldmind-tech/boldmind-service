// service/src/modules/storefronts/dto/storefronts.dto.ts

import {
  IsString, IsOptional, IsInt, IsBoolean, IsArray, IsEmail,
  IsUrl, IsIn, IsNotEmpty, IsNumber, Min, Max, MaxLength,
  MinLength, ValidateNested, ArrayMinSize, ArrayMaxSize, Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export const STORE_CATEGORIES = [
  'fashion', 'electronics', 'food-drinks', 'beauty-health', 'home-garden',
  'sports-outdoors', 'books-education', 'art-crafts', 'digital-products',
  'services', 'automobiles', 'agriculture', 'baby-kids', 'general',
];

export const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
];

// ─── STORE DTOs ───────────────────────────────────────────────────────────────

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /** Auto-generated from name if omitted */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers and hyphens' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(STORE_CATEGORIES, { message: `Category must be one of: ${STORE_CATEGORIES.join(', ')}` })
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsIn(NIGERIAN_STATES, { message: 'Must be a valid Nigerian state' })
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?234[0-9]{10}$|^0[7-9][0-1][0-9]{8}$/, {
    message: 'Enter a valid Nigerian phone number e.g. 08012345678 or +2348012345678',
  })
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex code e.g. #059669' })
  colorTheme?: string;

  /** logo / logoUrl — both accepted, service normalises to logoUrl */
  @IsOptional()
  @IsUrl({}, { message: 'Logo must be a valid URL' })
  @MaxLength(500)
  logo?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Logo must be a valid URL' })
  @MaxLength(500)
  logoUrl?: string;

  /** banner / coverImageUrl — both accepted */
  @IsOptional()
  @IsUrl({}, { message: 'Banner must be a valid URL' })
  @MaxLength(500)
  banner?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Cover image must be a valid URL' })
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  paystackSubAccount?: string;
}

import { StoreStatus } from '@prisma/client';

export class UpdateStoreDto extends PartialType(CreateStoreDto) {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'SUSPENDED'])
  status?: StoreStatus;

  /** Convenience bool → mapped to status ACTIVE / PAUSED internally */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── PRODUCT DTOs ─────────────────────────────────────────────────────────────

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * price in Kobo (₦1 = 100 kobo) — canonical field.
   * Provide either `price` (kobo) OR `priceNGN` (naira). Service normalises both.
   */
  @IsOptional()
  @IsInt({ message: 'price must be an integer in Kobo (e.g. ₦500 = 50000 kobo)' })
  @Min(100, { message: 'Minimum price is ₦1 (100 kobo)' })
  @Max(10_000_000_00)
  price?: number;

  /** priceNGN in Naira — alias kept for backward compat with old planai controller */
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Minimum price is ₦1' })
  priceNGN?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  comparePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  /** stock / stockQuantity — both accepted */
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  /** imageUrls / images — both accepted */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Maximum 10 images per product' })
  @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(10)
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isDigital?: boolean;

  @IsOptional()
  @IsUrl({}, { message: 'Download URL must be a valid URL' })
  downloadUrl?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── ORDER DTOs ───────────────────────────────────────────────────────────────

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(1000)
  quantity: number;
}

export class DeliveryAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsIn(NIGERIAN_STATES, { message: 'Must be a valid Nigerian state' })
  state: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lga: string;
}

export class PlaceOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must have at least one item' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  customerEmail: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?234[0-9]{10}$|^0[7-9][0-1][0-9]{8}$/, {
    message: 'Enter a valid Nigerian phone number',
  })
  customerPhone?: string;

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress: DeliveryAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES, { message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  trackingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ─── QUERY DTOs ───────────────────────────────────────────────────────────────

export class GetProductsQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'newest', 'popular'])
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  maxPrice?: number;
}

export class GetOrdersQueryDto {
  @IsOptional()
  @IsIn([...ORDER_STATUSES, ''])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}