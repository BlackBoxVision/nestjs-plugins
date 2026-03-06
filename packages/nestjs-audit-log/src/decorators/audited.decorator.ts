import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../audit-log.service';
import { auditContextStorage } from '../middleware/prisma-audit.middleware';

export const AUDIT_ACTION_KEY = 'AUDIT_ACTION';

export function Audited(action?: string): MethodDecorator {
  return applyDecorators(
    SetMetadata(AUDIT_ACTION_KEY, action),
    UseInterceptors(AuditedInterceptor),
  );
}

@Injectable()
export class AuditedInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const auditAction =
      Reflect.getMetadata(AUDIT_ACTION_KEY, handler) ??
      `${controller.name}.${handler.name}`;

    const request = context.switchToHttp().getRequest();
    const auditContext = auditContextStorage.getStore();

    return next.handle().pipe(
      tap((responseData) => {
        const entity = request.params?.entity ?? controller.name.replace('Controller', '');
        const entityId = request.params?.id ?? request.params?.entityId;

        this.auditLogService.log({
          userId:
            auditContext?.userId ??
            request.user?.id ??
            request.user?.sub,
          action: auditAction,
          entity,
          entityId: entityId?.toString(),
          metadata: {
            method: request.method,
            path: request.url,
            params: request.params,
            query: request.query,
          },
          ipAddress:
            auditContext?.ipAddress ??
            request.ip,
          userAgent:
            auditContext?.userAgent ??
            request.headers?.['user-agent'],
        });
      }),
    );
  }
}
