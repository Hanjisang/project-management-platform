import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentReviewStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty() @IsString() @Length(1, 240) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() planTaskId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  required?: boolean;
  @ApiProperty({ example: 'V1.0' }) @IsString() @Matches(/^V?\d+\.\d+(?:\.\d+)?$/) version!: string;
}
export class CreateDocumentVersionDto {
  @ApiProperty({ example: 'V1.1' }) @IsString() @Matches(/^V?\d+\.\d+(?:\.\d+)?$/) version!: string;
}
export class ReviewDocumentDto {
  @ApiProperty({ enum: DocumentReviewStatus })
  @IsEnum(DocumentReviewStatus)
  status!: DocumentReviewStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
