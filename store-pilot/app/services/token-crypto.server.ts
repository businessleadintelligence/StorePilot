import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const TOKEN_CIPHER_PREFIX = "spenc:v1:";
const IV_LENGTH = 12;

export class TokenEncryptionKeyMissingError extends Error {
  constructor() {
    super("TOKEN_ENCRYPTION_KEY_missing");
    this.name = "TokenEncryptionKeyMissingError";
  }
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new TokenEncryptionKeyMissingError();
  }

  return createHash("sha256").update(raw, "utf8").digest();
}

export function isTokenEncryptionConfigured(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY?.trim());
}

export function assertTokenEncryptionConfigured(): void {
  resolveEncryptionKey();
}

export function encryptSecretToken(plaintext: string | null | undefined): string {
  if (!plaintext) {
    return "";
  }

  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_CIPHER_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

export function decryptSecretToken(stored: string | null | undefined): string {
  if (!stored) {
    return "";
  }

  if (!stored.startsWith(TOKEN_CIPHER_PREFIX)) {
    return stored;
  }

  const key = resolveEncryptionKey();
  const payload = Buffer.from(stored.slice(TOKEN_CIPHER_PREFIX.length), "base64url");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}
