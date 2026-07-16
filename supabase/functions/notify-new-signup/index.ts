import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTIFY_EMAIL = "zejly12@gmail.com";

serve(async (req) => {
  try {
    const payload = await req.json();

    // Supabase Auth webhook payload: { type: "INSERT", record: { email, raw_user_meta_data, ... } }
    const record = payload?.record;
    if (!record) {
      return new Response("No record", { status: 400 });
    }

    const userEmail = record.email ?? "unknown";
    const userName =
      record.raw_user_meta_data?.full_name ??
      record.raw_user_meta_data?.name ??
      userEmail.split("@")[0];
    const createdAt = record.created_at
      ? new Date(record.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
      : new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "HEGON <noreply@hegon.fr>",
        to: [NOTIFY_EMAIL],
        subject: `🟢 Nouveau signup — ${userName}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouveau signup — HEGON</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">

          <!-- Header dark -->
          <tr>
            <td style="background-color:#09090b;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <img src="https://hegon.fr/logo/Hegon_white_logo.png" width="36" height="36" alt="HEGON" style="display:block;margin:0 auto 10px;" />
              <span style="color:#a1a1aa;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">Your Second Brain</span>
            </td>
          </tr>

          <!-- Body white -->
          <tr>
            <td style="background-color:#ffffff;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">
                Nouveau signup 🟢
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#71717a;">Un nouvel utilisateur vient de rejoindre HEGON.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
                <tr style="border-bottom:1px solid #e4e4e7;">
                  <td style="padding:12px 16px;font-size:13px;color:#71717a;width:80px;background:#fafafa;">Nom</td>
                  <td style="padding:12px 16px;font-size:13px;color:#09090b;font-weight:500;">${userName}</td>
                </tr>
                <tr style="border-bottom:1px solid #e4e4e7;">
                  <td style="padding:12px 16px;font-size:13px;color:#71717a;background:#fafafa;">Email</td>
                  <td style="padding:12px 16px;font-size:13px;color:#7c3aed;font-weight:500;">${userEmail}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#71717a;background:#fafafa;">Date</td>
                  <td style="padding:12px 16px;font-size:13px;color:#09090b;">${createdAt}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 12px 12px;padding:18px 40px;text-align:center;">
              <span style="font-size:12px;color:#a1a1aa;">
                © 2026 HEGON &nbsp;·&nbsp;
                <a href="mailto:noreply@hegon.fr" style="color:#a1a1aa;text-decoration:none;">noreply@hegon.fr</a>
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend error:", error);
      return new Response("Email failed", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("notify-new-signup error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
