import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const WORKSPACE_COOKIE = "hegon_has_workspace";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days — §3.1 garde-fou 3

// Defense-in-depth: never rely solely on RLS for workspace access check.
// Queries both ownership and membership explicitly so a misconfigured RLS
// policy on `workspaces` cannot let unauthorized users through. §5.2.
async function checkUserHasWorkspace(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  const [{ data: owned }, { data: member }] = await Promise.all([
    supabase.from("workspaces").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  return !!(owned || member);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static / internal assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/logo")
  ) {
    return NextResponse.next();
  }

  // Callback + finalize must always pass through
  if (
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/finalize")
  ) {
    return NextResponse.next();
  }

  // Invite pages are public (user may not be logged in yet)
  if (pathname.startsWith("/invite")) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth page: no user → allow; user → redirect away
  if (pathname === "/auth") {
    if (!user) return NextResponse.next();

    // Cookie shortcut: skip workspace query — §3.1
    if (request.cookies.get(WORKSPACE_COOKIE)?.value === "1") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const hasWorkspace = await checkUserHasWorkspace(supabase, user.id);
    const dest = hasWorkspace ? "/dashboard" : "/onboarding";
    const res = NextResponse.redirect(new URL(dest, request.url));
    if (hasWorkspace) {
      res.cookies.set(WORKSPACE_COOKIE, "1", { maxAge: COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
    }
    return res;
  }

  // All other app routes are protected
  if (!user) {
    // If Supabase missed the allowlist and sent an OAuth code to the wrong page,
    // forward directly to finalize instead of flashing the login form.
    const code = request.nextUrl.searchParams.get("code");
    const tokenHash = request.nextUrl.searchParams.get("token_hash");
    if (code || tokenHash) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/finalize";
      url.searchParams.set("target", "/dashboard");
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /onboarding: always verify DB — never trust cookie (stale after workspace delete)
  // Garde-fou 2: clear stale cookie if user truly has no workspace
  if (pathname === "/onboarding") {
    const hasWorkspace = await checkUserHasWorkspace(supabase, user.id);
    if (hasWorkspace) {
      const res = NextResponse.redirect(new URL("/dashboard", request.url));
      res.cookies.set(WORKSPACE_COOKIE, "1", { maxAge: COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
      return res;
    }
    // No workspace: clear any stale cookie so next nav re-checks
    response.cookies.set(WORKSPACE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }

  // Cookie shortcut: skip workspace DB query for all other protected routes — §3.1 core gain
  if (request.cookies.get(WORKSPACE_COOKIE)?.value === "1") {
    return response;
  }

  // No cookie yet: verify workspace and prime the cookie for future navigations
  const hasWorkspace = await checkUserHasWorkspace(supabase, user.id);

  if (!hasWorkspace) {
    const { data: pendingInvite } = await supabase
      .from("org_invitations")
      .select("token")
      .eq("email", user.email ?? "")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .not("workspace_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (pendingInvite) {
      return NextResponse.redirect(new URL(`/invite/${pendingInvite.token}`, request.url));
    }

    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  // Workspace confirmed — set cookie so subsequent navigations skip this query
  response.cookies.set(WORKSPACE_COOKIE, "1", { maxAge: COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
