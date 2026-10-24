import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  UpdateUserAccessDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from './dto';
import { GetUser } from './decorators/get-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Log in with credentials and receive access/refresh tokens' })
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Exchange a refresh token for a new set of tokens' })
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Log out and invalidate the given refresh token' })
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Get the profile of the currently authenticated user' })
  @ApiBearerAuth()
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@GetUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiBearerAuth()
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllUsers() {
    return this.authService.getAllUsers();
  }

  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiBearerAuth()
  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @ApiOperation({ summary: 'Update a user\'s details (admin only)' })
  @ApiBearerAuth()
  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateUser(@Param('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(userId, dto);
  }

  @ApiOperation({ summary: 'Reset a user\'s password (admin only)' })
  @ApiBearerAuth()
  @Post('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  resetPassword(@Param('id') userId: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(userId, dto);
  }

  @ApiOperation({ summary: 'Deactivate a user account (admin only)' })
  @ApiBearerAuth()
  @Patch('users/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deactivateUser(@Param('id') userId: string) {
    return this.authService.deactivateUser(userId);
  }

  @ApiOperation({ summary: 'Update a user\'s role/access level (admin only)' })
  @ApiBearerAuth()
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
