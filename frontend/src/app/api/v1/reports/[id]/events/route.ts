/**
 * SSE proxy route — Next.js rewrites() buffer responses, which breaks
 * Server-Sent Events. This route handler streams bytes directly from
 * the FastAPI backend without buffering.
 */
import { NextRequest } from "next/server";

// API_URL is server-side only — never exposed to the browser bundle
const BACKEND = process.env.API_URL ?? "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = request.headers.get("Authorization") ?? "";

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/api/v1/reports/${id}/events`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });
  } catch {
    return new Response("upstream unavailable", { status: 502 });
  }

  if (!backendRes.ok) {
    return new Response(null, { status: backendRes.status });
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
