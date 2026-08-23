import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SourceType, TaskPriority, TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty() @IsString() projectId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() planTaskId?: string;
  @ApiProperty() @IsString() @Length(1, 240) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
  @ApiPropertyOptional({ enum: SourceType })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceId?: string;
}
export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 240) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}
export class TaskListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) @Max(100) pageSize = 20;
}
