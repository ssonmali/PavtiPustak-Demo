import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/demo/config";

/**
 * DEMO BUILD — the production proxy validated the Supabase JWT on every
 * request. There is no token to validate here, so the gate is the demo session
 * cookie set by the login action. The routing it performs is identical, and
 * each Server Action still re-checks, exactly as before.
 */
export async function proxy(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!signedIn && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (signedIn && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/health|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest|txt)$).*)",
  ],
};
