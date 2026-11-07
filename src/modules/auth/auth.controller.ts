import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Headers, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() registerDto: RegisterDto,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.authService.register(registerDto, authHeader);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/create-store')
  createStore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() registerDto: RegisterDto,
  ) {
    return this.authService.createStoreAsMaster(user.email, registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-tenant/:tenantId')
  switchTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') tenantId: string,
  ) {
    return this.authService.switchTenant(user.email, tenantId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
