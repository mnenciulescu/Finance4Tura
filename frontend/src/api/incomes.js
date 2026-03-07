import client from "./client";

export const getIncome    = (id)       => client.get(`/incomes/${id}`).then(r => r.data);
export const listIncomes  = (params)   => client.get("/incomes", { params }).then(r => r.data);
export const createIncome = (body)     => client.post("/incomes", body).then(r => r.data);
export const updateIncome = (id, body) => client.put(`/incomes/${id}`, body).then(r => r.data);
export const updateIncomeSeries = (id, body) => client.put(`/incomes/${id}/series`, body).then(r => r.data);
export const deleteIncome = (id, params) => client.delete(`/incomes/${id}`, { params }).then(r => r.data);
