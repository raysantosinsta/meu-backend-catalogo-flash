import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateProductDto, UpdateProductStatusDto } from './dto/product.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(tenantId: string, createProductDto: CreateProductDto, file?: Express.Multer.File) {
    let imageUrl = '';
    let imageKey = '';

    if (file) {
      const fileId = uuidv4();
      const ext = file.mimetype === 'image/webp' ? 'webp' : file.originalname.split('.').pop() || 'jpg';
      imageKey = `tenants/${tenantId}/${fileId}.${ext}`;
      
      const uploadResult = await this.storageService.uploadFile(file.buffer, imageKey, file.mimetype);
      imageUrl = uploadResult.url;
    } else {
      throw new BadRequestException('A imagem do produto é obrigatória.');
    }

    const price = typeof createProductDto.price === 'string' 
      ? parseFloat(createProductDto.price.replace(',', '.')) 
      : createProductDto.price;

    return this.prisma.product.create({
      data: {
        name: createProductDto.name,
        description: createProductDto.description,
        price,
        imageUrl,
        imageKey,
        isFeatured: createProductDto.isFeatured || false,
        tenantId,
      },
    });
  }

  async findAllByTenant(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
    return product;
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateProductStatusDto) {
    await this.findOne(tenantId, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const product = await this.findOne(tenantId, id);

    if (product.imageKey) {
      try {
        await this.storageService.deleteFile(product.imageKey);
      } catch (err) {
        console.error('Erro ao deletar imagem do Cloudflare R2:', err);
      }
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
