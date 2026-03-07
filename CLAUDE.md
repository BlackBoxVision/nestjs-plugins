# CLAUDE.md - Agent Context for @bbv/nestjs-plugins

## Project Overview

Composable NestJS plugin ecosystem. Each package is a self-contained feature module (own Prisma schema, feature flags, provider abstraction) that composes into a production-ready NestJS API.

## Repository Structure

```
bbv-nestjs-packages/
  apps/demo/              # Demo NestJS app (Swagger at localhost:3000/api)
  packages/
    nestjs-prisma/        # Tier 2 - Prisma lifecycle, soft-delete, test mocks
    nestjs-pagination/    # Tier 2 - PaginationDto, paginate(), Swagger decorator
    nestjs-response/      # Tier 2 - ApiResponse wrapper, interceptor, exception filter
    nestjs-auth/          # Tier 1 - Auth (email/password, Google OAuth, RBAC, orgs)
    nestjs-notifications/ # Tier 1 - Multi-channel (email, SMS, push, in-app) + BullMQ
    nestjs-storage/       # Tier 1 - File upload (S3, Firebase, DO Spaces, Local)
    nestjs-audit-log/     # Tier 1 - CRUD audit logging via Prisma middleware
```

- **Tier 1 plugins** depend on `@bbv/nestjs-prisma` and ship their own `.prisma` schema files
- **Tier 2 utilities** are standalone — no module registration needed

## Key Patterns and Conventions

### Module Registration

All Tier 1 modules follow the NestJS dynamic module pattern with both sync and async variants:

```typescript
// Sync
SomeModule.forRoot(options: SomeModuleOptions): DynamicModule
// Async
SomeModule.forRootAsync(options: SomeModuleAsyncOptions): DynamicModule
```

### Feature Flags

Every Tier 1 module accepts a `features` config object. Disabled features don't register routes or providers. The pattern is opt-out (features default to `true` unless explicitly set to `false`).

### Provider Abstraction

Modules with swappable backends (storage, notifications) use a discriminated union on the `provider` field for type-safe config. Each provider implements a common interface (e.g., `StorageProvider`, `EmailProvider`, `SmsProvider`, `PushProvider`).

### Injection Tokens

Each module defines its options token as a string constant (e.g., `AUTH_MODULE_OPTIONS`, `STORAGE_MODULE_OPTIONS`, `NOTIFICATION_MODULE_OPTIONS`). Provider tokens follow the same pattern (e.g., `STORAGE_PROVIDER`, `EMAIL_PROVIDER`).

### Barrel Exports

Every package has an `src/index.ts` that re-exports all public API. Modules, services, controllers, decorators, guards, DTOs, interfaces, and constants are all exported from here.

## Tech Stack

- **Runtime**: Node.js >= 20
- **Framework**: NestJS 10
- **ORM**: Prisma 5/6 (multi-file schema with `prismaSchemaFolder` preview feature)
- **Language**: TypeScript 5.4+ (strict mode, `ES2022` target, `commonjs` modules)
- **Build**: `tsc` per package (no bundler)
- **Test**: Jest 29 with `ts-jest`, co-located `.spec.ts` files
- **Monorepo**: Turborepo with npm workspaces
- **Lint**: ESLint with `@typescript-eslint/strict`
- **Format**: Prettier
- **Versioning**: Changesets (public access, independent versioning)

## Development Commands

```bash
npm run build       # Build all packages (via Turbo)
npm run test        # Run all tests
npm run test:cov    # Run tests with coverage
npm run lint        # Lint all packages
npm run typecheck   # Type-check all packages
npm run format      # Format with Prettier
npm run clean       # Clean dist/coverage
```

All commands run through Turbo. To target a single package:
```bash
npx turbo run test --filter=@bbv/nestjs-auth
```

## Testing Conventions

- Test files are co-located with source: `foo.service.ts` -> `foo.service.spec.ts`
- Use `@nestjs/testing` `Test.createTestingModule()` for module tests
- Use `createMockPrismaService()` from `@bbv/nestjs-prisma` for Prisma mocks
- Coverage thresholds enforced per-package in `jest.config.ts` (base: 80% lines, 65% branches)
- Always use `--passWithNoTests` flag (already in package scripts)

## Coding Standards

- **Imports**: Use relative paths within a package, `@bbv/package-name` across packages
- **Naming**: `kebab-case` for files, `PascalCase` for classes/interfaces/types, `camelCase` for functions/variables
- **File organization**: One class per file. Group by feature (e.g., `organizations/`, `channels/email/`)
- **Decorators**: Custom decorators go in a `decorators/` directory
- **Guards/Strategies**: Go in `guards/` and `strategies/` directories respectively
- **DTOs**: Go in a `dto/` directory, use `class-validator` decorators
- **Interfaces**: Go in an `interfaces/` directory, export constants and types together

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

# Examples:
feat(nestjs-auth): add Apple OAuth strategy
fix(nestjs-storage): handle missing content-type header
test(nestjs-notifications): add push processor specs
docs: update architecture diagram
ci: add Node 22 to test matrix
```

Valid types: `feat`, `fix`, `test`, `docs`, `ci`, `chore`, `refactor`, `perf`, `style`, `build`
Scopes: package name without `@bbv/` prefix, or omit for root-level changes.

## CI/CD

- **CI**: Per-package matrix (lint -> typecheck -> build -> test:cov) on Node 20.x + 22.x
- **Release**: Changesets action on `main` — creates version PR or publishes to npm
- **Coverage**: Codecov with per-package flags, 80% patch target

## Important Constraints

- All packages use `commonjs` module format (not ESM)
- Prisma is a peer dependency — consumers provide their own `@prisma/client`
- NestJS 10 is the minimum supported version
- Packages are published with `"access": "public"` to npm under the `@bbv` scope
- No runtime dependencies on other `@bbv/*` packages (Prisma module is a peer dep for Tier 1)
