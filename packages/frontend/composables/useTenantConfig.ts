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
  listedInDirectory: boolean;
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
    listedInDirectory: false,
  });
  const saving = ref(false);
  const saved = ref(false);
  const slugError = ref<string | null>(null);
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
    form.listedInDirectory = tenant.listedInDirectory ?? false;
    currentLogoUrl.value = tenant.logoUrl;
  }

  async function save() {
    saving.value = true;
    saved.value = false;
    slugError.value = null;
    try {
      const slug = form.slug.trim();
      await api.patch('/tenant', {
        slug,
        listedInDirectory: form.listedInDirectory,
      });
      form.slug = slug;
      saved.value = true;
      setTimeout(() => (saved.value = false), 3000);
    } catch (error: unknown) {
      const response = error as {
        data?: { message?: unknown };
        response?: { _data?: { message?: unknown } };
        message?: unknown;
      };
      const message =
        response?.data?.message ?? response?.response?._data?.message ?? response?.message;
      slugError.value = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : 'No se pudieron guardar los cambios. Intenta de nuevo.';
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
    if (!currentLogoUrl.value) return null;
    // URLs nuevas (R2) son absolutas; solo los datos legacy /uploads/... locales
    // necesitan el prefijo del backend.
    return currentLogoUrl.value.startsWith('/')
      ? `${backendUrl}${currentLogoUrl.value}`
      : currentLogoUrl.value;
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
    slugError,
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
