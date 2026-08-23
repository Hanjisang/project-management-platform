import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @Length(3, 80)
  username!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @Length(8, 128)
  password!: string;
}
