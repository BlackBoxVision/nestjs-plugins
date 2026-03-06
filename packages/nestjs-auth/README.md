# @bbv/nestjs-auth

> Authentication and authorization module for NestJS with email/password, social login, organizations, and RBAC.

## Overview

Feature-flagged authentication module that brings its own Prisma schema (User, Account, Session, Organization, VerificationToken). Toggle capabilities like social login, email verification, password reset, session management, and organizations via config -- disabled features don't register routes or consume resources.

## Installation

```bash
npm install @bbv/nestjs-auth
```

### Peer Dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0` |
| `@nestjs/core` | `^10.0.0` |
| `@nestjs/passport` | `^10.0.0` |
| `@prisma/client` | `^5.0.0 \|\| ^6.0.0` |
| `passport` | `^0.7.0` |

Requires [`@bbv/nestjs-prisma`](../nestjs-prisma) to be registered first.

## Prisma Schema

Copy the auth schema into your project and run migrations:

```bash
cp node_modules/@bbv/nestjs-auth/prisma/auth.prisma prisma/schema/
npx prisma generate && npx prisma migrate dev
```

**Models provided**: `User`, `Account`, `Session`, `Organization`, `OrganizationMember`, `VerificationToken`

<details>
<summary>Schema details</summary>

| Model | Key Fields | Description |
|-------|-----------|-------------|
| `User` | `email` (unique), `passwordHash?`, `emailVerified`, `isActive`, `lastLoginAt` | Core user account |
| `Account` | `provider`, `providerAccountId`, `accessToken?`, `refreshToken?` | Social login linked accounts |
| `Session` | `token` (unique), `ipAddress?`, `userAgent?`, `expiresAt` | Active sessions |
| `Organization` | `name`, `slug` (unique), `logoUrl?`, `isActive` | Multi-tenant organizations |
| `OrganizationMember` | `userId`, `organizationId`, `role` (default: `"member"`) | Org membership + role |
| `VerificationToken` | `token` (unique), `type`, `userId`, `expiresAt`, `usedAt?` | Email verification & password reset |

</details>

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@bbv/nestjs-prisma';
import { AuthModule } from '@bbv/nestjs-auth';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule.forRoot({ isGlobal: true }),

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

## Configuration

### `AuthModuleOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jwt.secret` | `string` | **required** | JWT signing secret |
| `jwt.expiresIn` | `string` | `'1h'` | Token expiration (e.g. `'7d'`, `'1h'`) |
| `features` | `AuthFeatures` | see below | Feature flags |
| `providers.google` | `GoogleProviderConfig` | -- | Google OAuth config |
| `providers.apple` | `AppleProviderConfig` | -- | Apple Sign In config |
| `providers.microsoft` | `MicrosoftProviderConfig` | -- | Microsoft OAuth config |
| `passwordHashRounds` | `number` | `10` | bcrypt hash rounds |
| `verificationTokenExpiresIn` | `number` | `86400` | Token TTL in seconds (24h) |

## Feature Flags

| Flag | Default | Routes Enabled | Description |
|------|---------|---------------|-------------|
| `emailPassword` | `true` | `POST /auth/register`, `POST /auth/login` | Email/password registration and login |
| `google` | `false` | `GET /auth/google`, `GET /auth/google/callback` | Google OAuth 2.0 flow |
| `apple` | `false` | Apple OAuth endpoints | Apple Sign In |
| `microsoft` | `false` | Microsoft OAuth endpoints | Microsoft OAuth |
| `magicLink` | `false` | Magic link endpoints | Passwordless login via email |
| `organizations` | `true` | Full `/organizations` CRUD | Multi-tenant organizations |
| `emailVerification` | `true` | `POST /auth/verify-email` | Email verification tokens |
| `passwordReset` | `true` | `POST /auth/forgot-password`, `POST /auth/reset-password` | Password reset flow |
| `twoFactor` | `false` | 2FA setup and verify | Two-factor authentication |
| `sessionManagement` | `true` | `GET /auth/sessions`, `DELETE /auth/sessions/:id` | View and revoke sessions |
| `accountLinking` | `true` | (automatic) | Link social accounts to existing users |

When a feature is **off**, its routes are not registered and service methods throw `ForbiddenException`.

## API Reference

### Routes -- Auth Controller (`/auth`)

| Method | Path | Auth | Feature Flag | Description |
|--------|------|------|-------------|-------------|
| `POST` | `/auth/register` | Public | `emailPassword` | Register with email + password |
| `POST` | `/auth/login` | Public | `emailPassword` | Login with email + password |
| `GET` | `/auth/google` | Public | `google` | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | Public | `google` | Google OAuth callback |
| `POST` | `/auth/verify-email` | Public | `emailVerification` | Verify email token |
| `POST` | `/auth/forgot-password` | Public | `passwordReset` | Request password reset |
| `POST` | `/auth/reset-password` | Public | `passwordReset` | Reset password with token |
| `GET` | `/auth/me` | JWT | -- | Get current user profile |
| `GET` | `/auth/sessions` | JWT | `sessionManagement` | List active sessions |
| `DELETE` | `/auth/sessions/:id` | JWT | `sessionManagement` | Revoke a session |

### Routes -- Organization Controller (`/organizations`)

