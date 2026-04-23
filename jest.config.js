/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
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
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
};