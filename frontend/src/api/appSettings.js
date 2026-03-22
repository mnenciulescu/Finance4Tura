import axios from "axios";
import client from "./client";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// Use plain axios for GET — called before auth token is set (Login page)
export async function getAppSettings() {
  const res = await axios.get(`${BASE}/app-settings`);
  return res.data;
}

export async function putAppSettings(settings) {
  const res = await client.put("/app-settings", settings);
  return res.data;
}
