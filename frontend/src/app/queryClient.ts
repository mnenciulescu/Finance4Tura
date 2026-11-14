import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

/**
 * Server-state cache (proposal §12.3).
 *
 * The cache is persisted to IndexedDB, so the app opens instantly with the
 * last data — even offline — and refreshes in the background. Admin data is
 * marked `meta.persist = false` and never written to the device. Sign-out
 * clears both the memory cache and the persisted copy.
 */

export const PERSIST_KEY = "4tura-query-cache";
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // a week

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: PERSIST_MAX_AGE,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
}

export const queryClient = makeQueryClient();

export const persister = createAsyncStoragePersister({
  key: PERSIST_KEY,
  storage: {
    getItem: (key: string) => get(key),
    setItem: (key: string, value: string) => set(key, value),
    removeItem: (key: string) => del(key),
  },
  throttleTime: 1000,
});

/** Persist only successful, non-admin queries. */
export const shouldPersistQuery = (query: { state: { status: string }; meta?: Record<string, unknown> }) =>
  query.state.status === "success" && query.meta?.persist !== false;

/** Wipes every cached figure from memory and from the device. */
export async function clearCachedData() {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {
    /* IndexedDB unavailable — nothing was stored */
  }
}
