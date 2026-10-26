import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma.service';

jest.mock('bcrypt');

const mockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof mockPrisma>;
  let jwt: { signAsync: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    config = { get: jest.fn().mockReturnValue('30') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('signed.jwt.token');
    config.get.mockReturnValue('30');
  });

  const user = {
    id: 'user-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    password: 'hashed-password',
    role: Role.SALES_USER,
    posOnly: false,
    isActive: true,
    createdAt: new Date(),
  };

  describe('register', () => {
    const dto = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: Role.SALES_USER,
    };

    it('should create a user and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({ id: 'tenant-1' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Jane Doe' }),
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: 'hashed-password',
          role: dto.role,
        },
      });
      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.refresh_token).toBeDefined();
      expect(result.user.email).toBe(dto.email);
    });

    it('should throw ConflictException if email already in use', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { email: 'jane@example.com', password: 'password123' };

    it('should return tokens on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(dto);

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.user.id).toBe(user.id);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is deactivated', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return the user profile', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile(user.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: user.id } }),
      );
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      prisma.user.findMany.mockResolvedValue([user]);

      const result = await service.getAllUsers();

      expect(result).toEqual([user]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate the user', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, isActive: false });

      const result = await service.deactivateUser(user.id);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivateUser('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserAccess', () => {
    it('should update posOnly flag', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, posOnly: true });

      const result = await service.updateUserAccess(user.id, { posOnly: true });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { posOnly: true },
        }),
      );
      expect(result.posOnly).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserAccess('missing', { posOnly: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUser', () => {
    const dto = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      password: 'password123',
      role: Role.ADMIN,
    };

    it('should create a user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({ ...user, ...dto, password: 'hashed-password' });

      const result = await service.createUser(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            password: 'hashed-password',
            posOnly: false,
          }),
        }),
      );
      expect(result.email).toBe(dto.email);
    });

    it('should default posOnly to the provided value when set', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(user);

      await service.createUser({ ...dto, posOnly: true });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ posOnly: true }),
        }),
      );
    });

    it('should throw ConflictException if email already in use', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update only provided fields', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, firstName: 'Updated' });

      const result = await service.updateUser(user.id, { firstName: 'Updated' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { firstName: 'Updated' },
        }),
      );
      expect(result.firstName).toBe('Updated');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser('missing', { firstName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('should hash and update the password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(user);

      const result = await service.resetPassword(user.id, {
        newPassword: 'newpassword123',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { password: 'new-hashed-password' },
      });
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('missing', { newPassword: 'newpassword123' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPin', () => {
    it('should hash and store the pin', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pin');
      prisma.user.update.mockResolvedValue(user);

      const result = await service.setPin(user.id, '1234');

      expect(bcrypt.hash).toHaveBeenCalledWith('1234', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { pin: 'hashed-pin' },
      });
      expect(result).toEqual({ message: 'PIN set' });
    });
  });

  describe('verifyPin', () => {
    it('should resolve valid:true when the pin matches', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, pin: 'hashed-pin' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyPin(user.id, '1234');

      expect(bcrypt.compare).toHaveBeenCalledWith('1234', 'hashed-pin');
      expect(result).toEqual({ valid: true });
    });

    it('should throw UnauthorizedException when the pin does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, pin: 'hashed-pin' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyPin(user.id, '0000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when no pin has been set', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, pin: null });

      await expect(service.verifyPin(user.id, '1234')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyPin('missing', '1234')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('refreshTokens', () => {
    const stored = {
      id: 'rt-1',
      tokenHash: 'hash',
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      user,
    };

    it('should rotate the refresh token and return a new token pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(stored);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens('raw-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: stored.id },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.refresh_token).toBeDefined();
    });

    it('should throw UnauthorizedException if token not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token is revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...stored,
        revokedAt: new Date(),
      });

      await expect(service.refreshTokens('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...stored,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refreshTokens('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if account is deactivated', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...stored,
        user: { ...user, isActive: false },
      });

      await expect(service.refreshTokens('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke the matching non-revoked refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('raw-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ message: 'Logged out' });
    });
  });
});
