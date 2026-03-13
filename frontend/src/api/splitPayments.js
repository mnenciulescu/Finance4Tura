import client from "./client";

export const listSplitPayments   = ()         => client.get("/split-payments").then(r => r.data);
export const createSplitPayment  = (body)     => client.post("/split-payments", body).then(r => r.data);
export const updateSplitPayment  = (id, body) => client.put(`/split-payments/${id}`, body).then(r => r.data);
export const deleteSplitPayment  = (id)       => client.delete(`/split-payments/${id}`).then(r => r.data);
