import client from "./client";

export const listOperations  = (params)   => client.get("/investments/operations", { params }).then(r => r.data);
export const createOperation = (body)     => client.post("/investments/operations", body).then(r => r.data);
export const updateOperation = (id, body) => client.put(`/investments/operations/${id}`, body).then(r => r.data);
export const deleteOperation = (id)       => client.delete(`/investments/operations/${id}`).then(r => r.data);

export const listSnapshots   = (params)   => client.get("/investments/snapshots", { params }).then(r => r.data);
export const createSnapshot  = (body)     => client.post("/investments/snapshots", body).then(r => r.data);
export const deleteSnapshot  = (id)       => client.delete(`/investments/snapshots/${id}`).then(r => r.data);
