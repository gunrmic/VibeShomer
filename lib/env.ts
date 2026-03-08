// Validate required environment variables at module load time.
// This runs once when the module is first imported on the server.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const ENV = {
  get ANTHROPIC_API_KEY(): string {
    return requireEnv('ANTHROPIC_API_KEY');
  },
  get GITHUB_TOKEN(): string | undefined {
    return process.env.GITHUB_TOKEN;
  },
};
