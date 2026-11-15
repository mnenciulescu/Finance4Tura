// One-Page (the desktop dashboard at /one-page): its path and the
// per-browser "Open One-Page on this computer" preference.

export const ONE_PAGE_PATH = "/one-page";
export const ONE_PAGE_DEFAULT_KEY = "onePage.default";
/** Narrower screens never open One-Page automatically. */
export const ONE_PAGE_MIN_WIDTH = 1024;

export function readOnePageDefault(): boolean {
  try { return localStorage.getItem(ONE_PAGE_DEFAULT_KEY) === "true"; } catch { return false; }
}

export function writeOnePageDefault(on: boolean) {
  try { localStorage.setItem(ONE_PAGE_DEFAULT_KEY, String(on)); } catch { /* ignore */ }
}

/** Whether `/` should open One-Page on this launch. */
export const opensOnePage = () =>
  readOnePageDefault() && typeof window !== "undefined" && window.innerWidth >= ONE_PAGE_MIN_WIDTH;
