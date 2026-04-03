export const LoginIdentifier = {
  EMAIL: 'email',
  CLIENT_ID: 'client_id',
} as const;

export type LoginIdentifier = (typeof LoginIdentifier)[keyof typeof LoginIdentifier];
