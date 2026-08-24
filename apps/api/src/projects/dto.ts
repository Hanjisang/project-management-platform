import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectHealth, ProjectRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'P2026-001' })
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{2,49}$/)
  code!: string;
  @ApiProperty() @IsString() @Length(2, 200) name!: string;
  @ApiProperty() @IsString() @Length(2, 200) customerName!: string;
  @ApiProperty() @IsString() managerUserId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() approverUserId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedGoLiveDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
}
export class UpdateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200) customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() approverUserId?: string;
  @ApiPropertyOptional({ enum: ProjectHealth })
  @IsOptional()
  @IsEnum(ProjectHealth)
  healthOverride?: ProjectHealth;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedStartDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() plannedGoLiveDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
}
export class ProjectMemberInputDto {
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty({ enum: ProjectRole }) @IsEnum(ProjectRole) projectRole!: ProjectRole;
}
export class SetProjectMembersDto {
  @ApiProperty({ type: [ProjectMemberInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberInputDto)
  members!: ProjectMemberInputDto[];
}
export class ProjectListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() health?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20;
}
export class ProjectUserOptionsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20;
}
