# Contributing to @bbv/nestjs-plugins

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/BlackBoxVision/nestjs-plugins.git
cd nestjs-plugins

# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test
```

### Demo App

```bash
cd apps/demo
npm run docker        # Start Postgres + Redis
npm run setup         # prisma generate + migrate
npm run dev           # http://localhost:3000/api (Swagger)
```

## Development Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or: fix/issue-description, docs/topic, etc.
   ```

2. Make your changes. Target a single package when possible.

3. Run validation:
   ```bash
   npm run lint          # Lint
   npm run typecheck     # Type-check
   npm run test          # Tests
   ```

   Or target a specific package:
   ```bash
   npx turbo run test --filter=@bbv/nestjs-auth
   ```

4. Add a changeset if your change affects a published package:
   ```bash
   npx changeset
   ```

5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   type(scope): description
   ```
   - **type**: `feat`, `fix`, `test`, `docs`, `ci`, `chore`, `refactor`, `perf`
   - **scope**: package name without `@bbv/` (e.g., `nestjs-auth`), or omit for root changes

6. Push and open a PR against `main`.

## Project Conventions

### Package Structure

Each package follows this layout:
```
packages/nestjs-example/
  src/
    example.module.ts       # Dynamic module (forRoot/forRootAsync)
    example.service.ts      # Main service
    example.controller.ts   # REST controller (if applicable)
    example.service.spec.ts # Co-located test
    interfaces/             # Types, interfaces, injection tokens
    decorators/             # Custom decorators
    dto/                    # Request/response DTOs with class-validator
    index.ts                # Barrel exports (public API)
  jest.config.ts
  tsconfig.json
  tsconfig.build.json
  package.json
  README.md
```

### Module Pattern

Tier 1 modules use NestJS dynamic modules with feature flags:

```typescript
@Module({})
export class ExampleModule {
  static forRoot(options: ExampleModuleOptions): DynamicModule { ... }
  static forRootAsync(options: ExampleModuleAsyncOptions): DynamicModule { ... }
}
```

### Testing

- Co-locate tests with source files (`*.spec.ts`)
- Use `@nestjs/testing` `Test.createTestingModule()` for integration
- Use `createMockPrismaService()` from `@bbv/nestjs-prisma` for Prisma mocks
- Coverage thresholds are enforced per-package

### Code Style

- TypeScript strict mode
- ESLint with `@typescript-eslint/strict`
- Prettier for formatting
- One class per file, `kebab-case` file names

## Pull Request Guidelines

- Keep PRs small and focused on a single concern
- Fill out the PR template
- Ensure CI passes (lint, typecheck, build, test)
- Add a changeset for any package changes
- Update documentation if the public API changes

## Versioning

We use [Changesets](https://github.com/changesets/changesets) for versioning:

- `npx changeset` — create a changeset describing your changes
- Select the affected packages and semver bump type
- The changeset is committed with your PR
- On merge to `main`, a release PR is auto-created (or packages are published directly)
