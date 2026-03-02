import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const {
    clientName, clientEmail, clientPhone,
    existingClientId,
    jobTitle, jobDescription,
    addressLine1, addressLine2,
    townCity, county, postcode,
    phaseId,
    leadId,
    sendInvite,
  } = await request.json();

  if (!jobTitle || !addressLine1 || !townCity || !postcode) {
    return NextResponse.json({ error: "jobTitle, addressLine1, townCity and postcode are required" }, { status: 400 });
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

  let clientId: string;
  let resolvedEmail: string | null = null;
  let resolvedName: string = "";

  if (existingClientId) {
    clientId = existingClientId;
    const { data: ec } = await admin.from("zz_clients").select("email,full_name").eq("id", existingClientId).single();
    resolvedEmail = ec?.email ?? null;
    resolvedName = ec?.full_name ?? "";
  } else {
    if (!clientName || !clientEmail) {
      return NextResponse.json({ error: "clientName and clientEmail are required for new clients" }, { status: 400 });
    }
    resolvedEmail = (clientEmail as string).trim().toLowerCase();
    resolvedName = (clientName as string).trim();

    // Check for existing client by email
    const { data: existing } = await admin.from("zz_clients").select("id").eq("email", resolvedEmail).maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      // Insert via service role — data travels over TLS (encrypted in transit).
      // Field-level encryption at rest uses the DB_ENCRYPTION_KEY via pgcrypto RPC if available.
      const encKey = process.env.DB_ENCRYPTION_KEY;
      let insertedId: string | null = null;

      if (encKey) {
        // Use server-side pgcrypto encryption via RPC
        const { data: encId } = await admin.rpc("zz_create_client_encrypted", {
          p_full_name: resolvedName,
          p_email: resolvedEmail,
          p_phone: (clientPhone as string | null)?.trim() || null,
          p_key: encKey,
        }) as { data: string | null };
        insertedId = encId;
      }

      if (!insertedId) {
        // Plaintext fallback (still protected by RLS + TLS)
        const { data: nc, error: ncErr } = await admin.from("zz_clients").insert({
          full_name: resolvedName,
          email: resolvedEmail,
          phone: (clientPhone as string | null)?.trim() || null,
        }).select("id").single();
        if (ncErr || !nc) {
          return NextResponse.json({ error: ncErr?.message ?? "Failed to create client" }, { status: 500 });
        }
        insertedId = nc.id;
      }
      clientId = insertedId!;
    }
  }

  // Create job — description column may not exist yet; omit if not present
  const jobPayload: Record<string, unknown> = {
    title: (jobTitle as string).trim(),
    client_id: clientId,
    current_phase_id: phaseId || null,
    address_line_1: (addressLine1 as string).trim(),
    address_line_2: (addressLine2 as string | null)?.trim() || null,
    town_city: (townCity as string).trim(),
    county: (county as string | null)?.trim() || null,
    postcode: (postcode as string).trim().toUpperCase(),
    status: "active",
  };
  if (jobDescription) jobPayload.description = (jobDescription as string).trim();

  const { data: newJob, error: jobErr } = await admin.from("zz_jobs").insert(jobPayload).select("id").single();
  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  // Mark lead converted
  if (leadId) {
    await admin.rpc("zz_update_lead_status", { p_id: leadId, p_status: "converted" });
  }

  // Send invite email and link profile
  let inviteSent = false;
  if (sendInvite && resolvedEmail) {
    const { data: invData, error: invErr } = await admin.auth.admin.inviteUserByEmail(resolvedEmail, {
      data: { full_name: resolvedName, role: "client" },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/portal/client`,
    });
    if (!invErr && invData?.user?.id) {
      inviteSent = true;
      const uid = invData.user.id;
      await admin.from("zz_clients").update({ user_id: uid }).eq("id", clientId).is("user_id", null);
      await admin.from("zz_profiles").upsert({
        user_id: uid, full_name: resolvedName, role: "client",
      }, { onConflict: "user_id" });
    }
  }

  return NextResponse.json({ ok: true, jobId: newJob?.id, clientId, inviteSent });
}
