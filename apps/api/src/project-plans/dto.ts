import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GeneratePlanDto {
  @ApiProperty() @IsString() sopVersionId!: string;
}
export class SyncPlanDto {
  @ApiProperty() @IsString() sopVersionId!: string;
  @ApiProperty({ description: '预览接口返回的 Diff 哈希' }) @IsString() acceptedDiffHash!: string;
}
