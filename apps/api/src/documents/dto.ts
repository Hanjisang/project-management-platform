import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentVersionReviewStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty() @IsString() @Length(1, 240) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workItemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectDeliverableId?: string;
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
  @ApiProperty({ enum: DocumentVersionReviewStatus })
  @IsEnum(DocumentVersionReviewStatus)
  status!: DocumentVersionReviewStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
