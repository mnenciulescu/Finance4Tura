import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  listLocations, createLocation, updateLocation, deleteLocation,
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  listEntries, createEntry, updateEntry, deleteEntry,
} from "../api/headquarters";
import type { HqEntry, HqLocation, HqTemplate } from "../types";
import { keys, patchLists } from "./queries";
import { crud } from "./mutations";

/* ── Headquarters ─────────────────────────────────────────────────────────── */

export const useHqLocations = () =>
  useQuery({
    queryKey: keys.hqLocations,
    queryFn: async () => ((await listLocations()) as HqLocation[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
export const useHqTemplates = () =>
  useQuery({ queryKey: keys.hqTemplates, queryFn: () => listTemplates() as Promise<HqTemplate[]> });
export const useHqEntries = () =>
  useQuery({ queryKey: keys.hqEntries, queryFn: () => listEntries() as Promise<HqEntry[]> });

const locCrud = crud<HqLocation>(keys.hqLocations, l => l.hqId, createLocation, updateLocation, deleteLocation);
const tplCrud = crud<HqTemplate>(keys.hqTemplates, t => t.templateId, createTemplate, updateTemplate, deleteTemplate);
export const useSaveLocation = locCrud.useSave;
export const useDeleteLocation = locCrud.useDelete;
export const useSaveTemplate = tplCrud.useSave;

/** Deleting a template also drops its entries from the cache, as before. */
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: (_d, id) => {
      patchLists<HqTemplate>(qc, keys.hqTemplates, l => l.filter(t => t.templateId !== id));
      patchLists<HqEntry>(qc, keys.hqEntries, l => l.filter(e => e.templateId !== id));
    },
  });
}

export const hqEntryApi = { createEntry, updateEntry, deleteEntry };

export function upsertEntryInCache(qc: QueryClient, entry: HqEntry) {
  qc.setQueryData<HqEntry[]>(keys.hqEntries, old => {
    if (!old) return [entry];
    return old.some(e => e.entryId === entry.entryId)
      ? old.map(e => (e.entryId === entry.entryId ? entry : e))
      : [entry, ...old];
  });
}
export function removeEntryFromCache(qc: QueryClient, entryId: string) {
  patchLists<HqEntry>(qc, keys.hqEntries, l => l.filter(e => e.entryId !== entryId));
}
