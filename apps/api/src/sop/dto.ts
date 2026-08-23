import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateSopTemplateDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{2,79}$/) code!: string;
  @ApiProperty() @IsString() @Length(2, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
}
export class CreateSopVersionDto {
  @ApiProperty({ example: 'V1.0' }) @IsString() @Matches(/^V?\d+\.\d+(?:\.\d+)?$/) version!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
}
export class CreateSopStageDto {
  @ApiProperty() @IsString() @Length(1, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) @Max(3650) defaultDurationDays!: number;
}
export class UpdateSopStageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(3650) defaultDurationDays?: number;
}
export class CreateSopTaskDto {
  @ApiProperty() @IsString() @Length(1, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiProperty({ default: 1 }) @IsInt() @Min(1) @Max(3650) defaultDurationDays!: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deliverableRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) deliverableName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 255) deliverableTemplate?: string;
}
export class UpdateSopTaskDto extends CreateSopTaskDto {}
export class CreateChecklistItemDto {
  @ApiProperty() @IsString() @Length(1, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
}
export class CloneVersionDto extends CreateSopVersionDto {}
