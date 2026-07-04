# Bugfix Requirements Document

## Introduction

El endpoint `POST /auth/register` falla con un error 500 al intentar crear una nueva cuenta de negocio. El flujo crea un `Tenant` y un `User` dentro de un `$transaction` de Prisma con callback interactivo. Sin embargo, `PrismaService` usa `@prisma/adapter-pg` (driver adapter), y Prisma no soporta transacciones interactivas con callback cuando se usa un driver adapter — lanza una excepción en tiempo de ejecución. El frontend captura el error genérico y muestra "Error al crear la cuenta".

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN se envía un payload de registro válido (`businessName`, `ownerName`, `email`, `password`) THEN el sistema lanza una excepción interna al intentar ejecutar `prisma.$transaction` con callback interactivo, ya que el driver adapter `PrismaPg` no soporta ese modo de transacción

1.2 WHEN el backend lanza la excepción interna THEN el sistema responde con HTTP 500 y el frontend muestra "Error al crear la cuenta" sin crear el tenant ni el usuario

### Expected Behavior (Correct)

2.1 WHEN se envía un payload de registro válido THEN el sistema SHALL crear el `Tenant` y el `User` de forma atómica y responder con HTTP 201 incluyendo `accessToken` y los datos del usuario

2.2 WHEN la creación atómica de `Tenant` y `User` se realiza THEN el sistema SHALL usar `$transaction` con el modo de array de operaciones secuenciales (batch), compatible con el driver adapter `PrismaPg`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN se intenta registrar un email que ya existe THEN el sistema SHALL CONTINUE TO responder con HTTP 409 y el mensaje "Ya existe una cuenta con este email"

3.2 WHEN el payload de registro es inválido (campos faltantes, email malformado, contraseña menor a 8 caracteres) THEN el sistema SHALL CONTINUE TO responder con HTTP 400 de validación sin crear ningún registro

3.3 WHEN se registra un negocio cuyo slug generado ya existe THEN el sistema SHALL CONTINUE TO generar un slug único con sufijo numérico (`slug-1`, `slug-2`, etc.)

3.4 WHEN el flujo de registro de Google (`findOrCreateGoogleUser`) crea un nuevo tenant y usuario THEN el sistema SHALL CONTINUE TO funcionar correctamente aplicando la misma corrección de transacción
