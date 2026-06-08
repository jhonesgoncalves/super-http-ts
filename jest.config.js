module.exports = {
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(t|j)s$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/plugins/index.ts',       // plugin factories — covered by integration in examples
    '!src/nestjs/index.ts',        // re-exports only
    '!src/nestjs/super-http.module.ts',   // requires full NestJS DI context — tested via e2e
    '!src/nestjs/super-http.service.ts',  // NestJS injectable — tested via e2e
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
