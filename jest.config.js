/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    "/test/",
    "/src/infra/",
    "/src/domain/entities/",
    "/src/domain/mocks/",
  ],
  collectCoverageFrom: [
    "src/**"
  ]
};