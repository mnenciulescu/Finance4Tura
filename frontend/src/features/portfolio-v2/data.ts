import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelPv2Run, createPv2Asset, deletePv2Asset, getPv2AiConfig, getPv2Run, importPv2Assets, listPv2Assets,
  listPv2Runs, listPv2Snapshots, retryPv2Run, startPv2Run, updatePv2Asset, updatePv2AiConfig,
} from "../../api/portfolioV2";
import type { Pv2AiConfig, Pv2Asset, Pv2Run, Pv2Snapshot } from "../../types";

/* Portfolio v2 server state (One-Page only, so it stays in that chunk). */

export const pv2Keys = {
  all: ["pv2"] as const,
  assets: ["pv2", "assets"] as const,
  snapshots: ["pv2", "snapshots"] as const,
  runs: ["pv2", "runs"] as const,
  run: (id: string) => ["pv2", "run", id] as const,
  ai: ["pv2", "ai"] as const,
};

const asList = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

export const usePv2Assets = () =>
  useQuery({ queryKey: pv2Keys.assets, queryFn: async () => asList<Pv2Asset>(await listPv2Assets()) });
export const usePv2Snapshots = () =>
  useQuery({ queryKey: pv2Keys.snapshots, queryFn: async () => asList<Pv2Snapshot>(await listPv2Snapshots()) });
/** Recent runs; polled while one is in progress (the block shows its progress). */
export const usePv2Runs = () =>
  useQuery({
    queryKey: pv2Keys.runs,
    queryFn: async () => asList<Pv2Run>(await listPv2Runs(10)),
    meta: { persist: false },
    refetchInterval: q => (q.state.data?.some(r => r.status === "running") ? 4000 : false),
  });
export const usePv2AiConfig = () =>
  useQuery({ queryKey: pv2Keys.ai, queryFn: () => getPv2AiConfig() as Promise<Pv2AiConfig>, meta: { persist: false }, staleTime: 60_000 });

/** A run, polled every 2 s while it is in progress. */
export const usePv2Run = (id: string | null) =>
  useQuery({
    queryKey: pv2Keys.run(id ?? ""),
    queryFn: () => getPv2Run(id!) as Promise<Pv2Run>,
    enabled: !!id,
    meta: { persist: false },
    refetchInterval: q => (q.state.data?.status === "running" ? 2000 : false),
  });

export function useSavePv2Asset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<Pv2Asset> }) => (id ? updatePv2Asset(id, body) : createPv2Asset(body)),
    onSettled: () => qc.invalidateQueries({ queryKey: pv2Keys.assets }),
  });
}

/** Archive (keep history) or delete an asset with its snapshots, optimistically. */
export function useDeletePv2Asset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ asset, mode }: { asset: Pv2Asset; mode: "archive" | "delete" }) => deletePv2Asset(asset.assetId, mode),
    onMutate: async ({ asset, mode }) => {
      await qc.cancelQueries({ queryKey: pv2Keys.assets });
      const prev = qc.getQueryData<Pv2Asset[]>(pv2Keys.assets);
      qc.setQueryData<Pv2Asset[]>(pv2Keys.assets, list =>
        mode === "delete" ? list?.filter(a => a.assetId !== asset.assetId) : list?.map(a => (a.assetId === asset.assetId ? { ...a, active: false } : a)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(pv2Keys.assets, ctx.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: pv2Keys.assets });
      qc.invalidateQueries({ queryKey: pv2Keys.snapshots });
    },
  });
}

export function useImportPv2Assets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, dryRun }: { rows: unknown[]; dryRun: boolean }) => importPv2Assets(rows, dryRun),
    onSuccess: (_d, v) => { if (!v.dryRun) qc.invalidateQueries({ queryKey: pv2Keys.assets }); },
  });
}

export function useStartPv2Run() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startPv2Run() as Promise<Pv2Run>,
    onSuccess: run => {
      qc.setQueryData(pv2Keys.run(run.runId), run);
      qc.invalidateQueries({ queryKey: pv2Keys.runs });
    },
  });
}

export function useCancelPv2Run() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelPv2Run(id),
    onSettled: (_d, _e, id) => qc.invalidateQueries({ queryKey: pv2Keys.run(id) }),
  });
}

export function useRetryPv2Run() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assetIds }: { id: string; assetIds?: string[] }) => retryPv2Run(id, assetIds) as Promise<Pv2Run>,
    onSuccess: run => {
      qc.setQueryData(pv2Keys.run(run.runId), run);
      qc.invalidateQueries({ queryKey: pv2Keys.runs });
    },
  });
}

export function useUpdatePv2AiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pv2AiConfig> & { apiKey?: string; clearKey?: boolean }) => updatePv2AiConfig(body) as Promise<Pv2AiConfig>,
    onSuccess: cfg => qc.setQueryData(pv2Keys.ai, cfg),
  });
}