All routes require JWT authentication. Registered when `organizations` feature is enabled.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/organizations` | Create organization (creator becomes owner) |
| `GET` | `/organizations` | List user's organizations |
| `GET` | `/organizations/:id` | Get organization details |
| `PATCH` | `/organizations/:id` | Update name, slug, logo |
| `POST` | `/organizations/:id/members` | Add member with role |
| `DELETE` | `/organizations/:id/members/:userId` | Remove member |

### Services

**`AuthService`**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(dto: RegisterDto) => { user, accessToken }` | Create user + generate JWT |
| `login` | `(dto: LoginDto) => { user, accessToken }` | Validate credentials + generate JWT |
| `validateUser` | `(email, password) => AuthenticatedUser \| null` | Validate email/password |
| `generateToken` | `(user) => string` | Sign JWT for user |
| `verifyEmail` | `(token: string) => { success }` | Verify email with token |
| `forgotPassword` | `(email: string) => { success }` | Create password reset token |
| `resetPassword` | `(token, newPassword) => { success }` | Reset password with token |
| `findOrCreateSocialUser` | `(provider, profile) => { user, accessToken }` | Social login user resolution |
| `createSession` | `(userId, ip?, ua?) => { id, token, expiresAt }` | Create tracked session |
| `revokeSession` | `(sessionId, userId) => void` | Delete a session |
| `getUserSessions` | `(userId) => Session[]` | List active sessions |
| `getProfile` | `(userId) => AuthenticatedUser` | Get user profile |

**`OrganizationService`**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(name, slug, userId) => Organization` | Create org, creator is owner |
| `findAll` | `(userId) => Organization[]` | List user's organizations |
| `findOne` | `(id) => Organization` | Get org with members |
| `update` | `(id, data) => Organization` | Update org fields |
| `addMember` | `(orgId, userId, role?) => OrganizationMember` | Add user to org |
| `removeMember` | `(orgId, userId) => void` | Remove user from org |
| `updateMemberRole` | `(orgId, userId, role) => OrganizationMember` | Change member role |

### Decorators

```typescript
import { CurrentUser, Roles, Public } from '@bbv/nestjs-auth';

@Controller('items')
export class ItemsController {
  @Public()                       // Skip JWT authentication
  @Get()
  findAll() {}

  @Roles('admin', 'owner')       // Require specific roles
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {}  // Extract specific field
}
```

### Guards

| Guard | Description |
|-------|-------------|
| `JwtAuthGuard` | Validates JWT Bearer token. Skips routes decorated with `@Public()` |
| `RolesGuard` | Checks `@Roles()` metadata against `request.user.roles` |

### DTOs

| DTO | Fields |
|-----|--------|
| `RegisterDto` | `email` (email, required), `password` (string, min 8) |
| `LoginDto` | `email` (email, required), `password` (string, required) |
| `ForgotPasswordDto` | `email` (email, required) |
| `ResetPasswordDto` | `token` (string, required), `newPassword` (string, min 8) |
| `VerifyEmailDto` | `token` (string, required) |
| `ChangePasswordDto` | `currentPassword` (string, required), `newPassword` (string, min 8) |

## Social Provider Setup

### Google

```typescript
providers: {
  google: {
    clientId: 'your-google-client-id',
    clientSecret: 'your-google-client-secret',
    callbackUrl: '/auth/google/callback',
    scope: ['email', 'profile'],  // optional, defaults to email + profile
  },
}
```

### Apple

```typescript
providers: {
  apple: {
    clientId: 'your-apple-client-id',
    teamId: 'your-team-id',
    keyId: 'your-key-id',
    privateKey: '-----BEGIN PRIVATE KEY-----\n...',
    callbackUrl: '/auth/apple/callback',
  },
}
```

### Microsoft

```typescript
providers: {
  microsoft: {
    clientId: 'your-ms-client-id',
    clientSecret: 'your-ms-client-secret',
    tenantId: 'common',           // optional, defaults to common
    callbackUrl: '/auth/microsoft/callback',
  },
}
```

## Architecture

```mermaid
graph TD
    Module["AuthModule<br/>forRoot() / forRootAsync()"]

    subgraph Controllers
        AuthCtrl["AuthController<br/>/auth"]
        OrgCtrl["OrganizationController<br/>/organizations"]
    end

    subgraph Services
        AuthSvc["AuthService<br/>business logic, tokens, users"]
        OrgSvc["OrganizationService<br/>org CRUD, members"]
    end

    subgraph Strategies ["Passport Strategies"]
        JWT["JwtStrategy"]
        Local["LocalStrategy"]
        Google["GoogleStrategy<br/><i>conditional</i>"]
    end

    subgraph Guards
        JwtGuard["JwtAuthGuard<br/>@Public() support"]
        RolesGuard["RolesGuard<br/>@Roles() enforcement"]
    end

    Module --> Controllers
    Module --> Services
    Module --> Strategies
    Module --> Guards

    AuthCtrl --> AuthSvc
    OrgCtrl --> OrgSvc
    AuthSvc --> JWT
    AuthSvc --> Local
    AuthSvc --> Google

    style Module fill:#e3f2fd,stroke:#1565c0
    style AuthCtrl fill:#e8f5e9,stroke:#2e7d32
    style OrgCtrl fill:#e8f5e9,stroke:#2e7d32
    style AuthSvc fill:#fff3e0,stroke:#e65100
    style OrgSvc fill:#fff3e0,stroke:#e65100
```

## License

[MIT](../../LICENSE) -- [BlackBox Vision](https://github.com/BlackBoxVision)
