# Implementation Plan: Business Profile Customization

## Overview

Implementación incremental del módulo de personalización de perfil de negocio. El orden sigue las dependencias naturales: schema de base de datos → DTOs compartidos → backend (guards, servicios, controlador) → frontend (composable, store, componentes, página) → checkpoint final.

## Tasks

- [x] 1. Prisma schema: agregar `bannerUrl` a `Tenant` y crear modelo `ImageVersion`
  - Agregar campo `bannerUrl String?` al modelo `Tenant` en `schema.prisma`
  - Agregar relación `imageVersions ImageVersion[]` al modelo `Tenant`
  - Crear enum `ImageType { LOGO BANNER }`
  - Crear modelo `ImageVersion` con campos: `id`, `tenantId`, `url`, `fileSize`, `imageType`, `createdAt`
  - Agregar índices `@@index([tenantId, imageType])` y `@@index([tenantId, createdAt(sort: Desc)])`
  - Ejecutar `npx prisma migrate dev --name add-image-version` y `npx prisma generate`
  - _Requirements: 2.5, 3.5, 4.1, 4.2_

- [x] 2. Shared DTOs en `packages/shared`
  - Crear `packages/shared/src/dto/profile.dto.ts` con interfaces: `ProfileDto`, `UpdateProfileDto`, `UpdateLocationDto`, `ImageVersionDto`, `UploadResponseDto`, `LocationUpdateResponseDto`
  - Exportar las nuevas interfaces desde `packages/shared/src/index.ts`
  - _Requirements: 1.1, 2.6, 3.6, 5.1, 5.4, 6.1_

