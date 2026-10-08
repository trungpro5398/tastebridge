import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const required = ["QLOO_API_KEY", "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());
for (const key of required) console.log(`${key}: ${missing.includes(key) ? "MISSING" : "configured"}`);
console.log(missing.length ? "Live deployment blocked: configure the missing values privately." : "Configuration present. Live provider checks are still required before deployment.");
process.exitCode = missing.length ? 1 : 0;
