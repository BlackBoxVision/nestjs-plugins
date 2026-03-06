import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthenticatedUser } from '../interfaces';

import { OrganizationService } from './organization.service';

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(
    @Body() body: { name: string; slug: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.create(body.name, body.slug, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string; logoUrl?: string },
  ) {
    return this.organizationService.update(id, body);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') orgId: string,
    @Body() body: { userId: string; role?: string },
  ) {
    return this.organizationService.addMember(orgId, body.userId, body.role);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
  ) {
    await this.organizationService.removeMember(orgId, userId);
    return { success: true };
  }
}