- [x] 3. Guards y decoradores de roles
  - Crear `packages/backend/src/common/decorators/roles.decorator.ts` con el decorador `@Roles(...roles: Role[])`
  - Crear `packages/backend/src/common/guards/roles.guard.ts` que lea el metadata de `@Roles` y compare con `request.user.role`
  - Exportar ambos desde el barrel de `common` si existe, o directamente desde sus rutas
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. `StorageService` (Cloudflare R2)
  - Crear `packages/backend/src/profile/storage.service.ts`
  - Inyectar `ConfigService` para leer `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
  - Implementar método `upload(key: string, buffer: Buffer, contentType: string): Promise<string>` usando `@aws-sdk/client-s3` `PutObjectCommand`
  - Retornar `${R2_PUBLIC_URL}/${key}` como URL pública
  - Lanzar error descriptivo si `PutObjectCommand` falla
  - _Requirements: 2.4, 2.7, 3.4, 3.7_

- [x] 5. `GeocoderService` (Nominatim)
  - Crear `packages/backend/src/profile/geocoder.service.ts`
  - Implementar `geocode(address: string): Promise<{ latitude: number; longitude: number } | null>`
  - Llamar a `https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1` con header `User-Agent: Agendly/1.0`
  - Retornar `null` si el array de resultados está vacío o si ocurre un error de red
  - _Requirements: 5.4, 5.5, 5.6_

  - [x] 5.1 Escribir tests unitarios para `GeocoderService`
    - Caso: Nominatim retorna resultados → retorna `{ latitude, longitude }`
    - Caso: Nominatim retorna array vacío → retorna `null`
    - Caso: Nominatim lanza error de red → retorna `null`
    - _Requirements: 5.5, 5.6_

- [x] 6. DTOs de validación del backend
  - Crear `packages/backend/src/profile/dto/update-profile.dto.ts` con `UpdateProfileDto` usando decoradores `class-validator`: `@IsOptional`, `@IsString`, `@Length(2, 100)`, `@Matches` (E.164), `@IsTimeZone`
  - Crear `packages/backend/src/profile/dto/update-location.dto.ts` con `UpdateLocationDto`: `address` requerido, `latitude` opcional `@Min(-90) @Max(90)`, `longitude` opcional `@Min(-180) @Max(180)`
  - Crear `packages/backend/src/profile/dto/image-version.dto.ts` y `upload-response.dto.ts` como clases de respuesta
  - _Requirements: 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

- [x] 7. `UploadService`
  - Crear `packages/backend/src/profile/upload.service.ts`
  - Inyectar `StorageService` y `PrismaService`
  - Implementar método privado `validateFile(file: Express.Multer.File, maxSizeMb: number): void` que lanza `UnprocessableEntityException` si el MIME type no es `image/jpeg` o `image/png`, o si el tamaño supera el límite
  - Implementar `uploadLogo(tenantId: string, file: Express.Multer.File): Promise<UploadResponseDto>`:
    - Validar con `validateFile(file, 5)`
    - Construir key `tenants/{tenantId}/logos/{timestamp}-{filename}`
    - Llamar `StorageService.upload` → lanzar `BadGatewayException` si falla
    - Ejecutar `prisma.$transaction([tenant.update({ logoUrl }), imageVersion.create(...)])` 
    - Retornar `UploadResponseDto`
  - Implementar `uploadBanner(tenantId: string, file: Express.Multer.File): Promise<UploadResponseDto>` con la misma lógica pero key `banners/`, límite 8 MB, campo `bannerUrl`, y `imageType: BANNER`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 7.1 Escribir property test: validación de MIME type (Property 3)
    - **Property 3: Image MIME type validation**
    - Usar `fc.string()` para generar MIME types arbitrarios; filtrar los válidos y verificar que todos los inválidos resultan en 422 sin llamar a `StorageService`
    - **Validates: Requirements 2.1, 2.3, 3.1, 3.3**

  - [x] 7.2 Escribir property test: límites de tamaño de archivo (Property 4)
    - **Property 4: File size limits enforced per image type**
    - Generar tamaños de archivo con `fc.integer()` por encima del límite para logo (>5 MB) y banner (>8 MB); verificar rechazo con 422
    - **Validates: Requirements 2.2, 3.2**

  - [x] 7.3 Escribir property test: upload exitoso crea versión y actualiza URL (Property 5)
    - **Property 5: Successful upload creates ImageVersion and updates tenant URL**
    - Mockear `StorageService.upload` para retornar URL determinista; verificar que `ImageVersion` se crea con campos correctos y `Tenant.logoUrl`/`bannerUrl` se actualiza
    - **Validates: Requirements 2.4, 2.5, 2.6, 3.4, 3.5, 3.6**

  - [x] 7.4 Escribir property test: upload fallido no modifica el estado (Property 6)
    - **Property 6: Failed upload leaves system state unchanged**
    - Mockear `StorageService.upload` para lanzar error; verificar que se retorna 502 y que `prisma.$transaction` no fue llamado
    - **Validates: Requirements 2.7, 2.8, 3.7, 3.8**

  - [x] 7.5 Escribir property test: historial de imágenes es append-only y ordenado (Property 7)
    - **Property 7: Image version history is append-only and ordered descending**
    - Simular N uploads consecutivos con `fc.array(fc.record({...}), { minLength: 1, maxLength: 20 })`; verificar que el historial retorna exactamente N registros ordenados por `createdAt` desc
    - **Validates: Requirements 4.1, 4.2**

- [x] 8. `ProfileService`
  - Crear `packages/backend/src/profile/profile.service.ts`
  - Inyectar `PrismaService` y `GeocoderService`
  - Implementar `getProfile(tenantId: string): Promise<ProfileDto>` — query `prisma.tenant.findUniqueOrThrow` y mapear a `ProfileDto`
  - Implementar `updateProfile(tenantId: string, dto: UpdateProfileDto): Promise<ProfileDto>` — `prisma.tenant.update` con solo los campos presentes en `dto` (PATCH semántico)
  - Implementar `updateLocation(tenantId: string, dto: UpdateLocationDto): Promise<LocationUpdateResponseDto>`:
    - Si `dto.latitude` y `dto.longitude` están presentes → validar rangos y guardar directamente
    - Si no → llamar `GeocoderService.geocode(dto.address)` de forma no bloqueante; guardar resultado o `null` con warning
  - Implementar `getImageHistory(tenantId: string): Promise<ImageVersionDto[]>` — query `prisma.imageVersion.findMany` ordenado por `createdAt desc`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.5_

  - [x] 8.1 Escribir tests unitarios para `ProfileService`
    - Caso: GET retorna todos los campos requeridos para un tenant sembrado
    - Caso: PATCH con solo `name` actualiza nombre y deja phone/timezone sin cambios
    - Caso: PATCH con nombre inválido retorna 422
    - Caso: location update con coordenadas explícitas válidas las almacena correctamente
    - Caso: location update sin coordenadas dispara llamada al geocoder
    - Caso edge: geocoder retorna null → almacena address con coordenadas null
    - _Requirements: 1.1, 5.1, 5.4, 5.5, 6.1_

  - [x] 8.2 Escribir property test: PATCH solo actualiza campos enviados (Property 10)
    - **Property 10: PATCH semantics — only submitted fields are updated**
    - Generar subconjuntos arbitrarios de `{ name, phone, timezone }` con `fc.record` parcial; verificar que los campos no enviados permanecen iguales en el `Tenant`
    - **Validates: Requirements 5.7, 6.5**

  - [x] 8.3 Escribir property test: validación de longitud de nombre (Property 11)
    - **Property 11: Business name length validation**
    - Generar strings con `fc.string({ minLength: 0, maxLength: 200 })`; verificar que los de longitud <2 o >100 retornan 422 y no modifican `Tenant.name`
    - **Validates: Requirements 6.1**

  - [x] 8.4 Escribir property test: validación de formato E.164 (Property 12)
    - **Property 12: Phone E.164 format validation**
    - Generar strings arbitrarios con `fc.string()`; verificar que los que no coinciden con `^\+[1-9]\d{1,14}$` retornan 422
    - **Validates: Requirements 6.2**

  - [x] 8.5 Escribir property test: validación de timezone IANA (Property 13)
    - **Property 13: Timezone IANA validation**
    - Generar strings arbitrarios; verificar que los que no son IANA válidos retornan 422 y no modifican `Tenant.timezone`
    - **Validates: Requirements 6.3**

  - [x] 8.6 Escribir property test: validación de rango de coordenadas (Property 8)
    - **Property 8: Coordinate range validation**
    - Generar pares `(lat, lng)` con `fc.float()` fuera de rango; verificar que retornan 422 y el `Tenant` no cambia
    - **Validates: Requirements 5.2, 5.3**

  - [x] 8.7 Escribir property test: degradación graceful del geocoder (Property 9)
    - **Property 9: Geocoding failure degrades gracefully**
    - Mockear `GeocoderService.geocode` para retornar `null` (sin resultados) y para lanzar error (no disponible); verificar que en ambos casos se retorna HTTP 200 con `geocodingWarning` y coordenadas `null`
    - **Validates: Requirements 5.4, 5.5, 5.6**

- [x] 9. `ProfileController` y `ProfileModule`
  - Crear `packages/backend/src/profile/profile.controller.ts` con los 6 endpoints definidos en el diseño
  - Aplicar `@UseGuards(JwtAuthGuard, TenantGuard)` a nivel de clase
  - Aplicar `@UseGuards(RolesGuard) @Roles(Role.OWNER, Role.ADMIN)` en los 4 endpoints de mutación
  - Usar `@UseInterceptors(FileInterceptor('file'))` en los endpoints de upload
  - Crear `packages/backend/src/profile/profile.module.ts` declarando e importando `ProfileController`, `ProfileService`, `UploadService`, `StorageService`, `GeocoderService`
  - Registrar `ProfileModule` en `AppModule`
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.2, 5.1, 6.1, 7.1, 7.2, 7.3, 7.4_

- [x] 10. Checkpoint backend — todos los tests del backend pasan
  - Ejecutar `pnpm --filter @agendly/backend test` y verificar que todos los tests pasan
  - Asegurarse de que no hay errores de TypeScript con `pnpm --filter @agendly/backend typecheck`
  - Preguntar al usuario si hay dudas antes de continuar con el frontend

- [x] 11. Composable `useProfileApi` (frontend)
  - Crear `packages/frontend/composables/useProfileApi.ts`
  - Implementar funciones tipadas: `getProfile()`, `updateProfile(dto)`, `updateLocation(dto)`, `uploadImage(type: 'logo' | 'banner', file: File)`, `getImageHistory()`
  - `uploadImage` debe construir un `FormData` con campo `file` y hacer `POST` a `/profile/logo` o `/profile/banner`
  - Usar `$fetch` de Nuxt con el base URL del backend
  - _Requirements: 1.1, 2.1, 3.1, 4.2, 5.1, 6.1_

  - [x] 11.1 Escribir tests para `useProfileApi`
    - Caso: `getProfile` retorna `ProfileDto` tipado
    - Caso: `uploadImage` envía `multipart/form-data` con el campo `file` correcto
    - _Requirements: 1.1, 2.1_

- [x] 12. Pinia store `profile.ts` (frontend)
  - Crear `packages/frontend/stores/profile.ts`
  - Estado: `profileData: ProfileDto | null`, `imageHistory: ImageVersionDto[]`, `loading: boolean`, `uploadProgress: number`, `error: string | null`
  - Actions: `fetchProfile()`, `saveProfile(dto)`, `saveLocation(dto)`, `uploadLogo(file)`, `uploadBanner(file)`, `fetchImageHistory()`
  - Cada action debe manejar errores y actualizar `error` en el store
  - _Requirements: 1.1, 2.1, 3.1, 4.2, 5.1, 6.1_

  - [x] 12.1 Escribir tests para el store `profile`
    - Caso: `uploadLogo` llama al endpoint correcto y actualiza `profileData.logoUrl`
    - Caso: `saveProfile` con error de validación establece `error` en el store
    - _Requirements: 2.6, 6.4_

- [x] 13. Componente `ProfileForm.vue`
  - Crear `packages/frontend/components/profile/ProfileForm.vue`
  - Campos: nombre del negocio, teléfono (E.164), timezone (selector con zonas IANA comunes de México)
  - Validación en cliente antes de enviar
  - Emitir evento `submit` con el DTO parcial; el padre llama al store
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 14. Componente `ImageUpload.vue`
  - Crear `packages/frontend/components/profile/ImageUpload.vue`
  - Props: `type: 'logo' | 'banner'`, `currentUrl: string | null`, `maxSizeMb: number`
  - Soporte drag-and-drop y click-to-upload
  - Validar MIME type y tamaño en cliente antes de enviar (feedback inmediato)
  - Mostrar preview de la imagen actual y progreso de upload
  - Emitir evento `uploaded` con la nueva URL al completar
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 15. Componente `LocationForm.vue`
  - Crear `packages/frontend/components/profile/LocationForm.vue`
  - Campo de texto para dirección
  - Mapa Leaflet con marcador arrastrable (usar `leaflet` con import dinámico para SSR)
  - Al soltar el marcador, actualizar campos `latitude` y `longitude` en el formulario
  - Al hacer blur en el campo de dirección, llamar al store para geocodificar (vía `/profile/location`)
  - Mostrar `geocodingWarning` si está presente en la respuesta
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 16. Componente `ImageHistory.vue`
  - Crear `packages/frontend/components/profile/ImageHistory.vue`
  - Props: `images: ImageVersionDto[]`, `type: 'LOGO' | 'BANNER'`
  - Lista scrollable con thumbnail, fecha de upload y tamaño de archivo
  - Filtrar por `imageType` recibido en props
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 17. Página `profile.vue`
  - Crear `packages/frontend/pages/admin/settings/profile.vue`
  - Layout con tabs: "Información general", "Imágenes", "Ubicación"
  - Tab "Información general": `ProfileForm` + botón guardar
  - Tab "Imágenes": dos secciones (Logo y Banner) con `ImageUpload` e `ImageHistory` para cada una
  - Tab "Ubicación": `LocationForm` + botón guardar
  - Llamar a `store.fetchProfile()` y `store.fetchImageHistory()` en `onMounted`
  - Proteger la ruta con middleware de autenticación (solo OWNER/ADMIN)
  - _Requirements: 1.1, 2.1, 3.1, 4.2, 5.1, 6.1, 7.1, 7.2_

- [x] 18. Checkpoint final — todos los tests pasan
  - Ejecutar `pnpm test` en el monorepo completo
  - Verificar `pnpm typecheck` sin errores
  - Preguntar al usuario si hay dudas o ajustes antes de cerrar la feature

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los property tests usan `fast-check` (instalar con `pnpm add -D fast-check --filter @agendly/backend`)
- Los checkpoints garantizan validación incremental antes de avanzar al siguiente bloque
- El orden schema → shared → backend → frontend minimiza el retrabajo por cambios de tipos
