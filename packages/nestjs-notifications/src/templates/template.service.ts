import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import {
  NOTIFICATION_MODULE_OPTIONS,
  type NotificationModuleOptions,
} from '../interfaces';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly maxCacheSize = 100;
  private readonly defaultsDir: string;
  private readonly projectDir: string | undefined;

  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
  ) {
    this.defaultsDir = path.join(__dirname, 'defaults');

    const emailConfig = this.options.channels.email;
    if (emailConfig && emailConfig.enabled && emailConfig.templateDir) {
      this.projectDir = emailConfig.templateDir;
    }
  }

  async render(
    templateName: string,
    channel: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const cacheKey = `${channel}:${templateName}`;

    let compiledTemplate = this.cache.get(cacheKey);

    if (!compiledTemplate) {
      const source = await this.loadTemplate(templateName, channel);
      compiledTemplate = Handlebars.compile(source);

      // FIFO eviction when cache exceeds max size
      if (this.cache.size >= this.maxCacheSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) {
          this.cache.delete(oldestKey);
        }
      }

      this.cache.set(cacheKey, compiledTemplate);
    }

    return compiledTemplate(data);
  }

  private async loadTemplate(templateName: string, channel: string): Promise<string> {
    // Reject template names containing path traversal sequences
    if (templateName.includes('..')) {
      throw new BadRequestException(
        `Invalid template name "${templateName}": path traversal is not allowed`,
      );
    }

    // Resolution order: project templateDir -> built-in defaults
    const fileName = templateName.endsWith('.hbs')
      ? templateName
      : `${templateName}.hbs`;

    if (this.projectDir) {
      const projectPath = path.join(this.projectDir, channel, fileName);
      const resolvedProjectPath = path.resolve(projectPath);
      const resolvedProjectDir = path.resolve(this.projectDir);

      if (!resolvedProjectPath.startsWith(resolvedProjectDir + path.sep) && resolvedProjectPath !== resolvedProjectDir) {
        throw new BadRequestException(
          `Invalid template path: resolved path escapes the template directory`,
        );
      }

      try {
        await fs.promises.access(projectPath);
        this.logger.debug(
          `Loading template from project dir: ${projectPath}`,
        );
        return await fs.promises.readFile(projectPath, 'utf-8');
      } catch {
        // File not found, continue to next resolution path
      }

      // Also check without channel subdirectory
      const projectPathFlat = path.join(this.projectDir, fileName);
      try {
        await fs.promises.access(projectPathFlat);
        this.logger.debug(
          `Loading template from project dir: ${projectPathFlat}`,
        );
        return await fs.promises.readFile(projectPathFlat, 'utf-8');
      } catch {
        // File not found, continue to defaults
      }
    }

    // Fall back to built-in defaults
    const defaultPath = path.join(this.defaultsDir, fileName);
    try {
      await fs.promises.access(defaultPath);
      this.logger.debug(
        `Loading template from defaults: ${defaultPath}`,
      );
      return await fs.promises.readFile(defaultPath, 'utf-8');
    } catch {
      throw new Error(
        `Template "${templateName}" not found for channel "${channel}"`,
      );
    }
  }
}
