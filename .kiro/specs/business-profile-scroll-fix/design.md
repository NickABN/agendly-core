# Business Profile Scroll Fix — Bugfix Design

## Overview

La página `/admin/settings/profile` introduce un segundo contexto de scroll anidado dentro del layout admin. El layout (`admin.vue`) ya establece `overflow-hidden` en el contenedor principal y delega el scroll a cada página mediante `<slot />`. La página de perfil responde con `h-full overflow-hidden` en su raíz y `overflow-y-auto` en el contenedor de contenido, lo que genera una scrollbar interna visible que rompe la estética del panel.

La corrección es mínima: eliminar el contexto de altura fija y scroll interno de la página, permitiendo que el flujo natural del documento gestione el scroll a través del contenedor `flex-1 flex flex-col overflow-hidden` del layout.

## Glossary

- **Bug_Condition (C)**: La condición que activa el bug — la página renderiza un contenedor con `h-full overflow-hidden` + hijo con `overflow-y-auto`, creando un scroll interno visible.
- **Property (P)**: El comportamiento correcto — la página no debe introducir un contexto de scroll propio; el scroll debe fluir naturalmente a través del layout.
- **Preservation**: El header fijo, el acceso a todo el contenido de los tabs y el layout/navegación lateral deben permanecer sin cambios.
- **isBugCondition**: Función que evalúa si el árbol DOM de la página contiene el patrón de clases que genera el scroll anidado.
- **overflow-y-auto**: Clase Tailwind que activa `overflow-y: auto`, mostrando scrollbar cuando el contenido supera la altura del contenedor.
- **h-full**: Clase Tailwind que fija la altura del elemento al 100% de su padre, creando un contexto de altura acotada que activa el scroll interno.

## Bug Details

### Bug Condition

El bug se manifiesta cuando la página de perfil renderiza su template raíz con `h-full overflow-hidden` y su contenedor de contenido con `overflow-y-auto`. Dado que el layout ya limita la altura con `overflow-hidden`, el hijo `h-full` toma exactamente esa altura acotada y el `overflow-y-auto` genera una scrollbar interna en lugar de dejar que el scroll ocurra en el nivel del layout.

**Formal Specification:**
```
FUNCTION isBugCondition(pageRootElement)
  INPUT: pageRootElement — elemento raíz del template de profile.vue
  OUTPUT: boolean

  rootHasFixedHeight  := pageRootElement.classList CONTAINS 'h-full'
  rootHidesOverflow   := pageRootElement.classList CONTAINS 'overflow-hidden'
  contentScrollable   := pageRootElement.querySelector('.overflow-y-auto') IS NOT NULL

  RETURN rootHasFixedHeight AND rootHidesOverflow AND contentScrollable
END FUNCTION
```

### Examples

- **Bug activo**: Usuario navega a `/admin/settings/profile` → el div raíz tiene `h-full overflow-hidden`, el div de contenido tiene `overflow-y-auto` → aparece scrollbar interna dentro del área de contenido.
- **Bug activo**: El contenido del tab "Imágenes" supera la altura visible → el scroll ocurre dentro del contenedor de la página, no en el nivel del layout, mostrando una scrollbar discordante.
- **Comportamiento esperado**: Otras páginas del panel (ej. `/admin/clients`) no tienen `h-full overflow-hidden` en su raíz → el scroll fluye naturalmente sin scrollbar interna.
- **Edge case**: En pantallas muy pequeñas donde todo el contenido cabe en la vista → no hay scrollbar visible de ningún tipo (comportamiento correcto en ambas versiones).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- El header fijo con el botón de regreso y el título "Perfil del negocio" debe continuar visible y pegado al tope del área de contenido.
- El usuario debe poder acceder a todo el contenido de los tres tabs (Información general, Imágenes, Ubicación) mediante scroll.
- El layout admin (sidebar, navegación lateral, avatar de usuario) no debe sufrir ningún cambio visual ni funcional.
- Los tabs y su lógica de navegación interna deben continuar funcionando exactamente igual.

