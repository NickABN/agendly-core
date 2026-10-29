<script setup lang="ts">
definePageMeta({ layout: 'public' });
useHead({ title: 'Aviso de Privacidad — Agendly' });

const legal = useLegalInfo();
</script>

<template>
  <LegalDocument title="Aviso de Privacidad Integral" :updated-at="legal.updatedAt">
    <h2>1. Quién es responsable de tus datos</h2>
    <p>
      <strong>{{ legal.name }}</strong
      >, operador de la plataforma <strong>Agendly</strong> (en adelante, "Agendly"), con domicilio
      para oír y recibir notificaciones en <strong>{{ legal.address }}</strong
      >, es responsable del tratamiento de los datos personales de las personas que crean una cuenta
      de negocio, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
      Particulares y demás normativa aplicable.
    </p>
    <p>
      Contacto de privacidad:
      <a v-if="legal.email" :href="`mailto:${legal.email}`">{{ legal.email }}</a>
      <strong v-else>{{ legal.emailLabel }}</strong
      >.
    </p>

    <h2>2. Dos tipos de usuarios, dos roles distintos</h2>
    <ul>
      <li>
        <strong>Dueños y personal de negocios</strong> que usan el panel de Agendly: Agendly es el
        <em>responsable</em> de sus datos.
      </li>
      <li>
        <strong>Clientes finales</strong> que reservan una cita en la página de un negocio: el
        <em>negocio</em> con el que reservas es el responsable de tus datos. Agendly actúa como
        <em>encargado</em>: los trata únicamente por cuenta del negocio y para operar la reserva.
        Para ejercer tus derechos frente al negocio puedes contactarlo directamente o escribirnos y
        canalizaremos tu solicitud.
      </li>
    </ul>

    <h2>3. Datos personales que tratamos</h2>
    <h3>Dueños y personal del negocio</h3>
    <ul>
      <li>
        Nombre, correo electrónico y contraseña (guardada cifrada con hash; nunca en texto plano).
      </li>
      <li>Identificador de tu cuenta de Google, si eliges entrar con Google.</li>
      <li>
        Datos del negocio: nombre, teléfono, dirección y ubicación, logo, banner, servicios,
        precios, horarios y nombres del personal.
      </li>
      <li>Datos técnicos de sesión: dirección IP, fecha de acceso y cookies de sesión.</li>
    </ul>
    <h3>Clientes finales (por cuenta del negocio)</h3>
    <ul>
      <li>Nombre y número de teléfono.</li>
      <li>Correo electrónico (opcional, solo para enviarte la confirmación).</li>
      <li>Datos de la cita: servicio, profesional, fecha y hora.</li>
      <li>Registro de tu aceptación de este aviso (fecha y dirección IP).</li>
      <li>Tiempo que tardaste en completar la reserva (métrica de facilidad de uso).</li>
    </ul>
    <p>
      Agendly <strong>no solicita datos personales sensibles</strong> (salud, origen étnico,
      creencias, etc.) ni datos financieros para usar el servicio. Te pedimos no escribirlos en
      campos de notas.
    </p>

    <h2>4. Para qué usamos tus datos</h2>
    <h3>Finalidades necesarias</h3>
    <ul>
      <li>Crear y administrar tu cuenta y la página pública de tu negocio.</li>
      <li>Agendar, confirmar o cancelar citas y enviarte la confirmación y un recordatorio por correo.</li>
      <li>
        Mostrar al negocio una estimación del riesgo de que una cita no se atienda, calculada solo
        con el historial de citas en ese mismo negocio (faltas previas, anticipación, si eres
        cliente nuevo). Es una ayuda para que el negocio confirme la cita; no se usa para negarte
        el servicio ni se comparte con otros negocios.
      </li>
      <li>
        Mantener la seguridad de la plataforma (prevención de fraude y abuso, bitácoras de acceso).
      </li>
      <li>Atender solicitudes de soporte y de derechos ARCO.</li>
      <li>Cumplir obligaciones legales.</li>
    </ul>
    <h3>Finalidades secundarias</h3>
    <p>
      Hoy <strong>no</strong> usamos tus datos para publicidad, mercadotecnia ni los vendemos. Si en
      el futuro quisiéramos hacerlo, te lo pediremos antes y podrás negarte sin afectar el servicio.
    </p>

    <h2>5. Con quién compartimos tus datos</h2>
    <p>
      No vendemos ni transferimos tus datos a terceros para sus propios fines. Para operar el
      servicio usamos proveedores que los tratan <strong>por nuestra cuenta</strong> (remisiones),
      bajo obligaciones de confidencialidad, algunos con servidores fuera de México:
    </p>
    <ul>
      <li>Alojamiento de la aplicación y base de datos (Render, Netlify y Neon).</li>
      <li>Almacenamiento de imágenes como logos y banners (Cloudflare R2).</li>
      <li>Envío de correos transaccionales (Resend).</li>
      <li>Inicio de sesión con Google (Google LLC), solo si eliges esa opción.</li>
      <li>Conversión de la dirección del negocio a coordenadas (OpenStreetMap / Nominatim).</li>
      <li>Monitoreo de errores técnicos, cuando está habilitado.</li>
    </ul>
    <p>
      Solo transferiremos datos sin tu consentimiento en los casos que permite la ley, por ejemplo
      por requerimiento de una autoridad competente.
    </p>

    <h2>6. Tus derechos ARCO y cómo revocar tu consentimiento</h2>
    <p>
      Puedes <strong>A</strong>cceder, <strong>R</strong>ectificar, <strong>C</strong>ancelar u
      <strong>O</strong>ponerte al tratamiento de tus datos, así como revocar tu consentimiento o
      limitar su uso. Consulta el procedimiento en
      <NuxtLink to="/arco">la página de derechos ARCO</NuxtLink>. Los dueños de negocio también
      pueden corregir sus datos directamente desde el panel.
    </p>

    <h2>7. Cookies y tecnologías similares</h2>
    <p>
      Usamos cookies <strong>estrictamente necesarias</strong> para mantener tu sesión iniciada de
      forma segura (cookies httpOnly). No usamos cookies de publicidad ni de rastreo de terceros. Si
      las bloqueas en tu navegador, no podrás iniciar sesión en el panel.
    </p>

    <h2>8. Conservación y seguridad</h2>
    <p>
      Conservamos los datos mientras tu cuenta esté activa o mientras el negocio los necesite para
      gestionar sus citas, y después solo el tiempo que exija la ley. Cuando el dueño de un negocio
      elimina su cuenta, los datos del negocio y de sus clientes se bloquean durante 30 días (por si
      decide reactivarla) y después se suprimen de forma definitiva. Aplicamos medidas de seguridad
      administrativas, técnicas y físicas: conexiones cifradas (HTTPS), contraseñas con hash,
      sesiones revocables y aislamiento de datos entre negocios.
    </p>

    <h2>9. Cambios a este aviso</h2>
    <p>
      Si cambiamos este aviso publicaremos la nueva versión en esta página con su fecha de
      actualización y, si el cambio es relevante, te avisaremos por correo o dentro del panel.
    </p>

    <h2>10. Autoridad</h2>
    <p>
      Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir ante la
      autoridad competente en materia de protección de datos personales en México.
    </p>
  </LegalDocument>
</template>
