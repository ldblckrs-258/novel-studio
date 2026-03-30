import type { SiteAdapter } from "../types";
import { sangtacvietAdapter } from "./sangtacviet";

const adapters: SiteAdapter[] = [sangtacvietAdapter];

/** Find the adapter that matches the given URL, or null. */
export function detectAdapter(url: string): SiteAdapter | null {
  return adapters.find((a) => a.urlPattern.test(url)) ?? null;
}

/** Get all registered adapters (for UI display). */
export function getAdapters(): SiteAdapter[] {
  return adapters;
}

export { sangtacvietAdapter };
