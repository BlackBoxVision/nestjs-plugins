import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgMemberGuard } from './org-member.guard';

describe('OrgMemberGuard', () => {
  let guard: OrgMemberGuard;
  let reflector: Reflector;
  let prisma: any;

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {
      organizationMember: {
        findUnique: jest.fn(),
      },
    };
    guard = new OrgMemberGuard(reflector, prisma);
  });

  function createContext(user: any, orgId: string, orgRoles?: string[]): ExecutionContext {
    const request = {
      user,
      params: { id: orgId },
      orgMembership: undefined,
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(orgRoles);

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('should allow members of the organization', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: 'member',
      organizationId: 'org-1',
    });

    const context = createContext({ id: 'user-1' }, 'org-1');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('should throw NotFoundException for non-members', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);

    const context = createContext({ id: 'user-1' }, 'org-1');
    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should allow when org role matches', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: 'owner',
      organizationId: 'org-1',
    });

    const context = createContext({ id: 'user-1' }, 'org-1', ['owner', 'admin']);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('should throw ForbiddenException when org role does not match', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: 'member',
      organizationId: 'org-1',
    });

    const context = createContext({ id: 'user-1' }, 'org-1', ['owner']);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny when user has no id', async () => {
    const context = createContext({}, 'org-1');
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});
