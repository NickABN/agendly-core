<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const route = useRoute();
const { fetchMe, store } = useAuth();

onMounted(async () => {
  const token = route.query.token as string;
  if (token) {
    store.setAuth(token, { id: '', email: '', name: '', role: '', tenantId: '' });
    await fetchMe();
    if (store.isOnboarded) {
      navigateTo('/admin');
    } else {
      navigateTo('/onboarding');
    }
  } else {
    navigateTo('/login');
  }
});
</script>

<template>
  <div class="text-center">
    <p class="text-gray-500">Autenticando...</p>
  </div>
</template>
