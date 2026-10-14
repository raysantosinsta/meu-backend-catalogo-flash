import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export const MASTER_ADMIN_EMAIL = 'santosray62@gmail.com';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async createTenantAndUser(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: registerDto.tenantSlug.toLowerCase() },
    });

    if (existingTenant) {
      throw new ConflictException('Este slug de loja já está em uso.');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: registerDto.tenantName,
        slug: registerDto.tenantSlug.toLowerCase(),
        whatsapp: registerDto.whatsapp,
        users: {
          create: {
            email: registerDto.email.toLowerCase(),
            password: hashedPassword,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = tenant.users[0];
    return { tenant, user };
  }

  // Registro público: somente permitido para bootstrap inicial do master admin caso ainda não exista no banco
  async register(registerDto: RegisterDto) {
    const isMasterEmail = registerDto.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    const masterExists = await this.prisma.user.findUnique({
      where: { email: MASTER_ADMIN_EMAIL.toLowerCase() },
    });

    if (!masterExists && isMasterEmail) {
      const { tenant, user } = await this.createTenantAndUser(registerDto);
      const token = this.generateToken(user.id, user.email, tenant.id);
      return {
        accessToken: token,
        user: { id: user.id, email: user.email },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, whatsapp: tenant.whatsapp },
      };
    }

    throw new ForbiddenException(
      'O auto-cadastro público está desativado. Somente o administrador master pode cadastrar novas lojas.',
    );
  }

  // Criação de novas lojas por parte do administrador master autenticado
  async createStoreAsMaster(adminEmail: string, registerDto: RegisterDto) {
    if (adminEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new ForbiddenException('Apenas o administrador master pode cadastrar novas lojas.');
    }

    const { tenant, user } = await this.createTenantAndUser(registerDto);

    return {
      message: 'Loja cadastrada com sucesso!',
      user: { id: user.id, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, whatsapp: tenant.whatsapp },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const token = this.generateToken(user.id, user.email, user.tenantId);

    return {
      accessToken: token,
      user: { id: user.id, email: user.email },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        whatsapp: user.tenant.whatsapp,
        logoUrl: user.tenant.logoUrl,
      },
    };
  }

  private generateToken(userId: string, email: string, tenantId: string): string {
    const payload: JwtPayload = { sub: userId, email, tenantId };
    return this.jwtService.sign(payload);
  }
}
