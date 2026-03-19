# Product Brief — Agendly

**Autor:** Nico
**Fecha:** 2026-03-19
**Versión:** 1.0
**Estado:** MVP en desarrollo activo

---

## ¿Qué es Agendly?

Agendly es una plataforma SaaS de agendamiento de citas diseñada para negocios pequeños de belleza y estética en México. Su propósito central es resolver el **problema del techo de tiempo**: los dueños de salones, barberías y spas invierten horas diarias coordinando citas por WhatsApp, sin capacidad para enfocarse en su negocio.

Agendly automatiza el agendamiento por completo. El dueño recupera espacio mental y claridad operativa. Sus clientes reservan solos, sin fricciones, sin crear una cuenta.

---

## El Problema

Los negocios pequeños de servicios de belleza operan **sin infraestructura de agendamiento**. Las citas se coordinan manualmente por WhatsApp a lo largo del día:

- Cambios constantes de contexto para el dueño
- Reservas perdidas o mal registradas
- No-shows sin notificación
- Techo duro en la capacidad de crecer

El dueño no puede delegar el agendamiento sin perder el control. No puede crecer sin visibilidad de su demanda real. **WhatsApp lo tiene atrapado.**

---

## La Solución

Agendly provee dos herramientas complementarias:

### 1. Formulario público de reservas
Una URL compartible (`agendly.mx/[negocio]`) donde los clientes reservan de forma autónoma:
- Seleccionan servicio, empleado y horario disponible
- Ingresan solo nombre y teléfono — sin crear cuenta
- Reciben confirmación automática por email

### 2. Panel de administración (Admin)
Un dashboard mobile-first donde el dueño tiene el control sin estar pendiente:
- Vista de agenda día/semana con todas las citas del negocio
- Actualización en tiempo real (cada 10–15 segundos)
- Creación de citas manuales para walk-ins
- Cancelación y reagendado con notificación automática al cliente

---

## Para Quién es Agendly

### Usuario primario — El Dueño del Negocio (cliente de pago)
Microempresario con 1–10 empleados. Maneja su negocio desde el celular. No tiene tiempo para herramientas complejas ni presupuesto para software caro.

**Personas representativas:**
| Persona | Perfil | Pain point |
|---|---|---|
| Lupita | Dueña salón de uñas, Guadalajara, 35 años, low-tech | Costo percibido vs. tiempo ahorrado |
| Roberto | Dueño barbería, CDMX, 42 años, tech-savvy | Control de agenda por empleado + estadísticas |
| Don Marco | Dueño spa, Puebla, 55 años, delega en recepcionista | Confiabilidad y simplicidad extrema |

### Usuario secundario — El Cliente Final
El cliente del negocio que agenda citas. Espera **fricción cero y certeza de confirmación**. No quiere crear una cuenta. Prefiere WhatsApp, pero acepta un formulario si es rápido.

**Persona representativa:**
| Persona | Perfil | Expectativa |
|---|---|---|
| Daniela | Clienta, 27 años, digital nativa | Reservar en ≤ 3 pasos desde su celular |

---

## Diferenciador: La Certeza

El diferenciador central de Agendly **no es el canal — es la certeza.**

WhatsApp + confirmación automática crea un contrato de confiabilidad que estos negocios nunca han tenido:
- El **cliente** sabe que su cita es real y será respetada
- El **dueño** sabe que su día está definido sin haber monitoreado ningún chat

Esto se entrega a través de una experiencia diseñada específicamente para México:
- Español mexicano natural (no UX genérica traducida)
- Onboarding que habla el idioma del dueño no técnico
- Infraestructura de precio nativa (MercadoPago, OXXO en V1.1)
- Admin mobile-first, porque los dueños están siempre en movimiento

---

## Posicionamiento Competitivo

| Competidor | Fortaleza | Por qué no sirve al mercado objetivo |
|---|---|---|
| Calendly | UX pulida, integraciones | En inglés, requiere cuenta del cliente, sin WhatsApp, sin LATAM |
| Acuity Scheduling | Multi-staff, pagos | Precio alto, curva de aprendizaje, sin WhatsApp |
| SimplyBook.me | Multi-vertical | Genérico, sin localización, complejo para no-técnicos |
| WhatsApp manual | Familiar para el dueño | Sin automatización, sin agenda, consume tiempo |
| **Agendly** | Español MX + cero fricción + precio accesible + formulario web | — |

**Agendly no compite contra herramientas globales — ocupa el espacio que ellas dejaron vacío.**

---

## Modelo de Negocio

| Atributo | Valor |
|---|---|
| **Tipo** | SaaS B2B multi-tenant |
| **Mercado** | Micronegocios de belleza/estética en México |
| **Precio objetivo** | $150–$299 MXN/mes |
| **Trial** | 14 días gratis, sin tarjeta de crédito |
| **Facturación** | Mensual |
| **Canal de adquisición principal** | Orgánico — badge "Agenda gestionada por Agendly" en cada confirmación de cita |

### El growth loop embebido en el producto

Cada formulario de reservas activo es un punto de exposición de marca con **costo cero**:

> Negocio usa Agendly → Sus clientes ven el badge → Algunos son también dueños de negocios → Se registran

La adquisición orgánica está diseñada en la arquitectura del producto desde el día 1.

---

## Journeys de Usuario

### J1 — Lupita configura su negocio (Onboarding)
1. Crea cuenta con Google (un click)
2. Wizard de onboarding: nombre del negocio, servicios, empleados
3. Agendly precarga horario default (Lun–Sáb 9am–7pm), Lupita confirma o ajusta
4. Último paso: **"Tu negocio está listo → Comparte este link"** + URL pública
5. Lupita comparte el link en su historia de WhatsApp
6. Esa tarde recibe su primera reserva sin haber contestado nada

