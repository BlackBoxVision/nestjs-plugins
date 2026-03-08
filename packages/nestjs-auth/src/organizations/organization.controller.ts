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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OrganizationsFeatureGuard } from '../guards/feature-enabled.guard';
import { OrgMemberGuard } from '../guards/org-member.guard';
import { OrgRoles } from '../decorators/org-roles.decorator';
import { AuthenticatedUser } from '../interfaces';

import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(OrganizationsFeatureGuard, JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() body: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.create(body.name, body.slug, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations for the current user' })
  @ApiResponse({ status: 200, description: 'List of organizations returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.findAll(user.id);
  }

  @UseGuards(OrgMemberGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a member of this organization' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @UseGuards(OrgMemberGuard)
  @OrgRoles('owner', 'admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires owner or admin role' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, body);
  }

  @UseGuards(OrgMemberGuard)
  @OrgRoles('owner', 'admin')
  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires owner or admin role' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async addMember(
    @Param('id') orgId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.organizationService.addMember(orgId, body.userId, body.role);
  }

  @UseGuards(OrgMemberGuard)
  @OrgRoles('owner')
  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'userId', description: 'ID of the user to remove' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires owner role' })
  @ApiResponse({ status: 404, description: 'Organization or member not found' })
  async removeMember(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
  ) {
    await this.organizationService.removeMember(orgId, userId);
    return { success: true };
  }
}
