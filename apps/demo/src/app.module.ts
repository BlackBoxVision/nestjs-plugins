import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '@bbv/nestjs-prisma';
import { AuthModule, JwtAuthGuard, PermissionsGuard } from '@bbv/nestjs-auth';
import { OtpModule } from '@bbv/nestjs-otp';
import { StorageModule } from '@bbv/nestjs-storage';
import { NotificationModule, AuthNotificationModule } from '@bbv/nestjs-notifications';
import { AuditLogModule } from '@bbv/nestjs-audit-log';
import { LoggerModule } from '@bbv/nestjs-logger';
import { AppController } from './app.controller';
import { ItemsModule } from './items/items.module';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    EventEmitterModule.forRoot(),

    LoggerModule.forRoot({
      prettyPrint: process.env.NODE_ENV !== 'production',
    }),

    PrismaModule.forRoot({ isGlobal: true }),

    AuthModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        jwt: {
          secret: config.getOrThrow('JWT_SECRET'),
          expiresIn: '7d',
        },
        features: {
          emailPassword: true,
          google: !!config.get('GOOGLE_CLIENT_ID'),
          organizations: true,
          emailVerification: true,
          passwordReset: true,
          sessionManagement: true,
          twoFactor: true,
        },
        twoFactorJwt: {
          challengeTokenSecret: config.get(
            '2FA_CHALLENGE_SECRET',
            config.getOrThrow('JWT_SECRET'),
          ),
          challengeTokenExpiresIn: '5m',
        },
        providers: {
          ...(config.get('GOOGLE_CLIENT_ID')
            ? {
                google: {
                  clientId: config.getOrThrow('GOOGLE_CLIENT_ID'),
                  clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
                  callbackUrl: '/auth/google/callback',
                },
              }
            : {}),
        },
        permissions: {
          rolePermissions: {
            admin: ['*'],
            owner: ['org:*', 'items:*', 'audit:*', 'notifications:*', 'storage:*'],
            member: ['items:read', 'items:create', 'notifications:read', 'notifications:manage'],
            user: ['items:read', 'items:create', 'notifications:read'],
          },
          superAdminRoles: ['admin'],
        },
        defaultAdminEmail: config.get('ADMIN_EMAIL'),
      }),
      inject: [ConfigService],
    }),

    OtpModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        encryptionKey: config.get(
          'OTP_ENCRYPTION_KEY',
          'default-dev-encryption-key-change-in-prod',
        ),
        methods: {
          totp: {
            enabled: true,
            method: 'totp' as const,
            issuer: config.get('APP_NAME', 'Demo App'),
          },
          email: {
            enabled: true,
            method: 'email' as const,
            codeLength: 6,
            expiresInSeconds: 600,
          },
        },
        features: {
          totp: true,
          emailOtp: true,
          rateLimiting: true,
          backupCodes: true,
        },
        rateLimiting: {
          maxAttempts: 5,
          windowSeconds: 300,
          lockoutSeconds: 900,
        },
      }),
      inject: [ConfigService],
    }),

    StorageModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        provider: 's3' as const,
        providerOptions: {
          endpoint: config.get('S3_ENDPOINT'),
          accessKeyId: config.getOrThrow('S3_ACCESS_KEY'),
          secretAccessKey: config.getOrThrow('S3_SECRET_KEY'),
          bucket: config.getOrThrow('S3_BUCKET'),
          region: config.get('S3_REGION', 'us-east-1'),
          forcePathStyle: true,
        },
        features: {
          trackUploads: true,
          registerController: true,
          signedUrls: true,
        },
      }),
      inject: [ConfigService],
    }),

    NotificationModule.forRootAsync({
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        channels: {
          email: {
            enabled: true,
            provider: 'smtp' as const,
            providerOptions: {
              host: config.get('SMTP_HOST', 'localhost'),
              port: Number(config.get('SMTP_PORT', '1025')),
              from: config.get('SMTP_FROM', 'noreply@demo.local'),
            },
          },
          inApp: { enabled: true },
          sms: {
            enabled: true,
            provider: 'log' as const,
          },
          push: {
            enabled: true,
            provider: 'log' as const,
          },
        },
        features: {
          preferences: true,
          templates: true,
        },
        queue: {
          redis: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: Number(config.get('REDIS_PORT', '6379')),
          },
        },
      }),
      inject: [ConfigService],
    }),

    AuthNotificationModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        baseUrl: config.get('APP_BASE_URL', 'http://localhost:3000'),
        appName: config.get('APP_NAME', 'Demo App'),
      }),
      inject: [ConfigService],
    }),

    AuditLogModule.forRootAsync({
      useFactory: () => ({
        features: {
          autoTrackCrud: true,
          trackAuthEvents: true,
          trackChanges: true,
          registerController: true,
        },
        excludeEntities: ['Session', 'VerificationToken'],
        excludeFields: ['passwordHash', 'refreshToken', 'accessToken'],
        adminRoles: ['admin', 'owner'],
      }),
    }),

    ItemsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