**Momento de activación:** Primera reserva recibida sin intervención manual.

---

### J2 — Roberto reserva desde el formulario público
1. Abre `agendly.mx/bellasnails` desde su celular
2. Selecciona servicio → empleado → fecha → slot disponible
3. Ingresa nombre y teléfono
4. Recibe confirmación en pantalla + email con detalles, datos del negocio y link de calendario

**Tiempo total:** ≤ 3 pasos desde pantalla principal, completable solo con gestos táctiles.

---

### J3 — Sandra revisa su día
1. Abre el admin a las 8am desde su celular
2. Ve vista de día: todas las citas por empleada, con hora, servicio y cliente
3. La vista se actualiza automáticamente — solo cuando el tab está activo
4. Identifica huecos, registra walk-ins, cancela si necesario

**Estado objetivo:** *"Estoy en control sin estar pendiente."*

---

### J4 — Sandra descubre Agendly como clienta primero (Adquisición orgánica)
1. Agenda una cita en el salón de su amiga que ya usa Agendly
2. Recibe el email de confirmación con el badge "Agenda gestionada por Agendly →"
3. Sandra también tiene un negocio — el badge la lleva a la landing
4. Se registra — **la adquisición ocurrió sin gasto de marketing**

---

## Estado Objetivo de Experiencia

| Actor | Estado actual | Estado objetivo con Agendly |
|---|---|---|
| Dueño del negocio | Coordinación reactiva 24/7 disponible para agendar | Gestión pasiva — el sistema confirma, organiza y comunica sin intervención |
| Cliente final | Envía mensajes esperando respuesta, incertidumbre de confirmación | Reserva en ≤ 3 pasos, recibe confirmación automática inmediata |

---

## Alcance del MVP (3 meses)

**Incluido:**
- Auth: email/password + Google OAuth
- Multi-tenant: Account → Negocio → Empleados + Servicios
- Configuración de negocio: servicios (duración, buffer, precio), empleados, horarios
- Formulario público de reservas con URL compartible
- Motor de disponibilidad: slots libres por empleado + servicio, sin doble reserva
- Email de confirmación automática al cliente
- Vista de agenda en tiempo real (polling) — admin mobile-first
- Onboarding wizard con cálculo de ROI explícito
- Gestión de citas: cancelación y reagendado con notificación al cliente
- Trial management: 14 días, sin tarjeta
- Cumplimiento LFPDPPP básico (aviso de privacidad, mecanismos ARCO)

**Movido a V1.1:**
- Bot de WhatsApp (n8n + Meta Business API)
- MercadoPago / cobro automático de suscripción
- Rol Recepcionista y Rol Empleada
- Multi-sucursal
- Dashboard de estadísticas
- WebSockets en lugar de polling

---

## Arquitectura — Decisiones Clave

| Decisión | Qué | Por qué |
|---|---|---|
| **Channel-agnostic** | El motor de reservas no sabe por qué canal llegó la cita | Agregar WhatsApp, SMS o Instagram en V1.1 sin rediseño del backend |
| **Formulario web en MVP** | Sin WhatsApp en MVP | Elimina dependencia de aprobación Meta API del camino crítico |
| **Multi-tenant desde el día 1** | `tenant_id` en todas las tablas | Aislamiento total de datos entre negocios |
| **Polling en MVP** | Actualización cada 10–15s solo cuando el tab está activo | Menor complejidad; WebSockets en V1.1 con volumen validado |
| **Soft deletes** | Empleados y servicios no se borran físicamente | Preserva historial completo de reservas anteriores |
| **Monorepo pnpm** | NestJS (backend) + Nuxt 3 (frontend) + Shared (DTOs) | Un solo repositorio, tipado compartido, deploys independientes |
| **Railway.app** | PostgreSQL + deploy en la misma plataforma | Zero-ops en MVP, escala con el negocio |

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | Nuxt 3, Vue 3, Tailwind CSS, Nuxt UI, Pinia |
| **Backend** | NestJS, Passport.js (JWT + Google OAuth), Prisma |
| **Base de datos** | PostgreSQL |
| **Email** | Resend (SPF/DKIM, reintentos automáticos) |
| **Deploy** | Railway.app (PostgreSQL incluido, SSL automático) |
| **CI/CD** | GitHub Actions (type-check, lint, test, prisma generate) |

---

## Métricas de Éxito — MVP Mes 3

| Métrica | Target |
|---|---|
| Negocios registrados orgánicamente | ≥ 5 |
| Retención al mes 3 | ≥ 80% de registros orgánicos |
| Reservas completadas sin abandono | ≥ 85% |
| Doble reserva reportada | 0 |
| NPS informal | ≥ 4 de 5 responden "Sí, recomendaría" |

**Señal de product-market fit:** Un negocio piloto recomienda Agendly a otro negocio sin que el equipo lo solicite.

---

## Visión a Futuro

Una vez que un negocio tiene datos de reservas estructurados, **por primera vez puede ver patrones de demanda real** — la base para saber cuándo contratar, cuándo agregar servicios, cuándo expandirse.

El camino de expansión:
1. **V1.1:** Bot WhatsApp + MercadoPago + roles adicionales + estadísticas
2. **V2:** Módulo CRM + predicción de demanda + recordatorios proactivos (reducción de no-shows)
3. **LATAM:** Localización para Colombia, Argentina y otros mercados hispanohablantes

Agendly no es solo una herramienta de agendamiento — es el primer paso hacia **visibilidad operativa** para el micronegocio de servicios en Latinoamérica.

---

*Generado por BMad Master · Agendly Product Brief v1.0 · 2026-03-19*
