import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { AdminsService } from '../admins/admins.service';
import { LoginDto } from './dto/login.dto';
import { comparePassword } from '../common/utils/password.util';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminRole } from '../common/constants/roles.enum';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {}

  async login(dto: LoginDto, request?: any) {
    const admin = await this.adminsService.findByEmail(dto.email);

    if (!admin) {
      // Log failed login attempt
      await this.logsService.record('FAILED_LOGIN', null);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await comparePassword(dto.password, admin.password);
    if (!isMatch) {
      // Log failed login attempt
      await this.logsService.record('FAILED_LOGIN', admin.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      admin.id,
      admin.email,
      admin.role,
      admin.fullname,
      admin.allowedRegions,
    );

    await this.logsService.record('LOGIN', admin.id);

    return {
      ...tokens,
      role: admin.role,
      user: {
        id: admin.id,
        fullname: admin.fullname,
        email: admin.email,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.configService.get<string>('REFRESH_SECRET'),
      });

      const admin = await this.adminsService.findByEmail(payload.email);

      if (!admin) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Fixed: Use database values instead of token values
      // This ensures role and allowedRegions changes are reflected immediately
      const tokens = await this.generateTokens(
        admin.id,
        admin.email,
        admin.role, // From database, not token
        admin.fullname,
        admin.allowedRegions, // From database, not token
      );

      return {
        ...tokens,
        role: admin.role, // From database
        user: {
          id: admin.id,
          fullname: admin.fullname,
          email: admin.email,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(
    sub: string,
    email: string,
    role: AdminRole,
    fullname: string,
    allowedRegions?: string[] | any,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const refreshSecret = this.configService.get<string>('REFRESH_SECRET');
    const jwtExpires = this.configService.get<string>('JWT_EXPIRES');
    const refreshExpires = this.configService.get<string>('REFRESH_EXPIRES');

    if (!jwtSecret || !refreshSecret || !jwtExpires || !refreshExpires) {
      throw new Error('JWT configuration is missing');
    }

    const accessExpiresIn = this.normalizeDuration(jwtExpires, 'JWT_EXPIRES');
    const refreshExpiresIn = this.normalizeDuration(
      refreshExpires,
      'REFRESH_EXPIRES',
    );

    const payload = {
      sub,
      email,
      role,
      fullname,
      allowedRegions: allowedRegions?.map((region: any) =>
        typeof region === 'string' ? region : region.toString(),
      ),
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      access_token,
      refresh_token,
    };
  }

  private normalizeDuration(
    value: string,
    envKey: string,
  ): SignOptions['expiresIn'] {
    const durationPattern = /^\d+(ms|s|m|h|d)$/i;
    if (!durationPattern.test(value)) {
      throw new Error(`${envKey} must match pattern <number><ms|s|m|h|d>`);
    }
    return value as SignOptions['expiresIn'];
  }
}
