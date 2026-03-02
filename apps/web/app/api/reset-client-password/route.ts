import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Called by admin "Send password reset link":
// 1. Removes the user's password (sets a random one they won't know)
// 2. Sends a magic link that redirects to /auth/callback?next=/portal/client&setup_password=1
// On the client side, after login via that link, we prompt them to set a new password.
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Look up the user by email
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const user = users.find(u => u.email === email);
  if (!user) return NextResponse.json({ error: "No account found for that email" }, { status: 404 });

  // Remove their password by setting a random one they'll never know
  const randomPw = crypto.randomUUID() + crypto.randomUUID();
  await admin.auth.admin.updateUserById(user.id, { password: randomPw });

  // Send a magic link — client clicks it, logs in, then must set a new password
  const { error: otpErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/portal/client&setup_password=1`,
    },
  });

  if (otpErr) return NextResponse.json({ error: otpErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
