import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueSeverity, IssueStatus, IssueType, SourceType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateIssueDto {
  @ApiProperty() @IsString() projectId!: string;
  @ApiProperty({ enum: IssueType }) @IsEnum(IssueType) type!: IssueType;
  @ApiProperty() @IsString() @Length(1, 240) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) description?: string;
  @ApiProperty({ enum: IssueSeverity }) @IsEnum(IssueSeverity) severity!: IssueSeverity;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) probability?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) impact?: number;
  @ApiPropertyOptional({ enum: SourceType })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceId?: string;
}
export class UpdateIssueDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(IssueType) type?: IssueType;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 240) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(IssueSeverity) severity?: IssueSeverity;
  @ApiPropertyOptional() @IsOptional() @IsEnum(IssueStatus) status?: IssueStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerUserId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) probability?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) impact?: number;
}
export class IssueListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(IssueType) type?: IssueType;
  @ApiPropertyOptional() @IsOptional() @IsEnum(IssueSeverity) severity?: IssueSeverity;
  @ApiPropertyOptional() @IsOptional() @IsEnum(IssueStatus) status?: IssueStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) @Max(100) pageSize = 20;
}
