import { db } from "@/lib/db";
import { getModel } from "@/lib/ai/provider";
import type { StepModelConfig } from "@/lib/db";
import type { LanguageModel } from "ai";

/**
 * Resolve a StepModelConfig to a LanguageModel instance.
 * Returns undefined if config is missing or provider not found.
 */
export async function resolveStep(
  cfg: StepModelConfig | undefined,
): Promise<LanguageModel | undefined> {
  if (!cfg?.providerId || !cfg?.modelId) return undefined;
  const provider = await db.aiProviders.get(cfg.providerId);
  if (!provider) return undefined;
  return getModel(provider, cfg.modelId);
}
