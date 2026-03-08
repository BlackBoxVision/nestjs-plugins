import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';

import { StorageService } from './storage.service';
import { StorageFeatureGuard } from './guards/feature-enabled.guard';
import { UploadResult, GetUrlOptions } from './interfaces';

/** Requires a global authentication guard (e.g., JwtAuthGuard). Guard enforcement is the consumer's responsibility. */
@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(StorageFeatureGuard)
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file', description: 'Upload a single file to the configured storage provider' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'No file provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Delete a file', description: 'Delete a file from storage by its key' })
  @ApiParam({ name: 'key', description: 'Storage key of the file to delete' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async delete(@Param('key') key: string): Promise<{ deleted: boolean }> {
    this.logger.log(`Received delete request for key "${key}"`);

    await this.storageService.delete(key);

    return { deleted: true };
  }

  @Get(':key/url')
  @ApiOperation({ summary: 'Get a signed URL', description: 'Generate a signed URL for accessing a file by its key' })
  @ApiParam({ name: 'key', description: 'Storage key of the file' })
  @ApiResponse({ status: 200, description: 'Signed URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid expiresIn parameter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
