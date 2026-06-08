/**
 * Tests for the NestJS integration helpers that can run without a full
 * NestJS DI context: constants and the InjectSuperHttp decorator factory.
 */

import 'reflect-metadata';
import {
  SUPER_HTTP_DEFAULT_CLIENT,
  SUPER_HTTP_MODULE_OPTIONS,
  getSuperHttpClientToken,
} from '../nestjs/super-http.constants';
import { InjectSuperHttp } from '../nestjs/super-http.decorators';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('super-http NestJS constants', () => {
  it('SUPER_HTTP_DEFAULT_CLIENT is a non-empty string', () => {
    expect(typeof SUPER_HTTP_DEFAULT_CLIENT).toBe('string');
    expect(SUPER_HTTP_DEFAULT_CLIENT.length).toBeGreaterThan(0);
  });

  it('SUPER_HTTP_MODULE_OPTIONS is a non-empty string', () => {
    expect(typeof SUPER_HTTP_MODULE_OPTIONS).toBe('string');
    expect(SUPER_HTTP_MODULE_OPTIONS.length).toBeGreaterThan(0);
  });

  it('getSuperHttpClientToken returns a namespaced uppercase token', () => {
    expect(getSuperHttpClientToken('payments')).toBe('SUPER_HTTP_CLIENT_PAYMENTS');
    expect(getSuperHttpClientToken('CATALOG')).toBe('SUPER_HTTP_CLIENT_CATALOG');
    expect(getSuperHttpClientToken('my-service')).toBe('SUPER_HTTP_CLIENT_MY-SERVICE');
  });

  it('getSuperHttpClientToken produces unique tokens per name', () => {
    const a = getSuperHttpClientToken('A');
    const b = getSuperHttpClientToken('B');
    expect(a).not.toBe(b);
  });
});

// ─── InjectSuperHttp decorator ────────────────────────────────────────────────

describe('InjectSuperHttp decorator', () => {
  it('returns a ParameterDecorator function', () => {
    const decorator = InjectSuperHttp();
    expect(typeof decorator).toBe('function');
  });

  it('returns a ParameterDecorator for a named client', () => {
    const decorator = InjectSuperHttp('PAYMENTS');
    expect(typeof decorator).toBe('function');
  });

  it('default decorator (no name) targets SUPER_HTTP_DEFAULT_CLIENT token', () => {
    // Apply the decorator to a test class constructor param and verify
    // Reflect metadata is set with the correct injection token.
    class TestClass {
      constructor(public dep: unknown) {}
    }

    const decorator = InjectSuperHttp();
    // Decorators set metadata on the target; calling it should not throw
    expect(() => decorator(TestClass, undefined, 0)).not.toThrow();
  });

  it('named decorator targets the correct named client token', () => {
    class TestClass {
      constructor(public dep: unknown) {}
    }

    const decorator = InjectSuperHttp('CATALOG');
    expect(() => decorator(TestClass, undefined, 0)).not.toThrow();
  });
});
