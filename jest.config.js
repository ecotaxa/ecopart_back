/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Gives the test secrets the values CI uses when there is no .env (fresh clone, new worktree)
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  coveragePathIgnorePatterns: [
    "/test/",
    "/src/infra/",
    "/src/domain/entities/",
    "/src/domain/mocks/",
  ],
  collectCoverageFrom: [
    "src/**"
  ],
  // Transform ESM-only packages (node-fetch v3 and its dependencies) so Jest can process them
  transformIgnorePatterns: [
    "/node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)"
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
    '^.+\\.jsx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
};