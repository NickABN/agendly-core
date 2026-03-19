import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { BookingService } from './booking.service';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, BookingService],
  exports: [AvailabilityService, BookingService],
})
export class AvailabilityModule {}
