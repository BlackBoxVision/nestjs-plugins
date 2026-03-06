import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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

  render(
    templateName: string,
    channel: string,
    data: Record<string, unknown>,
  ): string {
    const cacheKey = `${channel}:${templateName}`;

    let compiledTemplate = this.cache.get(cacheKey);

    if (!compiledTemplate) {
      const source = this.loadTemplate(templateName, channel);
      compiledTemplate = Handlebars.compile(source);
      this.cache.set(cacheKey, compiledTemplate);
    }

    return compiledTemplate(data);
  }

  private loadTemplate(templateName: string, channel: string): string {
    // Resolution order: project templateDir -> built-in defaults
    const fileName = templateName.endsWith('.hbs')
      ? templateName
      : `${templateName}.hbs`;

    if (this.projectDir) {
      const projectPath = path.join(this.projectDir, channel, fileName);
      if (fs.existsSync(projectPath)) {
        this.logger.debug(
          `Loading template from project dir: ${projectPath}`,
        );
        return fs.readFileSync(projectPath, 'utf-8');
      }

      // Also check without channel subdirectory
      const projectPathFlat = path.join(this.projectDir, fileName);
      if (fs.existsSync(projectPathFlat)) {
        this.logger.debug(
          `Loading template from project dir: ${projectPathFlat}`,
        );
        return fs.readFileSync(projectPathFlat, 'utf-8');
      }
    }

    // Fall back to built-in defaults
    const defaultPath = path.join(this.defaultsDir, fileName);
    if (fs.existsSync(defaultPath)) {
      this.logger.debug(
        `Loading template from defaults: ${defaultPath}`,
      );
      return fs.readFileSync(defaultPath, 'utf-8');
    }

    throw new Error(
      `Template "${templateName}" not found for channel "${channel}"`,
    );
  }
}
