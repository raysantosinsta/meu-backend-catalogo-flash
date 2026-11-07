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

  private verifyMasterToken(authHeader?: string): boolean {
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return false;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    } catch {
      return false;
    }
  }

  private async createTenantAndUser(registerDto: RegisterDto) {
    const isMasterEmail = registerDto.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: registerDto.tenantSlug.toLowerCase() },
    });

    if (existingTenant) {
      throw new ConflictException('Este slug de loja já está em uso.');
    }

    // Se for o e-mail do master admin e ele já existir no banco, vincula o master à nova loja
    if (isMasterEmail) {
      const masterUser = await this.prisma.user.findUnique({
        where: { email: MASTER_ADMIN_EMAIL.toLowerCase() },
      });

      if (masterUser) {
        let hashedPassword = masterUser.password;
        if (registerDto.password && registerDto.password.trim().length >= 6) {
          hashedPassword = await bcrypt.hash(registerDto.password, 10);
        }

        const tenant = await this.prisma.tenant.create({
          data: {
            name: registerDto.tenantName,
            slug: registerDto.tenantSlug.toLowerCase(),
            whatsapp: registerDto.whatsapp,
          },
        });

        const user = await this.prisma.user.update({
          where: { id: masterUser.id },
          data: {
            tenantId: tenant.id,
            password: hashedPassword,
          },
        });

        return { tenant, user };
      }
    }

    // Caso de novo usuário (lojista ou bootstrap inicial do master)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado.');
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

  // Registro: permitido para bootstrap inicial do master ou quando a requisição for autenticada pelo master admin
  async register(registerDto: RegisterDto, authHeader?: string) {
    const isMasterEmail = registerDto.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    const masterUser = await this.prisma.user.findUnique({
      where: { email: MASTER_ADMIN_EMAIL.toLowerCase() },
    });

    // 1. Caso bootstrap: master admin ainda não cadastrado no banco
    if (!masterUser && isMasterEmail) {
      const { tenant, user } = await this.createTenantAndUser(registerDto);
      const token = this.generateToken(user.id, user.email, tenant.id);
      return {
        accessToken: token,
        user: { id: user.id, email: user.email },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, whatsapp: tenant.whatsapp },
      };
    }

    // 2. Requisição autenticada com Bearer Token do administrador master
    const isMasterToken = this.verifyMasterToken(authHeader);

    // 3. Ou se informar o e-mail do master com a senha correta do master
    let isMasterCredentials = false;
    if (masterUser && isMasterEmail && registerDto.password) {
      isMasterCredentials = await bcrypt.compare(registerDto.password, masterUser.password);
    }

    if (isMasterToken || isMasterCredentials) {
      const { tenant, user } = await this.createTenantAndUser(registerDto);

      // Se a criação foi realizada pelo administrador master autenticado,
      // preservamos a sessão do master admin (santosray62@gmail.com) vinculado à nova loja
      if (isMasterToken && masterUser) {
        await this.prisma.user.update({
          where: { id: masterUser.id },
          data: { tenantId: tenant.id },
        });
        const masterToken = this.generateToken(masterUser.id, masterUser.email, tenant.id);
        return {
          accessToken: masterToken,
          user: { id: masterUser.id, email: masterUser.email },
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, whatsapp: tenant.whatsapp },
        };
      }

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
    const masterUser = await this.prisma.user.findUnique({
      where: { email: MASTER_ADMIN_EMAIL.toLowerCase() },
    });

    let token = this.generateToken(user.id, user.email, tenant.id);
    let activeUser = { id: user.id, email: user.email };

    if (masterUser) {
      await this.prisma.user.update({
        where: { id: masterUser.id },
        data: { tenantId: tenant.id },
      });
      token = this.generateToken(masterUser.id, masterUser.email, tenant.id);
      activeUser = { id: masterUser.id, email: masterUser.email };
    }

    return {
      message: 'Loja cadastrada com sucesso!',
      accessToken: token,
      user: activeUser,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, whatsapp: tenant.whatsapp },
    };
  }

  // Alternância de loja ativa para o administrador master
  async switchTenant(adminEmail: string, tenantId: string) {
    if (adminEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new ForbiddenException('Apenas o administrador master pode alternar entre lojas.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new ConflictException('Loja não encontrada.');
    }

    const user = await this.prisma.user.update({
      where: { email: adminEmail.toLowerCase() },
      data: { tenantId: tenant.id },
    });

    const token = this.generateToken(user.id, user.email, tenant.id);

    return {
      accessToken: token,
      user: { id: user.id, email: user.email },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        whatsapp: tenant.whatsapp,
        logoUrl: tenant.logoUrl,
      },
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
