export async function setup() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is required for integration tests. ' +
      'Provide a PostgreSQL connection string with pgvector enabled.'
    );
  }
}
