const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const DOCKER_ONLY_API_HOSTS = new Set([
  'backend',
  'host.docker.internal',
  'docker.for.mac.localhost',
  'docker.for.win.localhost',
]);

type RuntimeEnv = {
  NODE_ENV?: string;
  NETLIFY?: string;
  CONTEXT?: string;
};

type LocalDockerEnv = RuntimeEnv & {
  AGENDLY_LOCAL_DOCKER?: string;
};

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
  if (!value) {
    throw new Error('NUXT_PUBLIC_API_URL is required in production runtime/deploys');
  }

  const url = parseHttpUrl('NUXT_PUBLIC_API_URL', value);
  const hostname = normalizedHostname(url);
  const allowLocalDockerCompose = isLocalDockerCompose(env);

  if (!allowLocalDockerCompose && LOCAL_API_HOSTS.has(hostname)) {
    throw new Error('NUXT_PUBLIC_API_URL cannot point to localhost in production');
  }

  if (!allowLocalDockerCompose && url.protocol !== 'https:') {
    throw new Error('NUXT_PUBLIC_API_URL must use https in production');
  }
}

export function validateNetlifyInternalApiUrl(value: string | undefined): void {
  if (!value) {
    return;
  }

  const url = parseHttpUrl('NUXT_API_URL_INTERNAL', value);
  const hostname = normalizedHostname(url);

  if (url.protocol !== 'https:') {
    throw new Error('NUXT_API_URL_INTERNAL must use https for production Netlify deploys');
  }

  if (LOCAL_API_HOSTS.has(hostname) || DOCKER_ONLY_API_HOSTS.has(hostname)) {
    throw new Error(
      'NUXT_API_URL_INTERNAL cannot point to localhost or Docker-only hosts on Netlify',
    );
  }
}
