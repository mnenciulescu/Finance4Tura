import client from "./client";

// ── Templates ─────────────────────────────────────────────────────────────────
export const listTemplates   = ()               => client.get("/practice-tests/templates").then(r => r.data);
export const getTemplate     = (id)             => client.get(`/practice-tests/templates/${id}`).then(r => r.data);
export const createTemplate  = (body)           => client.post("/practice-tests/templates", body).then(r => r.data);
export const updateTemplate  = (id, body)       => client.put(`/practice-tests/templates/${id}`, body).then(r => r.data);
export const deleteTemplate  = (id)             => client.delete(`/practice-tests/templates/${id}`).then(r => r.data);

// ── Results ───────────────────────────────────────────────────────────────────
export const listResults     = (params = {})    => client.get("/practice-tests/results", { params }).then(r => r.data);
export const getResult       = (id)             => client.get(`/practice-tests/results/${id}`).then(r => r.data);
export const createResult    = (body)           => client.post("/practice-tests/results", body).then(r => r.data);
export const updateResult    = (id, body)       => client.put(`/practice-tests/results/${id}`, body).then(r => r.data);
export const deleteResult    = (id)             => client.delete(`/practice-tests/results/${id}`).then(r => r.data);

// ── Kids ──────────────────────────────────────────────────────────────────────
export const getKids         = ()               => client.get("/practice-tests/kids").then(r => r.data);
export const putKids         = (body)           => client.put("/practice-tests/kids", body).then(r => r.data);
