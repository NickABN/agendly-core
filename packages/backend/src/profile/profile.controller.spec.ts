import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { TenantGuard } from '../common/guards/tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfileController } from './profile.controller';

describe('ProfileController address geocoding endpoint', () => {
  it('exposes GET /profile/geocode behind the profile authentication and tenant guards', () => {
    const prototype = ProfileController.prototype as unknown as Record<
      string,
      unknown
    >;
    const handlerName = Object.getOwnPropertyNames(prototype).find((name) => {
      const handler = prototype[name];
      return (
        typeof handler === 'function' &&
        Reflect.getMetadata(PATH_METADATA, handler) === 'geocode' &&
        Reflect.getMetadata(METHOD_METADATA, handler) === RequestMethod.GET
      );
    });

    expect(handlerName).toBeDefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, ProfileController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard]),
    );
  });
});
