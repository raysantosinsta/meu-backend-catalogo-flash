import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { MASTER_ADMIN_EMAIL } from '../auth/auth.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // Listagem de lojas: apenas o master admin
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    if (user.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new ForbiddenException('Apenas o administrador master pode listar todas as lojas.');
    }
    return this.tenantsService.findAll();
  }

  // Criação direta de tenant: apenas o master admin
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() createTenantDto: CreateTenantDto) {
    if (user.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new ForbiddenException('Apenas o administrador master pode cadastrar lojas.');
    }
    return this.tenantsService.create(createTenantDto);
  }

  // Endpoint público para vitrine: GET /tenants/:slug
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }
}

