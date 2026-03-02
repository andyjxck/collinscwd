import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/portal/client";

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    const fallback = next.includes("/admin") ? "/portal/admin" : "/portal/client";
    return NextResponse.redirect(`${origin}${fallback}?error=auth_failed`);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as "magiclink" | "email" | "recovery" | "invite" | "signup" });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] verifyOtp error:", error.message, "type:", type);
    const fallback = next.includes("/admin") ? "/portal/admin" : "/portal/client";
    return NextResponse.redirect(`${origin}${fallback}?error=auth_failed`);
  }

  // No code or token_hash — just redirect to next destination (session may already exist)
  return NextResponse.redirect(`${origin}${next}`);
}
