-- Anti doble-reserva a nivel de base de datos.
-- Dos citas CONFIRMED del mismo empleado no pueden superponerse en el tiempo,
-- sin importar cuántos procesos intenten insertar en paralelo.
-- Violación => error Postgres 23P01 (exclusion_violation), mapeado a 409 en BookingService.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "employeeId" WITH =,
    tsrange("startTime", "endTime") WITH &&
  )
  WHERE (status = 'CONFIRMED');
