/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['dotenv/config'],
  transform: {
    // tsconfig usa module "node16" (hybrid) — ts-jest exige isolatedModules
    // nesse caso. Sobrescrevemos para commonjs só no transform de teste, para
    // manter a checagem de tipos completa (sem isolatedModules) e sem o warning.
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node' } }],
  },
};
