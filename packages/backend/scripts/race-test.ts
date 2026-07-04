/**
 * Prueba de concurrencia del constraint anti doble-reserva.
 * Requiere el Postgres local (docker compose up -d) con migraciones aplicadas.
 *
 *   cd packages/backend && npx tsx scripts/race-test.ts
 *
 * Inserta N citas CONFIRMED superpuestas en paralelo para el mismo empleado;
 * el constraint appointment_no_overlap debe dejar pasar EXACTAMENTE UNA.
 */
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://agendly:agendly_dev@localhost:5433/agendly',
});
const prisma = new PrismaClient({ adapter });

const CONCURRENCY = 8;

async function main() {
  // Seed aislado
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Race Test',
      slug: `race-test-${Date.now()}`,
      trialEndsAt: new Date('2031-01-01T00:00:00.000Z'),
    },
  });
  const employee = await prisma.employee.create({
    data: { tenantId: tenant.id, name: 'Empleado Carrera' },
  });
  const service = await prisma.service.create({
    data: { tenantId: tenant.id, name: 'Servicio Carrera', durationMinutes: 60, priceMXN: 100 },
  });

  const startTime = new Date('2030-06-10T16:00:00.000Z');
  const endTime = new Date('2030-06-10T17:00:00.000Z');

  const attempts = Array.from({ length: CONCURRENCY }, (_, i) =>
    prisma.appointment
      .create({
        data: {
          tenantId: tenant.id,
          employeeId: employee.id,
          serviceId: service.id,
          clientName: `Cliente ${i}`,
          clientPhone: `55000000${i}`,
          startTime,
          endTime,
          status: 'CONFIRMED',
        },
      })
      .then(() => 'ok' as const)
      .catch((err: Error) =>
        err.message.includes('appointment_no_overlap') || err.message.includes('23P01')
          ? ('blocked' as const)
          : Promise.reject(err),
      ),
  );

  const results = await Promise.all(attempts);
  const ok = results.filter((r) => r === 'ok').length;
  const blocked = results.filter((r) => r === 'blocked').length;

  // Limpieza
  await prisma.tenant.delete({ where: { id: tenant.id } });
  await prisma.$disconnect();

  console.log(`Intentos: ${CONCURRENCY} | creadas: ${ok} | bloqueadas: ${blocked}`);
  if (ok === 1 && blocked === CONCURRENCY - 1) {
    console.log('RACE_TEST_OK — el constraint bloquea la doble reserva bajo concurrencia');
  } else {
    console.error('RACE_TEST_FAIL — se esperaba exactamente 1 cita creada');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
