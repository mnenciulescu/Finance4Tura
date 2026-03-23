import client from "./client";

export const listBooks   = ()           => client.get("/books-and-dev").then(r => r.data);
export const createBook  = (body)       => client.post("/books-and-dev", body).then(r => r.data);
export const updateBook  = (id, body)   => client.put(`/books-and-dev/${id}`, body).then(r => r.data);
export const deleteBook  = (id)         => client.delete(`/books-and-dev/${id}`).then(r => r.data);
