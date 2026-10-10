<script setup lang="ts">
definePageMeta({ layout: 'public' });
useHead({ title: 'Derechos ARCO — Agendly' });

const legal = useLegalInfo();

const RIGHTS = [
  { key: 'Acceso', icon: 'visibility', text: 'Saber qué datos tuyos tenemos y cómo los usamos.' },
  { key: 'Rectificación', icon: 'edit', text: 'Corregir datos incompletos o equivocados.' },
  { key: 'Cancelación', icon: 'delete', text: 'Pedir que eliminemos tus datos.' },
  { key: 'Oposición', icon: 'block', text: 'Oponerte a un uso específico de tus datos.' },
];

const form = reactive({ name: '', contact: '', right: 'Acceso', business: '', detail: '' });

/** Builds a pre-filled email so the request is sent from the person's own account. */
const mailtoHref = computed(() => {
  if (!legal.email) return '';
  const body = [
    `Nombre: ${form.name}`,
    `Correo o teléfono de contacto: ${form.contact}`,
    `Derecho que ejerzo: ${form.right}`,
    `Negocio donde reservé (si aplica): ${form.business}`,
    '',
    'Descripción de la solicitud:',
    form.detail,
    '',
    'Adjunto copia de mi identificación oficial (o la de mi representante legal).',
  ].join('\n');
  return `mailto:${legal.email}?subject=${encodeURIComponent(`Solicitud ARCO — ${form.right}`)}&body=${encodeURIComponent(body)}`;
});

const canSend = computed(
  () => !!legal.email && !!form.name.trim() && !!form.contact.trim() && !!form.detail.trim(),
);
</script>

<template>
  <LegalDocument title="Derechos ARCO" :updated-at="legal.updatedAt">
    <p>
      Conforme a la ley mexicana de protección de datos personales, tienes derecho a decidir sobre
      tus datos. Aquí te explicamos cómo hacerlo.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
      <div
        v-for="r in RIGHTS"
        :key="r.key"
        class="flex gap-3 p-4 rounded-xl bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/10"
      >
        <span class="material-symbols-outlined text-[var(--color-primary)]" aria-hidden="true">{{
          r.icon
        }}</span>
        <div>
          <p class="font-semibold text-[var(--color-on-surface)]">{{ r.key }}</p>
          <p class="text-xs">{{ r.text }}</p>
        </div>
      </div>
    </div>

    <h2>¿Reservaste una cita en un negocio?</h2>
    <p>
      El negocio es el responsable de tus datos de reserva. Puedes pedírselo directamente o
      enviarnos tu solicitud indicando el nombre del negocio; nosotros se la haremos llegar y te
      apoyaremos para que se atienda.
    </p>

    <h2>Qué debe incluir tu solicitud</h2>
    <ul>
      <li>Tu nombre y un correo o teléfono para responderte.</li>
      <li>
        Copia de una identificación oficial (o, si actúas por alguien más, el documento que acredite
        la representación).
      </li>
      <li>Una descripción clara de los datos y del derecho que quieres ejercer.</li>
      <li>Para rectificación, el dato correcto y, si aplica, documentos que lo respalden.</li>
    </ul>

    <h2>Plazos</h2>
    <p>
      Te responderemos dentro de los plazos que marca la ley (actualmente, hasta 20 días hábiles
      para comunicarte la respuesta y 15 días hábiles más para hacerla efectiva si procede). El
      trámite es gratuito.
    </p>

    <h2>Envía tu solicitud</h2>
    <p v-if="!legal.email" class="font-semibold">
      El correo de privacidad está {{ legal.emailLabel }}.
    </p>
    <form v-else class="space-y-3" @submit.prevent>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="space-y-1">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-outline)]"
            >Nombre</span
          >
          <input v-model="form.name" required autocomplete="name" class="arco-input" />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-outline)]"
            >Correo o teléfono</span
          >
          <input v-model="form.contact" required class="arco-input" />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-outline)]"
            >Derecho</span
          >
          <select v-model="form.right" class="arco-input">
            <option v-for="r in RIGHTS" :key="r.key" :value="r.key">{{ r.key }}</option>
            <option value="Revocación del consentimiento">Revocación del consentimiento</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-outline)]"
            >Negocio (opcional)</span
          >
          <input v-model="form.business" class="arco-input" />
        </label>
      </div>
      <label class="block space-y-1">
        <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-outline)]"
          >¿Qué necesitas?</span
        >
        <textarea v-model="form.detail" required rows="4" class="arco-input"></textarea>
      </label>
      <a
        :href="canSend ? mailtoHref : undefined"
        :aria-disabled="!canSend"
        class="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-bold !no-underline text-white soul-gradient transition-opacity"
        :class="canSend ? 'hover:opacity-90' : 'opacity-50 pointer-events-none'"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">mail</span>
        Abrir en mi correo
      </a>
      <p class="text-xs">
        Se abrirá tu aplicación de correo con la solicitud lista para enviarse a
        <strong>{{ legal.email }}</strong
        >. Recuerda adjuntar tu identificación.
      </p>
    </form>
  </LegalDocument>
</template>

<style scoped>
.arco-input {
  width: 100%;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
  outline: none;
}
.arco-input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
</style>
