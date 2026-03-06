import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaginationDto, ApiPaginatedResponse } from '@bbv/nestjs-pagination';
import { CurrentUser, Public } from '@bbv/nestjs-auth';
import { ItemsService } from './items.service';

@ApiTags('Items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Public()
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.itemsService.findAll(pagination);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }

  @Post()
  create(
    @Body() body: { name: string; description?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.itemsService.create({ ...body, createdBy: userId });
  }
}
