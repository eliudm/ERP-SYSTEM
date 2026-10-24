import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = () => ({
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
  getAllUsers: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  resetPassword: jest.fn(),
  deactivateUser: jest.fn(),
  updateUserAccess: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(async () => {
    authService = mockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should delegate to authService.register', async () => {
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: Role.SALES_USER,
      };
      const expected = { access_token: 'token' };
      authService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('login', () => {
    it('should delegate to authService.login', async () => {
      const dto = { email: 'jane@example.com', password: 'password123' };
      const expected = { access_token: 'token' };
      authService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('refresh', () => {
    it('should delegate to authService.refreshTokens with the raw token', async () => {
      const dto = { refreshToken: 'raw-token' };
      const expected = { access_token: 'new-token' };
      authService.refreshTokens.mockResolvedValue(expected);

      const result = await controller.refresh(dto);

      expect(authService.refreshTokens).toHaveBeenCalledWith('raw-token');
      expect(result).toBe(expected);
    });
  });

  describe('logout', () => {
    it('should delegate to authService.logout with the raw token', async () => {
      const dto = { refreshToken: 'raw-token' };
      const expected = { message: 'Logged out' };
      authService.logout.mockResolvedValue(expected);

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith('raw-token');
      expect(result).toBe(expected);
    });
  });

  describe('getProfile', () => {
    it('should delegate to authService.getProfile with the user id', async () => {
      const expected = { id: 'user-1', email: 'jane@example.com' };
      authService.getProfile.mockResolvedValue(expected);

      const result = await controller.getProfile('user-1');

      expect(authService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });
  });

  describe('getAllUsers', () => {
    it('should delegate to authService.getAllUsers', async () => {
      const expected = [{ id: 'user-1' }];
      authService.getAllUsers.mockResolvedValue(expected);

      const result = await controller.getAllUsers();

      expect(authService.getAllUsers).toHaveBeenCalled();
      expect(result).toBe(expected);
    });
  });

  describe('createUser', () => {
    it('should delegate to authService.createUser', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        password: 'password123',
        role: Role.ADMIN,
      };
      const expected = { id: 'user-2' };
      authService.createUser.mockResolvedValue(expected);

      const result = await controller.createUser(dto);

      expect(authService.createUser).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('updateUser', () => {
    it('should delegate to authService.updateUser with the user id and dto', async () => {
      const dto = { firstName: 'Updated' };
      const expected = { id: 'user-1', firstName: 'Updated' };
      authService.updateUser.mockResolvedValue(expected);

      const result = await controller.updateUser('user-1', dto);

      expect(authService.updateUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('resetPassword', () => {
    it('should delegate to authService.resetPassword with the user id and dto', async () => {
      const dto = { newPassword: 'newpassword123' };
      const expected = { message: 'Password reset successfully' };
      authService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword('user-1', dto);

      expect(authService.resetPassword).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('deactivateUser', () => {
    it('should delegate to authService.deactivateUser with the user id', async () => {
      const expected = { id: 'user-1', isActive: false };
      authService.deactivateUser.mockResolvedValue(expected);

      const result = await controller.deactivateUser('user-1');

      expect(authService.deactivateUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });
  });

  describe('updateUserAccess', () => {
    it('should delegate to authService.updateUserAccess with the user id and dto', async () => {
      const dto = { posOnly: true };
      const expected = { id: 'user-1', posOnly: true };
      authService.updateUserAccess.mockResolvedValue(expected);

      const result = await controller.updateUserAccess('user-1', dto);

      expect(authService.updateUserAccess).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });
  });
});
