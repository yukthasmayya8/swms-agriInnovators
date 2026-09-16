process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/swms_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STORAGE_DRIVER = "local";
process.env.LOCAL_STORAGE_DIR = "./storage/test-uploads";
process.env.NODE_ENV = "test";
