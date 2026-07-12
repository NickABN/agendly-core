<template>
  <div class="bg-surface text-on-surface min-h-screen">
    <!-- Navbar -->
    <header
      class="sticky top-0 z-40 flex items-center justify-between px-6 lg:px-12 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/50 shadow-sm"
    >
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
        <span class="text-lg font-bold text-on-surface tracking-tight">Agendly</span>
      </NuxtLink>
      <nav class="hidden md:flex items-center gap-8">
        <a
          href="#beneficios"
          class="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >Beneficios</a>
        <a
          href="#precios"
          class="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >Precios</a>
        <NuxtLink
          to="/login"
          class="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >Iniciar sesión</NuxtLink>
        <NuxtLink
          to="/register"
          class="soul-gradient text-on-primary px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
        >Empezar ahora</NuxtLink>
      </nav>
      <!-- Mobile menu -->
      <div class="flex md:hidden items-center gap-3">
        <NuxtLink
          to="/login"
          class="text-sm font-semibold text-on-surface-variant"
        >Entrar</NuxtLink>
        <NuxtLink
          to="/register"
          class="soul-gradient text-on-primary px-4 py-2 rounded-lg text-sm font-semibold"
        >Registrarse</NuxtLink>
      </div>
    </header>

    <main>
      <!-- Hero Section -->
      <section class="relative overflow-hidden pt-20 pb-32 px-6 lg:px-24">
        <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <!-- Left: Copy -->
          <div class="z-10">
            <span
              class="inline-block py-1 px-3 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold tracking-widest uppercase mb-6"
            >Santuario Digital</span>
            <h1
              class="text-5xl lg:text-6xl font-semibold text-on-surface tracking-tight leading-[1.1] mb-8"
            >
              Dile adiós al
              <span class="text-primary">caos de WhatsApp.</span>
            </h1>
            <p class="text-xl text-on-surface-variant font-medium leading-relaxed mb-10 max-w-lg">
              Centraliza tus citas, automatiza recordatorios y recupera tu paz mental. Diseñado para
              profesionales que valoran su tiempo y el de sus clientes.
            </p>
            <div class="flex flex-col sm:flex-row gap-4">
              <NuxtLink
                to="/register"
                class="soul-gradient text-on-primary px-8 py-4 rounded-lg font-semibold text-lg shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                Comenzar Prueba Gratis
                <span class="material-symbols-outlined text-lg">arrow_forward</span>
              </NuxtLink>
              <a
                href="#beneficios"
                class="bg-surface-container-high text-on-surface px-8 py-4 rounded-lg font-semibold text-lg hover:bg-surface-container-highest transition-all text-center"
              >Ver Beneficios</a>
            </div>
            <div class="mt-8 flex flex-wrap items-center gap-4 text-sm text-on-secondary-container font-medium">
              <span class="flex items-center gap-1">
                <span
                  class="material-symbols-outlined text-green-600 text-base"
                  style="font-variation-settings: 'FILL' 1;"
                >check_circle</span>
                Sin tarjeta de crédito
              </span>
              <span class="flex items-center gap-1">
                <span
                  class="material-symbols-outlined text-green-600 text-base"
                  style="font-variation-settings: 'FILL' 1;"
                >check_circle</span>
                Configura en 2 minutos
              </span>
            </div>
          </div>

          <!-- Right: Dashboard mockup -->
          <div class="relative">
            <div
              class="absolute -top-20 -right-20 w-96 h-96 bg-blue-100/50 rounded-full blur-[100px] pointer-events-none"
            ></div>
            <div
              class="relative bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden border border-outline-variant/20"
            >
              <!-- Mock dashboard header -->
              <div class="bg-white px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                  <span class="text-sm font-bold text-on-surface">Agendly</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-green-400"></div>
                  <span class="text-xs text-on-surface-variant font-medium">3 citas hoy</span>
                </div>
              </div>
              <!-- Mock appointments -->
              <div class="p-6 space-y-3 bg-surface-container-low">
                <p class="text-xs font-bold uppercase tracking-widest text-outline mb-4">Hoy</p>
                <div
                  v-for="(apt, i) in mockAppointments"
                  :key="i"
                  class="bg-white rounded-xl p-4 border-l-4 flex items-center justify-between shadow-sm"
                  :style="{ borderLeftColor: apt.color }"
                >
                  <div>
                    <p class="text-sm font-semibold text-on-surface">{{ apt.name }}</p>
                    <p class="text-xs text-on-surface-variant">{{ apt.service }} · {{ apt.time }}</p>
                  </div>
                  <span
                    class="text-xs font-semibold px-2 py-1 rounded-full"
                    :class="apt.badgeClass"
                  >{{ apt.status }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Benefits Bento Grid -->
      <section class="py-24 px-6 lg:px-24 bg-surface-container-low" id="beneficios">
        <div class="max-w-7xl mx-auto">
          <div class="mb-16 text-center">
            <h2 class="text-3xl lg:text-5xl font-semibold tracking-tight text-on-surface mb-4">
              Diseñado para la Calma
            </h2>
            <p class="text-on-surface-variant max-w-2xl mx-auto font-medium">
              Eliminamos el ruido visual para que te concentres en lo que importa: tus clientes.
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Feature 1 (wide) -->
            <div
              class="md:col-span-2 bg-surface-container-lowest p-8 rounded-xl flex flex-col justify-between group hover:shadow-sm transition-all border border-transparent hover:border-outline-variant/20"
            >
              <div>
                <div
                  class="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-6"
                >
                  <span class="material-symbols-outlined">link</span>
                </div>
                <h3 class="text-2xl font-semibold mb-4">Agendas sin fricción</h3>
                <p class="text-on-surface-variant font-medium leading-relaxed max-w-md">
                  Tus clientes no necesitan descargar apps ni crear cuentas. Un enlace, un clic y la
                  cita está confirmada. Tan simple como debería ser.
                </p>
              </div>
              <div class="mt-8 rounded-xl overflow-hidden bg-surface-container p-4 space-y-2">
                <div class="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-sm">
                  <span class="material-symbols-outlined text-primary text-xl">content_copy</span>
                  <span class="text-sm font-medium text-on-surface">{{ exampleBookingUrl }}</span>
                  <span
                    class="ml-auto text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full"
                  >Copiar</span>
                </div>
                <p class="text-xs text-center text-on-surface-variant pt-1">
                  Comparte este enlace en WhatsApp, Instagram o donde quieras
                </p>
              </div>
            </div>
            <!-- Feature 2 -->
            <div
              class="bg-surface-container-lowest p-8 rounded-xl border border-transparent hover:border-outline-variant/20 transition-all"
            >
              <div
                class="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-lg flex items-center justify-center mb-6"
              >
                <span class="material-symbols-outlined">notifications_active</span>
              </div>
              <h3 class="text-2xl font-semibold mb-4">Cero inasistencias</h3>
              <p class="text-on-surface-variant font-medium leading-relaxed">
                Recordatorios automáticos por WhatsApp y correo. El sistema trabaja mientras tú
                descansas o atiendes a alguien más.
              </p>
            </div>
            <!-- Feature 3 -->
            <div
              class="bg-surface-container-lowest p-8 rounded-xl border border-transparent hover:border-outline-variant/20 transition-all"
            >
              <div
                class="w-12 h-12 rounded-lg flex items-center justify-center mb-6"
                style="background: #ffdcc3; color: #2f1500;"
              >
                <span class="material-symbols-outlined">spa</span>
              </div>
              <h3 class="text-2xl font-semibold mb-4">Panel Calmante</h3>
              <p class="text-on-surface-variant font-medium leading-relaxed">
                Una interfaz limpia, libre de notificaciones agresivas. Organiza tu día con una
                visualización editorial de tu agenda.
              </p>
            </div>
            <!-- Feature 4 (wide) -->
            <div
              class="md:col-span-2 bg-surface-container-lowest p-8 rounded-xl flex flex-col md:flex-row gap-8 items-center border border-transparent hover:border-outline-variant/20 transition-all"
            >
              <div class="flex-1">
                <div
                  class="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-6"
                >
                  <span class="material-symbols-outlined">group</span>
                </div>
                <h3 class="text-2xl font-semibold mb-4">Gestión de Clientes Pro</h3>
                <p class="text-on-surface-variant font-medium leading-relaxed">
                  Historial de citas, preferencias y notas privadas de cada cliente en un solo lugar.
                  Conoce a tu cliente antes de que cruce la puerta.
                </p>
              </div>
              <!-- Mini client list mockup -->
              <div class="w-full md:w-64 rounded-xl overflow-hidden bg-surface-container p-4 space-y-2 shrink-0">
                <div
                  v-for="(client, i) in mockClients"
                  :key="i"
                  class="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm"
                >
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    :style="{ background: client.color }"
                  >{{ client.initials }}</div>
                  <div>
                    <p class="text-xs font-semibold text-on-surface">{{ client.name }}</p>
                    <p class="text-[10px] text-on-surface-variant">{{ client.visits }} visitas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Pricing -->
      <section class="py-32 px-6 lg:px-24" id="precios">
        <div class="max-w-7xl mx-auto">
          <div class="max-w-3xl mx-auto text-center mb-20">
            <h2 class="text-4xl lg:text-5xl font-semibold tracking-tight text-on-surface mb-6">
              Un solo plan, sin sorpresas.
            </h2>
            <p class="text-xl text-on-surface-variant font-medium">
              Creemos en la transparencia. Todo el poder de Agendly por una inversión única mensual.
            </p>
          </div>
          <div class="max-w-md mx-auto relative group">
            <div
              class="absolute -inset-1 bg-gradient-to-r from-primary to-primary-container rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"
            ></div>
            <div
              class="relative bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/30 flex flex-col items-center editorial-shadow"
            >
              <span
                class="text-sm font-bold text-primary tracking-widest uppercase mb-4"
              >Plan Profesional</span>
              <div class="flex items-baseline gap-1 mb-8">
                <span class="text-5xl font-bold text-on-surface">$249</span>
                <span class="text-xl text-on-surface-variant font-medium">MXN/mes</span>
              </div>
              <ul class="w-full space-y-5 mb-10">
                <li
                  v-for="feature in pricingFeatures"
                  :key="feature"
                  class="flex items-center gap-3 text-on-surface font-medium"
                >
                  <span
                    class="material-symbols-outlined text-primary text-xl shrink-0"
                    style="font-variation-settings: 'FILL' 1;"
                  >check_circle</span>
                  {{ feature }}
                </li>
              </ul>
              <NuxtLink
                to="/register"
                class="w-full block text-center soul-gradient text-on-primary py-4 rounded-lg font-bold text-lg hover:opacity-90 transition-all shadow-md"
              >
                Comenzar ahora
              </NuxtLink>
              <p class="mt-4 text-xs text-on-secondary-container font-medium text-center">
                Cancela en cualquier momento sin penalizaciones.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA Final -->
      <section class="py-24 px-6 lg:px-24 bg-primary text-on-primary text-center overflow-hidden relative">
        <div class="absolute inset-0 pointer-events-none opacity-10">
          <div
            class="absolute -top-1/2 -left-1/4 w-full h-full bg-white rounded-full blur-[120px]"
          ></div>
        </div>
        <div class="max-w-3xl mx-auto relative z-10">
          <h2 class="text-3xl lg:text-5xl font-semibold tracking-tight mb-8 leading-tight">
            Tu negocio merece el orden que Agendly ofrece.
          </h2>
          <p class="text-xl opacity-90 font-medium mb-12">
            Únete a cientos de profesionales que ya transformaron su flujo de trabajo.
          </p>
          <NuxtLink
            to="/register"
            class="inline-block bg-white text-primary px-10 py-5 rounded-lg font-bold text-xl shadow-xl hover:opacity-95 transition-all"
          >
            Probar gratis por 14 días
          </NuxtLink>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer
      class="flex flex-col items-center justify-center gap-6 w-full py-16 bg-slate-50 border-t border-slate-100"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-xl">auto_awesome</span>
          <span class="text-sm font-black uppercase text-slate-400 tracking-[0.2em]">Agendly</span>
        </div>
        <div class="flex gap-8">
          <NuxtLink
            to="/privacidad"
            class="text-xs tracking-widest text-slate-400 hover:text-primary transition-colors"
          >Privacidad</NuxtLink>
          <a href="#" class="text-xs tracking-widest text-slate-400 hover:text-primary transition-colors">Términos</a>
          <a href="#" class="text-xs tracking-widest text-slate-400 hover:text-primary transition-colors">Soporte</a>
        </div>
      </div>
      <div
        class="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full border border-outline-variant/20"
      >
        <span
          class="material-symbols-outlined text-primary"
          style="font-size: 14px; font-variation-settings: 'FILL' 1;"
        >verified</span>
        <span class="text-[10px] font-bold text-on-surface uppercase tracking-wider">Hecho con Agendly</span>
      </div>
      <p class="text-xs tracking-widest text-slate-400">© 2025 Agendly. Todos los derechos reservados.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Agendly — Dile adiós al caos de WhatsApp',
  description:
    'Centraliza tus citas, automatiza recordatorios y recupera tu paz mental. Diseñado para profesionales de belleza en México.',
})

