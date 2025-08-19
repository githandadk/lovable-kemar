// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // This syncs any client-side session into a cookie Next.js can read.
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();

  return res;
}

// (Optional) You can limit which paths run the middleware via config
// export const config = { matcher: ['/account/:path*', '/auth/:path*'] }
