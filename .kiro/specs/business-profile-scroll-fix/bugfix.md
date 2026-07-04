# Bugfix Requirements Document

## Introduction

En la página de configuración del perfil de negocio (`/admin/settings/profile`), aparece una barra de scroll vertical que desentona con la estética del diseño. El layout admin ya gestiona el scroll a nivel de contenedor principal, pero la página introduce un segundo contexto de scroll (`overflow-y-auto`) dentro de un contenedor con altura fija (`h-full`), generando una scrollbar visible e inconsistente con el resto de las páginas del panel.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el usuario navega a `/admin/settings/profile` THEN el sistema muestra una barra de scroll vertical dentro del área de contenido de la página que desentona visualmente con el diseño del panel.

1.2 WHEN el contenido de la página supera la altura visible THEN el sistema genera un scroll interno en el contenedor de la página en lugar de usar el scroll natural del layout.

### Expected Behavior (Correct)

2.1 WHEN el usuario navega a `/admin/settings/profile` THEN el sistema SHALL mostrar la página sin una barra de scroll interna visible que rompa la estética del diseño.

2.2 WHEN el contenido de la página supera la altura visible THEN el sistema SHALL gestionar el scroll de forma consistente con el resto de las páginas del panel admin, sin introducir un contenedor de scroll adicional que genere una scrollbar discordante.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el usuario navega a `/admin/settings/profile` THEN el sistema SHALL CONTINUE TO mostrar correctamente el header fijo con el botón de regreso y el título de la página.

3.2 WHEN el usuario hace scroll en la página de perfil THEN el sistema SHALL CONTINUE TO permitir acceder a todo el contenido de los tabs (información general, imágenes, ubicación).

3.3 WHEN el usuario accede al panel admin desde cualquier otra página THEN el sistema SHALL CONTINUE TO mostrar el layout y la navegación lateral sin cambios.
