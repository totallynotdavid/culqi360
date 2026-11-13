import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const TOKEN_BYTES = 20;
const TOKEN_PATTERN = /^[a-z2-7]{32}$/;

export function generatePasswordResetToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export function hashPasswordResetToken(token: string): string {
  const payload = new TextEncoder().encode(`password_reset:${token}`);
  return encodeHexLowerCase(sha256(payload));
}

export function isValidPasswordResetTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
