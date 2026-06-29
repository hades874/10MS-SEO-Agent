import { isDbConfigured } from "./db";
import { isAiConfigured } from "./ai/models";

export interface SystemStatus {
  db: boolean;
  ai: boolean;
}

export async function systemStatus(): Promise<SystemStatus> {
  return { db: isDbConfigured(), ai: await isAiConfigured() };
}
