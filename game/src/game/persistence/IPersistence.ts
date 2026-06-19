/**
 * Storage abstraction used by GameSim for all save/load operations.
 *
 * Web: LocalStoragePersistence (default)
 * iOS (Capacitor): CapacitorPersistence wrapping @capacitor/preferences
 * React Native: AsyncStoragePersistence (async variant needed)
 * ML training: MemoryPersistence — in-memory, no I/O, fast resets
 * Tests: MemoryPersistence
 */
export interface IPersistence {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
