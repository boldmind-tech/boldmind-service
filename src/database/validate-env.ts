export function validateDatabaseEnvVars(): { valid: boolean; missing: string[] } {
  const required = [
    'DATABASE_URL',
    'MONGODB_URL',
    'MONGODB_DB_MAIN',
    'REDIS_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'PAYSTACK_SECRET_KEY',
  ];
  const missing = required.filter((v) => !process.env[v]);
  return { valid: missing.length === 0, missing };
}