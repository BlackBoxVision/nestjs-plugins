# @bbv/nestjs-auth

Complete authentication and authorization module for NestJS with email/password, social login (Google, Apple, Microsoft), organizations, magic links, and role-based access control.

## Installation

```bash
npm install @bbv/nestjs-auth
```

**Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `@nestjs/passport`, `@prisma/client`, `passport`

## Prisma Schema

Copy the auth schema into your project:

```bash
cp node_modules/@bbv/nestjs-auth/prisma/auth.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

Provides: `User`, `Account`, `Session`, `Organization`, `OrganizationMember`, `VerificationToken`

## Usage

```typescript
import { AuthModule } from '@bbv/nestjs-auth';

@Module({
  imports: [
    AuthModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        jwt: {
          secret: config.getOrThrow('JWT_SECRET'),
          expiresIn: '7d',
        },
        features: {
          emailPassword: true,
          google: true,
          organizations: true,
          emailVerification: true,
          passwordReset: true,
          sessionManagement: true,
        },
        providers: {
          google: {
            clientId: config.getOrThrow('GOOGLE_CLIENT_ID'),
            clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
            callbackUrl: '/auth/google/callback',
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Feature Flags

| Flag | Default | Routes |
|------|---------|--------|
| `emailPassword` | `true` | `POST /auth/register`, `POST /auth/login` |
| `google` | `false` | `GET /auth/google`, `GET /auth/google/callback` |
| `apple` | `false` | `GET /auth/apple`, `POST /auth/apple/callback` |
| `microsoft` | `false` | `GET /auth/microsoft`, `GET /auth/microsoft/callback` |
| `magicLink` | `false` | `POST /auth/magic-link`, `GET /auth/magic-link/verify` |
| `organizations` | `false` | Full `/organizations` CRUD + membership |
| `emailVerification` | `true` | `POST /auth/verify-email` |
| `passwordReset` | `true` | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| `twoFactor` | `false` | 2FA setup, verify, recovery |
| `sessionManagement` | `false` | `GET /auth/sessions`, `DELETE /auth/sessions/:id` |

When a feature is off, its routes are not registered and services throw if called directly.

## Decorators

```typescript
import { CurrentUser, Roles, Public } from '@bbv/nestjs-auth';

@Controller('items')
export class ItemsController {
  @Public()                    // Skip JWT auth
  @Get()
  findAll() {}

  @Roles('admin', 'owner')    // Require specific roles
  @Delete(':id')
  remove(@CurrentUser() user) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {}
}
```

## Guards

- `JwtAuthGuard` — Validates JWT Bearer token, skips `@Public()` routes
- `RolesGuard` — Checks `@Roles()` metadata against `request.user`

## API

| Export | Description |
|--------|-------------|
| `AuthModule` | Dynamic module with `forRootAsync()` |
| `AuthService` | Login, register, verify, token management |
| `OrganizationService` | Organization CRUD + membership |
| `@CurrentUser()` | Param decorator for current user |
| `@Roles()` | Method decorator for role requirements |
| `@Public()` | Method decorator to skip auth |
| `JwtAuthGuard` | JWT authentication guard |
| `RolesGuard` | Role-based authorization guard |

## License

[MIT](./LICENSE)
