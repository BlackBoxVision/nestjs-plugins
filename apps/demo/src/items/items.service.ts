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

  private get itemModel() {
    return (this.prisma as unknown as Record<string, unknown>)['item'] as {
      findMany: (args: Record<string, unknown>) => Promise<Item[]>;
      count: (args: Record<string, unknown>) => Promise<number>;
      findUnique: (args: Record<string, unknown>) => Promise<Item | null>;
      create: (args: Record<string, unknown>) => Promise<Item>;
    };
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponseDto<Item>> {
    return paginate<Item>({
      model: this.itemModel,
      pagination,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.itemModel.findUnique({ where: { id } });
  }

  async create(data: { name: string; description?: string; createdBy?: string }) {
    return this.itemModel.create({ data });
  }
}
