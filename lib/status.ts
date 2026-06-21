import { isDbConfigured } from "./db";
import { isAiConfigured } from "./ai/models";

export interface SystemStatus {
  db: boolean;
  ai: boolean;
}

export function systemStatus(): SystemStatus {
  return { db: isDbConfigured(), ai: isAiConfigured() };
}
