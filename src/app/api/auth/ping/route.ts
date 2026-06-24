import { NextResponse } from "next/server";

// Heartbeat for the client-side idle watcher. Hitting this endpoint goes
// through the proxy, which stamps `erp_last_active` on the response, so a
// real user pinging here keeps the server-side 30-min timer alive too.
// The response itself is empty — nothing to render.
export const dynamic = "force-dynamic";
export const runtime = "edge";

export function POST() {
  return new NextResponse(null, { status: 204 });
}

export function GET() {
  return new NextResponse(null, { status: 204 });
}
