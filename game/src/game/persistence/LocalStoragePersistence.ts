import type { IPersistence } from "./IPersistence.js";

export class LocalStoragePersistence implements IPersistence {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore — storage quota exceeded or private browsing */
    }
  }
}

/** In-memory store — no I/O. Use for ML training and tests. */
export class MemoryPersistence implements IPersistence {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  clear(): void {
    this.data.clear();
  }
}

export const defaultPersistence = new LocalStoragePersistence();
