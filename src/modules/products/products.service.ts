import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateProductDto, UpdateProductStatusDto, UpdateProductDto } from './dto/product.dto';
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
      const ext = file.mimetype === 'image/webp' ? 'webp' : file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
      imageKey = `tenants/${tenantId}/${fileId}.${ext}`;
      
      const uploadResult = await this.storageService.uploadFile(
        file.buffer,
        imageKey,
        file.mimetype || 'image/jpeg',
      );
      imageUrl = uploadResult.url;
    } else {
      throw new BadRequestException('A imagem do produto é obrigatória.');
    }

    // Limpa caracteres monetários (ex: 'R$ 89,90' ou '89,90')
    const rawPrice = String(createProductDto.price).replace(/[^\d.,]/g, '').replace(',', '.');
    const price = parseFloat(rawPrice) || 0;

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

  async update(
    tenantId: string,
    id: string,
    updateProductDto: UpdateProductDto,
    file?: Express.Multer.File,
  ) {
    const product = await this.findOne(tenantId, id);

    let imageUrl = product.imageUrl;
    let imageKey = product.imageKey;

    if (file) {
      const fileId = uuidv4();
      const ext = file.mimetype === 'image/webp' ? 'webp' : file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
      const newImageKey = `tenants/${tenantId}/${fileId}.${ext}`;

      const uploadResult = await this.storageService.uploadFile(
        file.buffer,
        newImageKey,
        file.mimetype || 'image/jpeg',
      );
      imageUrl = uploadResult.url;
      imageKey = newImageKey;

      // Deleta imagem antiga do bucket se existia
      if (product.imageKey) {
        try {
          await this.storageService.deleteFile(product.imageKey);
        } catch (err) {
          console.error('Erro ao deletar imagem antiga do R2:', err);
        }
      }
    }

    let price = product.price;
    if (updateProductDto.price !== undefined && updateProductDto.price !== null && updateProductDto.price !== '') {
      const rawPrice = String(updateProductDto.price).replace(/[^\d.,]/g, '').replace(',', '.');
      const parsedPrice = parseFloat(rawPrice);
      if (!isNaN(parsedPrice)) {
        price = parsedPrice as any;
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(updateProductDto.name && { name: updateProductDto.name.trim() }),
        ...(updateProductDto.description !== undefined && { description: updateProductDto.description }),
        price,
        imageUrl,
        imageKey,
        ...(updateProductDto.isFeatured !== undefined && { isFeatured: updateProductDto.isFeatured }),
        ...(updateProductDto.isActive !== undefined && { isActive: updateProductDto.isActive }),
      },
    });
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
