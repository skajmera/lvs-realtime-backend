process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGIN = "*";
// MONGODB_URI is set per-test-run by tests/setup.ts once mongodb-memory-server starts.