**Scope:**
Todos los inputs que NO involucren el patrón de clases `h-full overflow-hidden` + `overflow-y-auto` en la raíz de la página deben quedar completamente sin afectar. Esto incluye:
- Clics en tabs y navegación entre secciones
- Envío de formularios (perfil, ubicación)
- Carga y visualización de imágenes
- Navegación a otras páginas del panel

## Hypothesized Root Cause

Basado en el análisis del código:

1. **Patrón de layout incorrecto en la página**: El div raíz de `profile.vue` usa `flex flex-col h-full overflow-hidden`. La clase `h-full` hace que el elemento tome exactamente la altura del contenedor padre (que ya está acotado por `overflow-hidden` en el layout), y `overflow-hidden` evita que el contenido desborde visualmente hacia afuera.

2. **Scroll interno innecesario**: El div de contenido hijo usa `flex-1 overflow-y-auto`, lo que activa una scrollbar dentro de ese contenedor acotado. Este patrón es correcto cuando la página es el único contexto de scroll, pero en este layout el scroll debería ocurrir en el nivel del `<slot />` del layout o fluir naturalmente.

3. **Inconsistencia con otras páginas**: Otras páginas del panel probablemente no usan `h-full overflow-hidden` en su raíz, por lo que el contenido fluye naturalmente y el scroll ocurre a nivel del contenedor `flex-1 flex flex-col overflow-hidden` del layout.

4. **Causa raíz concreta**: Las clases `h-full overflow-hidden` en el div raíz de `profile.vue` (línea del template: `<div class="flex flex-col h-full overflow-hidden">`) son las que crean el contexto de scroll anidado. Eliminarlas permite que el contenido fluya naturalmente.

## Correctness Properties

Property 1: Bug Condition — Ausencia de scroll interno en la página de perfil

_For any_ renderizado de la página `/admin/settings/profile` donde el contenido supere la altura visible, la función/template corregido SHALL gestionar el scroll a través del layout natural sin introducir un contenedor `overflow-y-auto` dentro de un elemento `h-full overflow-hidden`, de modo que no aparezca una scrollbar interna discordante.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Acceso completo al contenido y header fijo

_For any_ interacción del usuario en la página de perfil donde el bug condition NO se cumpla (pantallas donde el contenido cabe en la vista, o tras aplicar el fix), el template corregido SHALL producir exactamente el mismo resultado visual y funcional que el original, preservando el header fijo, la navegación por tabs y el acceso a todo el contenido.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Asumiendo que el análisis de causa raíz es correcto:

**File**: `packages/frontend/pages/admin/settings/profile.vue`

**Element**: `<div class="flex flex-col h-full overflow-hidden">` (div raíz del template)

**Specific Changes**:

1. **Eliminar `h-full overflow-hidden` del div raíz**: Cambiar `class="flex flex-col h-full overflow-hidden"` por `class="flex flex-col"`. Esto elimina el contexto de altura fija que activa el scroll interno.

2. **Eliminar `overflow-y-auto` del div de contenido**: Cambiar `class="flex-1 overflow-y-auto p-4 sm:p-6"` por `class="p-4 sm:p-6"`. Sin el contexto de altura acotada del padre, `flex-1` y `overflow-y-auto` ya no son necesarios; el contenido fluye naturalmente.

3. **Verificar que el header sticky sigue funcionando**: El header usa `sticky top-0 z-40`. Sin `overflow-hidden` en el padre, `sticky` funciona correctamente respecto al scroll del layout. Si el layout usa `overflow-hidden` en el contenedor del slot, puede ser necesario ajustar el contexto de `sticky` — verificar visualmente tras el cambio.

**Resultado esperado**: El contenido de la página fluye naturalmente dentro del `flex-1 flex flex-col overflow-hidden` del layout, sin scrollbar interna adicional.

