<script setup lang="ts">
import AppToaster from '~/components/ui/AppToaster.vue';
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ColdStartNotice />
  <AppToaster />
</template>
