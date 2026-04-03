export const Language = {
  ENGLISH: 'en',
  GERMAN: 'de',
} as const;

export type Language = (typeof Language)[keyof typeof Language];
