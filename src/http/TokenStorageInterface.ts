import { Token } from '../dto/Token.js';

export interface TokenStorageInterface {
  get(): Token | null;
  set(token: Token): void;
  clear(): void;
}
