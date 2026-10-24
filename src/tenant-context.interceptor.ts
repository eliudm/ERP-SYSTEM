import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { tenantContextStorage } from './tenant-context';

/**
 * Runs the rest of the request (every downstream service/Prisma call) inside
 * an AsyncLocalStorage scope carrying req.user.tenantId, so
 * tenant-scoping.extension.ts can read it without the tenantId having to be
 * passed through every function signature. No-ops for unauthenticated
 * requests (req.user absent) — those simply run unscoped.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { tenantId?: string } }>();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      tenantContextStorage.run({ tenantId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
