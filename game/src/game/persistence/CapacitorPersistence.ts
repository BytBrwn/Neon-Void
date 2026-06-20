import { Preferences } from "@capacitor/preferences";
import type { IPersistence } from "./IPersistence.js";

/**
 * Native iOS persistence backed by @capacitor/preferences.
 *
 * IPersistence is synchronous, but Capacitor's Preferences API is async, so
 * reads are served from an in-memory cache that must be hydrated up front via
 * `CapacitorPersistence.create()`. Writes update the cache immediately and
 * flush to native storage in the background.
 */
export class CapacitorPersistence implements IPersistence {
  private readonly cache = new Map<string, string>();

  private constructor(entries: [string, string][]) {
    for (const [key, value] of entries) this.cache.set(key, value);
  }

  static async create(): Promise<CapacitorPersistence> {
    const { keys } = await Preferences.keys();
    const entries = await Promise.all(
      keys.map(async (key): Promise<[string, string] | null> => {
        const { value } = await Preferences.get({ key });
        return value === null ? null : [key, value];
      }),
    );
    return new CapacitorPersistence(entries.filter((entry): entry is [string, string] => entry !== null));
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    void Preferences.set({ key, value });
  }
}
