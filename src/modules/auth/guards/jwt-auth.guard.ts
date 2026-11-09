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
    user: { posOnly?: boolean; role?: string } | undefined,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    void info;
    void status;

    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest<{
      path?: string;
      method?: string;
    }>();
    const path = request.path ?? '';
    const method = (request.method ?? 'GET').toUpperCase();

    // Non-ADMIN, non-SALES_USER roles may view sales data but cannot create/modify sales records
    if (!user.posOnly) {
      const role = user.role ?? 'SALES_USER';
      const canSell = role === 'ADMIN' || role === 'SALES_USER';
      const isSalesWrite =
        !canSell &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        path.startsWith('/api/v1/sales/');

      if (isSalesWrite) {
        throw new ForbiddenException(
          'Only Sales and Admin users can create or modify sales records. Contact your administrator.',
        );
      }

      return user as TUser;
    }

    // posOnly path: restrict to POS-related routes only
    const isSalesRoute = path.startsWith('/api/v1/sales/');
    const isPosInventoryRead =
      method === 'GET' &&
      (path === '/api/v1/inventory/products' ||
        path === '/api/v1/inventory/warehouses' ||
        path === '/api/v1/inventory/categories');
    const isOwnProfileRoute =
      path === '/api/v1/auth/profile' ||
      path === '/api/v1/auth/set-pin' ||
      path === '/api/v1/auth/verify-pin';
    const isSystemSettingsRead =
      method === 'GET' && path === '/api/v1/settings/system';
    // The mobile app's own POS data/sync endpoints — equivalent to the
    // inventory reads already allowed above, just shaped for the mobile
    // client instead of the web one.
    const isMobilePosRead =
      method === 'GET' &&
      (path === '/api/v1/mobile/pos-data' ||
        path === '/api/v1/mobile/sync-status');
    // A cashier needs the compliant receipt for every sale they ring up —
    // RolesGuard already permits SALES_USER on these two routes, this guard
    // just hadn't been updated to match, so a posOnly cashier only ever saw
    // a provisional QR fallback.
    const isOwnEtimsReceiptRead =
      method === 'GET' &&
      /^\/api\/v1\/etims\/invoice\/[^/]+\/(qr|status)$/.test(path);

    if (
      isSalesRoute ||
      isPosInventoryRead ||
      isOwnProfileRoute ||
      isSystemSettingsRead ||
      isMobilePosRead ||
      isOwnEtimsReceiptRead
    ) {
      return user as TUser;
    }

    throw new ForbiddenException(
      'This account is limited to Point of Sale module access only',
    );
  }
}
