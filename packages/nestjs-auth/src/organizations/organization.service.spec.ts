import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new OrganizationService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const name = 'Acme Corp';
    const slug = 'acme-corp';
    const userId = 'user-1';

    it('should create an organization with owner member when slug is available', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      const createdOrg = {
        id: 'org-1',
        name,
        slug,
        members: [{ userId, role: 'owner', user: { id: userId, email: 'a@b.com' } }],
      };
      prisma.organization.create.mockResolvedValue(createdOrg);

      const result = await service.create(name, slug, userId);

      expect(result).toEqual(createdOrg);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug },
      });
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          name,
          slug,
          members: {
            create: {
              userId,
              role: 'owner',
            },
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
      });
    });

    it('should throw ConflictException when slug already exists', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'existing', slug });

      await expect(service.create(name, slug, userId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(name, slug, userId)).rejects.toThrow(
        'An organization with this slug already exists',
      );
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const userId = 'user-1';

    it('should return organizations where the user is a member', async () => {
      const orgs = [
        { id: 'org-1', name: 'Org 1', members: [{ userId, role: 'owner' }] },
        { id: 'org-2', name: 'Org 2', members: [{ userId, role: 'member' }] },
      ];
      prisma.organization.findMany.mockResolvedValue(orgs);

      const result = await service.findAll(userId);

      expect(result).toEqual(orgs);
      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: { userId },
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return an empty array when user has no organizations', async () => {
      prisma.organization.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    const orgId = 'org-1';

    it('should return the organization when found', async () => {
      const org = {
        id: orgId,
        name: 'Acme',
        members: [{ userId: 'user-1', role: 'owner' }],
      };
      prisma.organization.findUnique.mockResolvedValue(org);

      const result = await service.findOne(orgId);

      expect(result).toEqual(org);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: orgId },
        include: {
          members: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
      });
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne(orgId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(orgId)).rejects.toThrow(
        'Organization not found',
      );
    });
  });

  describe('update', () => {
    const orgId = 'org-1';
    const existingOrg = { id: orgId, name: 'Acme', slug: 'acme' };

    it('should update the organization when it exists and no slug conflict', async () => {
      const updateData = { name: 'Acme Updated' };
      const updatedOrg = { ...existingOrg, ...updateData };
      prisma.organization.findUnique.mockResolvedValue(existingOrg);
      prisma.organization.update.mockResolvedValue(updatedOrg);

      const result = await service.update(orgId, updateData);

      expect(result).toEqual(updatedOrg);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: orgId },
        data: updateData,
      });
    });

    it('should update the organization when slug is changed and not taken', async () => {
      const updateData = { slug: 'new-slug' };
      const updatedOrg = { ...existingOrg, slug: 'new-slug' };
      prisma.organization.findUnique
        .mockResolvedValueOnce(existingOrg)
        .mockResolvedValueOnce(null);
      prisma.organization.update.mockResolvedValue(updatedOrg);

      const result = await service.update(orgId, updateData);

      expect(result).toEqual(updatedOrg);
      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.organization.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'new-slug' },
      });
    });

    it('should not check slug uniqueness when slug is unchanged', async () => {
      const updateData = { slug: 'acme' };
      prisma.organization.findUnique.mockResolvedValue(existingOrg);
      prisma.organization.update.mockResolvedValue(existingOrg);

      await service.update(orgId, updateData);

      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should not check slug uniqueness when slug is not provided', async () => {
      const updateData = { name: 'New Name' };
      prisma.organization.findUnique.mockResolvedValue(existingOrg);
      prisma.organization.update.mockResolvedValue({
        ...existingOrg,
        name: 'New Name',
      });

      await service.update(orgId, updateData);

      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.update(orgId, { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(orgId, { name: 'Updated' }),
      ).rejects.toThrow('Organization not found');
    });

    it('should throw ConflictException when new slug is already taken', async () => {
      prisma.organization.findUnique
        .mockResolvedValueOnce(existingOrg)
        .mockResolvedValueOnce({ id: 'other-org', slug: 'taken-slug' });

      await expect(
        service.update(orgId, { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    const organizationId = 'org-1';
    const userId = 'user-2';
    const role = 'member';

    it('should add a member to the organization', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: organizationId });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      const createdMember = {
        userId,
        organizationId,
        role,
        user: { id: userId, email: 'user@test.com' },
      };
      prisma.organizationMember.create.mockResolvedValue(createdMember);

      const result = await service.addMember(organizationId, userId, role);

      expect(result).toEqual(createdMember);
      expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });
      expect(prisma.organizationMember.create).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId,
          role,
        },
        include: {
          user: { select: { id: true, email: true } },
        },
      });
    });

    it('should use default role "member" when role is not provided', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: organizationId });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      prisma.organizationMember.create.mockResolvedValue({
        userId,
        organizationId,
        role: 'member',
      });

      await service.addMember(organizationId, userId);

      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'member' }),
        }),
      );
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember(organizationId, userId, role),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.addMember(organizationId, userId, role),
      ).rejects.toThrow('Organization not found');
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user is already a member', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: organizationId });
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId,
        organizationId,
        role: 'member',
      });

      await expect(
        service.addMember(organizationId, userId, role),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addMember(organizationId, userId, role),
      ).rejects.toThrow('User is already a member of this organization');
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    const organizationId = 'org-1';
    const userId = 'user-2';

    it('should remove a non-owner member successfully', async () => {
      const membership = {
        id: 'member-1',
        userId,
        organizationId,
        role: 'member',
      };
      prisma.organizationMember.findUnique.mockResolvedValue(membership);
      prisma.organizationMember.delete.mockResolvedValue(membership);

      await service.removeMember(organizationId, userId);

      expect(prisma.organizationMember.delete).toHaveBeenCalledWith({
        where: { id: membership.id },
      });
    });

    it('should remove an owner when there are multiple owners', async () => {
      const membership = {
        id: 'member-1',
        userId,
        organizationId,
        role: 'owner',
      };
      prisma.organizationMember.findUnique.mockResolvedValue(membership);
      prisma.organizationMember.count.mockResolvedValue(2);
      prisma.organizationMember.delete.mockResolvedValue(membership);

      await service.removeMember(organizationId, userId);

      expect(prisma.organizationMember.count).toHaveBeenCalledWith({
        where: {
          organizationId,
          role: 'owner',
        },
      });
      expect(prisma.organizationMember.delete).toHaveBeenCalledWith({
        where: { id: membership.id },
      });
    });

    it('should not check owner count for non-owner members', async () => {
      const membership = {
        id: 'member-1',
        userId,
        organizationId,
        role: 'member',
      };
      prisma.organizationMember.findUnique.mockResolvedValue(membership);
      prisma.organizationMember.delete.mockResolvedValue(membership);

      await service.removeMember(organizationId, userId);

      expect(prisma.organizationMember.count).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when membership does not exist', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember(organizationId, userId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeMember(organizationId, userId),
      ).rejects.toThrow('Membership not found');
      expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when removing the last owner', async () => {
      const membership = {
        id: 'member-1',
        userId,
        organizationId,
        role: 'owner',
      };
      prisma.organizationMember.findUnique.mockResolvedValue(membership);
      prisma.organizationMember.count.mockResolvedValue(1);

      await expect(
        service.removeMember(organizationId, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeMember(organizationId, userId),
      ).rejects.toThrow(
        'Cannot remove the last owner of an organization',
      );
      expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    const organizationId = 'org-1';
    const userId = 'user-2';
    const newRole = 'admin';

    it('should update the member role when membership exists', async () => {
      const membership = {
        id: 'member-1',
        userId,
        organizationId,
        role: 'member',
      };
      const updatedMember = {
        ...membership,
        role: newRole,
        user: { id: userId, email: 'user@test.com' },
      };
      prisma.organizationMember.findUnique.mockResolvedValue(membership);
      prisma.organizationMember.update.mockResolvedValue(updatedMember);

      const result = await service.updateMemberRole(
        organizationId,
        userId,
        newRole,
      );

      expect(result).toEqual(updatedMember);
      expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
      });
      expect(prisma.organizationMember.update).toHaveBeenCalledWith({
        where: { id: membership.id },
        data: { role: newRole },
        include: {
          user: { select: { id: true, email: true } },
        },
      });
    });

    it('should throw NotFoundException when membership does not exist', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(organizationId, userId, newRole),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateMemberRole(organizationId, userId, newRole),
      ).rejects.toThrow('Membership not found');
      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });
  });
});
