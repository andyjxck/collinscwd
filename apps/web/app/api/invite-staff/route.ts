import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, fullName, phone, role } = await request.json();

  if (!email || !fullName) {
    return NextResponse.json({ error: "email and fullName required" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured: missing service role key" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const resolvedRole = role ?? "staff";
  const isClient = resolvedRole === "client";

  // For clients: create/get user then send magic link that forces password setup
  // For staff: use standard invite flow
  if (isClient) {
    // Upsert the auth user (create if not exists)
    const { data: { users } } = await admin.auth.admin.listUsers();
    let userId: string | undefined = users.find(u => u.email === email)?.id;

    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: phone ?? null, role: resolvedRole },
      });
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
      userId = created.user?.id;
    }

    if (userId) {
      await admin.from("zz_profiles").upsert(
        { user_id: userId, full_name: fullName, phone: phone ?? null, role: resolvedRole },
        { onConflict: "user_id" }
      );
      await admin.from("zz_clients").update({ user_id: userId }).eq("email", email).is("user_id", null);
    }

    // Send magic link — redirects to client portal with setup_password=1 to prompt password creation
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/portal/client&setup_password=1`,
      },
    });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, userId });
  }

  // Staff invite flow
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, phone: phone ?? null, role: resolvedRole },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/portal/admin`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userId = data.user?.id;
  if (userId) {
    await admin.from("zz_profiles").upsert(
      { user_id: userId, full_name: fullName, phone: phone ?? null, role: resolvedRole },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.json({ ok: true, userId });
}
