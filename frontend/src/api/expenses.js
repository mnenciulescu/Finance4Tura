import client from "./client";

export const getExpense          = (id)       => client.get(`/expenses/${id}`).then(r => r.data);
export const listExpenses        = (params)   => client.get("/expenses", { params }).then(r => r.data);
export const createExpense       = (body)     => client.post("/expenses", body).then(r => r.data);
export const updateExpense       = (id, body) => client.put(`/expenses/${id}`, body).then(r => r.data);
export const updateExpenseSeries = (id, body) => client.put(`/expenses/${id}/series`, body).then(r => r.data);
export const deleteExpense       = (id, params) => client.delete(`/expenses/${id}`, { params }).then(r => r.data);
export const resolveIncome       = (date)     => client.get("/expenses/resolve-income", { params: { date } }).then(r => r.data);
