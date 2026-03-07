import { AuthModule } from './auth.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AUTH_MODULE_OPTIONS, AuthModuleOptions } from './interfaces';
import {
  OrganizationController,
  OrganizationService,
} from './organizations';

describe('AuthModule', () => {
  const baseOptions: AuthModuleOptions = {
    jwt: { secret: 'test-secret', expiresIn: '1h' },
    features: { emailPassword: true },
  };

  describe('forRoot()', () => {
    it('should return a DynamicModule', () => {
      const result = AuthModule.forRoot(baseOptions);

      expect(result).toBeDefined();
      expect(result.module).toBe(AuthModule);
    });

    it('should include AuthController in controllers', () => {
      const result = AuthModule.forRoot(baseOptions);

      expect(result.controllers).toContain(AuthController);
    });

    it('should include OrganizationController by default (organizations not explicitly disabled)', () => {
      const result = AuthModule.forRoot(baseOptions);

      expect(result.controllers).toContain(OrganizationController);
    });

    it('should exclude OrganizationController when organizations feature is false', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { ...baseOptions.features, organizations: false },
      };

      const result = AuthModule.forRoot(options);

      expect(result.controllers).not.toContain(OrganizationController);
    });

    it('should include AUTH_MODULE_OPTIONS provider with correct value', () => {
      const result = AuthModule.forRoot(baseOptions);
      const providers = result.providers as any[];

      const optionsProvider = providers.find(
        (p: any) => p.provide === AUTH_MODULE_OPTIONS,
      );

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.useValue).toEqual(baseOptions);
    });

    it('should include core providers (AuthService, JwtStrategy, JwtAuthGuard, RolesGuard)', () => {
      const result = AuthModule.forRoot(baseOptions);
      const providers = result.providers as any[];

      expect(providers).toContain(AuthService);
      expect(providers).toContain(JwtStrategy);
      expect(providers).toContain(JwtAuthGuard);
      expect(providers).toContain(RolesGuard);
    });

    it('should include LocalStrategy when emailPassword feature is enabled', () => {
      const result = AuthModule.forRoot(baseOptions);
      const providers = result.providers as any[];

      expect(providers).toContain(LocalStrategy);
    });

    it('should exclude LocalStrategy when emailPassword feature is false', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { emailPassword: false },
      };

      const result = AuthModule.forRoot(options);
      const providers = result.providers as any[];

      expect(providers).not.toContain(LocalStrategy);
    });

    it('should include GoogleStrategy provider when google feature and config are present', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { ...baseOptions.features, google: true },
        providers: {
          google: {
            clientId: 'google-client-id',
            clientSecret: 'google-client-secret',
            callbackUrl: 'http://localhost:3000/auth/google/callback',
          },
        },
      };

      const result = AuthModule.forRoot(options);
      const providers = result.providers as any[];

      const googleProvider = providers.find(
        (p: any) => p && typeof p === 'object' && p.provide === GoogleStrategy,
      );

      expect(googleProvider).toBeDefined();
    });

    it('should not include GoogleStrategy when google feature is disabled', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { ...baseOptions.features, google: false },
      };

      const result = AuthModule.forRoot(options);
      const providers = result.providers as any[];

      const googleProvider = providers.find(
        (p: any) => p && typeof p === 'object' && p.provide === GoogleStrategy,
      );

      expect(googleProvider).toBeUndefined();
    });

    it('should not include GoogleStrategy when google config is missing', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { ...baseOptions.features, google: true },
      };

      const result = AuthModule.forRoot(options);
      const providers = result.providers as any[];

      const googleProvider = providers.find(
        (p: any) => p && typeof p === 'object' && p.provide === GoogleStrategy,
      );

      expect(googleProvider).toBeUndefined();
    });

    it('should include OrganizationService when organizations feature is not disabled', () => {
      const result = AuthModule.forRoot(baseOptions);
      const providers = result.providers as any[];

      expect(providers).toContain(OrganizationService);
    });

    it('should exclude OrganizationService when organizations feature is false', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { ...baseOptions.features, organizations: false },
      };

      const result = AuthModule.forRoot(options);
      const providers = result.providers as any[];

      expect(providers).not.toContain(OrganizationService);
    });

    it('should export AuthService, JwtAuthGuard, RolesGuard, and AUTH_MODULE_OPTIONS', () => {
      const result = AuthModule.forRoot(baseOptions);
      const exports = result.exports as any[];

      expect(exports).toContain(AuthService);
      expect(exports).toContain(JwtAuthGuard);
      expect(exports).toContain(RolesGuard);
      expect(exports).toContain(AUTH_MODULE_OPTIONS);
    });

    it('should export OrganizationService when organizations feature is not disabled', () => {
      const result = AuthModule.forRoot(baseOptions);
      const exports = result.exports as any[];

      expect(exports).toContain(OrganizationService);
    });

    it('should not export OrganizationService when organizations feature is false', () => {
      const options: AuthModuleOptions = {
        ...baseOptions,
        features: { ...baseOptions.features, organizations: false },
      };

      const result = AuthModule.forRoot(options);
      const exports = result.exports as any[];

      expect(exports).not.toContain(OrganizationService);
    });

    it('should include PassportModule and JwtModule in imports', () => {
      const result = AuthModule.forRoot(baseOptions);

      expect(result.imports).toBeDefined();
      expect(result.imports!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('forRootAsync()', () => {
    it('should return a DynamicModule', () => {
      const result = AuthModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      expect(result).toBeDefined();
      expect(result.module).toBe(AuthModule);
    });

    it('should include AuthController and OrganizationController in controllers', () => {
      const result = AuthModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      expect(result.controllers).toContain(AuthController);
      expect(result.controllers).toContain(OrganizationController);
    });

    it('should include AUTH_MODULE_OPTIONS async provider', () => {
      const factory = jest.fn().mockReturnValue(baseOptions);

      const result = AuthModule.forRootAsync({
        useFactory: factory,
        inject: ['SomeService'],
      });

      const providers = result.providers as any[];
      const optionsProvider = providers.find(
        (p: any) => p.provide === AUTH_MODULE_OPTIONS,
      );

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.useFactory).toBe(factory);
      expect(optionsProvider.inject).toEqual(['SomeService']);
    });

    it('should include core providers', () => {
      const result = AuthModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      const providers = result.providers as any[];

      expect(providers).toContain(AuthService);
      expect(providers).toContain(JwtStrategy);
      expect(providers).toContain(LocalStrategy);
      expect(providers).toContain(JwtAuthGuard);
      expect(providers).toContain(RolesGuard);
      expect(providers).toContain(OrganizationService);
    });

    it('should include GoogleStrategy async provider', () => {
      const result = AuthModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      const providers = result.providers as any[];
      const googleProvider = providers.find(
        (p: any) => p && typeof p === 'object' && p.provide === GoogleStrategy,
      );

      expect(googleProvider).toBeDefined();
      expect(googleProvider.inject).toContain(AUTH_MODULE_OPTIONS);
    });

    it('should export AuthService, JwtAuthGuard, RolesGuard, OrganizationService, AUTH_MODULE_OPTIONS', () => {
      const result = AuthModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      const exports = result.exports as any[];

      expect(exports).toContain(AuthService);
      expect(exports).toContain(JwtAuthGuard);
      expect(exports).toContain(RolesGuard);
      expect(exports).toContain(OrganizationService);
      expect(exports).toContain(AUTH_MODULE_OPTIONS);
    });

    it('should include custom imports in module imports', () => {
      const customImport = { module: class CustomModule {} } as any;

      const result = AuthModule.forRootAsync({
        imports: [customImport],
        useFactory: () => baseOptions,
      });

      expect(result.imports).toContain(customImport);
    });

    it('should default inject to empty array when not provided', () => {
      const result = AuthModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      const providers = result.providers as any[];
      const optionsProvider = providers.find(
        (p: any) => p.provide === AUTH_MODULE_OPTIONS,
      );

      expect(optionsProvider.inject).toEqual([]);
    });
  });
});
