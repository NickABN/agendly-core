import {
  isProduction,
  isProductionNetlifyDeploy,
  validateNetlifyProxyConfig,
  validateProductionPublicApiUrl,
} from '../../config/runtime-config-validation';

export default defineNitroPlugin(() => {
  if (!isProduction()) {
    return;
  }

  const config = useRuntimeConfig();

  // Las páginas legales muestran "[pendiente de configurar]" sin estos datos;
  // no se bloquea el deploy, pero debe corregirse antes de abrir a usuarios.
  const missingLegal = (['legalName', 'legalAddress', 'legalEmail'] as const).filter(
    (key) => !config.public[key],
  );
  if (missingLegal.length > 0) {
    console.warn(
      `[legal] Faltan NUXT_PUBLIC_LEGAL_* (${missingLegal.join(', ')}): ` +
        'Términos, Aviso de Privacidad y ARCO quedarán incompletos.',
    );
  }

  // The relative prefix also identifies the proxy topology if Netlify does not
  // expose build-only CONTEXT metadata to the running SSR function.
  if (isProductionNetlifyDeploy() || config.public.apiUrl === '/api') {
    validateNetlifyProxyConfig(
      config.public.apiUrl,
      config.apiProxyTarget,
      config.apiUrlInternal,
    );
    return;
  }

  validateProductionPublicApiUrl(config.public.apiUrl);
});
