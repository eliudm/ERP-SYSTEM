import { SetMetadata } from '@nestjs/common';

export const ALLOW_POS_USER_KEY = 'allowPosUser';
export const AllowPosUser = () => SetMetadata(ALLOW_POS_USER_KEY, true);
