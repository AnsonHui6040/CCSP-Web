/**
 * Lightweight `window`/`localStorage` polyfill for unit tests that exercise
 * stores backed by `window.localStorage`. Avoids pulling in jsdom.
 */

type Listener = (e: { key: string | null }) => void;

export type FakeWindow = {
  localStorage: Storage;
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  /** Test helper: simulate another tab writing this key. */
  __dispatchStorage: (key: string) => void;
};

export function installFakeWindow(): FakeWindow {
  const data = new Map<string, string>();
  const listeners = new Map<string, Set<Listener>>();
  const ls: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(k: string) {
      return data.get(k) ?? null;
    },
    key(i: number) {
      return Array.from(data.keys())[i] ?? null;
    },
    removeItem(k: string) {
      data.delete(k);
    },
    setItem(k: string, v: string) {
      data.set(k, v);
    },
  };
  const w: FakeWindow = {
    localStorage: ls,
    addEventListener(type, listener) {
      let bucket = listeners.get(type);
      if (!bucket) {
        bucket = new Set();
        listeners.set(type, bucket);
      }
      bucket.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    __dispatchStorage(key) {
      listeners.get("storage")?.forEach((l) => l({ key }));
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = w;
  return w;
}

export function uninstallFakeWindow() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
}
