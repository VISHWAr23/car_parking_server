// src/auth/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { Role } from '../../common/enums/app.enums';

export const ROLES_KEY = 'roles';

/**
 * Attach required roles to a route handler.
 * @example @Roles(Role.OWNER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
