import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ALLOW_POS_USER_KEY } from '../decorators/allow-pos-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();

    // Allow posOnly users through on routes that explicitly permit it
    const allowPosUser = this.reflector.getAllAndOverride<boolean>(
      ALLOW_POS_USER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowPosUser && user?.posOnly === true) return true;
    return requiredRoles.includes(user?.role);
  }
}
