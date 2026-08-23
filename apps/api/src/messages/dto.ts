import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateManualMessageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiProperty() @IsString() @Length(1, 160) senderName!: string;
  @ApiProperty() @IsString() @Length(1, 50000) content!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() receivedAt?: Date;
}
export class MessageListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(MessageStatus) status?: MessageStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @Min(1) @Max(100) pageSize = 20;
}
export class PendingActionDecisionDto {
  @ApiProperty() @IsString() actionId!: string;
  @ApiProperty({ enum: ['CONFIRM', 'REJECT'] }) @IsIn(['CONFIRM', 'REJECT']) decision!:
    'CONFIRM' | 'REJECT';
  @ApiPropertyOptional() @IsOptional() @IsObject() payload?: Record<string, unknown>;
}
export class ConfirmMessageDto {
  @ApiProperty({ type: [PendingActionDecisionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingActionDecisionDto)
  decisions!: PendingActionDecisionDto[];
}
