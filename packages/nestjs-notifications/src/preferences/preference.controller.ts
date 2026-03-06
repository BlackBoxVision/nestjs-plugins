import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { PreferenceService } from './preference.service';

interface UpsertPreferenceBody {
  channel: string;
  type: string;
  enabled: boolean;
}

@Controller('notification-preferences')
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  @Get()
  async getPreferences(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;

    return this.preferenceService.getPreferences(userId);
  }

  @Put()
  async upsertPreference(
    @Req() req: any,
    @Body() body: UpsertPreferenceBody,
  ) {
    const userId = req.user?.id ?? req.user?.sub;

    return this.preferenceService.upsertPreference(
      userId,
      body.channel,
      body.type,
      body.enabled,
    );
  }
}
