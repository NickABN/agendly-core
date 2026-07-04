import { computed, reactive, ref } from 'vue';

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

/** Business info + logo management for the config page. */
export function useTenantConfig() {
  const api = useApi();
  const runtimeConfig = useRuntimeConfig();

  const form = reactive({
    name: '',
    slug: '',
    phone: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const saving = ref(false);
  const saved = ref(false);
  const currentLogoUrl = ref<string | null>(null);

  const logoFile = ref<File | null>(null);
  const logoPreview = ref<string | null>(null);
  const logoUploading = ref(false);

  async function load() {
    const tenant = await api.get<TenantData>('/tenant');
    form.name = tenant.name;
    form.slug = tenant.slug;
    form.phone = tenant.phone || '';
    form.address = tenant.address || '';
    form.latitude = tenant.latitude;
    form.longitude = tenant.longitude;
    currentLogoUrl.value = tenant.logoUrl;
  }

  async function save() {
    saving.value = true;
    saved.value = false;
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        phone: form.phone,
        address: form.address,
      };
      if (form.latitude != null) payload.latitude = form.latitude;
      if (form.longitude != null) payload.longitude = form.longitude;
      await api.patch('/tenant', payload);
      saved.value = true;
      setTimeout(() => (saved.value = false), 3000);
    } finally {
      saving.value = false;
    }
  }

  function onLogoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    logoFile.value = file;
    logoPreview.value = URL.createObjectURL(file);
  }

  async function uploadLogo() {
    if (!logoFile.value) return;
    logoUploading.value = true;
    try {
      const formData = new FormData();
      formData.append('logo', logoFile.value);
      const result = await api.post<TenantData>('/tenant/logo', formData);
      currentLogoUrl.value = result.logoUrl;
      logoFile.value = null;
      logoPreview.value = null;
    } finally {
      logoUploading.value = false;
    }
  }

  const backendUrl = ((runtimeConfig.public.apiUrl as string) || 'http://localhost:3000').replace(
    /\/api$/,
    '',
  );

  const logoSrc = computed(() => {
    if (logoPreview.value) return logoPreview.value;
    if (currentLogoUrl.value) return `${backendUrl}${currentLogoUrl.value}`;
    return null;
  });

  const mapSrc = computed(() => {
    if (form.latitude && form.longitude) {
      return `https://maps.google.com/maps?q=${form.latitude},${form.longitude}&z=16&output=embed`;
    }
    if (form.address) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(form.address)}&z=16&output=embed`;
    }
    return null;
  });

  return {
    form,
    saving,
    saved,
    logoFile,
    logoPreview,
    logoUploading,
    logoSrc,
    mapSrc,
    load,
    save,
    onLogoSelect,
    uploadLogo,
  };
}
