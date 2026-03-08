import { SetMetadata } from '@nestjs/common';

export const ORG_ROLES_KEY = 'org_roles';
export const OrgRoles = (...roles: string[]) =>
  SetMetadata(ORG_ROLES_KEY, roles);
