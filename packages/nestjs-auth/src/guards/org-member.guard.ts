import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PRISMA_SERVICE) private readonly prisma: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      return false;
    }

    const orgId = request.params.id;
    if (!orgId) {
      return false;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
      select: {
        role: true,
        organizationId: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found');
    }

    // Check org-level role requirement
    const requiredOrgRoles = this.reflector.getAllAndOverride<string[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredOrgRoles && requiredOrgRoles.length > 0) {
      if (!requiredOrgRoles.includes(membership.role)) {
        throw new ForbiddenException('Insufficient organization role');
      }
    }

    // Attach membership info for downstream use
    request.orgMembership = {
      role: membership.role,
      organizationId: membership.organizationId,
    };

    return true;
  }
}
