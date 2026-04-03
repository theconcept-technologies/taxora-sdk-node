import { describe, it, expect } from 'vitest';
import { TaxoraException } from '../../src/exceptions/TaxoraException.js';
import { AuthenticationException } from '../../src/exceptions/AuthenticationException.js';
import { HttpException } from '../../src/exceptions/HttpException.js';
import { ValidationException } from '../../src/exceptions/ValidationException.js';

describe('TaxoraException', () => {
  it('extends Error and stores context', () => {
    const err = new TaxoraException('something went wrong', { foo: 'bar' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaxoraException);
    expect(err.message).toBe('something went wrong');
    expect(err.context).toEqual({ foo: 'bar' });
  });

  it('context defaults to empty object', () => {
    const err = new TaxoraException('oops');
    expect(err.context).toEqual({});
  });
});

describe('AuthenticationException', () => {
  it('extends TaxoraException with code 401', () => {
    const err = new AuthenticationException('unauthorized');
    expect(err).toBeInstanceOf(TaxoraException);
    expect(err.message).toBe('unauthorized');
    expect(err.statusCode).toBe(401);
  });
});

describe('HttpException', () => {
  it('stores statusCode and responseBody', () => {
    const err = new HttpException('server error', 500, '{"error":"internal"}');
    expect(err).toBeInstanceOf(TaxoraException);
    expect(err.message).toBe('server error');
    expect(err.statusCode).toBe(500);
    expect(err.responseBody).toBe('{"error":"internal"}');
  });

  it('getStatusCode and getResponseBody return correct values', () => {
    const err = new HttpException('not found', 404, 'not found');
    expect(err.getStatusCode()).toBe(404);
    expect(err.getResponseBody()).toBe('not found');
  });
});

describe('ValidationException', () => {
  it('extends TaxoraException with code 422 and errors', () => {
    const errors = { vat_uid: ['The vat_uid field is required.'] };
    const err = new ValidationException('Validation failed', errors);
    expect(err).toBeInstanceOf(TaxoraException);
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(422);
    expect(err.getErrors()).toEqual(errors);
  });
});
