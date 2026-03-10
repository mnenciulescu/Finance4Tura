import client from "./client";

export const listUsers      = ()                     => client.get("/admin/users").then(r => r.data);
export const updateUserRole = (username, role)       => client.put(`/admin/users/${encodeURIComponent(username)}/role`, { role }).then(r => r.data);
export const deleteUser     = (username)             => client.delete(`/admin/users/${encodeURIComponent(username)}`).then(r => r.data);
