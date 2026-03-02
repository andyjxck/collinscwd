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

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, phone: phone ?? null, role: role ?? "staff" },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/admin`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userId = data.user?.id;
  if (userId) {
    await admin.from("zz_profiles").upsert({
      user_id: userId,
      full_name: fullName,
      phone: phone ?? null,
      role: role ?? "staff",
    }, { onConflict: "user_id" });
  }

  return NextResponse.json({ ok: true, userId });
}
