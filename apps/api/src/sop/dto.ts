import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliverableReviewMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

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
}
export class UpdateSopTaskDto extends CreateSopTaskDto {}
export class CreateChecklistItemDto {
  @ApiProperty() @IsString() @Length(1, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
}
export class CloneVersionDto extends CreateSopVersionDto {}

export class CreateSopDeliverableDto {
  @ApiProperty() @IsString() @Length(1, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ enum: DeliverableReviewMode })
  @IsOptional()
  @IsEnum(DeliverableReviewMode)
  reviewMode?: DeliverableReviewMode;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() aiReviewEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) aiAutoApproveThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) aiReviewInstruction?: string;
}

export class UpdateSopDeliverableDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ enum: DeliverableReviewMode })
  @IsOptional()
  @IsEnum(DeliverableReviewMode)
  reviewMode?: DeliverableReviewMode;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() aiReviewEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) aiAutoApproveThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) aiReviewInstruction?: string;
}

export class CreateSopDeliverableCriterionDto {
  @ApiProperty() @IsString() @Length(1, 200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateSopDeliverableCriterionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
