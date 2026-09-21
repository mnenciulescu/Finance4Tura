import axios from "axios";

// The app runs against AWS only — there is no local backend to fall back to.
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod";

const client = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

let _authToken = null;
export const setAuthToken = (token) => { _authToken = token; };
export const getAuthToken = () => _authToken;

let _onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { _onUnauthorized = fn; };

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
  if (_authToken) config.headers.Authorization = _authToken;
  config._ts = Date.now();
  return config;
});

client.interceptors.response.use(
  res  => { pushLog(res.config, res.status, Date.now() - res.config._ts); return res; },
  err  => {
    pushLog(err.config, err.response?.status ?? 0, Date.now() - (err.config?._ts ?? Date.now()));
    if (err.response?.status === 401 && _onUnauthorized) _onUnauthorized();
    return Promise.reject(err);
  },
);

export default client;
