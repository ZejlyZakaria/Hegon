import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code       = searchParams.get("code");
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type");
  const rawNext    = searchParams.get("next") ?? "/dashboard";
  let decoded: string;
  try { decoded = decodeURIComponent(rawNext); } catch { decoded = "/dashboard"; }
  const next = decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/dashboard";

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingCookies: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  let error, data;
  if (tokenHash && type) {
    ({ error, data } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
    }));
  } else {
    ({ error, data } = await supabase.auth.exchangeCodeForSession(code!));
  }

  if (error) {
    console.error("[auth/callback] exchange error:", error.message);
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
  }

  let redirectPath = next;

  // Auto-create workspace for new users
  if (data.user) {
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", data.user.id)
      .limit(1);

    if (!existing?.length) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single();

      const orgId = membership?.org_id;

      if (orgId) {
        const userName = data.user.user_metadata?.full_name?.split(" ")[0]
          ?? data.user.user_metadata?.name?.split(" ")[0]
          ?? "My";
        const { data: workspace } = await supabase
          .from("workspaces")
          .insert({ name: `${userName}'s Workspace`, user_id: data.user.id, org_id: orgId })
          .select("id")
          .single();

        if (workspace) {
          const { data: project } = await supabase
            .from("projects")
            .insert({ name: "Personal", workspace_id: workspace.id, color: "#3b82f6", org_id: orgId })
            .select("id")
            .single();

          if (project) {
            await supabase.from("statuses").insert([
              { name: "Backlog",     color: "#6b7280", position: 0, project_id: project.id, org_id: orgId },
              { name: "To Do",       color: "#6b7280", position: 1, project_id: project.id, org_id: orgId },
              { name: "In Progress", color: "#f59e0b", position: 2, project_id: project.id, org_id: orgId },
              { name: "Done",        color: "#3b82f6", position: 3, project_id: project.id, org_id: orgId },
            ]);
          }
        }
      }

      redirectPath = "/onboarding";
    }
  }

  // Return 200 + meta-refresh instead of 302 redirect.
  // Browsers store Set-Cookie headers on 200 responses before navigating,
  // whereas some CDN/proxy setups (incl. Vercel) can strip Set-Cookie on 302.
  const safeUrl = `${origin}${redirectPath}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safeUrl}"></head><body></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
