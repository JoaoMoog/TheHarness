import { TypeSafeClient } from "@typesafe-ai/sdk";

const API_KEY_ENV = "TYPESAFE_API_KEY";

/** Creates a Jev client, failing fast when the API key is missing. */
export function createJevClient(): TypeSafeClient {
  if (!process.env[API_KEY_ENV]) {
    throw new Error(`${API_KEY_ENV} is not set. Copy .env.example to .env and add your key.`);
  }
  return new TypeSafeClient();
}
