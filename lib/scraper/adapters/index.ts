import type { SiteAdapter } from "../types";
import { AliceSWAdapter } from "./AliceSW";
import { STVAdapter } from "./STV";
import { UukanshuAdapter } from "./Uukanshu";

const adapters: SiteAdapter[] = [AliceSWAdapter, STVAdapter, UukanshuAdapter];

/** Find the adapter that matches the given URL, or null. */
export function detectAdapter(url: string): SiteAdapter | null {
  return adapters.find((a) => a.urlPattern.test(url)) ?? null;
}

/** Get all registered adapters (for UI display). */
export function getAdapters(): SiteAdapter[] {
  return adapters;
}

export { AliceSWAdapter, STVAdapter, UukanshuAdapter };
