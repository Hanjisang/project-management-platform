import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{2,79}$/) code!: string;
  @ApiProperty() @IsString() @Length(2, 120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) description?: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) permissionCodes!: string[];
}
export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}
