import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  UpdateUserAccessDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
} from './dto';
import { GetUser } from './decorators/get-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@GetUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateUser(@Param('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(userId, dto);
  }

  @Post('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  resetPassword(@Param('id') userId: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(userId, dto);
  }

  @Patch('users/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deactivateUser(@Param('id') userId: string) {
    return this.authService.deactivateUser(userId);
  }

  @Patch('users/:id/access')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateUserAccess(
    @Param('id') userId: string,
    @Body() dto: UpdateUserAccessDto,
  ) {
    return this.authService.updateUserAccess(userId, dto);
  }
}