const { bookingDisplayUrl } = usePublicBookingUrl()

const exampleBookingUrl = computed(() => bookingDisplayUrl('tu-salon'))

const mockAppointments = [
  {
    name: 'Ana Martínez',
    service: 'Corte + Color',
    time: '10:00',
    status: 'Confirmada',
    color: '#005da9',
    badgeClass: 'bg-blue-50 text-blue-700',
  },
  {
    name: 'Sofía Ruiz',
    service: 'Manicure',
    time: '11:30',
    status: 'Pendiente',
    color: '#8d4b00',
    badgeClass: 'bg-orange-50 text-orange-700',
  },
  {
    name: 'Laura García',
    service: 'Tinte',
    time: '13:00',
    status: 'Confirmada',
    color: '#2e7d32',
    badgeClass: 'bg-green-50 text-green-700',
  },
]

const mockClients = [
  { initials: 'AM', name: 'Ana Martínez', visits: 12, color: '#005da9' },
  { initials: 'SR', name: 'Sofía Ruiz', visits: 7, color: '#8d4b00' },
  { initials: 'LG', name: 'Laura García', visits: 5, color: '#526070' },
]

const pricingFeatures = [
  'Citas ilimitadas',
  'Recordatorios vía WhatsApp',
  'Base de datos de clientes',
  'Enlace público personalizado',
  'Reportes de negocio',
  'Soporte prioritario 24/7',
]
</script>
