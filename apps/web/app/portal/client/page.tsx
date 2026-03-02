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

const NOTE_COLOUR: Record<string, string> = {
  default: "#a78bfa",
};

export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "documents" | "photos" | "messages">("overview");
  const [loginEmail, setLoginEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkSending, setMagicLinkSending] = useState(false);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Show error from callback redirect if present
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") setAuthError("Sign-in link was invalid or expired. Please request a new one.");

    // Handle initial session (page load after /auth/callback redirect)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { loadData(); return; }
      setAuthLoading(false);
    });
    // Also catch SIGNED_IN fired by any in-page token exchange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") loadData();
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal/client` },
    });
    setMagicLinkSending(false);
    if (err) { setAuthError(err.message); return; }
    setMagicLinkSent(true);
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
      .select("id,created_at,filename,mime_type,size_bytes,storage_path,storage_bucket")
      .eq("job_id", job?.id ?? "")
      .eq("is_client_visible", true)
      .order("created_at", { ascending: false });
    if (data) setPhotos(data);
  }

  async function uploadPhoto(file: File) {
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
      });
      loadPhotos(); // reload photos
    }
    setPhotoUploading(false);
  }

  async function loadData() {
    setAuthLoading(false);
    setAuthed(true);
    setLoading(true);
    setDataError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: client } = await supabase
      .from("zz_clients")
      .select("id")
      .eq("user_id", user.id)
      .single();

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
      setDataError("No active job found on your account.");
      setLoading(false);
      return;
    }

    setJob(jobRes.data as Job);
    if (phasesRes.data) setPhases(phasesRes.data);

    const [notesRes, docsRes] = await Promise.all([
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
    ]);

    if (notesRes.data) setNotes(notesRes.data as Note[]);
    if (docsRes.data) setDocs(docsRes.data as Doc[]);
    setLoading(false);
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
            <form className={s.loginForm} onSubmit={requestMagicLink}>
              <input className={s.loginInput} type="email" placeholder="Your email address"
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" required />
              {authError && <div className={s.loginError}>{authError}</div>}
              <button type="submit" className={s.btnPrimary} disabled={magicLinkSending}>
                {magicLinkSending ? "Sending…" : "Send sign-in link"}
              </button>
            </form>
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

        {/* ── Tabs ── */}
        {job && !loading && (
          <>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 className={s.sectionTitle}>Photos ({photos.length})</h3>
                    <input type="file" ref={photoInputRef} accept="image/*" multiple style={{ display: "none" }} onChange={e => {
                      const files = Array.from(e.target.files || []);
                      files.forEach(file => uploadPhoto(file));
                      e.target.value = "";
                    }} />
                    <button className={s.btnPrimary} onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                      {photoUploading ? "Uploading…" : "Add photos"}
                    </button>
                  </div>
                  <div className={s.photoGrid}>
                    {photos.map(photo => (
                      <div key={photo.id} className={s.photoCard}>
                        <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${photo.storage_bucket}/${photo.storage_path}`} alt={photo.filename} className={s.photoImg} />
                        <div className={s.photoInfo}>
                          <div className={s.photoFilename}>{photo.filename}</div>
                          <div className={s.photoDate}>{formatDate(photo.created_at)}</div>
                        </div>
                      </div>
                    ))}
                    {photos.length === 0 && (
                      <div className={s.emptyState}>No photos yet. Add your first photo above.</div>
                    )}
                  </div>
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
