import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsOptional, IsString, Length } from 'class-validator';

export class UpsertDailyReportDto {
  @ApiProperty() @IsString() projectId!: string;
  @ApiProperty() @Type(() => Date) @IsDate() reportDate!: Date;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) completed!: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) risks!: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) coordination!: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) tomorrow!: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) notes?: string;
}
export class GenerateWeeklyReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiProperty() @Type(() => Date) @IsDate() weekStart!: Date;
  @ApiProperty() @Type(() => Date) @IsDate() weekEnd!: Date;
}
