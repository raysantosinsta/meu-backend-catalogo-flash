import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: createTenantDto.slug },
    });

    if (existing) {
      throw new ConflictException('Já existe uma loja cadastrada com este slug.');
    }

    return this.prisma.tenant.create({
      data: createTenantDto,
    });
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Loja não encontrada.');
    }

    const featuredProducts = tenant.products.filter((p) => p.isFeatured).slice(0, 10);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      whatsapp: tenant.whatsapp,
      logoUrl: tenant.logoUrl,
      featuredProducts,
      products: tenant.products,
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada.');
    }
    return tenant;
  }
}
