import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001",
  headers: { "Content-Type": "application/json" },
});

// Operation log — max 50 entries, newest first
export const opLog = [];
let seq = 0;
export const getLogSeq = () => seq;

function pushLog(config, status, ms) {
  const d = new Date();
  opLog.unshift({
    id:     ++seq,
    ts:     `${d.toLocaleTimeString("ro-RO", { hour12: false })} · ${d.toLocaleDateString("ro-RO")}`,
    method: (config?.method ?? "?").toUpperCase(),
    url:    config?.url ?? "?",
    params: config?.params,
    status,
    ms,
  });
  if (opLog.length > 50) opLog.pop();
}

client.interceptors.request.use(config => {
  config._ts = Date.now();
  return config;
});

client.interceptors.response.use(
  res  => { pushLog(res.config, res.status, Date.now() - res.config._ts); return res; },
  err  => { pushLog(err.config, err.response?.status ?? 0, Date.now() - (err.config?._ts ?? Date.now())); return Promise.reject(err); },
);

export default client;
