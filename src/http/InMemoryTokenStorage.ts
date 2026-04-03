import { type Token } from '../dto/Token.js';
import { type TokenStorageInterface } from './TokenStorageInterface.js';

export class InMemoryTokenStorage implements TokenStorageInterface {
  private token: Token | null = null;

  get(): Token | null {
    return this.token;
  }

  set(token: Token): void {
    this.token = token;
  }

  clear(): void {
    this.token = null;
  }
}
