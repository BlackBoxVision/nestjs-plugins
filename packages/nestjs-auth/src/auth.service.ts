import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { RegisterDto, LoginDto } from './dto';
import {
  AUTH_MODULE_OPTIONS,
  OTP_SERVICE,
  AuthModuleOptions,
  AuthenticatedUser,
  JwtPayload,
  LoginResult,
  TwoFactorChallengePayload,
  TwoFactorChallengeResult,
} from './interfaces';
import { AUTH_EVENTS } from './events';
import { ROLES, VERIFICATION_TOKEN_TYPES, AUTH_PROVIDERS } from './constants';
import { PRISMA_SERVICE } from '@bbv/nestjs-prisma';

@Injectable()
export class AuthService {
  private readonly prisma: any;
  private readonly logger = new Logger(AuthService.name);
  private readonly otpService: any;

  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
    @Inject(PRISMA_SERVICE)
    prisma: any,
    private readonly jwtService: JwtService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    @Inject(OTP_SERVICE)
    otpService?: any,
  ) {
    this.prisma = prisma;
    this.otpService = otpService ?? null;
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ user: AuthenticatedUser; accessToken: string }> {
    if (!this.isFeatureEnabled('emailPassword')) {
      throw new ForbiddenException('Email/password registration is disabled');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const rounds = this.options.passwordHashRounds ?? 10;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const role =
      this.options.defaultAdminEmail &&
      dto.email === this.options.defaultAdminEmail
        ? ROLES.ADMIN
        : ROLES.USER;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role,
        accounts: {
          create: {
            provider: AUTH_PROVIDERS.CREDENTIALS,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });

    let verificationToken: string | undefined;

    if (this.isFeatureEnabled('emailVerification')) {
      verificationToken = randomBytes(32).toString('hex');
      const expiresIn = this.options.verificationTokenExpiresIn ?? 86400;

      await this.prisma.verificationToken.create({
        data: {
          token: verificationToken,
          type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION,
          userId: user.id,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
        },
      });
    }

    await this.emitEvent(AUTH_EVENTS.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      verificationToken,
    });

    const accessToken = this.generateToken(user);

    return {
      user: this.toAuthenticatedUser(user),
      accessToken,
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<LoginResult | TwoFactorChallengeResult> {
    if (!this.isFeatureEnabled('emailPassword')) {
      throw new ForbiddenException('Email/password login is disabled');
    }

    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (this.isTwoFactorEnabled() && this.otpService) {
      const methods = await this.otpService.getEnabledMethods(user.id);
      const isOtpEnabled = methods.length > 0;
      if (isOtpEnabled) {
        const challengeToken = this.generateChallengeToken(user);
        return {
          challengeToken,
          twoFactorRequired: true,
          methods,
        };
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateToken(user);

    return { user, accessToken };
  }

  async verifyTwoFactor(
    challengeToken: string,
    code: string,
    method?: string,
  ): Promise<LoginResult> {
    if (!this.isTwoFactorEnabled()) {
      throw new ForbiddenException('Two-factor authentication is disabled');
    }

    if (!this.otpService) {
      throw new ForbiddenException(
        'OTP service is not available. Import @bbv/nestjs-otp module.',
      );
    }

    let payload: TwoFactorChallengePayload;
    try {
      const secret =
        this.options.twoFactorJwt?.challengeTokenSecret ??
        this.options.jwt.secret;
      payload = this.jwtService.verify(challengeToken, { secret }) as TwoFactorChallengePayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }

    if (!payload.twoFactorRequired) {
      throw new UnauthorizedException('Invalid challenge token');
    }

    const result = await this.otpService.verifyOtp(payload.sub, code, {
      method,
    });

    if (!result.success) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { lastLoginAt: new Date() },
    });

    const user = await this.getProfile(payload.sub);
    const accessToken = this.generateToken(user);

    return { user, accessToken };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    return this.toAuthenticatedUser(user);
  }

  generateToken(user: { id: string; email: string; role?: string; emailVerified?: boolean; isActive?: boolean }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
    };

    return this.jwtService.sign(payload);
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    if (!this.isFeatureEnabled('emailVerification')) {
      throw new ForbiddenException('Email verification is disabled');
    }

    const verificationToken = await this.validateAndConsumeToken(
      token,
      VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      this.prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.emitEvent(AUTH_EVENTS.EMAIL_VERIFIED, {
      userId: verificationToken.userId,
    });

    return { success: true };
  }

  async forgotPassword(email: string): Promise<{ success: boolean }> {
    if (!this.isFeatureEnabled('passwordReset')) {
      throw new ForbiddenException('Password reset is disabled');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');
    const expiresIn = this.options.verificationTokenExpiresIn ?? 86400; // 24h

    await this.prisma.verificationToken.create({
      data: {
        token,
        type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
        userId: user.id,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    await this.emitEvent(AUTH_EVENTS.FORGOT_PASSWORD, {
      userId: user.id,
      email: user.email,
      resetToken: token,
      expiresInSeconds: expiresIn,
    });

    return { success: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    if (!this.isFeatureEnabled('passwordReset')) {
      throw new ForbiddenException('Password reset is disabled');
    }

    const verificationToken = await this.validateAndConsumeToken(
      token,
      VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
    );

    const rounds = this.options.passwordHashRounds ?? 10;
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { passwordHash },
      }),
      this.prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.emitEvent(AUTH_EVENTS.PASSWORD_RESET, {
      userId: verificationToken.userId,
      email: '',
    });

    return { success: true };
  }

  async findOrCreateSocialUser(
    provider: string,
    profile: {
      providerAccountId: string;
      email: string;
      displayName?: string;
      avatarUrl?: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ): Promise<{ user: AuthenticatedUser; accessToken: string }> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (account) {
      // Update tokens on the existing account
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });

      await this.prisma.user.update({
        where: { id: account.user.id },
        data: { lastLoginAt: new Date() },
      });

      const accessToken = this.generateToken(account.user);

      return {
        user: this.toAuthenticatedUser(account.user),
        accessToken,
      };
    }

    // Check if a user with this email already exists for account linking
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user && this.isFeatureEnabled('accountLinking')) {
      // Link social account to existing user
      await this.prisma.account.create({
        data: {
          userId: user.id,
          provider,
          providerAccountId: profile.providerAccountId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          lastLoginAt: new Date(),
          avatarUrl: user.avatarUrl ?? profile.avatarUrl,
        },
      });
    } else if (!user) {
      // Create new user with social account
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          emailVerified: true,
          avatarUrl: profile.avatarUrl,
          lastLoginAt: new Date(),
          accounts: {
            create: {
              provider,
              providerAccountId: profile.providerAccountId,
              accessToken: profile.accessToken,
              refreshToken: profile.refreshToken,
            },
          },
        },
      });
    } else {
      throw new BadRequestException(
        'An account with this email already exists. Account linking is disabled.',
      );
    }

    const accessToken = this.generateToken(user);

    return {
      user: this.toAuthenticatedUser(user),
      accessToken,
    };
  }

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ id: string; token: string; expiresAt: Date }> {
    if (!this.isFeatureEnabled('sessionManagement')) {
      throw new ForbiddenException('Session management is disabled');
    }

    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const session = await this.prisma.session.create({
      data: {
        userId,
        token,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      id: session.id,
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    if (!this.isFeatureEnabled('sessionManagement')) {
      throw new ForbiddenException('Session management is disabled');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  async getUserSessions(
    userId: string,
  ): Promise<Array<{ id: string; ipAddress: string | null; userAgent: string | null; createdAt: Date; expiresAt: Date }>> {
    if (!this.isFeatureEnabled('sessionManagement')) {
      throw new ForbiddenException('Session management is disabled');
    }

    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    role?: string;
    emailVerified?: boolean;
    isActive?: boolean;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? false,
    };
  }

  private async validateAndConsumeToken(
    token: string,
    expectedType: string,
  ): Promise<{ id: string; userId: string; token: string; type: string; expiresAt: Date; usedAt: Date | null }> {
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      throw new BadRequestException(
        expectedType === VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION
          ? 'Invalid verification token'
          : 'Invalid reset token',
      );
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Token has already been used');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Token has expired');
    }

    if (verificationToken.type !== expectedType) {
      throw new BadRequestException('Invalid token type');
    }

    return verificationToken;
  }

  private generateChallengeToken(user: { id: string; email: string }): string {
    const payload: TwoFactorChallengePayload = {
      sub: user.id,
      email: user.email,
      twoFactorRequired: true,
    };

    const secret =
      this.options.twoFactorJwt?.challengeTokenSecret ??
      this.options.jwt.secret;
    const expiresIn =
      this.options.twoFactorJwt?.challengeTokenExpiresIn ?? '5m';

    return this.jwtService.sign(payload, { secret, expiresIn });
  }

  private isTwoFactorEnabled(): boolean {
    const twoFactor = this.options.features?.twoFactor;
    if (typeof twoFactor === 'boolean') return twoFactor;
    if (typeof twoFactor === 'object') return twoFactor.enabled;
    return false;
  }

  private isFeatureEnabled(
    feature: keyof NonNullable<AuthModuleOptions['features']>,
  ): boolean {
    return this.options.features?.[feature] !== false;
  }

  private async emitEvent(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.eventEmitter) {
      try {
        await this.eventEmitter.emitAsync(event, payload);
      } catch (error) {
        this.logger.error(
          `Failed to emit event ${event}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
