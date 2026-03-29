const memoryStore = new Map<string, string>();

export const appStorage = {
  getItem(key: string): string | null {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    memoryStore.set(key, value);
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
  },
};

// #SPEC GAP: local persistence strategy is not finalized for production;
// this in-memory store removes localStorage usage while backend API migration is completed.
