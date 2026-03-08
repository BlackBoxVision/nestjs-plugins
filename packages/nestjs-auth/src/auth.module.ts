import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { OrgMemberGuard } from './guards/org-member.guard';
import {
  AUTH_MODULE_OPTIONS,
  AuthModuleAsyncOptions,
  AuthModuleOptions,
} from './interfaces';
import {
  OrganizationController,
  OrganizationService,
} from './organizations';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    const providers = AuthModule.buildProviders(options);
    const controllers = AuthModule.buildControllers(options);

    return {
      module: AuthModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: options.jwt.secret,
          signOptions: {
            expiresIn: options.jwt.expiresIn ?? '1h',
          },
        }),
      ],
      controllers,
      providers: [
        {
          provide: AUTH_MODULE_OPTIONS,
          useValue: options,
        },
        ...providers,
      ],
      exports: [
        AuthService,
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        OrgMemberGuard,
        AUTH_MODULE_OPTIONS,
        ...AuthModule.getConditionalExports(options),
      ],
    };
  }

  static forRootAsync(asyncOptions: AuthModuleAsyncOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        ...(asyncOptions.imports ?? []),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: asyncOptions.imports,
          useFactory: async (...args: any[]) => {
            const options = await asyncOptions.useFactory(...args);
            return {
              secret: options.jwt.secret,
              signOptions: {
                expiresIn: options.jwt.expiresIn ?? '1h',
              },
            };
          },
          inject: asyncOptions.inject ?? [],
        }),
      ],
      controllers: [AuthController, OrganizationController],
      providers: [
        {
          provide: AUTH_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
        AuthService,
        JwtStrategy,
        LocalStrategy,
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        OrgMemberGuard,
        OrganizationService,
        AuthModule.createAsyncGoogleStrategyProvider(),
      ],
      exports: [
        AuthService,
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        OrgMemberGuard,
        OrganizationService,
        AUTH_MODULE_OPTIONS,
      ],
    };
  }

  private static buildProviders(options: AuthModuleOptions): Provider[] {
    const providers: Provider[] = [
      AuthService,
      JwtStrategy,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      OrgMemberGuard,
    ];

    if (options.features?.emailPassword !== false) {
      providers.push(LocalStrategy);
    }

    if (options.features?.google && options.providers?.google) {
      providers.push({
        provide: GoogleStrategy,
        useFactory: () => {
          // Safe: guarded by options.providers?.google check above
          const googleConfig = options.providers?.google;
          if (!googleConfig) throw new Error('Google provider config missing');
          return new GoogleStrategy(googleConfig);
        },
      });
    }

    if (options.features?.organizations !== false) {
      providers.push(OrganizationService);
    }

    return providers;
  }

  private static buildControllers(
    options: AuthModuleOptions,
  ): Type<any>[] {
    const controllers: Type<any>[] = [AuthController];

    if (options.features?.organizations !== false) {
      controllers.push(OrganizationController);
    }

    return controllers;
  }

  private static getConditionalExports(
    options: AuthModuleOptions,
  ): Provider[] {
    const exports: Provider[] = [];

    if (options.features?.organizations !== false) {
      exports.push(OrganizationService);
    }

    return exports;
  }

  private static createAsyncGoogleStrategyProvider(): Provider {
    return {
      provide: GoogleStrategy,
      useFactory: (options: AuthModuleOptions) => {
        if (options.features?.google && options.providers?.google) {
          return new GoogleStrategy(options.providers.google);
        }
        return null;
      },
      inject: [AUTH_MODULE_OPTIONS],
    };
  }

}
