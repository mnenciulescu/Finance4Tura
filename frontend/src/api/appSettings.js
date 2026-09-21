import axios from "axios";
import client, { API_BASE } from "./client";

// Use plain axios for GET — called before auth token is set (Login page)
export async function getAppSettings() {
  const res = await axios.get(`${API_BASE}/app-settings`);
  return res.data;
}

export async function putAppSettings(settings) {
  const res = await client.put("/app-settings", settings);
  return res.data;
}
