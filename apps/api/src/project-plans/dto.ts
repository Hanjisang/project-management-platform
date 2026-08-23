import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class GeneratePlanDto {
  @ApiProperty() @IsString() sopVersionId!: string;
}
export class SyncPlanDto {
  @ApiProperty() @IsString() sopVersionId!: string;
  @ApiProperty({ description: '预览接口返回的 Diff 哈希' }) @IsString() acceptedDiffHash!: string;
}
export class UpdatePlanTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedEndDate?: Date;
}
export class CompleteChecklistDto {
  @ApiProperty() @IsBoolean() completed!: boolean;
}
