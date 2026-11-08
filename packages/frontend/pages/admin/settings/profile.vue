<script setup lang="ts">
definePageMeta({ layout: 'admin' });

await navigateTo({ path: '/admin/config', query: { tab: 'imagenes' } });
</script>

<template>
  <div class="flex items-center justify-center p-8" role="status">
    Redirigiendo a la configuración de imágenes…
  </div>
</template>
