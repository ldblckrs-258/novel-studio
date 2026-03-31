import type { TTSProvider, TTSProviderClass } from "./types";

/** Internal map of registered provider constructors keyed by class name. */
const providers = new Map<string, TTSProviderClass>();

/**
 * Register a TTS provider class so it can be instantiated later by id.
 *
 * ```ts
 * registerProvider("BingTTS", BingTTS, "Bing TTS");
 * ```
 */
export function registerProvider(
  id: string,
  providerClass: TTSProviderClass,
  friendlyName: string,
): void {
  if (providers.has(id)) {
    console.warn(`Provider ${id} is already registered. Overwriting.`);
  }
  providerClass.friendlyName = friendlyName;
  providers.set(id, providerClass);
}

/**
 * Instantiate and return a provider by its class name.
 *
 * ```ts
 * const provider = getProvider("BingTTS");
 * ```
 */
export function getProvider(providerName: string): TTSProvider {
  const providerClass = providers.get(providerName);
  if (!providerClass) {
    throw new Error(`Provider "${providerName}" is not registered`);
  }
  return new providerClass();
}

/**
 * List all registered providers (name + friendlyName).
 */
export function listProviders(): { name: string; friendlyName: string }[] {
  return Array.from(providers.entries())
    .map(([name, cls]) => ({
      name,
      friendlyName: cls.friendlyName ?? name,
    }))
    .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));
}
