<script setup lang="ts">
definePageMeta({ layout: 'public' });
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-2xl mx-auto px-4">
      <h1 class="text-2xl font-bold mb-6">Aviso de Privacidad</h1>

      <div class="bg-white rounded-lg border p-6 space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>
          <strong>Agendly</strong> (en adelante "la Plataforma"), con domicilio en México, es responsable
          del tratamiento de sus datos personales conforme a la Ley Federal de Protección de Datos
          Personales en Posesión de los Particulares (LFPDPPP).
        </p>

        <h2 class="text-base font-semibold mt-4">Datos que recopilamos</h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>Nombre completo</li>
          <li>Número de teléfono</li>
          <li>Correo electrónico (opcional)</li>
          <li>Datos de la cita (servicio, fecha, hora)</li>
        </ul>

        <h2 class="text-base font-semibold mt-4">Finalidad del tratamiento</h2>
        <p>
          Sus datos serán utilizados exclusivamente para: gestionar su cita, enviar confirmaciones
          y recordatorios, y mejorar nuestros servicios.
        </p>

        <h2 class="text-base font-semibold mt-4">Derechos ARCO</h2>
        <p>
          Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos
          personales. Para ejercer estos derechos, envíe un correo a
          <strong>privacidad@agendly.mx</strong> indicando su nombre, teléfono y la acción solicitada.
        </p>

        <h2 class="text-base font-semibold mt-4">Transferencia de datos</h2>
        <p>
          Sus datos no serán compartidos con terceros sin su consentimiento, salvo los casos previstos por la ley.
        </p>

        <p class="text-xs text-gray-400 mt-6">
          Última actualización: Marzo 2026
        </p>
      </div>
    </div>
  </div>
</template>
