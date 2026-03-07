import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: jest.Mocked<Pick<
    OrganizationService,
    'create' | 'findAll' | 'findOne' | 'update' | 'addMember' | 'removeMember'
  >>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
    };

    controller = new OrganizationController(
      service as unknown as OrganizationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.create with name, slug, and user id', async () => {
      const body = { name: 'Acme Corp', slug: 'acme-corp' };
      const user = { id: 'user-1', email: 'test@test.com' } as any;
      const expected = { id: 'org-1', ...body, members: [] };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(body, user);

      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith(
        body.name,
        body.slug,
        user.id,
      );
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from the service', async () => {
      const body = { name: 'Acme', slug: 'acme' };
      const user = { id: 'user-1' } as any;
      service.create.mockRejectedValue(new Error('conflict'));

      await expect(controller.create(body, user)).rejects.toThrow('conflict');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with user id', async () => {
      const user = { id: 'user-1' } as any;
      const orgs = [
        { id: 'org-1', name: 'Org 1' },
        { id: 'org-2', name: 'Org 2' },
      ];
      service.findAll.mockResolvedValue(orgs);

      const result = await controller.findAll(user);

      expect(result).toEqual(orgs);
      expect(service.findAll).toHaveBeenCalledWith(user.id);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no organizations', async () => {
      const user = { id: 'user-1' } as any;
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(user);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the organization id', async () => {
      const orgId = 'org-1';
      const org = { id: orgId, name: 'Acme', members: [] };
      service.findOne.mockResolvedValue(org);

      const result = await controller.findOne(orgId);

      expect(result).toEqual(org);
      expect(service.findOne).toHaveBeenCalledWith(orgId);
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(new Error('not found'));

      await expect(controller.findOne('missing')).rejects.toThrow('not found');
    });
  });

  describe('update', () => {
    it('should call service.update with id and body', async () => {
      const orgId = 'org-1';
      const body = { name: 'Updated Name', slug: 'updated-slug' };
      const updated = { id: orgId, ...body };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(orgId, body);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(orgId, body);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('should support partial updates with only name', async () => {
      const orgId = 'org-1';
      const body = { name: 'New Name' };
      service.update.mockResolvedValue({ id: orgId, ...body });

      await controller.update(orgId, body);

      expect(service.update).toHaveBeenCalledWith(orgId, body);
    });

    it('should support partial updates with logoUrl', async () => {
      const orgId = 'org-1';
      const body = { logoUrl: 'https://example.com/logo.png' };
      service.update.mockResolvedValue({ id: orgId, ...body });

      await controller.update(orgId, body);

      expect(service.update).toHaveBeenCalledWith(orgId, body);
    });

    it('should propagate errors from the service', async () => {
      service.update.mockRejectedValue(new Error('conflict'));

      await expect(
        controller.update('org-1', { slug: 'taken' }),
      ).rejects.toThrow('conflict');
    });
  });

  describe('addMember', () => {
    it('should call service.addMember with orgId, userId, and role', async () => {
      const orgId = 'org-1';
      const body = { userId: 'user-2', role: 'admin' };
      const member = {
        userId: body.userId,
        organizationId: orgId,
        role: body.role,
      };
      service.addMember.mockResolvedValue(member);

      const result = await controller.addMember(orgId, body);

      expect(result).toEqual(member);
      expect(service.addMember).toHaveBeenCalledWith(
        orgId,
        body.userId,
        body.role,
      );
      expect(service.addMember).toHaveBeenCalledTimes(1);
    });

    it('should pass undefined role when not provided in body', async () => {
      const orgId = 'org-1';
      const body = { userId: 'user-2' } as { userId: string; role?: string };
      service.addMember.mockResolvedValue({ userId: body.userId });

      await controller.addMember(orgId, body);

      expect(service.addMember).toHaveBeenCalledWith(
        orgId,
        body.userId,
        undefined,
      );
    });

    it('should propagate errors from the service', async () => {
      service.addMember.mockRejectedValue(new Error('already a member'));

      await expect(
        controller.addMember('org-1', { userId: 'user-2' }),
      ).rejects.toThrow('already a member');
    });
  });

  describe('removeMember', () => {
    it('should call service.removeMember and return success true', async () => {
      const orgId = 'org-1';
      const userId = 'user-2';
      service.removeMember.mockResolvedValue(undefined);

      const result = await controller.removeMember(orgId, userId);

      expect(result).toEqual({ success: true });
      expect(service.removeMember).toHaveBeenCalledWith(orgId, userId);
      expect(service.removeMember).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from the service', async () => {
      service.removeMember.mockRejectedValue(new Error('not found'));

      await expect(
        controller.removeMember('org-1', 'user-2'),
      ).rejects.toThrow('not found');
    });
  });
});
