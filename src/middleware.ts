// import { createServerClient } from "@supabase/ssr";
// import { NextResponse, type NextRequest } from "next/server";

// const PUBLIC_ROUTES = ["/auth"];
// const IGNORED_PREFIXES = ["/_next", "/favicon", "/api", "/icon", "/logo", "/auth/callback"];

// export async function middleware(request: NextRequest) {
//   const { pathname } = request.nextUrl;

//   if (IGNORED_PREFIXES.some(p => pathname.startsWith(p))) {
//     return NextResponse.next();
//   }

//   const response = NextResponse.next({ request: { headers: request.headers } });

//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll: () => request.cookies.getAll(),
//         setAll: (cookies) => {
//           cookies.forEach(({ name, value, options }) => {
//             request.cookies.set(name, value);
//             response.cookies.set(name, value, options);
//           });
//         },
//       },
//     }
//   );

//   const { data: { user } } = await supabase.auth.getUser();
//   const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

//   // Not authenticated → /auth with next param
//   if (!user && !isPublic) {
//     const url = request.nextUrl.clone();
//     url.pathname = "/auth";
//     url.searchParams.set("next", pathname);
//     return NextResponse.redirect(url);
//   }

//   // Authenticated → check workspace once for all routing decisions
//   if (user) {
//     const { data: workspace } = await supabase
//       .from("workspaces")
//       .select("id")
//       .eq("user_id", user.id)
//       .limit(1)
//       .maybeSingle();

//     // On auth page → redirect to onboarding or dashboard (unless there's an error to display)
//     if (isPublic && !request.nextUrl.searchParams.get("error")) {
//       const url = request.nextUrl.clone();
//       url.pathname = workspace ? "/dashboard" : "/onboarding";
//       url.searchParams.delete("next");
//       return NextResponse.redirect(url);
//     }

//     // No workspace + not already on onboarding → force onboarding
//     if (!workspace && pathname !== "/onboarding") {
//       const url = request.nextUrl.clone();
//       url.pathname = "/onboarding";
//       return NextResponse.redirect(url);
//     }

//     // Has workspace but landed on onboarding → skip to dashboard
//     if (workspace && pathname === "/onboarding") {
//       const url = request.nextUrl.clone();
//       url.pathname = "/dashboard";
//       return NextResponse.redirect(url);
//     }
//   }

//   return response;
// }

// export const config = {
//   matcher: [
//     "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
//   ],
// };



import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Auth page:
  // - no user => allow
  // - user => redirect away
  if (pathname === "/auth") {
    if (!user) {
      return NextResponse.next();
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = workspace ? "/dashboard" : "/onboarding";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspace && pathname !== "/onboarding") {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  if (workspace && pathname === "/onboarding") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};