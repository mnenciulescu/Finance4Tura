import client from "./client";

// Portfolio v2 (One-Page block): assets, AI-priced snapshots, snapshot runs.
export const listPv2Assets   = ()         => client.get("/portfolio-v2/assets").then(r => r.data);
export const createPv2Asset  = (body)     => client.post("/portfolio-v2/assets", body).then(r => r.data);
export const updatePv2Asset  = (id, body) => client.put(`/portfolio-v2/assets/${id}`, body).then(r => r.data);
export const deletePv2Asset  = (id, mode) => client.delete(`/portfolio-v2/assets/${id}`, { params: { mode } }).then(r => r.data);
export const importPv2Assets = (rows, dryRun) =>
  client.post("/portfolio-v2/assets/import", { rows }, { params: dryRun ? { dryRun: "true" } : undefined }).then(r => r.data);

export const listPv2Snapshots = () => client.get("/portfolio-v2/snapshots").then(r => r.data);

export const listPv2Runs  = (limit = 10) => client.get("/portfolio-v2/runs", { params: { limit } }).then(r => r.data);
export const startPv2Run  = ()           => client.post("/portfolio-v2/runs").then(r => r.data);
export const getPv2Run    = (id)         => client.get(`/portfolio-v2/runs/${id}`).then(r => r.data);
export const cancelPv2Run = (id)         => client.post(`/portfolio-v2/runs/${id}/cancel`).then(r => r.data);
export const retryPv2Run  = (id, assetIds) => client.post(`/portfolio-v2/runs/${id}/retry`, { assetIds }).then(r => r.data);

export const getPv2AiConfig    = ()     => client.get("/portfolio-v2/ai-config").then(r => r.data);
export const updatePv2AiConfig = (body) => client.put("/portfolio-v2/ai-config", body).then(r => r.data);
