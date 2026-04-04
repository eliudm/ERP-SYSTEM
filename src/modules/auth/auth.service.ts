import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import {
  RegisterDto,
  LoginDto,
  UpdateUserAccessDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
} from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ─── REGISTER ───────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
      },
    });

    // Return token
    return this.signToken(
      user.id,
      user.email,
      user.role,
      user.posOnly,
      user.firstName,
      user.lastName,
    );
  }

  // ─── LOGIN ──────────────────────────────────────────────
  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken(
      user.id,
      user.email,
      user.role,
      user.posOnly,
      user.firstName,
      user.lastName,
    );
  }

  // ─── GET PROFILE ────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        posOnly: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── GET ALL USERS (Admin only) ─────────────────────────
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        posOnly: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── DEACTIVATE USER (Admin only) ───────────────────────
  async deactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  // ─── UPDATE USER ACCESS (Admin only) ────────────────────
  async updateUserAccess(userId: string, dto: UpdateUserAccessDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { posOnly: dto.posOnly },
      select: {
        id: true,
        email: true,
        role: true,
        posOnly: true,
        isActive: true,
      },
    });
  }

  // ─── CREATE USER (Admin only) ────────────────────────────
  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashed,
        role: dto.role,
        posOnly: dto.posOnly ?? false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        posOnly: true,
        isActive: true,
        createdAt: true,
      },
    });
    return user;
  }

  // ─── UPDATE USER (Admin only) ────────────────────────────
  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.posOnly !== undefined && { posOnly: dto.posOnly }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        posOnly: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  // ─── RESET PASSWORD (Admin only) ─────────────────────────
  async resetPassword(userId: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { message: 'Password reset successfully' };
  }

  // ─── SIGN JWT TOKEN ──────────────────────────────────────
  private async signToken(
    userId: string,
    email: string,
    role: string,
    posOnly: boolean,
    firstName = '',
    lastName = '',
  ) {
    const payload = { sub: userId, email, role, posOnly, firstName, lastName };

    const token = await this.jwt.signAsync(payload);

    return {
      access_token: token,
      user: { id: userId, email, role, posOnly, firstName, lastName },
    };
  }
}
