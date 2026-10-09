import { useSyncExternalStore } from "react";

/** Best-effort city and streaming region from the browser time zone (no geolocation prompt). */
const TZ_CITY: Record<string, string> = {
  "Australia/Melbourne": "Melbourne",
  "Australia/Sydney": "Sydney",
  "Australia/Brisbane": "Brisbane",
  "Australia/Perth": "Perth",
  "Australia/Adelaide": "Adelaide",
  "America/New_York": "New York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Angeles",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
  "Europe/Berlin": "Berlin",
  "Europe/Madrid": "Madrid",
  "Asia/Singapore": "Singapore",
  "Asia/Tokyo": "Tokyo",
  "Asia/Ho_Chi_Minh": "Ho Chi Minh City",
  "Asia/Bangkok": "Bangkok",
  "Pacific/Auckland": "Auckland",
};

export function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export function guessCity(tz = timeZone()) {
  return TZ_CITY[tz] ?? "Melbourne";
}

/** JustWatch country path for "where to watch" links. */
export function watchRegion(tz = timeZone()) {
  if (tz.startsWith("America/")) return tz === "America/Toronto" || tz === "America/Vancouver" ? "ca" : "us";
  if (tz === "Europe/London") return "uk";
  if (tz.startsWith("Europe/")) return tz.split("/")[1] === "Berlin" ? "de" : tz.split("/")[1] === "Paris" ? "fr" : "uk";
  if (tz === "Pacific/Auckland") return "nz";
  if (tz.startsWith("Asia/Singapore")) return "sg";
  return "au";
}


const noopSubscribe = () => () => {};

/** Browser time zone after hydration ("" on the server), so server and client markup match. */
export function useTimeZone() {
  return useSyncExternalStore(noopSubscribe, timeZone, () => "");
}
