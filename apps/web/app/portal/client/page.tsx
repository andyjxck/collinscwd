"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase";
import s from "./client.module.css";

// ── Mobile Pill Nav ────────────────────────────────────────────────
type NavItem = { key: string; icon: string; label: string; badge?: number | null };
function MobilePillNav({ items, activeKey, onSelect }: {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.find(i => i.key === activeKey);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={s.mobilePillNav} ref={ref}>
      {!open ? (
        /* Collapsed: single icon circle */
        <button
          className={s.mobilePillCollapsed}
          onClick={() => setOpen(true)}
          title={active?.label}
        >
          {active?.icon}
        </button>
      ) : (
        /* Expanded: horizontal pill + labels outside below */
        <div>
          <div className={s.mobilePillExpanded}>
            {items.map(item => (
              <button
                key={item.key}
                className={`${s.mobilePillNavItem} ${item.key === activeKey ? s.mobilePillNavItemActive : ""}`}
                onClick={() => { onSelect(item.key); setOpen(false); }}
                title={item.label}
              >
                <span className={s.mobilePillNavItemInner}>{item.icon}</span>
                {item.badge ? <span className={s.mobilePillBadge}>{item.badge}</span> : null}
              </button>
            ))}
          </div>
          <div className={s.mobilePillLabelsRow}>
            {items.map(item => (
              <span
                key={item.key}
                className={`${s.mobilePillNavLabel} ${item.key === activeKey ? s.mobilePillNavLabelActive : ""}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Job = {
  id: string;
  title: string;
  status: string;
  address_line_1: string;
  address_line_2: string | null;
  town_city: string;
  county: string | null;
  postcode: string;
  created_at: string;
  current_phase: { name: string }[] | null;
};

type Note = {
  id: string;
  created_at: string;
  body: string;
  is_client_visible: boolean;
  author_profile: { full_name: string }[] | null;
};

type Doc = {
  id: string;
  created_at: string;
  filename: string;
  mime_type: string | null;
  storage_path: string;
  storage_bucket: string;
};

type Phase = { id: string; name: string; position: number };
type ChatMessage = { id: string; created_at: string; body: string; direction: string };
type Appointment = {
  id: string; job_id: string; created_at: string;
  appt_type: "survey" | "parts_eta" | "scheduled" | "final_check";
  appt_date: string; appt_time: string | null; person_in_charge: string | null;
  is_first_visit: boolean; is_revisit: boolean; is_intended_last: boolean;
  customer_agreed: boolean;
  client_response: "accepted" | "declined" | "counter" | null;
  client_response_at: string | null; counter_message: string | null;
  notes: string | null; cancelled_at: string | null;
};
const APPT_LABELS: Record<string, string> = {
  survey: "Survey", parts_eta: "Parts ETA", scheduled: "Scheduled Visit", final_check: "Final Check"
};

const NOTE_COLOUR: Record<string, string> = {
  default: "#a78bfa",
};

export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "documents" | "photos" | "messages">("overview");
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [counterText, setCounterText] = useState<Record<string, string>>({});
  const [counterOpen, setCounterOpen] = useState<string | null>(null);
  const [apptResponding, setApptResponding] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [loginMode, setLoginMode] = useState<"magic" | "password">("magic");
  const [loginPassword, setLoginPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  // ── Photos state ───────────────────────────────────────────────
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadTypePicker, setUploadTypePicker] = useState(false);
  const [pendingUploadType, setPendingUploadType] = useState<"quote" | "invoice" | "photo" | "other">("photo");
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Show error from callback redirect if present
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") setAuthError("Sign-in link was invalid or expired. Please request a new one.");
    if (params.get("setup_password") === "1") setSetupPassword(true);

    // Handle initial session (page load after /auth/callback redirect)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { loadData(); return; }
      setAuthLoading(false);
    });
    // Also catch SIGNED_IN fired by any in-page token exchange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const p = new URLSearchParams(window.location.search);
        if (p.get("setup_password") === "1") setSetupPassword(true);
        loadData();
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setMagicLinkSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal/client`,
        shouldCreateUser: false,
      },
    });
    setMagicLinkSending(false);
    if (err) { setAuthError(err.message); return; }
    setMagicLinkSent(true);
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setMagicLinkSending(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setMagicLinkSending(false);
    if (err) { setAuthError(err.message); return; }
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (newPassword !== newPasswordConfirm) { setPasswordError("Passwords do not match."); return; }
    setPasswordSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (err) { setPasswordError(err.message); return; }
    setSetupPassword(false);
    setNewPassword("");
    setNewPasswordConfirm("");
    // Clean up URL param
    const url = new URL(window.location.href);
    url.searchParams.delete("setup_password");
    window.history.replaceState({}, "", url.toString());
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAuthed(false);
    setJob(null);
    setNotes([]);
    setDocs([]);
    setClientId(null);
    setChatMessages([]);
  }

  async function loadMessages(cid: string) {
    setChatLoading(true);
    const { data } = await supabase
      .from("zz_messages")
      .select("id,created_at,body,direction")
      .eq("client_id", cid)
      .order("created_at", { ascending: true });
    if (data) setChatMessages(data as ChatMessage[]);
    setChatLoading(false);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function sendMessage() {
    if (!chatText.trim() || !clientId) return;
    setChatSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: msg } = await supabase
      .from("zz_messages")
      .insert({ client_id: clientId, sender_user_id: user?.id ?? null, body: chatText.trim(), direction: "client_to_admin" })
      .select("id,created_at,body,direction").single();
    if (msg) {
      setChatMessages(prev => [...prev, msg as ChatMessage]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    setChatText("");
    setChatSending(false);
  }

  // ── Photos ───────────────────────────────────────────────────────
  async function loadPhotos() {
    if (!clientId) return;
    const { data } = await supabase
      .from("zz_files")
      .select("id,created_at,filename,mime_type,size_bytes,storage_path,storage_bucket,file_type,client_deleted_at")
      .eq("job_id", job?.id ?? "")
      .eq("is_client_visible", true)
      .order("created_at", { ascending: false });
    if (data) setPhotos(data);
  }

  async function uploadPhoto(file: File, fileType: "quote" | "invoice" | "photo" | "other" = "photo") {
    if (!job?.id) return;
    setPhotoUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `jobs/${job.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, file);
    if (!upErr) {
      await supabase.from("zz_files").insert({
        job_id: job.id,
        uploader_user_id: user?.id ?? null,
        storage_bucket: "job-photos",
        storage_path: path,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        is_client_visible: true,
        file_type: fileType,
      });
      loadPhotos();
    }
    setPhotoUploading(false);
  }

  async function deletePhoto(fileId: string) {
    setDeletingFileId(fileId);
    await supabase.from("zz_files").update({ client_deleted_at: new Date().toISOString() }).eq("id", fileId);
    setPhotos(prev => prev.map(f => f.id === fileId ? { ...f, client_deleted_at: new Date().toISOString() } : f));
    setDeletingFileId(null);
  }

  async function loadData() {
    setAuthLoading(false);
    setAuthed(true);
    setLoading(true);
    setDataError(null);

    let { data: { user } } = await supabase.auth.getUser();
    // Session may not be fully settled immediately after auth redirect — retry once
    if (!user) {
      await new Promise(r => setTimeout(r, 800));
      const retry = await supabase.auth.getUser();
      user = retry.data.user;
    }
    if (!user) { setLoading(false); setDataError("Could not verify your session. Please try refreshing the page."); return; }

    let { data: client } = await supabase
      .from("zz_clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fallback: link by email if user_id not yet set (e.g. signed in via password reset before trigger fired)
    if (!client && user.email) {
      const { data: byEmail } = await supabase
        .from("zz_clients")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      if (byEmail) {
        await supabase.from("zz_clients").update({ user_id: user.id }).eq("id", byEmail.id);
        client = byEmail;
      }
    }

    if (!client) {
      setDataError("No client profile found for your account. Contact Collins to resolve this.");
      setLoading(false);
      return;
    }

    setClientId(client.id);

    const [jobRes, phasesRes] = await Promise.all([
      supabase
        .from("zz_jobs")
        .select("id,title,status,address_line_1,address_line_2,town_city,county,postcode,created_at,current_phase:zz_job_phases(name)")
        .eq("client_id", client.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("zz_job_phases")
        .select("id,name,position")
        .eq("is_active", true)
        .order("position", { ascending: true }),
    ]);

    if (jobRes.error || !jobRes.data) {
      setLoading(false);
      return;
    }

    setJob(jobRes.data as Job);
    if (phasesRes.data) setPhases(phasesRes.data);

    const [notesRes, docsRes, apptsRes] = await Promise.all([
      supabase
        .from("zz_job_notes")
        .select("id,created_at,body,is_client_visible,author_profile:zz_profiles!zz_job_notes_author_user_id_fkey(full_name)")
        .eq("job_id", jobRes.data.id)
        .eq("is_client_visible", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("zz_files")
        .select("id,created_at,filename,mime_type,storage_path,storage_bucket")
        .eq("job_id", jobRes.data.id)
        .eq("is_client_visible", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("zz_appointments")
        .select("*")
        .eq("job_id", jobRes.data.id)
        .is("cancelled_at", null)
        .order("appt_date", { ascending: true }),
    ]);

    if (notesRes.data) setNotes(notesRes.data as Note[]);
    if (docsRes.data) setDocs(docsRes.data as Doc[]);
    if (apptsRes.data) setAppts(apptsRes.data as Appointment[]);
    setLoading(false);
  }

  async function respondToAppt(id: string, response: "accepted" | "declined" | "counter", msg?: string) {
    setApptResponding(id);
    await supabase.from("zz_appointments").update({
      client_response: response,
      client_response_at: new Date().toISOString(),
      counter_message: msg ?? null,
    }).eq("id", id);
    setAppts(prev => prev.map(a => a.id === id
      ? { ...a, client_response: response, client_response_at: new Date().toISOString(), counter_message: msg ?? null }
      : a
    ));
    setCounterOpen(null);
    setCounterText(prev => { const n = { ...prev }; delete n[id]; return n; });
    setApptResponding(null);
  }

  if (authLoading) {
    return (
      <div className={s.loadingRoot}>
        <div className={s.loadingSpinner} />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className={s.loginRoot}>
        <div className={s.loginCard}>
          <div className={s.loginBrand}>
            <div className={s.loginLogo}>
              <Image src="/logomaybe.png" alt="Collins" width={52} height={52} style={{ objectFit: "cover" }} />
            </div>
            <div>
              <div className={s.loginTitle}>Collins CW&amp;D</div>
              <div className={s.loginSub}>Client Portal</div>
            </div>
          </div>
          {magicLinkSent ? (
            <div className={s.magicSent}>
              <div className={s.magicSentIcon}>✉</div>
              <div className={s.magicSentTitle}>Check your email</div>
              <div className={s.magicSentSub}>We sent a sign-in link to <strong>{loginEmail}</strong>. Click it to access your portal.</div>
              <button className={s.btnGhost} onClick={() => setMagicLinkSent(false)}>Use a different email</button>
            </div>
          ) : (
            <div className={s.loginForm}>
              <input className={s.loginInput} type="email" placeholder="Your email address"
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
              {authError && <div className={s.loginError}>{authError}</div>}

              {loginMode === "magic" ? (
                <form onSubmit={requestMagicLink} style={{ display: "contents" }}>
                  <button type="submit" className={s.btnPrimary} disabled={magicLinkSending || !loginEmail.trim()}>
                    {magicLinkSending ? "Sending…" : "Send sign-in link"}
                  </button>
                  <button type="button" className={s.btnGhost}
                    onClick={() => { setLoginMode("password"); setAuthError(""); }}>
                    Login with password
                  </button>
                </form>
              ) : (
                <form onSubmit={loginWithPassword} style={{ display: "contents" }}>
                  <input className={s.loginInput} type="password" placeholder="Password"
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" />
                  <button type="submit" className={s.btnPrimary} disabled={magicLinkSending || !loginEmail.trim() || !loginPassword}>
                    {magicLinkSending ? "Signing in…" : "Sign in"}
                  </button>
                  <button type="button" className={s.btnGhost}
                    onClick={() => { setLoginMode("magic"); setAuthError(""); }}>
                    Send sign-in link instead
                  </button>
                </form>
              )}
            </div>
          )}
          <Link href="/" className={s.loginBack}>← Back to website</Link>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className={s.loadingRoot}>
        <div className={s.dataErrorCard}>
          <div className={s.dataErrorTitle}>Something went wrong</div>
          <div className={s.dataErrorBody}>{dataError}</div>
          <button className={s.btnPrimary} onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  const currentPhaseName = job?.current_phase?.[0]?.name ?? null;
  const currentPhaseIdx = phases.findIndex(p => p.name === currentPhaseName);
  const jobRef = job ? `JOB-${job.id.slice(0, 6).toUpperCase()}` : "";
  const jobAddress = job
    ? [job.address_line_1, job.address_line_2, job.town_city, job.county, job.postcode].filter(Boolean).join(", ")
    : "";

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className={s.root}>

      {/* ── Set password overlay ── */}
      {setupPassword && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#13162a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "28px 24px", width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#e8ecf8", marginBottom: 6 }}>Set your password</div>
              <div style={{ fontSize: 12, color: "rgba(232,236,248,0.5)" }}>Choose a password to use next time you log in.</div>
            </div>
            <form onSubmit={saveNewPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="password" placeholder="New password (min 8 chars)"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "9px 12px", color: "#e8ecf8", fontSize: 13 }}
              />
              <input
                type="password" placeholder="Confirm password"
                value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "9px 12px", color: "#e8ecf8", fontSize: 13 }}
              />
              {passwordError && <div style={{ fontSize: 11, color: "#f87171" }}>{passwordError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={passwordSaving || !newPassword || !newPasswordConfirm}
                  style={{ flex: 1, background: "#7fa5ff", color: "#0d0f1a", border: "none", borderRadius: 7, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {passwordSaving ? "Saving…" : "Set password"}
                </button>
                <button type="button" onClick={() => setSetupPassword(false)}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "9px 14px", color: "rgba(232,236,248,0.4)", fontSize: 12, cursor: "pointer" }}>
                  Skip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.logo}>
            <div className={s.logoMark}>C</div>
            <div>
              <div className={s.logoName}>Collins</div>
              <div className={s.logoSub}>Client Portal</div>
            </div>
          </div>
          <div className={s.headerRight}>
            {jobRef && <div className={s.jobRef}>{jobRef}</div>}
            <button className={s.signOutBtn} onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      <div className={s.body}>

        {/* ── Job banner ── */}
        {job && (
          <div className={s.jobBanner}>
            <div className={s.bannerInner}>
              <div className={s.bannerLeft}>
                <div className={s.bannerRef}>{jobRef}</div>
                <h1 className={s.bannerTitle}>{job.title}</h1>
                <div className={s.bannerAddr}>{jobAddress}</div>
              </div>
              <div className={s.bannerRight}>
                {currentPhaseName && <div className={s.phasePill}>{currentPhaseName}</div>}
              </div>
            </div>

            {/* Progress track */}
            {phases.length > 0 && (
              <div className={s.bannerInner} style={{ paddingTop: 0 }}>
                <div className={s.track}>
                  {phases.map((phase, i) => (
                    <div key={phase.id} className={s.trackItem}>
                      <div
                        className={`${s.trackDot} ${i < currentPhaseIdx ? s.trackDone : i === currentPhaseIdx ? s.trackActive : ""}`}
                      />
                      {i < phases.length - 1 && (
                        <div className={`${s.trackLine} ${i < currentPhaseIdx ? s.trackLineDone : ""}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className={s.content}>
            <div className={s.loadingMsg}>Loading your job details…</div>
          </div>
        )}

        {/* No job assigned yet */}
        {!loading && !job && !dataError && (
          <div className={s.content}>
            <div className={s.latestUpdate} style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🔧</div>
              <div className={s.latestTitle} style={{ marginBottom: 8 }}>No job assigned yet</div>
              <p className={s.latestBody} style={{ color: "rgba(233,238,252,0.4)" }}>
                Your account is set up. Collins will link your job to this account shortly — you'll see all your job details here once it's ready.
              </p>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        {job && !loading && (
          <>
            {/* Mobile: back to site */}
            <Link href="/" className={s.mobileBackLink}>← Site</Link>
            {/* Mobile pill nav */}
            <MobilePillNav
              items={[
                { key: "overview", icon: "⊙", label: "Overview" },
                { key: "timeline", icon: "◷", label: "Timeline" },
                { key: "documents", icon: "📄", label: "Documents", badge: docs.length > 0 ? docs.length : null },
                { key: "photos", icon: "🖼", label: "Photos", badge: photos.length > 0 ? photos.length : null },
                { key: "messages", icon: "💬", label: "Messages" },
              ]}
              activeKey={activeTab}
              onSelect={(key) => {
                setActiveTab(key as typeof activeTab);
                if (key === "messages" && clientId) loadMessages(clientId);
                if (key === "photos") loadPhotos();
              }}
            />

            <div className={s.tabBar}>
              <div className={s.tabBarInner}>
                {(["overview", "timeline", "documents", "photos", "messages"] as const).map(tab => (
                  <button
                    key={tab}
                    className={`${s.tab} ${activeTab === tab ? s.tabActive : ""}`}
                    onClick={() => { setActiveTab(tab); if (tab === "messages" && clientId) loadMessages(clientId); if (tab === "photos") loadPhotos(); }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === "documents" && docs.length > 0 && (
                      <span className={s.tabBadge}>{docs.length}</span>
                    )}
                    {tab === "photos" && photos.length > 0 && (
                      <span className={s.tabBadge}>{photos.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Content ── */}
            <div className={s.content}>

              {activeTab === "overview" && (
                <div className={s.overview}>
                  <div className={s.overviewGrid}>
                    <div className={s.overviewCard}>
                      <div className={s.overviewCardLabel}>Current phase</div>
                      <div className={s.overviewCardVal}>{currentPhaseName ?? "Not set"}</div>
                      {currentPhaseIdx >= 0 && (
                        <div className={s.overviewCardSub}>Step {currentPhaseIdx + 1} of {phases.length}</div>
                      )}
                    </div>
                    <div className={s.overviewCard}>
                      <div className={s.overviewCardLabel}>Address</div>
                      <div className={s.overviewCardVal} style={{ fontSize: 15 }}>{jobAddress}</div>
                    </div>
                    <div className={s.overviewCard}>
                      <div className={s.overviewCardLabel}>Documents</div>
                      <div className={s.overviewCardVal}>{docs.length}</div>
                      <div className={s.overviewCardSub}>{docs.length === 1 ? "File" : "Files"} available</div>
                    </div>
                  </div>

                  {notes[0] && (
                    <div className={s.latestUpdate}>
                      <div className={s.latestLabel}>Latest update</div>
                      <div className={s.latestTitle}>{notes[0].author_profile?.[0]?.full_name ?? "Collins team"}</div>
                      <div className={s.latestDate}>{formatDate(notes[0].created_at)}</div>
                      <p className={s.latestBody}>{notes[0].body}</p>
                    </div>
                  )}

                  {notes.length === 0 && (
                    <div className={s.latestUpdate}>
                      <div className={s.latestLabel}>Latest update</div>
                      <p className={s.latestBody} style={{ color: "rgba(233,238,252,0.35)" }}>
                        No updates yet. Your installation team will post updates here as your job progresses.
                      </p>
                    </div>
                  )}

                  {/* ── Upcoming appointments ── */}
                  {appts.length > 0 && (
                    <div className={s.latestUpdate}>
                      <div className={s.latestLabel}>Upcoming appointments</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                        {appts.map(a => {
                          const isPending = !a.customer_agreed && !a.client_response;
                          const isResponded = !!a.client_response;
                          const isCounter = counterOpen === a.id;
                          return (
                            <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                {/* Date block */}
                                <div style={{ background: "rgba(42,91,255,0.1)", borderRadius: 10, padding: "8px 14px", textAlign: "center", flexShrink: 0, minWidth: 54 }}>
                                  <div style={{ fontSize: 18, fontWeight: 800, color: "#e9eefc", lineHeight: 1 }}>
                                    {new Date(a.appt_date).getDate()}
                                  </div>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(233,238,252,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {new Date(a.appt_date).toLocaleDateString("en-GB", { month: "short" })}
                                  </div>
                                  <div style={{ fontSize: 10, color: "rgba(233,238,252,0.35)" }}>
                                    {new Date(a.appt_date).getFullYear()}
                                  </div>
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e9eefc", marginBottom: 2 }}>
                                    {APPT_LABELS[a.appt_type]}
                                    {a.appt_time && <span style={{ fontWeight: 400, color: "rgba(233,238,252,0.5)", marginLeft: 8 }}>at {a.appt_time.slice(0,5)}</span>}
                                  </div>
                                  {a.person_in_charge && (
                                    <div style={{ fontSize: 12, color: "rgba(233,238,252,0.45)", marginBottom: 3 }}>Engineer: {a.person_in_charge}</div>
                                  )}
                                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                    {a.is_first_visit && <span style={{ fontSize: 10, color: "rgba(52,211,153,0.7)", background: "rgba(52,211,153,0.07)", borderRadius: 4, padding: "1px 7px" }}>First visit</span>}
                                    {a.is_revisit && <span style={{ fontSize: 10, color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.07)", borderRadius: 4, padding: "1px 7px" }}>Re-visit</span>}
                                    {a.is_intended_last && <span style={{ fontSize: 10, color: "rgba(167,139,250,0.7)", background: "rgba(167,139,250,0.07)", borderRadius: 4, padding: "1px 7px" }}>Final visit</span>}
                                  </div>
                                  {/* Client already responded */}
                                  {isResponded && (
                                    <div style={{ marginTop: 6, fontSize: 12 }}>
                                      {a.client_response === "accepted" && <span style={{ color: "#34d399" }}>✓ You confirmed this appointment</span>}
                                      {a.client_response === "declined" && <span style={{ color: "#f87171" }}>✗ You declined this appointment</span>}
                                      {a.client_response === "counter" && <span style={{ color: "#fbbf24" }}>↺ You requested a reschedule{a.counter_message ? `: "${a.counter_message}"` : ""}</span>}
                                    </div>
                                  )}
                                  {/* Admin already confirmed on their end */}
                                  {a.customer_agreed && !isResponded && (
                                    <div style={{ marginTop: 4, fontSize: 11, color: "rgba(52,211,153,0.6)" }}>✓ Confirmed by Collins</div>
                                  )}
                                </div>
                                {/* Accept / Counter / Decline buttons — only if pending */}
                                {isPending && !isCounter && (
                                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                                    <button
                                      disabled={apptResponding === a.id}
                                      onClick={() => respondToAppt(a.id, "accepted")}
                                      title="Accept"
                                      style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(52,211,153,0.12)", border: "none", cursor: "pointer", fontSize: 16, color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      ✓
                                    </button>
                                    <button
                                      disabled={apptResponding === a.id}
                                      onClick={() => setCounterOpen(a.id)}
                                      title="Request reschedule"
                                      style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(251,191,36,0.1)", border: "none", cursor: "pointer", fontSize: 16, color: "#fbbf24", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      ↺
                                    </button>
                                    <button
                                      disabled={apptResponding === a.id}
                                      onClick={() => respondToAppt(a.id, "declined")}
                                      title="Decline"
                                      style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "none", cursor: "pointer", fontSize: 16, color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                              {/* Counter/reschedule input */}
                              {isPending && isCounter && (
                                <div style={{ display: "flex", gap: 8, paddingLeft: 66 }}>
                                  <input
                                    placeholder="Suggest a different time or date…"
                                    value={counterText[a.id] ?? ""}
                                    onChange={e => setCounterText(prev => ({ ...prev, [a.id]: e.target.value }))}
                                    style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "none", borderRadius: 8, padding: "8px 12px", color: "#e9eefc", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                                  />
                                  <button
                                    disabled={apptResponding === a.id || !(counterText[a.id] ?? "").trim()}
                                    onClick={() => respondToAppt(a.id, "counter", counterText[a.id])}
                                    style={{ background: "rgba(251,191,36,0.12)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fbbf24", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                    Send
                                  </button>
                                  <button onClick={() => setCounterOpen(null)}
                                    style={{ background: "none", border: "none", color: "rgba(233,238,252,0.3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "timeline" && (
                <div className={s.timeline}>
                  {notes.length === 0 && (
                    <div className={s.emptyState}>No updates have been posted yet.</div>
                  )}
                  {notes.map((note, i) => (
                    <div key={note.id} className={s.timelineItem}>
                      <div className={s.timelineLeft}>
                        <div className={s.timelineDot} style={{ background: NOTE_COLOUR.default }} />
                        {i < notes.length - 1 && <div className={s.timelineConnector} />}
                      </div>
                      <div className={s.timelineContent}>
                        <div className={s.timelineDate}>{formatDate(note.created_at)}</div>
                        <div className={s.timelineTitle}>{note.author_profile?.[0]?.full_name ?? "Collins team"}</div>
                        <p className={s.timelineBody}>{note.body}</p>
                      </div>
                    </div>
                  ))}
                  {/* Job creation entry always at bottom */}
                  <div className={s.timelineItem}>
                    <div className={s.timelineLeft}>
                      <div className={s.timelineDot} style={{ background: "#6b7280" }} />
                    </div>
                    <div className={s.timelineContent}>
                      <div className={s.timelineDate}>{formatDate(job.created_at)}</div>
                      <div className={s.timelineTitle}>Job registered</div>
                      <p className={s.timelineBody}>Your job has been registered on our system.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "documents" && (
                <div className={s.docs}>
                  <div className={s.docsHeader}>Your documents</div>
                  {docs.length === 0 && (
                    <div className={s.tableEmpty}>No documents have been uploaded yet.</div>
                  )}
                  {docs.map((doc) => (
                    <div key={doc.id} className={s.docRow}>
                      <div className={s.docIcon}>⭡</div>
                      <div className={s.docMeta}>
                        <div className={s.docName}>{doc.filename}</div>
                        <div className={s.docDate}>{doc.mime_type ?? "File"} · Added {formatDate(doc.created_at)}</div>
                      </div>
                      <button className={s.docDownload}>Download</button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "photos" && (
                <div className={s.photos}>
                  {/* Upload controls */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
                    <h3 className={s.sectionTitle}>Files & Photos ({photos.filter(p => !p.client_deleted_at).length})</h3>
                    <div>
                      {!uploadTypePicker ? (
                        <button className={s.btnPrimary} onClick={() => setUploadTypePicker(true)} disabled={photoUploading}>
                          {photoUploading ? "Uploading…" : "📎 Add file"}
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)" }}>Type:</span>
                          {(["quote", "invoice", "other"] as const).map(t => (
                            <button key={t}
                              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5,
                                border: `1px solid ${pendingUploadType === t ? "rgba(127,165,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                                background: pendingUploadType === t ? "rgba(127,165,255,0.12)" : "rgba(255,255,255,0.03)",
                                color: pendingUploadType === t ? "#7fa5ff" : "rgba(232,236,248,0.5)", cursor: "pointer" }}
                              onClick={() => setPendingUploadType(t)}>
                              {t === "other" ? "Photo / Other" : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                          <label style={{ fontSize: 11, padding: "3px 12px", borderRadius: 5, cursor: "pointer",
                            border: "1px solid rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.08)", color: "#34d399" }}>
                            Upload
                            <input ref={photoInputRef} type="file" accept="image/*,.pdf" style={{ display: "none" }}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) uploadPhoto(f, pendingUploadType);
                                e.target.value = "";
                                setUploadTypePicker(false);
                              }} />
                          </label>
                          <button onClick={() => setUploadTypePicker(false)}
                            style={{ fontSize: 11, background: "none", border: "none", color: "rgba(232,236,248,0.3)", cursor: "pointer" }}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Files grouped by type */}
                  {(() => {
                    const visible = photos.filter(p => !p.client_deleted_at);
                    if (visible.length === 0) return <div className={s.emptyState}>No files yet. Upload your first file above.</div>;
                    const byType: Record<string, typeof visible> = { quote: [], invoice: [], photo: [], other: [] };
                    visible.forEach(f => { const t = f.file_type ?? "other"; (byType[t] ?? (byType.other ??= [])).push(f); });
                    const typeLabel: Record<string, string> = { quote: "Quotes", invoice: "Invoices", photo: "Photos", other: "Other" };
                    const typeColour: Record<string, string> = { quote: "#fbbf24", invoice: "#34d399", photo: "#7fa5ff", other: "#9ca3af" };
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {(["quote", "invoice", "photo", "other"] as const).map(type => {
                          const files = byType[type] ?? [];
                          if (files.length === 0) return null;
                          return (
                            <div key={type}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: typeColour[type], letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                                {typeLabel[type]}
                              </div>
                              <div className={s.photoGrid}>
                                {files.map(photo => {
                                  const url = `${supabaseUrl}/storage/v1/object/public/${photo.storage_bucket}/${photo.storage_path}`;
                                  const isImage = photo.mime_type?.startsWith("image/");
                                  return (
                                    <div key={photo.id} style={{ position: "relative" }}>
                                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                                        <div className={s.photoCard}>
                                          {isImage
                                            ? <img src={url} alt={photo.filename} className={s.photoImg} />
                                            : <div className={s.photoImg} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                                                {type === "quote" ? "📄" : type === "invoice" ? "🧾" : "📎"}
                                              </div>
                                          }
                                          <div className={s.photoInfo}>
                                            <div className={s.photoFilename}>{photo.filename}</div>
                                            <div className={s.photoDate}>{formatDate(photo.created_at)}</div>
                                          </div>
                                        </div>
                                      </a>
                                      <button
                                        onClick={() => deletePhoto(photo.id)}
                                        disabled={deletingFileId === photo.id}
                                        title="Delete"
                                        style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%",
                                          background: "rgba(248,113,113,0.85)", border: "none", cursor: "pointer",
                                          fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                                          opacity: deletingFileId === photo.id ? 0.4 : 1, zIndex: 2 }}>
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === "messages" && (
                <div className={s.messages}>
                  <div className={s.chatWindow}>
                    <div className={s.chatMessages}>
                      {chatLoading && <div className={s.chatEmpty}>Loading messages…</div>}
                      {!chatLoading && chatMessages.length === 0 && (
                        <div className={s.chatEmpty}>
                          <div className={s.messagesEmptyIcon}>✉</div>
                          <div className={s.messagesEmptyTitle}>No messages yet</div>
                          <div className={s.messagesEmptySub}>Send a message to your Collins team below.</div>
                        </div>
                      )}
                      {chatMessages.map(msg => {
                        const isClient = msg.direction === "client_to_admin";
                        return (
                          <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isClient ? "flex-end" : "flex-start" }}>
                            <div className={`${s.chatBubble} ${isClient ? s.chatBubbleClient : s.chatBubbleAdmin}`}>
                              {msg.body}
                            </div>
                            <div className={`${s.chatBubbleMeta} ${isClient ? s.chatBubbleMetaClient : ""}`}>
                              {isClient ? "You" : "Collins team"} · {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatBottomRef} />
                    </div>
                    <div className={s.chatInputRow}>
                      <textarea
                        className={s.chatInput}
                        placeholder="Type a message…"
                        value={chatText}
                        onChange={e => setChatText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        rows={1}
                      />
                      <button
                        className={s.chatSendBtn}
                        disabled={chatSending || !chatText.trim()}
                        onClick={sendMessage}
                      >↑</button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </>
        )}

      </div>

    </div>
  );
}
