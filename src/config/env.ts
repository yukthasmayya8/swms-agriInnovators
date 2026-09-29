import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/swms",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || "local") as "local" | "s3",
    localDir: process.env.LOCAL_STORAGE_DIR || "./storage/uploads",
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_REGION || ""
  }
};
