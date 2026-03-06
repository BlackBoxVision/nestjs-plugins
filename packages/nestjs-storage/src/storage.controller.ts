import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { StorageService } from './storage.service';
import { UploadResult, GetUrlOptions } from './interfaces';

@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.log(
      `Received upload request for file "${file.originalname}"`,
    );

    return this.storageService.upload(file);
  }

  @Delete(':key')
  async delete(@Param('key') key: string): Promise<{ deleted: boolean }> {
    this.logger.log(`Received delete request for key "${key}"`);

    await this.storageService.delete(key);

    return { deleted: true };
  }

  @Get(':key/url')
  async getUrl(
    @Param('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<{ url: string }> {
    const options: GetUrlOptions = {};

    if (expiresIn) {
      const parsed = parseInt(expiresIn, 10);

      if (isNaN(parsed) || parsed <= 0) {
        throw new BadRequestException(
          'expiresIn must be a positive integer (seconds)',
        );
      }

      options.expiresIn = parsed;
    }

    const url = await this.storageService.getUrl(key, options);

    return { url };
  }
}
