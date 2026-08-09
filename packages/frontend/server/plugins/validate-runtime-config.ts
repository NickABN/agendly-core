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
