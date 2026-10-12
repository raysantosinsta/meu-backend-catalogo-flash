import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens.',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  whatsapp: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}
