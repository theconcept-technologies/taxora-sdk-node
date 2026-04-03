import { describe, it, expect } from 'vitest';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';

describe('InMemoryTokenStorage', () => {
  it('get returns null initially', () => {
    const storage = new InMemoryTokenStorage();
    expect(storage.get()).toBeNull();
  });

  it('set and get token', () => {
    const storage = new InMemoryTokenStorage();
    const token = new Token('abc', 'Bearer', new Date(Date.now() + 3600_000));
    storage.set(token);
    expect(storage.get()).toBe(token);
  });

  it('clear removes the stored token', () => {
    const storage = new InMemoryTokenStorage();
    const token = new Token('abc', 'Bearer', new Date(Date.now() + 3600_000));
    storage.set(token);
    storage.clear();
    expect(storage.get()).toBeNull();
  });
});
