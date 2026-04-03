import { describe, it, expect } from 'vitest';
import { Token } from '../../src/dto/Token.js';

describe('Token', () => {
  function makeToken(expiresInSeconds: number): Token {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return new Token('my-access-token', 'Bearer', expiresAt);
  }

  it('stores accessToken, tokenType, and expiresAt', () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const token = new Token('abc123', 'Bearer', expiresAt);
    expect(token.accessToken).toBe('abc123');
    expect(token.tokenType).toBe('Bearer');
    expect(token.expiresAt).toBe(expiresAt);
  });

  it('isExpired returns false when token is valid', () => {
    const token = makeToken(3600);
    expect(token.isExpired()).toBe(false);
  });

  it('isExpired returns true when token is expired', () => {
    const token = makeToken(-1);
    expect(token.isExpired()).toBe(true);
  });

  it('isExpired respects 15s buffer by default', () => {
    // Token expires in 10 seconds — should be considered expired with 15s buffer
    const token = makeToken(10);
    expect(token.isExpired()).toBe(true);
  });

  it('isExpired respects custom buffer', () => {
    const token = makeToken(10);
    expect(token.isExpired(5)).toBe(false);
    expect(token.isExpired(20)).toBe(true);
  });

  it('fromArray creates token from API response', () => {
    const token = Token.fromArray({
      access_token: 'tok123',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    expect(token.accessToken).toBe('tok123');
    expect(token.tokenType).toBe('Bearer');
    expect(token.isExpired()).toBe(false);
  });

  it('fromArray strips Bearer prefix from access_token', () => {
    const token = Token.fromArray({
      access_token: 'Bearer tok123',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    expect(token.accessToken).toBe('tok123');
  });

  it('fromArray defaults expires_in to 3600 if missing', () => {
    const token = Token.fromArray({ access_token: 'tok', token_type: 'Bearer' });
    expect(token.isExpired()).toBe(false);
  });

  it('toArray serializes correctly', () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    const token = new Token('tok123', 'Bearer', expiresAt);
    const arr = token.toArray();
    expect(arr.access_token).toBe('tok123');
    expect(arr.token_type).toBe('Bearer');
    expect(arr.expires_at).toBe('2030-01-01T00:00:00.000Z');
  });
});
