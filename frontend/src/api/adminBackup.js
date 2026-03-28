import api from "./client";

export const backupPreview  = () =>
  api.get("/admin/backup/preview", { timeout: 60000 }).then(r => r.data);

export const backupPrepare  = () =>
  api.post("/admin/backup/prepare", null, { timeout: 30000 }).then(r => r.data);

export const backupRunTable = (tableName, folderId) =>
  api.post("/admin/backup/run-table", { tableName, folderId }, { timeout: 120000 }).then(r => r.data);
