import { IsBoolean } from 'class-validator';

export class UpdateUserAccessDto {
  @IsBoolean()
  posOnly!: boolean;
}
