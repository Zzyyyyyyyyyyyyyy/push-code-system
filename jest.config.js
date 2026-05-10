/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "preserve",
          esModuleInterop: true,
          target: "ES2022",
          module: "commonjs",
          moduleResolution: "node",
          paths: { "@/*": ["./*"] },
          baseUrl: ".",
        },
      },
    ],
  },
};
