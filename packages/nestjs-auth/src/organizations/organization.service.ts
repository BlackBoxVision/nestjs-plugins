import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';
import { ROLES } from '../constants';

export interface OrganizationMemberUser {
  id: string;
  email: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user: OrganizationMemberUser;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: OrganizationMember[];
}

export interface OrganizationBasic {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrganizationService {
  private readonly prisma: any;

  constructor(
    @Inject(PRISMA_SERVICE)
    prisma: any,
  ) {
    this.prisma = prisma;
  }

  async create(
    name: string,
    slug: string,
    userId: string,
  ): Promise<Organization> {
    const existing = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('An organization with this slug already exists');
    }

    return this.prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId,
            role: ROLES.OWNER,
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });
  }

  async findAll(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
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
      take: 100,
    });
  }

  async findOne(id: string): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async update(
    id: string,
    data: { name?: string; slug?: string; logoUrl?: string },
  ): Promise<OrganizationBasic> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (data.slug && data.slug !== org.slug) {
      const slugTaken = await this.prisma.organization.findUnique({
        where: { slug: data.slug },
      });

      if (slugTaken) {
        throw new ConflictException('An organization with this slug already exists');
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async addMember(
    organizationId: string,
    userId: string,
    role: string = ROLES.MEMBER,
  ): Promise<OrganizationMember> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this organization');
    }

    return this.prisma.organizationMember.create({
      data: {
        userId,
        organizationId,
        role,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  async removeMember(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.role === ROLES.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: {
          organizationId,
          role: ROLES.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last owner of an organization',
        );
      }
    }

    await this.prisma.organizationMember.delete({
      where: { id: membership.id },
    });
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<OrganizationMember> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.organizationMember.update({
      where: { id: membership.id },
      data: { role },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }
}
