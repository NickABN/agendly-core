import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClientAppointmentsService } from './client-appointments.service';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

describe('PublicController directory route', () => {
  let app: INestApplication;
  let publicService: {
    getDirectory: jest.Mock;
    getTenantBySlug: jest.Mock;
  };

  beforeEach(async () => {
    publicService = {
      getDirectory: jest.fn().mockResolvedValue({ businesses: [] }),
      getTenantBySlug: jest.fn().mockResolvedValue({
        tenant: { name: 'Salón Calma', slug: 'salon-calma' },
        services: [],
        employees: [],
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [
        { provide: PublicService, useValue: publicService },
        {
          provide: ClientAppointmentsService,
          useValue: { findByToken: jest.fn(), cancel: jest.fn() },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns HTTP 400 when q exceeds 80 characters', async () => {
    await request(app.getHttpServer())
      .get('/public/directory')
      .query({ q: 'a'.repeat(81) })
      .expect(400);

    expect(publicService.getDirectory).not.toHaveBeenCalled();
  });

  it('forwards the trimmed search query to the directory service', async () => {
    await request(app.getHttpServer())
      .get('/public/directory')
      .query({ q: '  Luna  ' })
      .expect(200)
      .expect({ businesses: [] });

    expect(publicService.getDirectory).toHaveBeenCalledWith('Luna');
  });

  it('keeps the existing public booking route available for a tenant slug', async () => {
    await request(app.getHttpServer())
      .get('/public/salon-calma')
      .expect(200)
      .expect((response) => {
        expect(response.body.tenant.slug).toBe('salon-calma');
      });

    expect(publicService.getTenantBySlug).toHaveBeenCalledWith('salon-calma');
  });
});
