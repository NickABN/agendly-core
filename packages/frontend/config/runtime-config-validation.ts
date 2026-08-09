const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

type RuntimeEnv = {
  NODE_ENV?: string;
  NETLIFY?: string;
  CONTEXT?: string;
};

type LocalDockerEnv = RuntimeEnv & {
  AGENDLY_LOCAL_DOCKER?: string;
};

function validateHostedProductionUrl(
  name: string,
  value: string | undefined,
  env: LocalDockerEnv = process.env as LocalDockerEnv,
): void {
  if (!value) {
    throw new Error(`${name} is required in production runtime/deploys`);
  }

  const url = parseHttpUrl(name, value);
  const hostname = normalizedHostname(url);
  const allowLocalDockerCompose = isLocalDockerCompose(env);

  if (!allowLocalDockerCompose && LOCAL_API_HOSTS.has(hostname)) {
    throw new Error(`${name} cannot point to localhost in production`);
  }

  if (!allowLocalDockerCompose && url.protocol !== 'https:') {
    throw new Error(`${name} must use https in production`);
  }
}

function parseHttpUrl(name: string, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }

  return url;
}

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase();
}

export function isProduction(env: RuntimeEnv = process.env as RuntimeEnv): boolean {
  return env.NODE_ENV === 'production';
}

export function isProductionNetlifyDeploy(
  env: RuntimeEnv = process.env as RuntimeEnv,
): boolean {
  return env.NETLIFY === 'true' && env.CONTEXT === 'production';
}

export function isLocalDockerCompose(
  env: LocalDockerEnv = process.env as LocalDockerEnv,
): boolean {
  return env.AGENDLY_LOCAL_DOCKER === 'true' && !isProductionNetlifyDeploy(env);
}

export function validateProductionPublicApiUrl(
  value: string | undefined,
  env: LocalDockerEnv = process.env as LocalDockerEnv,
): void {
  validateHostedProductionUrl('NUXT_PUBLIC_API_URL', value, env);
}

export function validateNetlifyPublicApiUrl(value: string | undefined): void {
  if (value !== '/api') {
    throw new Error('NUXT_PUBLIC_API_URL must be /api for production Netlify deploys');
  }
}

export function validateProductionPublicAppUrl(
  value: string | undefined,
  env: LocalDockerEnv = process.env as LocalDockerEnv,
): void {
  validateHostedProductionUrl('NUXT_PUBLIC_APP_URL', value, env);
}

export function validateApiProxyTarget(value: string | undefined): URL {
  if (!value) {
    throw new Error('NUXT_API_PROXY_TARGET is required for production Netlify deploys');
  }

  const url = parseHttpUrl('NUXT_API_PROXY_TARGET', value);
  const hostname = normalizedHostname(url);

  if (url.protocol !== 'https:') {
    throw new Error('NUXT_API_PROXY_TARGET must use https');
  }

  if (!hostname.endsWith('.onrender.com')) {
    throw new Error('NUXT_API_PROXY_TARGET must use a Render onrender.com host');
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'NUXT_API_PROXY_TARGET must be an origin without credentials, path, query, or hash',
    );
  }

  return url;
}

export function validateNetlifyProxyConfig(
  publicApiUrl: string | undefined,
  proxyTarget: string | undefined,
  internalApiUrl: string | undefined,
): void {
  validateNetlifyPublicApiUrl(publicApiUrl);
  validateApiProxyTarget(proxyTarget);

  if (internalApiUrl) {
    throw new Error('NUXT_API_URL_INTERNAL must not be set on production Netlify deploys');
  }
}
