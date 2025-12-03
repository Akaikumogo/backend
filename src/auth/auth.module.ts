import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminsModule } from '../admins/admins.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), AdminsModule, LogsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