## Testing Strategy

### Validation Approach

La estrategia sigue dos fases: primero confirmar el bug en el código sin corregir inspeccionando el DOM, luego verificar que el fix elimina la scrollbar interna sin romper el acceso al contenido ni el header fijo.

### Exploratory Bug Condition Checking

**Goal**: Confirmar que el patrón de clases `h-full overflow-hidden` + `overflow-y-auto` genera una scrollbar interna ANTES de aplicar el fix.

**Test Plan**: Montar el componente `profile.vue` con un contenido que supere la altura del viewport y verificar que el elemento con `overflow-y-auto` tiene `scrollHeight > clientHeight` y que el elemento raíz tiene `overflow: hidden` computado.

**Test Cases**:
1. **Scrollbar interna visible**: Montar la página con contenido largo → verificar que existe un elemento con `overflow-y: auto` cuyo `scrollHeight > clientHeight` (fallará en código corregido).
2. **Raíz con altura fija**: Verificar que el div raíz tiene `h-full` y `overflow-hidden` en sus clases (fallará en código corregido).
3. **Scroll en nivel incorrecto**: Simular scroll y verificar que el evento ocurre en el contenedor interno, no en el layout (fallará en código corregido).

**Expected Counterexamples**:
- El elemento `.overflow-y-auto` tiene `scrollHeight > clientHeight` cuando el contenido supera la vista.
- Posibles causas: `h-full` acota la altura, `overflow-y-auto` activa la scrollbar interna.

### Fix Checking

**Goal**: Verificar que tras el fix, para todos los inputs donde el bug condition se cumplía, la página ya no genera scrollbar interna.

**Pseudocode:**
```
FOR ALL pageRender WHERE isBugCondition(pageRootElement) WAS true DO
  result := render(profile_fixed)
  ASSERT NOT exists(element WITH overflow-y-auto AND scrollHeight > clientHeight)
  ASSERT NOT pageRootElement.classList.contains('h-full')
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde el bug condition NO se cumple, el template corregido produce el mismo resultado visual y funcional que el original.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(pageRootElement) DO
  ASSERT profile_original(interaction) = profile_fixed(interaction)
END FOR
```

**Testing Approach**: Las pruebas de preservación son principalmente visuales y de componente. Se recomienda pruebas de componente con Vitest + Vue Test Utils para verificar que el header, los tabs y el contenido siguen renderizando correctamente.

**Test Cases**:
1. **Header fijo preservation**: Verificar que el header con `sticky top-0` sigue renderizando con las clases correctas tras el fix.
2. **Tab navigation preservation**: Verificar que cambiar entre tabs sigue mostrando/ocultando las secciones correctas.
3. **Content accessibility preservation**: Verificar que todo el contenido de cada tab es accesible en el DOM tras el fix.

### Unit Tests

- Verificar que el div raíz del template NO contiene `h-full` ni `overflow-hidden` tras el fix.
- Verificar que el div de contenido NO contiene `overflow-y-auto` tras el fix.
- Verificar que el header renderiza con `sticky top-0 z-40 shrink-0`.

### Property-Based Tests

- Para cualquier altura de viewport simulada, el componente corregido no debe tener elementos con `overflow-y-auto` dentro de un padre con `h-full overflow-hidden`.
- Para cualquier combinación de datos de perfil (con/sin logo, con/sin banner, con/sin dirección), el componente corregido debe renderizar todos los tabs accesibles.

### Integration Tests

- Navegar a `/admin/settings/profile` en un browser real y verificar visualmente que no aparece scrollbar interna.
- Verificar que el header permanece fijo al hacer scroll en la página.
- Verificar que cambiar entre tabs y hacer scroll en el tab de Imágenes funciona correctamente.
- Verificar que navegar a otras páginas del panel no muestra cambios en el layout o la navegación lateral.
