import Constants from "expo-constants";
import { createApiClient } from "@bizfinder/shared";

// In dev on a device/emulator, localhost won't reach your machine — override
// `extra.apiUrl` in app.json with your LAN IP (e.g. http://192.168.1.20:4000).
const baseUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:4000";

export const api = createApiClient({ baseUrl });
