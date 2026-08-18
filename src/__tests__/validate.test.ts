import { assertDuration, assertIntAtLeast, assertOneOf, assertOptional } from '../models/validate';

describe('assertIntAtLeast', () => {
  it('accepts integers at or above the minimum', () => {
    expect(() => assertIntAtLeast(1, 1, 'x')).not.toThrow();
    expect(() => assertIntAtLeast(0, 0, 'x')).not.toThrow();
    expect(() => assertIntAtLeast(100, 1, 'x')).not.toThrow();
  });

  it('rejects values below the minimum, naming the value', () => {
    expect(() => assertIntAtLeast(0, 1, 'maxConcurrent')).toThrow(RangeError);
    expect(() => assertIntAtLeast(0, 1, 'maxConcurrent')).toThrow(/maxConcurrent must be >= 1, received 0/);
    expect(() => assertIntAtLeast(-3, 0, 'x')).toThrow(/received -3/);
  });

  it('rejects non-integers', () => {
    expect(() => assertIntAtLeast(1.5, 1, 'x')).toThrow(/integer/);
  });

  it('rejects non-numbers and non-finite numbers', () => {
    expect(() => assertIntAtLeast('5', 1, 'x')).toThrow(TypeError);
    expect(() => assertIntAtLeast(undefined, 1, 'x')).toThrow(/received undefined/);
    expect(() => assertIntAtLeast(null, 1, 'x')).toThrow(/received null/);
    expect(() => assertIntAtLeast({}, 1, 'x')).toThrow(/received object/);
    expect(() => assertIntAtLeast(NaN, 1, 'x')).toThrow(TypeError);
    expect(() => assertIntAtLeast(Infinity, 1, 'x')).toThrow(/finite/);
  });

  it('tags messages with the library name', () => {
    expect(() => assertIntAtLeast(0, 1, 'x')).toThrow(/\[super-http\]/);
  });
});

describe('assertDuration', () => {
  it('accepts zero and positive durations', () => {
    expect(() => assertDuration(0, 'x')).not.toThrow();
    expect(() => assertDuration(1_500, 'x')).not.toThrow();
    expect(() => assertDuration(1.5, 'x')).not.toThrow();
  });

  it('rejects negatives', () => {
    expect(() => assertDuration(-1, 'delayMs')).toThrow(/delayMs must be >= 0, received -1/);
  });

  it('rejects non-numbers', () => {
    expect(() => assertDuration('100', 'x')).toThrow(TypeError);
    expect(() => assertDuration(NaN, 'x')).toThrow(TypeError);
  });

  it('rejects Infinity unless it is explicitly allowed', () => {
    expect(() => assertDuration(Infinity, 'x')).toThrow(/finite/);
    expect(() => assertDuration(Infinity, 'x', true)).not.toThrow();
  });
});

describe('assertOptional', () => {
  it('skips undefined', () => {
    expect(() => assertOptional(undefined, () => assertIntAtLeast(0, 1, 'x'))).not.toThrow();
  });

  it('runs the assertion for a present value', () => {
    expect(() => assertOptional(0, (v) => assertIntAtLeast(v, 1, 'x'))).toThrow(/must be >= 1/);
    expect(() => assertOptional(5, (v) => assertIntAtLeast(v, 1, 'x'))).not.toThrow();
  });
});

describe('assertOneOf', () => {
  it('accepts a listed value', () => {
    expect(() => assertOneOf('a', ['a', 'b'], 'thing')).not.toThrow();
  });

  it('lists the allowed values so the message contains the fix', () => {
    expect(() => assertOneOf('c', ['a', 'b'], 'preset')).toThrow(/unknown preset "c"/);
    expect(() => assertOneOf('c', ['a', 'b'], 'preset')).toThrow(/Expected one of: a, b/);
  });
});
