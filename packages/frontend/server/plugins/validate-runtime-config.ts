import {
  isProduction,
  isProductionNetlifyDeploy,
  validateNetlifyInternalApiUrl,
  validateProductionPublicApiUrl,
} from '../../config/runtime-config-validation';

export default defineNitroPlugin(() => {
  if (!isProduction()) {
    return;
  }

  const config = useRuntimeConfig();

  validateProductionPublicApiUrl(config.public.apiUrl);

  if (isProductionNetlifyDeploy()) {
    validateNetlifyInternalApiUrl(config.apiUrlInternal);
  }
});
