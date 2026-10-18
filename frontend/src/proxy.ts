import { NextResponse, type NextRequest } from "next/server";

// Behind the /api rewrite every request reaches the backend from the frontend host, so the backend would rate-limit all
// visitors as one. Pass the visitor's address on, signed with a secret the backend checks (PATHSYNC_PROXY_SECRET on
// both sides). Vercel sets x-real-ip / x-forwarded-for itself; whatever the browser sent in our own headers is dropped.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-pathsync-client-ip");
  headers.delete("x-pathsync-proxy-secret");
  const secret = process.env.PATHSYNC_PROXY_SECRET;
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (secret && ip) {
    headers.set("x-pathsync-client-ip", ip);
    headers.set("x-pathsync-proxy-secret", secret);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
