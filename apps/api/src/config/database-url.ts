export const validateSafeTestDatabaseUrl = (value: string): string => {
  if (!value) {
    throw new Error('TEST_DATABASE_URL is missing or empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL is invalid.');
  }

  const { protocol, hostname, port, pathname, search, hash } = parsed;

  if (protocol !== 'postgresql:' && protocol !== 'postgres:') {
    throw new Error('TEST_DATABASE_URL must use postgresql: or postgres: protocol.');
  }

  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error('TEST_DATABASE_URL must target localhost or 127.0.0.1.');
  }

  if (port !== '5432') {
    throw new Error('TEST_DATABASE_URL must target port 5432.');
  }

  if (pathname !== '/invoiceflow_test') {
    throw new Error('TEST_DATABASE_URL must target /invoiceflow_test database.');
  }

  if (search !== '') {
    throw new Error('TEST_DATABASE_URL cannot contain query parameters.');
  }

  if (hash !== '') {
    throw new Error('TEST_DATABASE_URL cannot contain a fragment.');
  }

  return value;
};

export const resolveRuntimeDatabaseUrl = ({
  nodeEnv,
  databaseUrl,
  testDatabaseUrl,
}: {
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  testDatabaseUrl?: string;
}): string => {
  if (nodeEnv !== 'test') {
    return databaseUrl;
  }

  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required when NODE_ENV=test.');
  }

  return validateSafeTestDatabaseUrl(testDatabaseUrl);
};
