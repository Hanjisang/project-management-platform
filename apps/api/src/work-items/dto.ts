import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateWorkItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() planStageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentWorkItemId?: string;
  @ApiProperty() @IsString() @Length(1, 240) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedEndDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
}

export class UpdateWorkItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 240) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedEndDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) progress?: number;
}

export class WorkItemListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) @Max(100) pageSize = 20;
}

export class CompleteWorkItemChecklistDto {
  @ApiProperty() @IsBoolean() completed!: boolean;
}

export class CancelWorkItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 1000) reason?: string;
}
