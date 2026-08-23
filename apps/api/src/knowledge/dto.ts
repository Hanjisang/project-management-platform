import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateKnowledgeCategoryDto {
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
}
export class CreateKnowledgeArticleDto {
  @ApiProperty() @IsString() categoryId!: string;
  @ApiProperty() @IsString() @Length(1, 240) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) summary?: string;
  @ApiProperty() @IsString() @Length(1, 100000) content!: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() sourceProjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceDocumentId?: string;
}
export class UpdateKnowledgeArticleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 240) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100000) content?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
export class ReviewKnowledgeArticleDto {
  @ApiProperty({ enum: ['PUBLISHED', 'REJECTED'] }) @IsIn(['PUBLISHED', 'REJECTED']) status!:
    'PUBLISHED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
export class DepositDocumentDto {
  @ApiProperty() @IsString() categoryId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 240) title?: string;
}
