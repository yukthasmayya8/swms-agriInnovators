module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    setupFiles: ["<rootDir>/tests/jest.setup.ts"],
    testTimeout: 15000,
    maxWorkers: 1
};
