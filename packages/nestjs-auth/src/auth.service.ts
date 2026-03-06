import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { RegisterDto, LoginDto } from './dto';
import {
  AUTH_MODULE_OPTIONS,
  AuthModuleOptions,
  AuthenticatedUser,
  JwtPayload,
} from './interfaces';

@Injectable()
export class AuthService {
  private readonly prisma: any;

  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleOptions,
    @Inject('PrismaService')
    prisma: any,
    private readonly jwtService: JwtService,
  ) {
    this.prisma = prisma;
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

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        accounts: {
          create: {
            provider: 'credentials',
          },
        },
      },
    });

    const accessToken = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
      },
      accessToken,
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: AuthenticatedUser; accessToken: string }> {
    if (!this.isFeatureEnabled('emailPassword')) {
      throw new ForbiddenException('Email/password login is disabled');
    }

    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    };
  }

  generateToken(user: { id: string; email: string }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return this.jwtService.sign(payload);
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    if (!this.isFeatureEnabled('emailVerification')) {
      throw new ForbiddenException('Email verification is disabled');
    }

    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Token has already been used');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Token has expired');
    }

    if (verificationToken.type !== 'email_verification') {
      throw new BadRequestException('Invalid token type');
    }

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
        type: 'password_reset',
        userId: user.id,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    // The consuming application should listen for this token and send the email.
    // This library does not handle email sending directly.

    return { success: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    if (!this.isFeatureEnabled('passwordReset')) {
      throw new ForbiddenException('Password reset is disabled');
    }

    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid reset token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Token has already been used');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Token has expired');
    }

    if (verificationToken.type !== 'password_reset') {
      throw new BadRequestException('Invalid token type');
    }

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
        user: {
          id: account.user.id,
          email: account.user.email,
          emailVerified: account.user.emailVerified,
          isActive: account.user.isActive,
        },
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
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
      },
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
    });
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    };
  }

  private isFeatureEnabled(
    feature: keyof NonNullable<AuthModuleOptions['features']>,
  ): boolean {
    return this.options.features?.[feature] !== false;
  }
}
