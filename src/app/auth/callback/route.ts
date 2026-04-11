// app/auth/callback/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // Ensure next is a safe relative path — prevent open redirect
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchange error:", error.message);
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
  }

  // Auto-create workspace for new users
  if (data.user) {
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", data.user.id)
      .limit(1);

    if (!existing?.length) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .insert({ name: "My Workspace", user_id: data.user.id })
        .select("id")
        .single();

      if (workspace) {
        const { data: project } = await supabase
          .from("projects")
          .insert({ name: "My First Project", workspace_id: workspace.id, color: "#3b82f6" })
          .select("id")
          .single();

        if (project) {
          await supabase.from("statuses").insert([
            { name: "Backlog",     color: "#6b7280", position: 0, project_id: project.id },
            { name: "To Do",       color: "#6b7280", position: 1, project_id: project.id },
            { name: "In Progress", color: "#f59e0b", position: 2, project_id: project.id },
            { name: "Done",        color: "#3b82f6", position: 3, project_id: project.id },
          ]);
        }

        // New user → show onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  // redirect to intended destination (or dashboard)
  return NextResponse.redirect(`${origin}${next}`);
}
