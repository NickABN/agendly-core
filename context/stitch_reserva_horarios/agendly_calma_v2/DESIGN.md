# Guía Maestra de Diseño: El Santuario Digital v2

## 1. Filosofía y Norte Creativo: "Minimalismo Atmosférico"
Este sistema de diseño no es una simple evolución; es una purificación. Nuestro Norte Creativo es el **Minimalismo Atmosférico**. Mientras que el software tradicional se siente como una herramienta rígida, este sistema debe sentirse como una extensión del espacio de trabajo físico de un profesional de alto nivel: despejado, sereno y táctil.

Rompemos con la estética de "plantilla genérica" mediante el uso de **asimetría intencional** y **jerarquía tonal**. No buscamos encerrar el contenido en cajas, sino permitir que respire. La interfaz debe invitar a la calma, eliminando el ruido visual (líneas, bordes negros, contrastes violentos) para centrar la atención en lo que realmente importa: el tiempo y el enfoque del usuario.

---

## 2. Paleta de Colores y Jerarquía de Superficies

### El Concepto "No-Line" (Cero Bordes)
Queda estrictamente prohibido el uso de bordes sólidos de 1px para seccionar la interfaz. La delimitación de áreas debe lograrse exclusivamente mediante:
1.  **Cambios de tono en el fondo:** Un contenedor `surface-container-low` sobre un fondo `surface`.
2.  **Transiciones tonales suaves:** El ojo humano percibe el cambio de profundidad sin necesidad de una línea negra que ensucie el diseño.

### Jerarquía de Capas (Nesting)
Tratamos la UI como capas de papel fino o cristal esmerilado.
*   **Nivel 0 (Fondo):** `surface` (#F8F9FA) - La base de toda la experiencia.
*   **Nivel 1 (Secciones):** `surface-container-low` (#F3F4F5) - Para áreas de contenido secundario.
*   **Nivel 2 (Tarjetas/Interactivos):** `surface-container-lowest` (#FFFFFF) - El blanco puro se reserva para elementos que "flotan" y requieren la máxima atención del usuario.

### Regla de Cristal y Gradiente
Para elementos flotantes (modales, menús desplegables), utiliza efectos de **Glassmorphism**:
*   Fondo: `surface` con 80% de opacidad + `backdrop-blur` de 12px.
*   **Soul Gradient:** En botones principales o estados de éxito, permite un sutil gradiente desde `primary` (#005DA9) hacia `primary-container` (#0076D3) para evitar una apariencia plana y "barata".

---

## 3. Tipografía: Autoridad Editorial con Inter
La tipografía no solo comunica datos; establece el tono de voz. Usamos **Inter** para proyectar modernidad y precisión técnica.

*   **Display & Headlines (XL a MD):** Deben usar peso `semibold` con un `letter-spacing` de -0.02em. Esto crea un bloque de texto compacto y autoritario, similar a una revista de diseño premium.
*   **Body Text:** El cuerpo del mensaje siempre en `medium`. Nunca uses pesos ligeros (light) para texto largo, ya que comprometen la legibilidad en pantallas de alta densidad.
*   **Labels:** El micro-texto (labels) debe tener un ligero aumento en el `letter-spacing` (+0.05em) para asegurar que sea escaneable a pesar de su tamaño reducido.

---

## 4. Elevación y Profundidad Tonal

### El Principio de Superposición
En lugar de sombras pesadas, usamos **Capas Tonales**. Una tarjeta blanca (`surface-container-lowest`) sobre un fondo gris ultra-suave (`surface`) genera una elevación natural sin necesidad de efectos visuales pesados.

### Sombras Ambientales (The Whisper Shadow)
Si un elemento requiere flotar (ej. un botón de acción flotante), la sombra debe ser casi imperceptible:
*   **Color:** Una versión entintada del `on-surface` (ej. `#191C1D` al 4% de opacidad).
*   **Blur:** Valores de desenfoque altos (16px a 24px) para simular una luz ambiental suave, no una luz dura de estudio.

### El "Ghost Border" (Último Recurso)
Si la accesibilidad exige un borde, usa un **Ghost Border**: el token `outline-variant` con una opacidad reducida al 15%. Nunca debe ser un color sólido al 100%.

---

## 5. Componentes Signature

### Botones y Acciones
*   **Primario:** Fondo `primary`, texto `on-primary`. Radio de 8px (`lg`). Sin bordes. Efecto de elevación sutil al hacer hover.
*   **Secundario:** Fondo `secondary-container`, texto `on-secondary-container`. Ideal para acciones de soporte.
*   **Terciario (Ghost):** Solo texto en `primary`. Sin contenedor visible hasta el estado de hover.

### Campos de Entrada (Inputs)
*   **Radio:** 8px (`lg`).
*   **Estado Inactivo:** Fondo `surface-container-high` con un Ghost Border casi invisible.
*   **Estado Focus:** El borde se transforma en un anillo de 2px de color `primary` con una opacidad del 20%, creando un aura de enfoque suave.

### Tarjetas y Listas (Zero-Divider Policy)
*   **Prohibido:** Usar líneas divisorias horizontales entre elementos de una lista.
*   **Solución:** Usa el sistema de espaciado. Un `padding-y` de `4` (1rem) o `5` (1.25rem) es suficiente para separar ítems. Para listas complejas, alterna sutilmente el color de fondo de los ítems usando `surface-container-low`.

### Chips de Estado
*   No uses colores vibrantes para todo. El chip debe ser `secondary-container` con texto `on-secondary-container`. Solo usa color (ej. `error`) cuando la atención del usuario sea crítica.

---

## 6. Do's & Don'ts (Prácticas Recomendadas)

### Sí (Do)
*   **Usa el espacio en blanco como una herramienta:** El espacio no es "vacío", es elegancia. Si tienes duda, añade una unidad más de nuestra escala de espaciado.
*   **Prioriza el contraste de tamaño sobre el de color:** Haz que un encabezado sea más grande, no necesariamente más oscuro.
*   **Mantén la calma visual:** Cada elemento en pantalla debe tener una razón de existir. Si no aporta valor, elimínalo.

### No (Don't)
*   **No uses bordes negros o grises oscuros:** Rompen la ilusión de "Santuario Digital".
*   **No satures con el Azul Primario:** El azul es para acentos y llamadas a la acción. Si todo es azul, nada es importante.
*   **No uses sombras con opacidad mayor al 10%:** Las sombras pesadas hacen que la interfaz se sienta "sucia" y anticuada.
*   **No mezcles radios de borde:** Mantén los 12px para tarjetas y 8px para elementos interactivos. La consistencia geométrica es clave para la profesionalidad.

---
*Este sistema de diseño es un organismo vivo. Su éxito reside en la disciplina de mantener la simplicidad y el respeto por el espacio visual del usuario.*