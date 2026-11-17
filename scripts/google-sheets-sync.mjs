import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.CRON_SECRET) {
  console.error("CRON_SECRET nav iestatīts .env.local.");
  process.exit(1);
}

const baseUrl = process.env.GOOGLE_SHEETS_SYNC_LOCAL_URL ?? "http://localhost:3000";

try {
  const response = await fetch(new URL("/api/cron/google-sheets-sync", baseUrl), {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok || result.configurationError || result.failed > 0 || result.scanErrors?.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
