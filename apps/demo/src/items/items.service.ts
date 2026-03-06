import { Injectable } from '@nestjs/common';
import { PrismaService } from '@bbv/nestjs-prisma';
import { PaginationDto, PaginatedResponseDto, paginate } from '@bbv/nestjs-pagination';

export interface Item {
  id: string;
  name: string;
  description: string | null;
  imageKey: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<Item>> {
    return paginate<Item>({
      model: (this.prisma as Record<string, unknown>)['item'] as {
        findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
        count: (args: Record<string, unknown>) => Promise<number>;
      },
      pagination,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return (this.prisma as Record<string, unknown>)['item'];
  }

  async create(data: { name: string; description?: string; createdBy?: string }) {
    return (this.prisma as Record<string, unknown>)['item'];
  }
}
