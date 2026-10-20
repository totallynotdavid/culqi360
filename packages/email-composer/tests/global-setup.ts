import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED_ENV = "CRM_EMAIL_TEMPLATES_GENERATED";

export default function generateEmailTemplates(): void {
  if (process.env[GENERATED_ENV] === "1") {
    return;
  }

  execFileSync("bun", ["scripts/build-emails.ts"], {
    cwd: packageDir,
    stdio: "inherit",
  });
  process.env[GENERATED_ENV] = "1";
}
