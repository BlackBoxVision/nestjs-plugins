import { SetMetadata } from '@nestjs/common';

export const REQUIRE_OTP_KEY = 'requireOtp';

export const RequireOtp = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_OTP_KEY, true);
