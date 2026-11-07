import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductStatusDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024, // Suporta imagens até 15MB
      },
    }),
  )
  create(
    @CurrentTenant() tenantId: string,
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productsService.create(tenantId, createProductDto, file);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.productsService.findAllByTenant(tenantId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.productsService.findOne(tenantId, id);
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024, // Suporta imagens até 15MB
      },
    }),
  )
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.update(tenantId, id, updateProductDto, file);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    }),
  )
  patchUpdate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.update(tenantId, id, updateProductDto, file);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.productsService.remove(tenantId, id);
  }
}
