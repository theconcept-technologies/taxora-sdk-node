export const ApiVersion = {
  V1: 'v1',
} as const;

export type ApiVersion = (typeof ApiVersion)[keyof typeof ApiVersion];
