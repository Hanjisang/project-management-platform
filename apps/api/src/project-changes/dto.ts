import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectChangeOperationType, ProjectChangeSource, ProjectChangeType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class ChangeOperationDto {
  @ApiProperty({ enum: ProjectChangeOperationType })
  @IsEnum(ProjectChangeOperationType)
  operationType!: ProjectChangeOperationType;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiProperty() @IsObject() payload!: object;
}
export class CreateProjectChangeDto {
  @ApiProperty() @IsString() @Length(1, 240) title!: string;
  @ApiProperty() @IsString() @Length(1, 10000) description!: string;
  @ApiProperty({ enum: ProjectChangeType })
  @IsEnum(ProjectChangeType)
  changeType!: ProjectChangeType;
  @ApiProperty() @IsString() @Length(1, 10000) reason!: string;
  @ApiProperty({ enum: ProjectChangeSource })
  @IsEnum(ProjectChangeSource)
  source!: ProjectChangeSource;
  @ApiProperty({ type: [ChangeOperationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeOperationDto)
  operations!: ChangeOperationDto[];
}
export class ProjectChangeDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
export class ChangePreflightDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() proposedCompletionDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() scopeChange?: boolean;
}
export class DirectProjectAdjustmentDto {
  @ApiProperty() @Type(() => Date) @IsDate() proposedCompletionDate!: Date;
  @ApiProperty() @IsString() @Length(1, 5000) reason!: string;
}
