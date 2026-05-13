import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function err(message: string, status = 400, extras?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extras ?? {}) }, { status });
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Response("Invalid JSON body", { status: 400 });
  }
}
