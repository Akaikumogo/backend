import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  PORT!: string;

  @IsNotEmpty()
  @IsString()
  MONGO_URI!: string;

  @IsNotEmpty()
  @IsString()
  JWT_SECRET!: string;

  @IsNotEmpty()
  @IsString()
  JWT_EXPIRES!: string;

  @IsNotEmpty()
  @IsString()
  REFRESH_SECRET!: string;

  @IsNotEmpty()
  @IsString()
  REFRESH_EXPIRES!: string;

  @IsNotEmpty()
  @IsEmail()
  DEFAULT_ADMIN_EMAIL!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  DEFAULT_ADMIN_PASSWORD!: string;
}

export const validateEnv = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
};
