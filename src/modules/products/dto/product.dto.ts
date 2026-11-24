import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNotEmpty()
  price: number | string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAffiliate?: boolean;

  @IsString()
  @IsOptional()
  affiliateUrl?: string;
}

export class UpdateProductStatusDto {
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  price?: number | string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || (value === 'false' ? false : value))
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || (value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || (value === 'false' ? false : value))
  @IsBoolean()
  isAffiliate?: boolean;

  @IsString()
  @IsOptional()
  affiliateUrl?: string;
}
