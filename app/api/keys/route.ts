import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_PREFIX,
  MANAGED_KEYS,
  isManagedKey,
  hasApiKey,
} from "@/lib/keys";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
} as const;

/** Which managed keys are currently set (cookie OR env). Names only, never values. */
async function statusMap(): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    MANAGED_KEYS.map(async (k) => [k.name, await hasApiKey(k.name)] as const)
  );
  return Object.fromEntries(entries);
}

export async function GET() {
  return NextResponse.json({ keys: await statusMap() });
}

/**
 * Save keys to httpOnly cookies. Body: { [KEY_NAME]: string }. An empty string
 * clears that key. Unknown names are ignored. Values are never echoed back.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected an object of keys" }, { status: 400 });
  }

  const store = await cookies();
  for (const [name, value] of Object.entries(body as Record<string, unknown>)) {
    if (!isManagedKey(name)) continue;
    const cookieName = `${COOKIE_PREFIX}${name}`;
    if (typeof value === "string" && value.trim()) {
      store.set(cookieName, value.trim(), COOKIE_OPTS);
    } else {
      store.delete(cookieName);
    }
  }

  return NextResponse.json({ ok: true, keys: await statusMap() });
}

/** Clear all managed key cookies (env-based keys, if any, remain). */
export async function DELETE() {
  const store = await cookies();
  for (const k of MANAGED_KEYS) store.delete(`${COOKIE_PREFIX}${k.name}`);
  return NextResponse.json({ ok: true, keys: await statusMap() });
}
