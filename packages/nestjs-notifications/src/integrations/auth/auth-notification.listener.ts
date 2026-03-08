import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification.service';
import { TemplateService } from '../../templates/template.service';
import {
  AUTH_NOTIFICATION_CONFIG,
  AuthNotificationConfig,
} from './auth-notification.interfaces';

interface UserRegisteredEvent {
  userId: string;
  email: string;
  verificationToken?: string;
}

interface ForgotPasswordEvent {
  userId: string;
  email: string;
  resetToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class AuthNotificationListener {
  private readonly logger = new Logger(AuthNotificationListener.name);

  constructor(
    @Inject(AUTH_NOTIFICATION_CONFIG)
    private readonly config: AuthNotificationConfig,
    private readonly notificationService: NotificationService,
    private readonly templateService: TemplateService,
  ) {}

  @OnEvent('auth.user.registered')
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    try {
      if (event.verificationToken) {
        await this.sendVerifyEmail(event);
      } else {
        await this.sendWelcomeEmail(event);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle user registered event for ${event.email}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @OnEvent('auth.password.forgot')
  async handleForgotPassword(event: ForgotPasswordEvent): Promise<void> {
    try {
      const resetPath = this.config.resetPasswordPath ?? '/auth/reset-password?token={{token}}';
      const resetUrl = `${this.config.baseUrl}${resetPath.replace('{{token}}', event.resetToken)}`;
      const expiresInHours = Math.round(event.expiresInSeconds / 3600);
      const expiresIn = expiresInHours === 1 ? '1 hour' : `${expiresInHours} hours`;

      const templateName = this.config.templates?.passwordReset ?? 'password-reset';
      const html = this.templateService.render(templateName, 'email', {
        resetUrl,
        expiresIn,
      });

      await this.notificationService.send({
        userId: event.userId,
        channel: 'email',
        type: 'auth.password-reset',
        title: 'Reset Your Password',
        body: html,
        to: event.email,
      });

      this.logger.log(`Password reset email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${event.email}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async sendVerifyEmail(event: UserRegisteredEvent): Promise<void> {
    const verifyPath = this.config.verifyEmailPath ?? '/auth/verify-email?token={{token}}';
    const verifyUrl = `${this.config.baseUrl}${verifyPath.replace('{{token}}', event.verificationToken!)}`;

    const templateName = this.config.templates?.verifyEmail ?? 'verify-email';
    const html = this.templateService.render(templateName, 'email', {
      verifyUrl,
    });

    await this.notificationService.send({
      userId: event.userId,
      channel: 'email',
      type: 'auth.verify-email',
      title: 'Verify Your Email Address',
      body: html,
      to: event.email,
    });

    this.logger.log(`Verification email sent to ${event.email}`);
  }

  private async sendWelcomeEmail(event: UserRegisteredEvent): Promise<void> {
    const appName = this.config.appName ?? 'Our App';

    const templateName = this.config.templates?.welcome ?? 'welcome';
    const html = this.templateService.render(templateName, 'email', {
      name: event.email,
      actionUrl: this.config.baseUrl,
    });

    await this.notificationService.send({
      userId: event.userId,
      channel: 'email',
      type: 'auth.welcome',
      title: `Welcome to ${appName}`,
      body: html,
      to: event.email,
    });

    this.logger.log(`Welcome email sent to ${event.email}`);
  }
}
