import { PrismaClient } from '../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'bellas-nails-demo' },
    update: {},
    create: {
      name: 'Bellas Nails Demo',
      slug: 'bellas-nails-demo',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      onboardedAt: new Date(),
    },
  });

  // 2. Create demo owner
  const passwordHash = await bcrypt.hash('demo1234', 10);
  await prisma.user.upsert({
    where: { email: 'demo@agendly.mx' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'demo@agendly.mx',
      passwordHash,
      name: 'María Demo',
      role: 'OWNER',
    },
  });

  // 3. Create services
  const serviceData = [
    { name: 'Corte de cabello', durationMinutes: 45, priceMXN: 250 },
    { name: 'Tinte completo', durationMinutes: 90, bufferMinutes: 15, priceMXN: 800 },
    { name: 'Manicure', durationMinutes: 40, priceMXN: 200 },
    { name: 'Pedicure', durationMinutes: 50, priceMXN: 250 },
    { name: 'Uñas acrílicas', durationMinutes: 90, priceMXN: 500 },
    { name: 'Alisado', durationMinutes: 120, bufferMinutes: 15, priceMXN: 1500 },
  ];

  const services = [];
  for (const s of serviceData) {
    const service = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        bufferMinutes: s.bufferMinutes || 0,
        priceMXN: s.priceMXN,
      },
    });
    services.push(service);
  }

  // 4. Create employees
  const employeeNames = ['Ana García', 'Luisa Martínez', 'Carmen López'];
  const employees = [];
  for (const name of employeeNames) {
    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        name,
      },
    });
    employees.push(employee);
  }

  // 5. Assign all services to all employees
  for (const emp of employees) {
    for (const svc of services) {
      await prisma.employeeService.create({
        data: { employeeId: emp.id, serviceId: svc.id },
      });
    }
  }

  // 6. Create Mon-Sat 09:00-19:00 schedules
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
  for (const emp of employees) {
    for (const day of days) {
      await prisma.schedule.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '19:00',
        },
      });
    }
  }

  console.log('✅ Seed complete!');
  console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`   Login: demo@agendly.mx / demo1234`);
  console.log(`   Services: ${services.length}`);
  console.log(`   Employees: ${employees.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
