import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty() @IsString() @Length(3, 80) username!: string;
  @ApiProperty({ minLength: 10, format: 'password' })
  @IsString()
  @Length(10, 128)
  password!: string;
  @ApiProperty() @IsString() @Length(2, 120) displayName!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ type: [String], example: ['MEMBER'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}
