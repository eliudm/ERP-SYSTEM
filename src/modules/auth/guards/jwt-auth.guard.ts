import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: unknown,
    user: { posOnly?: boolean } | undefined,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    void info;
    void status;

    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (!user.posOnly) {
      return user as TUser;
    }

    const request = context.switchToHttp().getRequest<{
      path?: string;
      method?: string;
    }>();

    const path = request.path ?? '';
    const method = (request.method ?? 'GET').toUpperCase();
    const isSalesRoute = path.startsWith('/api/v1/sales/');
    const isPosInventoryRead =
      method === 'GET' &&
      (path === '/api/v1/inventory/products' ||
        path === '/api/v1/inventory/warehouses' ||
        path === '/api/v1/inventory/categories');
    const isOwnProfileRoute = path === '/api/v1/auth/profile';
    const isSystemSettingsRead =
      method === 'GET' && path === '/api/v1/settings/system';
    // The mobile app's own POS data/sync endpoints — equivalent to the
    // inventory reads already allowed above, just shaped for the mobile
    // client instead of the web one.
    const isMobilePosRead =
      method === 'GET' &&
      (path === '/api/v1/mobile/pos-data' ||
        path === '/api/v1/mobile/sync-status');

    if (
      isSalesRoute ||
      isPosInventoryRead ||
      isOwnProfileRoute ||
      isSystemSettingsRead ||
      isMobilePosRead
    ) {
      return user as TUser;
    }

    throw new ForbiddenException(
      'This account is limited to Point of Sale module access only',
    );
  }
}
