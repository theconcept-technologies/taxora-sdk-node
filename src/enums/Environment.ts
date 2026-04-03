export const Environment = {
  SANDBOX: 'sandbox',
  PRODUCTION: 'production',
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

const BASE_URLS: Record<Environment, string> = {
  [Environment.SANDBOX]: 'https://sandbox.taxora.io/v1',
  [Environment.PRODUCTION]: 'https://api.taxora.io/v1',
};

export function getBaseUrl(environment: Environment): string {
  return BASE_URLS[environment];
}
