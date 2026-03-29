import type { AccessSession, RefreshSession } from '../types/contracts.js';

export const db = {
  accessTokens: new Map<string, AccessSession>(),
  refreshTokens: new Map<string, RefreshSession>(),
};

export async function seedStore() {
  return Promise.resolve();
}
