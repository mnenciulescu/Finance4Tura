import client from "./client";

// ── Locations ─────────────────────────────────────────────────────────────────
export const listLocations  = ()         => client.get("/headquarters").then(r => r.data);
export const createLocation = (body)     => client.post("/headquarters", body).then(r => r.data);
export const updateLocation = (id, body) => client.put(`/headquarters/${id}`, body).then(r => r.data);
export const deleteLocation = (id)       => client.delete(`/headquarters/${id}`).then(r => r.data);

// ── Templates ─────────────────────────────────────────────────────────────────
export const listTemplates  = (params)   => client.get("/headquarters/templates", { params }).then(r => r.data);
export const createTemplate = (body)     => client.post("/headquarters/templates", body).then(r => r.data);
export const updateTemplate = (id, body) => client.put(`/headquarters/templates/${id}`, body).then(r => r.data);
export const deleteTemplate = (id)       => client.delete(`/headquarters/templates/${id}`).then(r => r.data);

// ── Entries ───────────────────────────────────────────────────────────────────
export const listEntries  = (params)   => client.get("/headquarters/entries", { params }).then(r => r.data);
export const createEntry  = (body)     => client.post("/headquarters/entries", body).then(r => r.data);
export const updateEntry  = (id, body) => client.put(`/headquarters/entries/${id}`, body).then(r => r.data);
export const deleteEntry  = (id)       => client.delete(`/headquarters/entries/${id}`).then(r => r.data);
