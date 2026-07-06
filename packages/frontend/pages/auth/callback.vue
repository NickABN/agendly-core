<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const { fetchMe, store } = useAuth();

// Tras el OAuth de Google el backend ya seteó la cookie httpOnly (el token ya NO
// viaja en la URL). Solo cargamos el perfil y redirigimos.
onMounted(async () => {
  await fetchMe();
  if (!store.isAuthenticated) {
    await navigateTo('/login');
  } else if (store.isOnboarded) {
    await navigateTo('/admin');
  } else {
    await navigateTo('/onboarding');
  }
});
</script>

<template>
  <div class="text-center">
    <p class="text-gray-500">Autenticando...</p>
  </div>
</template>
