import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user's ID from the request object.
 *
 * Expects `req.user.id` to be populated by an authentication guard (e.g., JwtAuthGuard).
 * If no user is present on the request, returns `undefined`.
 *
 * @example
 * ```ts
 * @Get('methods')
 * async getMethods(@CurrentUser() userId: string) {
 *   return this.otpService.getEnabledMethods(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id;
  },
);
