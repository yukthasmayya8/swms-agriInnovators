import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);

const configuredDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (configuredDatabaseUrl) {
    const testDatabaseUrl = new URL(configuredDatabaseUrl);
    if (!process.env.TEST_DATABASE_URL) testDatabaseUrl.pathname = "/swms_test";
    process.env.DATABASE_URL = testDatabaseUrl.toString();
} else {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/swms_test";
}
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STORAGE_DRIVER = "local";
process.env.LOCAL_STORAGE_DIR = "./storage/test-uploads";
process.env.NODE_ENV = "test";

