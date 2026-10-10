<script setup lang="ts">
definePageMeta({ layout: 'public' });
useHead({ title: 'Términos y Condiciones — Agendly' });

const legal = useLegalInfo();
</script>

<template>
  <LegalDocument title="Términos y Condiciones de Uso" :updated-at="legal.updatedAt">
    <h2>1. Quiénes somos y qué aceptas</h2>
    <p>
      Agendly es una plataforma operada por <strong>{{ legal.name }}</strong
      >, con domicilio en <strong>{{ legal.address }}</strong> y contacto
      <a v-if="legal.email" :href="`mailto:${legal.email}`">{{ legal.email }}</a>
      <strong v-else>{{ legal.emailLabel }}</strong
      >. Al crear una cuenta o reservar una cita a través de Agendly aceptas estos Términos y el
      <NuxtLink to="/privacidad">Aviso de Privacidad</NuxtLink>. Si no estás de acuerdo, no uses la
      plataforma.
    </p>

    <h2>2. Qué es Agendly</h2>
    <p>
      Agendly es una herramienta tecnológica que permite a negocios de belleza y bienestar publicar
      sus servicios y horarios, y a sus clientes reservar citas en línea. Agendly
      <strong>no presta los servicios</strong> que se reservan ni es parte de la relación entre el
      negocio y su cliente: el negocio es el único responsable de sus servicios, precios, horarios,
      calidad, cobros y políticas de cancelación o inasistencia.
    </p>

    <h2>3. Servicio gratuito en etapa beta</h2>
    <p>
      Actualmente Agendly se ofrece <strong>sin costo</strong> y en fase de desarrollo (beta). Por
      ello se proporciona "tal cual" y "según disponibilidad": puede tener interrupciones, errores o
      cambios de funcionalidad, y no garantizamos un nivel de servicio específico. Si en el futuro
      se introducen planes de pago, lo avisaremos con anticipación y nunca se te cobrará sin tu
      aceptación expresa de las nuevas condiciones.
    </p>

    <h2>4. Cuentas de negocio</h2>
    <ul>
      <li>Debes ser mayor de edad y tener facultades para representar al negocio que registras.</li>
      <li>
        La información que publiques (nombre, servicios, precios, imágenes) debe ser veraz y tener
        los derechos para usarla.
      </li>
      <li>
        Eres responsable de mantener segura tu contraseña y de la actividad hecha desde tu cuenta.
      </li>
      <li>
        Respecto de los datos de tus clientes, actúas como <strong>responsable</strong> frente a
        ellos y Agendly como tu <strong>encargado</strong>: solo los trataremos para operar tus
        reservas y según el Aviso de Privacidad. Debes usarlos únicamente para gestionar sus citas y
        cumplir la legislación de protección de datos aplicable.
      </li>
    </ul>

    <h2>5. Reservas de clientes finales</h2>
    <ul>
      <li>
        Al reservar, tu cita se agenda directamente con el negocio; la confirmación en pantalla o
        por correo depende de los datos que proporciones.
      </li>
      <li>
        Cambios, cancelaciones, anticipos, reembolsos y retrasos se rigen por las políticas de cada
        negocio. Contáctalo directamente para cualquier ajuste.
      </li>
      <li>Proporciona datos verdaderos y no hagas reservas falsas o masivas.</li>
    </ul>

    <h2>6. Uso aceptable</h2>
    <p>No está permitido:</p>
    <ul>
      <li>
        Usar Agendly para actividades ilícitas, engañosas o que infrinjan derechos de terceros.
      </li>
      <li>
        Publicar contenido ofensivo, sexual explícito, discriminatorio o que viole propiedad
        intelectual.
      </li>
      <li>
        Intentar acceder a datos de otros negocios, vulnerar la seguridad o sobrecargar la
        plataforma.
      </li>
      <li>Usar la información de clientes para enviar publicidad no solicitada.</li>
    </ul>
    <p>
      Podemos suspender o dar de baja cuentas que incumplan estos Términos, avisando cuando sea
      posible.
    </p>

    <h2>7. Contenido y propiedad intelectual</h2>
    <p>
      Conservas la titularidad del contenido que subes (logos, imágenes, textos) y nos otorgas una
      licencia no exclusiva y gratuita para alojarlo y mostrarlo solo con el fin de operar tu página
      de reservas. El software, la marca y el diseño de Agendly pertenecen a su operador.
    </p>

    <h2>8. Apoyo voluntario</h2>
    <p>
      Puedes apoyar el desarrollo del proyecto con una aportación voluntaria. Esta aportación
      <strong>no es una compra ni una suscripción</strong>: no otorga funciones adicionales,
      prioridad ni derechos sobre la plataforma, y no condiciona el acceso al servicio. No es un
      donativo deducible de impuestos. Si realizaste una aportación por error, escríbenos dentro de
      los 30 días siguientes y la reembolsaremos. Los pagos los procesa Stripe; Agendly no recibe ni
      almacena los datos de tu tarjeta.
    </p>

    <h2>9. Limitación de responsabilidad</h2>
    <p>
      En la medida permitida por la ley, Agendly no será responsable por daños indirectos, pérdida
      de ingresos o de clientes, citas no atendidas, ni por los servicios prestados por los
      negocios. Te recomendamos llevar un respaldo de las citas importantes. Nada en estos Términos
      limita los derechos que te otorga la legislación de protección al consumidor.
    </p>

    <h2>10. Baja de la cuenta</h2>
    <p>
      Puedes dejar de usar Agendly cuando quieras y solicitar la eliminación de tu cuenta y tus
      datos escribiendo al contacto de arriba. Conservaremos solo lo que la ley nos obligue.
    </p>

    <h2>11. Cambios a estos Términos</h2>
    <p>
      Podemos actualizar estos Términos. Publicaremos la nueva versión con su fecha y, si el cambio
      es relevante, te lo notificaremos. Si sigues usando Agendly después de la notificación,
      entendemos que aceptas la nueva versión.
    </p>

    <h2>12. Ley aplicable</h2>
    <p>
      Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia
      se someterá a los tribunales competentes del domicilio del operador, salvo que la ley te
      otorgue el derecho a acudir a otro foro, como la Procuraduría Federal del Consumidor.
    </p>
  </LegalDocument>
</template>
