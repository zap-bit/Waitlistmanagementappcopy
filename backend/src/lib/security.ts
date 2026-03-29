import crypto from 'node:crypto';

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  // #SPEC GAP: the spec calls for bcrypt(12), but package installation is blocked in this execution environment,
  // so this secure scaffold uses Node's built-in scrypt with per-password random salt instead.
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (error, result) => {
      if (error) reject(error);
      else resolve(result as Buffer);
    });
  });

  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (error, result) => {
      if (error) reject(error);
      else resolve(result as Buffer);
    });
  });

  return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), derivedKey);
}

export function createOpaqueToken(prefix: 'atk' | 'rtk'): string {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}
