import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { getCurrentTenantId } from '../../tenant-context';
import {
  RegisterDto,
  LoginDto,
  UpdateUserAccessDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
} from './dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

const REFRESH_TOKEN_BYTES = 40;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private refreshTokenTtlMs(): number {
    const days = Number(this.config.get('REFRESH_TOKEN_EXPIRES_DAYS', '30'));
    return days * 24 * 60 * 60 * 1000;
  }

  private async generateUniqueTenantSlug(base: string): Promise<string> {
    const normalized =
      base
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'company';

    let slug = normalized;
    let suffix = 0;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${normalized}-${suffix}`;
    }
    return slug;
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(rawToken),
        expiresAt: new Date(Date.now() + this.refreshTokenTtlMs()),
      },
    });
    return rawToken;
  }

  // ─── REFRESH ACCESS TOKEN ────────────────────────────────
  async refreshTokens(rawToken: string) {
    const tokenHash = this.hashRefreshToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Rotate: revoke the used token and issue a brand new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.signToken(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.user.posOnly,
      stored.user.firstName,
      stored.user.lastName,
    );
  }

  // ─── LOGOUT (revoke refresh token) ───────────────────────
  async logout(rawToken: string) {
    const tokenHash = this.hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out' };
  }

  // ─── REGISTER ───────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Registering creates a brand-new company (tenant). Adding further users
    // to an existing company goes through POST /auth/users (createUser)
    // instead, which inherits the calling admin's tenant automatically.
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.companyName?.trim() || `${dto.firstName} ${dto.lastName}`,
        slug: await this.generateUniqueTenantSlug(
          dto.companyName || `${dto.firstName}-${dto.lastName}`,
        ),
      },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
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
        // joins the calling admin's own company
        tenantId: getCurrentTenantId()!,
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

  // ─── SET PIN (self-service, for quick register unlock) ───
  async setPin(userId: string, pin: string) {
    const hashed = await bcrypt.hash(pin, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pin: hashed },
    });
    return { message: 'PIN set' };
  }

  // ─── VERIFY PIN (re-authenticates an already-signed-in,
  // already-locked session — does not issue new tokens) ────
  async verifyPin(userId: string, pin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.pin) {
      throw new UnauthorizedException('No PIN has been set for this account');
    }

    const match = await bcrypt.compare(pin, user.pin);
    if (!match) {
      throw new UnauthorizedException('Incorrect PIN');
    }
    return { valid: true };
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

    const [token, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.issueRefreshToken(userId),
    ]);

    return {
      access_token: token,
      refresh_token: refreshToken,
      user: { id: userId, email, role, posOnly, firstName, lastName },
    };
  }
}
