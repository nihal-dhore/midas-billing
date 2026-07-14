import { NextRequest, NextResponse } from "next/server";
import { get, put } from "@vercel/blob";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

const BLOB_PATH = "midas-clients.json";

export async function GET(req: NextRequest) {
  if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blob = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!blob) {
    // No blob saved yet — fresh install, empty client list
    return NextResponse.json({ clients: [] });
  }
  const clients = await new Response(blob.stream).json();
  return NextResponse.json({ clients });
}

export async function PUT(req: NextRequest) {
  if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.clients)) {
    return NextResponse.json({ error: "Expected { clients: [] }" }, { status: 400 });
  }

  await put(BLOB_PATH, JSON.stringify(body.clients), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return NextResponse.json({ ok: true });
}
