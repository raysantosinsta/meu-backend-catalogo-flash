import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: registerDto.tenantSlug },
    });

    if (existingTenant) {
      throw new ConflictException('Este slug de loja já está em uso.');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: registerDto.tenantName,
        slug: registerDto.tenantSlug,
        whatsapp: registerDto.whatsapp,
        users: {
          create: {
            email: registerDto.email,
            password: hashedPassword,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = tenant.users[0];
    const token = this.generateToken(user.id, user.email, tenant.id);

    return {
      accessToken: token,
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
