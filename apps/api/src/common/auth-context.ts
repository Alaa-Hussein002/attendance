import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

export interface AuthCtx { userId: string; companyId: string; role: string }

/** Identity comes ONLY from the verified JWT (set by JwtAuthGuard). Tenant scoping never comes from request bodies. */
export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthCtx => ctx.switchToHttp().getRequest().user);

export function requireRole(ctx: AuthCtx, ...roles: string[]) {
  if (!roles.includes(ctx.role)) throw new ForbiddenException('FORBIDDEN_ROLE');
}
