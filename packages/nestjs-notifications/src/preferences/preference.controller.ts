import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PreferenceService } from './preference.service';
import { PreferencesFeatureGuard } from '../guards/feature-enabled.guard';
import { UpsertPreferenceDto } from '../dto/upsert-preference.dto';

/** Requires a global authentication guard (e.g., JwtAuthGuard). Guard enforcement is the consumer's responsibility. */
@ApiTags('Notification Preferences')
@ApiBearerAuth()
@UseGuards(PreferencesFeatureGuard)
@Controller('notification-preferences')
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  @Get()
  @ApiOperation({ summary: 'Get notification preferences for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPreferences(@Req() req: Request & { user: { id: string } }) {
    return this.preferenceService.getPreferences(req.user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update a notification preference' })
  @ApiResponse({ status: 200, description: 'Preference upserted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upsertPreference(
    @Req() req: Request & { user: { id: string } },
    @Body() body: UpsertPreferenceDto,
  ) {
    return this.preferenceService.upsertPreference(
      req.user.id,
      body.channel,
      body.type,
      body.enabled,
    );
  }
}
