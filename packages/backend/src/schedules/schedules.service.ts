import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { BulkScheduleDto } from './dto/bulk-schedule.dto';
import type { DayOfWeek } from '../generated/prisma/client.js';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmployee(tenantId: string, employeeId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: { tenantId, employeeId },
      orderBy: [{ dayOfWeek: 'asc' }, { blockIndex: 'asc' }],
    });

    return schedules.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      dayOfWeek: s.dayOfWeek,
      blockIndex: s.blockIndex,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
    }));
  }

  async findAllByTenant(tenantId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: { tenantId },
      orderBy: [{ employeeId: 'asc' }, { dayOfWeek: 'asc' }, { blockIndex: 'asc' }],
    });

    return schedules.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      dayOfWeek: s.dayOfWeek,
      blockIndex: s.blockIndex,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
    }));
  }

  async create(tenantId: string, dto: CreateScheduleDto) {
    const blockIndex = dto.blockIndex ?? 0;
    const schedule = await this.prisma.schedule.upsert({
      where: {
        employeeId_dayOfWeek_blockIndex: {
          employeeId: dto.employeeId,
          dayOfWeek: dto.dayOfWeek as DayOfWeek,
          blockIndex,
        },
      },
      update: {
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: true,
      },
      create: {
        tenantId,
        employeeId: dto.employeeId,
        dayOfWeek: dto.dayOfWeek as DayOfWeek,
        blockIndex,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    return {
      id: schedule.id,
      employeeId: schedule.employeeId,
      dayOfWeek: schedule.dayOfWeek,
      blockIndex: schedule.blockIndex,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive,
    };
  }

  async bulkSet(tenantId: string, dto: BulkScheduleDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.schedule.deleteMany({
        where: { tenantId, employeeId: dto.employeeId },
      });

      if (dto.days.length > 0) {
        await tx.schedule.createMany({
          data: dto.days.map((d) => ({
            tenantId,
            employeeId: dto.employeeId,
            dayOfWeek: d.dayOfWeek as DayOfWeek,
            blockIndex: d.blockIndex ?? 0,
            startTime: d.startTime,
            endTime: d.endTime,
          })),
        });
      }
    });

    return this.findByEmployee(tenantId, dto.employeeId);
  }

  /** Creates default Mon-Sat 09:00-19:00 schedule for an employee */
  async createDefault(tenantId: string, employeeId: string) {
    const defaultDays: DayOfWeek[] = [
      'MONDAY' as DayOfWeek,
      'TUESDAY' as DayOfWeek,
      'WEDNESDAY' as DayOfWeek,
      'THURSDAY' as DayOfWeek,
      'FRIDAY' as DayOfWeek,
      'SATURDAY' as DayOfWeek,
    ];

    await this.prisma.schedule.createMany({
      data: defaultDays.map((day) => ({
        tenantId,
        employeeId,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '19:00',
      })),
      skipDuplicates: true,
    });

    return this.findByEmployee(tenantId, employeeId);
  }
}
