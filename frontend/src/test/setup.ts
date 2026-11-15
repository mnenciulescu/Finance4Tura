import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { __resetOverlays } from "../app/overlays";
import { __resetTabHistory } from "../app/tabHistory";

// Node 25 exposes its own experimental localStorage global, which shadows
// jsdom's and lacks most of the Storage API. Use a plain in-memory Storage.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  const current = (globalThis as any)[name];
  if (!current || typeof current.clear !== "function" || typeof current.setItem !== "function") {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}

// jsdom lacks these browser APIs; the app guards most of them, charts do not.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver ??= ResizeObserverStub;
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollTo ??= function scrollTo() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
// Screens render as on a phone unless a test widens the window (One-Page).
const PHONE_WIDTH = 390;
Object.defineProperty(window, "innerWidth", { value: PHONE_WIDTH, writable: true, configurable: true });

window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as typeof window.matchMedia;

afterEach(() => {
  cleanup();
  window.innerWidth = PHONE_WIDTH;
  __resetOverlays();
  __resetTabHistory();
  localStorage.clear();
});
