"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase";
import s from "./admin.module.css";
import JobExpandedDetail from "./JobExpandedDetail";

// ── Mobile Pill Nav ────────────────────────────────────────────────
type NavItem = { key: string; icon: string; label: string; badge?: number | null };
function MobilePillNav({ items, activeKey, onSelect, styles }: {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: any;
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
    <div className={styles.mobilePillNav} ref={ref}>
      {!open ? (
        /* Collapsed: single icon circle */
        <button
          className={styles.mobilePillCollapsed}
          onClick={() => setOpen(true)}
          title={active?.label}
        >
          {active?.icon}
        </button>
      ) : (
        /* Expanded: horizontal pill with all icons + labels outside below */
        <div>
          <div className={styles.mobilePillExpanded}>
            {items.map(item => (
              <button
                key={item.key}
                className={`${styles.mobilePillNavItem} ${item.key === activeKey ? styles.mobilePillNavItemActive : ""}`}
                onClick={() => { onSelect(item.key); setOpen(false); }}
                title={item.label}
              >
                <span className={styles.mobilePillNavItemInner}>{item.icon}</span>
                {item.badge ? <span className={styles.mobilePillBadge}>{item.badge}</span> : null}
              </button>
            ))}
          </div>
          <div className={styles.mobilePillLabelsRow}>
            {items.map(item => (
              <span
                key={item.key}
                className={`${styles.mobilePillNavLabel} ${item.key === activeKey ? styles.mobilePillNavLabelActive : ""}`}
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

// ── Floating phase filter pill (mobile) ───────────────────────────
function PhaseFloatPill({ phases, jobs, phaseFilterPhase, setPhaseFilterPhase, styles }: {
  phases: { id: string; name: string; position: number; is_active: boolean }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs: any[];
  phaseFilterPhase: string;
  setPhaseFilterPhase: (v: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: any;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${styles.phaseFloatPill} ${expanded ? styles.phaseFloatPillExpanded : ""}`}>
      <button
        className={styles.phaseFloatToggle}
        onClick={() => setExpanded(v => !v)}
        title={expanded ? "Collapse" : "Filter by phase"}
      />
      <div className={styles.phaseFloatSep} />
      {phases.map((phase, i) => {
        const colour = PHASE_COLOURS[i % PHASE_COLOURS.length] ?? "#6b7280";
        const count = jobs.filter((j: { current_phase?: { name: string }[] | { name: string } | null }) => {
          if (!j.current_phase) return false;
          const name = Array.isArray(j.current_phase) ? j.current_phase[0]?.name : j.current_phase?.name;
          return name === phase.name;
        }).length;
        const isActive = phaseFilterPhase === phase.name;
        return (
          <div
            key={phase.id}
            className={styles.phaseFloatItem}
            onClick={() => setPhaseFilterPhase(isActive ? "" : phase.name)}
            title={`${phase.name} · ${count}`}
          >
            <div
              className={`${styles.phaseFloatDot} ${isActive ? styles.phaseFloatDotActive : ""}`}
              style={{ borderColor: colour, background: isActive ? colour : "transparent", color: colour }}
            />
            <span className={`${styles.phaseFloatLabel} ${isActive ? styles.phaseFloatLabelActive : ""}`}>
              {phase.name}
            </span>
          </div>
        );
      })}
      <div className={styles.phaseFloatSep} />
      <button
        className={`${styles.phaseFloatAll} ${!phaseFilterPhase ? styles.phaseFloatAllActive : ""}`}
        onClick={() => setPhaseFilterPhase("")}
      >All</button>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────
type Phase = { id: string; name: string; position: number; is_active: boolean };
type Job = {
  id: string; title: string; status: string;
  town_city: string; postcode: string; updated_at: string; created_at: string;
  address_line_1: string; client_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  current_phase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
};
function jobPhaseName(job: Job): string | null {
  if (!job.current_phase) return null;
  if (Array.isArray(job.current_phase)) return job.current_phase[0]?.name ?? null;
  return job.current_phase.name;
}
function jobClientName(job: Job): string {
  if (!job.client) return "—";
  if (Array.isArray(job.client)) return job.client[0]?.full_name ?? "—";
  return job.client.full_name || "—";
}
type JobDetail = {
  id: string; title: string; status: string;
  address_line_1: string; address_line_2: string | null;
  town_city: string; county: string | null; postcode: string;
  created_at: string; updated_at: string;
  current_phase_id: string | null;
  client: { id: string; full_name: string; email: string; phone: string | null } | null;
  notes: { id: string; created_at: string; body: string; is_client_visible: boolean; author: { full_name: string } | null }[];
  files: { id: string; filename: string; storage_path: string; storage_bucket: string; is_client_visible: boolean; created_at: string }[];
};
type Lead = { id: string; created_at: string; status: string; full_name: string; email: string | null; phone: string | null; message: string | null };
type Client = { id: string; created_at: string; full_name: string; email: string; phone: string | null; user_id: string | null };

const PHASE_COLOURS = ["#fbbf24","#60a5fa","#34d399","#a78bfa","#f97316","#fb923c","#e879f9","#94a3b8"];
const ROADBLOCK_PRESETS = [
  "More parts were needed — this may cause a delay.",
  "Awaiting parts delivery.",
  "Weather conditions have caused a delay.",
  "Customer rescheduled the appointment.",
  "Additional survey required before proceeding.",
];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── AccountsPanel ──────────────────────────────────────────────────
const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, staff: 2, client: 1 };
function canDelete(myRole: string, targetRole: string) {
  const myRank = ROLE_RANK[myRole] ?? 0;
  const targetRank = ROLE_RANK[targetRole] ?? 0;
  if (myRank < 3) return false; // only admin+ can delete
  if (myRole === "admin" && targetRank >= 3) return false; // admin can't delete admin/owner
  return myRank > targetRank;
}

function AccountsPanel({ supabase, currentProfile, onSignOut }: {
  supabase: ReturnType<typeof createClient>;
  currentProfile: { full_name: string; role: string } | null;
  onSignOut: () => void;
}) {
  const [staff, setStaff] = useState<{ user_id: string; full_name: string; role: string; phone: string | null }[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Inline action dropdown: key = user_id or client_id
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "staff" });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const myRole = currentProfile?.role ?? "";
  const canSeeStaff = (ROLE_RANK[myRole] ?? 0) >= 3;
  const canInvite = (ROLE_RANK[myRole] ?? 0) >= 3;

  useEffect(() => {
    (async () => {
      if (canSeeStaff) {
        const [staffRes, clientsRes] = await Promise.all([
          supabase.from("zz_profiles").select("user_id,full_name,role,phone").in("role", ["owner","admin","staff"]).order("full_name"),
          supabase.from("zz_clients").select("id,created_at,full_name,email,phone,user_id").order("full_name"),
        ]);
        if (staffRes.data) setStaff(staffRes.data);
        if (clientsRes.data) setClients(clientsRes.data);
      } else {
        const { data } = await supabase.from("zz_clients").select("id,created_at,full_name,email,phone,user_id").order("full_name");
        if (data) setClients(data);
      }
      setLoading(false);
    })();
  }, []);

  async function deleteStaff(userId: string) {
    if (!confirm("Delete this staff account? This cannot be undone.")) return;
    setDeleting(userId);
    await supabase.from("zz_profiles").delete().eq("user_id", userId);
    setStaff(prev => prev.filter(s => s.user_id !== userId));
    setDeleting(null);
  }

  async function deleteClient(clientId: string) {
    if (!confirm("Delete this client? Their jobs will remain but they will lose portal access.")) return;
    setDeleting(clientId);
    await supabase.from("zz_clients").delete().eq("id", clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
    setDeleting(null);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg("");
    const fullName = `${inviteForm.firstName.trim()} ${inviteForm.lastName.trim()}`.trim();
    const res = await fetch("/api/invite-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteForm.email, fullName, phone: inviteForm.phone || null, role: inviteForm.role }),
    });
    const json = await res.json();
    if (json.error) {
      setInviteMsg(`Error: ${json.error}`);
    } else {
      setInviteMsg(`Invite sent to ${inviteForm.email}!`);
      setInviteForm({ firstName: "", lastName: "", email: "", phone: "", role: "staff" });
      setShowInvite(false);
      // Refresh staff list
      const { data } = await supabase.from("zz_profiles").select("user_id,full_name,role,phone").order("full_name");
      if (data) setStaff(data);
    }
    setInviting(false);
  }

  if (loading) return <div style={{ padding: 24, color: "rgba(232,236,248,0.4)", fontSize: 13 }}>Loading accounts…</div>;

  const roleColour: Record<string, string> = { owner: "#f97316", admin: "#a78bfa", staff: "#60a5fa", client: "#34d399" };

  const rowStyle = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", position: "relative" as const };

  function ActionMenu({ id, phone, email, onDelete, canDel }: { id: string; phone: string | null; email?: string; onDelete: () => void; canDel: boolean }) {
    const isOpen = openMenu === id;
    return (
      <div style={{ position: "relative" }}>
        <button onClick={e => { e.stopPropagation(); setOpenMenu(isOpen ? null : id); }}
          style={{ fontSize: 12, color: "rgba(232,236,248,0.4)", background: "rgba(255,255,255,0.04)", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>
          ···
        </button>
        {isOpen && (
          <div onClick={e => e.stopPropagation()}
            style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, zIndex: 50, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
            {phone && (
              <a href={`tel:${phone}`} style={{ display: "block", padding: "9px 14px", fontSize: 12, color: "#e8ecf8", textDecoration: "none" }}
                onClick={() => setOpenMenu(null)}>📞 Call</a>
            )}
            {phone && (
              <a href={`sms:${phone}`} style={{ display: "block", padding: "9px 14px", fontSize: 12, color: "#e8ecf8", textDecoration: "none" }}
                onClick={() => setOpenMenu(null)}>💬 Message (SMS)</a>
            )}
            {email && (
              <a href={`mailto:${email}`} style={{ display: "block", padding: "9px 14px", fontSize: 12, color: "#e8ecf8", textDecoration: "none" }}
                onClick={() => setOpenMenu(null)}>✉️ Email</a>
            )}
            {canDel && (
              <button onClick={() => { setOpenMenu(null); onDelete(); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12, color: "rgba(248,113,113,0.8)", background: "none", border: "none", cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                🗑 Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }} onClick={() => setOpenMenu(null)}>

      {/* Staff section — admin+ only */}
      {canSeeStaff && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,236,248,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Staff · {staff.length}
            </div>
            {canInvite && (
              <button onClick={() => setShowInvite(v => !v)}
                style={{ fontSize: 11, color: "#7fa5ff", background: "rgba(127,165,255,0.08)", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
                + Invite staff
              </button>
            )}
          </div>

          {/* Invite form */}
          {showInvite && (
            <form onSubmit={sendInvite} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 14px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input required placeholder="First name" value={inviteForm.firstName} onChange={e => setInviteForm(p => ({ ...p, firstName: e.target.value }))}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#e8ecf8", fontSize: 12 }} />
                <input required placeholder="Last name" value={inviteForm.lastName} onChange={e => setInviteForm(p => ({ ...p, lastName: e.target.value }))}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#e8ecf8", fontSize: 12 }} />
              </div>
              <input required type="email" placeholder="Email address" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#e8ecf8", fontSize: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="tel" placeholder="Phone (optional)" value={inviteForm.phone} onChange={e => setInviteForm(p => ({ ...p, phone: e.target.value }))}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#e8ecf8", fontSize: 12 }} />
                <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", color: "#e8ecf8", fontSize: 12 }}>
                  <option value="staff">Staff</option>
                  {myRole === "owner" && <option value="admin">Admin</option>}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="submit" disabled={inviting}
                  style={{ fontSize: 12, background: "#7fa5ff", color: "#0d0f1a", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
                  {inviting ? "Sending…" : "Send invite"}
                </button>
                <button type="button" onClick={() => setShowInvite(false)}
                  style={{ fontSize: 12, background: "none", color: "rgba(232,236,248,0.4)", border: "none", cursor: "pointer" }}>Cancel</button>
                {inviteMsg && <span style={{ fontSize: 11, color: inviteMsg.startsWith("Error") ? "#f87171" : "#34d399" }}>{inviteMsg}</span>}
              </div>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {staff.map(member => {
              const isMe = member.full_name === currentProfile?.full_name;
              const canDel = !isMe && canDelete(myRole, member.role);
              return (
                <div key={member.user_id} style={rowStyle}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${roleColour[member.role] ?? "#7fa5ff"}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: roleColour[member.role] ?? "#7fa5ff", flexShrink: 0 }}>
                    {member.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e8ecf8" }}>
                      {member.full_name}
                      {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(232,236,248,0.3)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 5px" }}>You</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(232,236,248,0.35)" }}>{member.phone ?? "No phone"}</div>
                  </div>
                  <span style={{ fontSize: 10, color: roleColour[member.role] ?? "#7fa5ff", background: `${roleColour[member.role] ?? "#7fa5ff"}18`, borderRadius: 4, padding: "1px 6px" }}>{member.role}</span>
                  <ActionMenu id={member.user_id} phone={member.phone} onDelete={() => deleteStaff(member.user_id)} canDel={canDel} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clients */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,236,248,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Clients · {clients.length}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {clients.map(c => {
            const canDel = canDelete(myRole, "client");
            return (
              <div key={c.id} style={rowStyle}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#34d399", flexShrink: 0 }}>
                  {c.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e8ecf8" }}>{c.full_name}</div>
                  <div style={{ fontSize: 11, color: "rgba(232,236,248,0.35)" }}>{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
                </div>
                <div style={{ fontSize: 10, color: c.user_id ? "rgba(52,211,153,0.7)" : "rgba(232,236,248,0.2)", background: c.user_id ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)", borderRadius: 4, padding: "1px 6px" }}>
                  {c.user_id ? "Active" : "No login"}
                </div>
                <ActionMenu id={c.id} phone={c.phone} email={c.email} onDelete={() => deleteClient(c.id)} canDel={canDel} />
              </div>
            );
          })}
          {clients.length === 0 && <div style={{ fontSize: 12, color: "rgba(232,236,248,0.25)", padding: "8px 0" }}>No clients yet.</div>}
        </div>
      </div>

      {/* Sign out */}
      <div>
        <button onClick={onSignOut} style={{ fontSize: 12, color: "rgba(248,113,113,0.7)", background: "none", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminPortal() {
  // ── Auth state ──────────────────────────────────────────────────
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null);

  // ── App state ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"jobs" | "clients" | "leads" | "photos" | "account">("jobs");
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Leads state ─────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // ── Clients state ────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientActionLoading, setClientActionLoading] = useState(false);
  const [clientActionMsg, setClientActionMsg] = useState<string | null>(null);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [lastCancelLogId, setLastCancelLogId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [clientActionPanel, setClientActionPanel] = useState<"none" | "message" | "email" | "cancel" | "edit">("none");
  const [editClientForm, setEditClientForm] = useState({ full_name: "", email: "", phone: "" });
  type ChatMessage = { id: string; created_at: string; body: string; direction: string; sender_user_id: string | null };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Job status filter ───────────────────────────────────────────
  const [jobStatusFilter, setJobStatusFilter] = useState<"" | "active" | "history" | "cancelled">("active");

  // ── Phases filter state ───────────────────────────────────────────
  const [phaseFilterPhase, setPhaseFilterPhase] = useState("");
  const [phaseFilterSearch, setPhaseFilterSearch] = useState("");
  const [phaseEditing, setPhaseEditing] = useState<string | null>(null);
  const [phaseNewName, setPhaseNewName] = useState("");
  const [phaseAdding, setPhaseAdding] = useState(false);
  const [phaseDeleting, setPhaseDeleting] = useState<string | null>(null);
  // ── Photos state ───────────────────────────────────────────────
  const [photos, setPhotos] = useState<any[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFilterJob, setPhotoFilterJob] = useState<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  // ── Expanded jobs in pipeline ───────────────────────────────────
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  // jobId -> which blocked-phase upload prompt is open ("quote" | "invoice" | null)
  const [blockedUpload, setBlockedUpload] = useState<Record<string, string>>({});

  // ── Job detail state ─────────────────────────────────────────────
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [showRoadblock, setShowRoadblock] = useState(false);
  const [roadblockText, setRoadblockText] = useState("");

  // ── New job drawer ───────────────────────────────────────────────
  const [showNewJob, setShowNewJob] = useState(false);
  const [newJobSaving, setNewJobSaving] = useState(false);
  const [newJobError, setNewJobError] = useState("");
  const [newJobDone, setNewJobDone] = useState<{ clientEmail: string } | null>(null);
  const [njClientMode, setNjClientMode] = useState<"new" | "existing">("new");
  const [njExistingSearch, setNjExistingSearch] = useState("");
  const [njExistingId, setNjExistingId] = useState("");
  const [nj, setNj] = useState({
    clientName: "", clientEmail: "", clientPhone: "",
    title: "", description: "", addressLine1: "", addressLine2: "",
    townCity: "", county: "", postcode: "",
    phaseId: "",
  });

  // ── Convert lead modal ───────────────────────────────────────────
  const [convertLeadData, setConvertLeadData] = useState<Lead | null>(null);
  const [clForm, setClForm] = useState({
    clientName: "", clientEmail: "", clientPhone: "",
    jobTitle: "", jobDescription: "",
    addressLine1: "", addressLine2: "", townCity: "", county: "", postcode: "",
    phaseId: "",
  });
  const [clSaving, setClSaving] = useState(false);
  const [clError, setClError] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  // Debug selectedJobId changes
  useEffect(() => {
    console.log("selectedJobId changed:", selectedJobId);
  }, [selectedJobId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      setPhotos(prev => prev.map(f => f.id === id ? { ...f, staff_deleted_at: new Date().toISOString() } : f));
    };
    window.addEventListener("zz_file_deleted", handler);
    return () => window.removeEventListener("zz_file_deleted", handler);
  }, []);

  // ── Phase management ─────────────────────────────────────────────
  async function addPhase() {
    if (!phaseNewName.trim()) return;
    setPhaseAdding(true);
    const maxPos = Math.max(0, ...phases.map(p => p.position));
    await supabase.from("zz_job_phases").insert({ name: phaseNewName.trim(), position: maxPos + 1, is_active: true });
    loadData(); // reload phases
    setPhaseNewName("");
    setPhaseAdding(false);
  }

  async function deletePhase(id: string) {
    if (!confirm("Delete this phase? Jobs in this phase will become un-phased.")) return;
    setPhaseDeleting(id);
    await supabase.from("zz_job_phases").delete().eq("id", id);
    loadData();
    setPhaseDeleting(null);
  }

  async function savePhaseName(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from("zz_job_phases").update({ name: name.trim() }).eq("id", id);
    loadData();
    setPhaseEditing(null);
  }

  async function movePhase(id: string, direction: "up" | "down") {
    const idx = phases.findIndex(p => p.id === id);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= phases.length) return;
    const phase = phases[idx];
    const target = phases[targetIdx];
    if (!phase || !target) return;
    await supabase.from("zz_job_phases").update({ position: target.position }).eq("id", phase.id);
    await supabase.from("zz_job_phases").update({ position: phase.position }).eq("id", target.id);
    loadData();
  }

  function toggleJobExpansion(jobId: string) {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
        loadJobFiles(jobId);
      }
      return newSet;
    });
  }

  // ── Photos ───────────────────────────────────────────────────────
  async function loadPhotos() {
    const { data } = await supabase
      .from("zz_files")
      .select("id,created_at,filename,mime_type,size_bytes,storage_path,storage_bucket,job_id,file_type,is_client_visible,staff_deleted_at,client_deleted_at,zz_jobs(id,title,zz_clients(full_name))")
      .order("created_at", { ascending: false });
    if (data) setPhotos(data as any[]);
  }

  async function loadJobFiles(jobId: string) {
    const { data } = await supabase
      .from("zz_files")
      .select("id,created_at,filename,mime_type,size_bytes,job_id,file_type,storage_path,storage_bucket,staff_deleted_at,client_deleted_at")
      .eq("job_id", jobId);
    if (data) setPhotos(prev => {
      const withoutJob = prev.filter(f => f.job_id !== jobId);
      return [...withoutJob, ...(data as any[])];
    });
  }

  async function uploadPhoto(file: File, jobId?: string, fileType: "quote" | "invoice" | "photo" | "other" = "photo") {
    setPhotoUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const targetJobId = jobId || selectedJobId;
    if (!targetJobId) { setPhotoUploading(false); return; }
    const path = `jobs/${targetJobId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, file);
    if (!upErr) {
      const { data: fileRow } = await supabase.from("zz_files").insert({
        job_id: targetJobId,
        uploader_user_id: user?.id ?? null,
        storage_bucket: "job-photos",
        storage_path: path,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        is_client_visible: true,
        file_type: fileType,
      }).select("id,created_at,filename,mime_type,size_bytes,job_id,file_type,zz_jobs!inner(title,client_id,zz_clients!inner(full_name))").single();
      if (fileRow) {
        setPhotos(prev => [fileRow as any, ...prev]);
        if (jobDetail) setJobDetail(prev => prev ? { ...prev, files: [fileRow as unknown as JobDetail["files"][0], ...prev.files] } : prev);
      }
    }
    setPhotoUploading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadData();
      else setAuthLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data loading ─────────────────────────────────────────────────
  async function loadData() {
    setAuthLoading(false);
    setAuthed(true);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("zz_profiles").select("full_name,role").eq("user_id", user.id).single();
      setProfile(prof);
    }
    const [jobsRes, phasesRes] = await Promise.all([
      supabase.from("zz_jobs")
        .select("id,title,status,client_id,town_city,postcode,address_line_1,created_at,updated_at,current_phase:zz_job_phases(name),client:zz_clients(id,full_name,email)")
        .neq("status", "deleted").order("updated_at", { ascending: false }),
      supabase.from("zz_job_phases").select("id,name,position,is_active").eq("is_active", true).order("position", { ascending: true }),
    ]);
    if (jobsRes.error) setError(jobsRes.error.message);
    else setJobs((jobsRes.data ?? []) as Job[]);
    if (phasesRes.data) setPhases(phasesRes.data);
    setLoading(false);
  }

  async function loadLeads() {
    setLeadsLoading(true);
    const { data } = await supabase.rpc("zz_get_leads");
    if (data) setLeads((data as Lead[]).filter(l => l.status !== "converted" && l.status !== "dismissed"));
    setLeadsLoading(false);
  }

  async function loadClients() {
    setClientsLoading(true);
    const { data } = await supabase.from("zz_clients").select("id,created_at,full_name,email,phone,user_id").order("created_at", { ascending: false });
    if (data) setClients(data as Client[]);
    setClientsLoading(false);
  }

  // ── Leads actions ────────────────────────────────────────────────
  async function markLeadContacted(id: string) {
    await supabase.rpc("zz_update_lead_status", { p_id: id, p_status: "contacted" });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: "contacted" } : l));
  }

  function openConvertLead(lead: Lead) {
    setConvertLeadData(lead);
    setClForm({
      clientName: lead.full_name ?? "",
      clientEmail: lead.email ?? "",
      clientPhone: lead.phone ?? "",
      jobTitle: "",
      jobDescription: lead.message ?? "",
      addressLine1: "", addressLine2: "", townCity: "", county: "", postcode: "",
      phaseId: phases[0]?.id ?? "",
    });
    setClError("");
  }

  async function submitConvertLead(e: React.FormEvent) {
    e.preventDefault();
    if (!convertLeadData) return;
    setClSaving(true); setClError("");
    try {
      const res = await fetch("/api/create-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clForm.clientName.trim(),
          clientEmail: clForm.clientEmail.trim(),
          clientPhone: clForm.clientPhone.trim() || null,
          jobTitle: clForm.jobTitle.trim(),
          jobDescription: clForm.jobDescription.trim() || null,
          addressLine1: clForm.addressLine1.trim(),
          addressLine2: clForm.addressLine2.trim() || null,
          townCity: clForm.townCity.trim(),
          county: clForm.county.trim() || null,
          postcode: clForm.postcode.trim(),
          phaseId: clForm.phaseId || null,
          leadId: convertLeadData.id,
          sendInvite: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to convert lead");
      setLeads(prev => prev.filter(l => l.id !== convertLeadData.id));
      setExpandedLead(null);
      setConvertLeadData(null);
      await loadData();
    } catch (err: unknown) {
      setClError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setClSaving(false);
    }
  }

  async function dismissLead(id: string) {
    await supabase.rpc("zz_update_lead_status", { p_id: id, p_status: "dismissed" });
    setLeads(prev => prev.filter(l => l.id !== id));
    setExpandedLead(null);
  }

  // ── Client actions ───────────────────────────────────────────────
  function openClientPanel(id: string) {
    const closing = selectedClientId === id;
    setSelectedClientId(closing ? null : id);
    setClientActionMsg(null);
    setClientActionPanel("none");
    setCancelJobId(null);
    setCancelReason("");
    setLastCancelLogId(null);
    setMessageText("");
    setEmailSubject("");
    setEmailBody("");
    setChatMessages([]);
  }

  async function sendMagicLink(email: string) {
    setClientActionLoading(true);
    const res = await fetch("/api/reset-client-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (json.error) {
      setClientActionMsg("Error: " + json.error);
    } else {
      setClientActionMsg("Password reset link sent to " + email);
    }
    setClientActionLoading(false);
  }

  async function assignProfile(clientId: string, email: string, fullName: string) {
    setClientActionLoading(true);
    try {
      const res = await fetch("/api/invite-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role: "client" }),
      });
      if (res.ok) {
        setClientActionMsg("Invite sent — client will receive an email to set up access.");
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, user_id: "pending" } : c));
      } else {
        const { error } = await res.json();
        setClientActionMsg(`Error: ${error}`);
      }
    } catch {
      setClientActionMsg("Failed to send invite.");
    }
    setClientActionLoading(false);
  }

  async function loadMessages(clientId: string) {
    setChatLoading(true);
    const { data } = await supabase.from("zz_messages")
      .select("id,created_at,body,direction,sender_user_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (data) setChatMessages(data as ChatMessage[]);
    setChatLoading(false);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function sendClientMessage(clientId: string) {
    if (!messageText.trim()) return;
    setClientActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: msg } = await supabase.from("zz_messages")
      .insert({ client_id: clientId, sender_user_id: user?.id ?? null, body: messageText.trim(), direction: "admin_to_client" })
      .select("id,created_at,body,direction,sender_user_id").single();
    if (msg) {
      setChatMessages(prev => [...prev, msg as ChatMessage]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    setMessageText("");
    setClientActionLoading(false);
  }

  async function sendClientEmail(email: string, clientName: string) {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setClientActionLoading(true);
    const res = await fetch("/api/send-client-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toEmail: email, toName: clientName, subject: emailSubject.trim(), body: emailBody.trim() }),
    });
    const json = await res.json();
    setClientActionLoading(false);
    if (!res.ok) { setClientActionMsg(`Failed: ${json.error}`); return; }
    setEmailSubject(""); setEmailBody("");
    setClientActionMsg("Email sent.");
    setClientActionPanel("none");
  }

  async function updateClient(clientId: string) {
    setClientActionLoading(true);
    const update: Record<string, string | null> = {
      full_name: editClientForm.full_name.trim() || null,
      email: editClientForm.email.trim() || null,
      phone: editClientForm.phone.trim() || null,
    };
    const { error } = await supabase.from("zz_clients").update(update).eq("id", clientId);
    if (error) {
      setClientActionMsg("Error: " + error.message);
    } else {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...update } : c));
      setClientActionMsg("Client updated.");
      setClientActionPanel("none");
    }
    setClientActionLoading(false);
  }

  async function deleteClientFull(clientId: string) {
    if (!confirm("Delete this client entirely? Their jobs will be unlinked but remain. This cannot be undone.")) return;
    setClientActionLoading(true);
    await supabase.from("zz_clients").delete().eq("id", clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
    setSelectedClientId(null);
    setClientActionLoading(false);
  }

  async function cancelJob(jobId: string, reason: string) {
    if (!reason.trim()) return;
    setClientActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    // Save prev state for undo
    const prevJob = jobs.find(j => j.id === jobId);
    // Write to mod log first
    const { data: logRow } = await supabase.from("zz_mod_log").insert({
      actor_user_id: user?.id ?? null,
      action: "cancel_job",
      target_table: "zz_jobs",
      target_id: jobId,
      reason: reason.trim(),
      prev_state: { status: prevJob?.status ?? "active" },
    }).select("id").single();
    // Update job status
    await supabase.from("zz_jobs").update({ status: "cancelled", cancel_reason: reason.trim() }).eq("id", jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "cancelled" as const } : j));
    setLastCancelLogId(logRow?.id ?? null);
    setCancelJobId(null);
    setCancelReason("");
    setClientActionPanel("none");
    setClientActionMsg("Job cancelled.");
    setClientActionLoading(false);
  }

  async function undoCancelJob(logId: string) {
    setClientActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: log } = await supabase.from("zz_mod_log").select("target_id,prev_state").eq("id", logId).single();
    if (log) {
      const prevStatus = (log.prev_state as { status: string }).status ?? "active";
      await supabase.from("zz_jobs").update({ status: prevStatus, cancel_reason: null }).eq("id", log.target_id);
      await supabase.from("zz_mod_log").update({ undone_at: new Date().toISOString(), undone_by: user?.id ?? null }).eq("id", logId);
      setJobs(prev => prev.map(j => j.id === log.target_id ? { ...j, status: prevStatus as Job["status"] } : j));
      setClientActionMsg("Cancellation undone.");
      setLastCancelLogId(null);
    }
    setClientActionLoading(false);
  }

  // ── Job detail ────────────────────────────────────────────────────
  async function openJobDetail(id: string) {
    setSelectedJobId(id);
    setJobDetail(null);
    setNoteBody("");
    setShowRoadblock(false);
    setJobDetailLoading(true);
    const { data, error: detailErr } = await supabase.from("zz_jobs").select(`
      id, title, status, address_line_1, address_line_2,
      town_city, county, postcode, created_at, updated_at, current_phase_id,
      client:zz_clients(id, full_name, email, phone),
      notes:zz_job_notes(id, created_at, body, is_client_visible, author:zz_profiles(full_name)),
      files:zz_files(id, filename, storage_path, storage_bucket, is_client_visible, created_at)
    `).eq("id", id)
      .order("created_at", { referencedTable: "zz_job_notes", ascending: true })
      .order("created_at", { referencedTable: "zz_files", ascending: false })
      .single();
    if (!detailErr && data) {
      const raw = data as Record<string, unknown>;
      setJobDetail({
        ...raw,
        client: Array.isArray(raw.client) ? (raw.client[0] ?? null) : raw.client,
        notes: (raw.notes as JobDetail["notes"]) ?? [],
        files: (raw.files as JobDetail["files"]) ?? [],
      } as JobDetail);
    }
    setJobDetailLoading(false);
  }

  async function changePhase(phaseId: string, jobId?: string) {
    const targetId = jobId ?? selectedJobId;
    if (!targetId) return;
    const newPhase = phases.find(p => p.id === phaseId);
    const newPhaseName = newPhase?.name ?? "";
    const lastPhase = [...phases].sort((a, b) => b.position - a.position)[0];
    const isCompleting = lastPhase?.id === phaseId || newPhaseName === "Completed";
    const update: Record<string, string> = { current_phase_id: phaseId, updated_at: new Date().toISOString() };
    if (isCompleting) update.status = "history";
    const { error } = await supabase.from("zz_jobs").update(update).eq("id", targetId);
    if (error) { console.error("changePhase error:", error); return; }
    setJobDetail(prev => prev ? { ...prev, current_phase_id: phaseId } : prev);
    setJobs(prev => prev.map(j => j.id === targetId
      ? { ...j, current_phase: [{ name: newPhaseName }], status: isCompleting ? "history" : j.status } : j));
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim() || !selectedJobId) return;
    setNoteSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: note } = await supabase.from("zz_job_notes")
      .insert({ job_id: selectedJobId, body: noteBody.trim(), is_client_visible: noteVisible, author_user_id: user?.id ?? null })
      .select("id, created_at, body, is_client_visible").single();
    if (note) {
      setJobDetail(prev => prev ? { ...prev, notes: [...prev.notes, { ...note, author: profile ? { full_name: profile.full_name } : null }] } : prev);
      setNoteBody(""); setNoteVisible(false);
    }
    setNoteSaving(false);
  }

  async function saveRoadblock(e: React.FormEvent) {
    e.preventDefault();
    if (!roadblockText.trim() || !selectedJobId) return;
    setNoteSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const body = `⚠️ Roadblock: ${roadblockText.trim()}`;
    const { data: note } = await supabase.from("zz_job_notes")
      .insert({ job_id: selectedJobId, body, is_client_visible: true, author_user_id: user?.id ?? null })
      .select("id, created_at, body, is_client_visible").single();
    if (note) {
      setJobDetail(prev => prev ? { ...prev, notes: [...prev.notes, { ...note, author: profile ? { full_name: profile.full_name } : null }] } : prev);
      setRoadblockText(""); setShowRoadblock(false);
    }
    setNoteSaving(false);
  }

  
  // ── New job ───────────────────────────────────────────────────────
  function openNewJob() {
    setNj({ clientName: "", clientEmail: "", clientPhone: "", title: "", description: "", addressLine1: "", addressLine2: "", townCity: "", county: "", postcode: "", phaseId: phases[0]?.id ?? "" });
    setNjClientMode("new"); setNjExistingSearch(""); setNjExistingId("");
    setNewJobError(""); setNewJobDone(null); setShowNewJob(true);
  }

  async function saveNewJob(e: React.FormEvent) {
    e.preventDefault();
    setNewJobError(""); setNewJobSaving(true);
    try {
      const body: Record<string, unknown> = {
        jobTitle: nj.title.trim(),
        jobDescription: nj.description.trim() || null,
        addressLine1: nj.addressLine1.trim(),
        addressLine2: nj.addressLine2.trim() || null,
        townCity: nj.townCity.trim(),
        county: nj.county.trim() || null,
        postcode: nj.postcode.trim(),
        phaseId: nj.phaseId || null,
        sendInvite: true,
      };
      if (njClientMode === "existing" && njExistingId) {
        body.existingClientId = njExistingId;
      } else {
        body.clientName = nj.clientName.trim();
        body.clientEmail = nj.clientEmail.trim();
        body.clientPhone = nj.clientPhone.trim() || null;
      }
      const res = await fetch("/api/create-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create job");
      setNewJobDone({ clientEmail: njClientMode === "existing" ? (clients.find(c => c.id === njExistingId)?.email ?? "") : nj.clientEmail.trim() });
      await loadData();
    } catch (err: unknown) {
      setNewJobError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setNewJobSaving(false);
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setAuthError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (err) { setAuthError(err.message); return; }
    loadData();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAuthed(false); setJobs([]); setPhases([]); setProfile(null);
  }

  // ── Render: loading / login ───────────────────────────────────────
  if (authLoading) return <div className={s.loadingRoot}><div className={s.loadingSpinner} /></div>;

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
              <div className={s.loginSub}>Staff &amp; Admin portal</div>
            </div>
          </div>
          <form className={s.loginForm} onSubmit={signIn}>
            <input className={s.loginInput} type="email" placeholder="Email" value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)} autoComplete="email" required />
            <input className={s.loginInput} type="password" placeholder="Password" value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" required />
            {authError && <div className={s.loginError}>{authError}</div>}
            <button type="submit" className={s.btnPrimary}>Sign in</button>
          </form>
          <Link href="/" className={s.loginBack}>← Back to website</Link>
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter(j => j.status === "active");
  const completedJobs = jobs.filter(j => j.status === "history");
  const cancelledJobs = jobs.filter(j => j.status === "cancelled");
  const filteredJobs = jobStatusFilter ? jobs.filter(j => j.status === jobStatusFilter) : jobs;
  const newLeadsCount = leads.filter(l => l.status === "new").length;

  const NAV_ITEMS = [
    { key: "jobs" as const, icon: "◫", label: "Jobs" },
    { key: "clients" as const, icon: "◎", label: "Clients" },
    { key: "leads" as const, icon: "✉", label: "Leads", badge: newLeadsCount > 0 ? newLeadsCount : null },
    { key: "photos" as const, icon: "📷", label: "Photos" },
    { key: "account" as const, icon: "◉", label: "Account" },
  ];

  const activeNav = NAV_ITEMS.find(n => n.key === activeTab);

  return (
    <div className={s.root}>

      {/* ── Floating Sidebar ── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarTop}>
          <div className={s.brand}>
            <div className={s.brandLogo}>
              <Image src="/logomaybe.png" alt="Collins" width={34} height={34} style={{ objectFit: "cover" }} />
            </div>
            <div>
              <div className={s.brandName}>Collins</div>
              <div className={s.brandRole}>Admin</div>
            </div>
          </div>
          <nav className={s.nav}>
            <button className={`${s.navItem} ${activeTab === "jobs" ? s.navActive : ""}`} onClick={() => setActiveTab("jobs")}>
              <span className={s.navIcon}>◫</span> Jobs
            </button>
            <button className={`${s.navItem} ${activeTab === "clients" ? s.navActive : ""}`}
              onClick={() => { setActiveTab("clients"); loadClients(); }}>
              <span className={s.navIcon}>◎</span> Clients
            </button>
            <button className={`${s.navItem} ${activeTab === "leads" ? s.navActive : ""}`}
              onClick={() => { setActiveTab("leads"); loadLeads(); }}>
              <span className={s.navIcon}>✉</span> Leads
              {newLeadsCount > 0 && <span className={s.navBadge}>{newLeadsCount}</span>}
            </button>
            <button className={`${s.navItem} ${activeTab === "photos" ? s.navActive : ""}`} onClick={() => { setActiveTab("photos"); loadPhotos(); }}>
              <span className={s.navIcon}>📷</span> Photos
            </button>
            <button className={`${s.navItem} ${activeTab === "account" ? s.navActive : ""}`} onClick={() => setActiveTab("account")}>
              <span className={s.navIcon}>◉</span> Account
            </button>
          </nav>
        </div>
        <div className={s.sidebarBottom}>
          <div className={s.userRow}>
            <div className={s.avatar}>{(profile?.full_name?.[0] ?? "A").toUpperCase()}</div>
            <div>
              <div className={s.userName}>{profile?.full_name ?? "Staff"}</div>
              <div className={s.userRole}>{profile?.role ?? ""}</div>
            </div>
          </div>
          <button className={s.signOutBtn} onClick={signOut}>Sign out</button>
          <Link href="/" className={s.backLink}>← Back to site</Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={s.main}>

        {/* ── Mobile: back to site + pill nav ── */}
        <Link href="/" className={s.mobileBackLink}>← Site</Link>
        <MobilePillNav
          items={NAV_ITEMS}
          activeKey={activeTab}
          onSelect={(key) => {
            setActiveTab(key as "jobs" | "clients" | "leads" | "photos" | "account");
            if (key === "clients") loadClients();
            if (key === "leads") loadLeads();
            if (key === "photos") loadPhotos();
          }}
          styles={s}
        />

        {/* ── Jobs tab ── */}
        {activeTab === "jobs" && (
          <>
            <div className={s.pageHeader}>
              <div>
                <h1 className={s.pageTitle}>Jobs</h1>
                <p className={s.pageSub}>{loading ? "Loading…" : `${activeJobs.length} active`}</p>
              </div>
              <div className={s.pageActions}>
                <div className={s.viewToggle}>
                  <button className={`${s.toggleBtn} ${view === "pipeline" ? s.toggleActive : ""}`} onClick={() => setView("pipeline")}>Pipeline</button>
                  <button className={`${s.toggleBtn} ${view === "list" ? s.toggleActive : ""}`} onClick={() => setView("list")}>List</button>
                </div>
                <button className={s.btnPrimary} onClick={openNewJob}>+ New job</button>
              </div>
            </div>

            <div className={s.stats}>
              <div className={`${s.stat} ${s.statClickable} ${jobStatusFilter === "active" ? s.statActive : ""}`}
                onClick={() => setJobStatusFilter(jobStatusFilter === "active" ? "" : "active")}>
                <div className={s.statVal}>{loading ? "—" : activeJobs.length}</div>
                <div className={s.statLabel}>Active</div>
              </div>
              <div className={`${s.stat} ${s.statClickable} ${jobStatusFilter === "history" ? s.statActive : ""}`}
                onClick={() => setJobStatusFilter(jobStatusFilter === "history" ? "" : "history")}>
                <div className={s.statVal}>{loading ? "—" : completedJobs.length}</div>
                <div className={s.statLabel}>Completed</div>
              </div>
              <div className={s.stat}>
                <div className={s.statVal}>{loading ? "—" : phases.length}</div>
                <div className={s.statLabel}>Phases</div>
              </div>
              <div className={`${s.stat} ${s.statClickable} ${activeTab !== "jobs" ? "" : ""}`}
                onClick={() => { setActiveTab("leads"); loadLeads(); }}>
                <div className={s.statVal}>{loading ? "—" : newLeadsCount}</div>
                <div className={s.statLabel}>New leads</div>
              </div>
            </div>

            {loading && <div className={s.loadingRow}>Loading…</div>}
            {error && <div className={s.errorRow}>{error}</div>}

            {!loading && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input className={s.drawerInput} style={{ maxWidth: 240 }} placeholder="Search client or job…"
                  value={phaseFilterSearch} onChange={e => setPhaseFilterSearch(e.target.value)} />
                {phaseFilterSearch && <button className={s.btnGhost} style={{ fontSize: 12 }} onClick={() => setPhaseFilterSearch("")}>Clear</button>}
              </div>
            )}

            {view === "pipeline" && !loading && (
              <div>
                {/* Horizontal dot-line phase track */}
                <div className={s.phaseTrackRow}>
                  {phases.map((phase, i) => {
                    const count = jobs.filter(j => jobPhaseName(j) === phase.name).length;
                    const colour = PHASE_COLOURS[i % PHASE_COLOURS.length] ?? "#6b7280";
                    const isActive = phaseFilterPhase === phase.name;
                    return (
                      <div key={phase.id} className={s.phaseTrackStep}>
                        <div className={s.phaseTrackStepInner}>
                          <div
                            className={`${s.phaseTrackStepDot} ${isActive ? s.phaseTrackStepDotActive : ""}`}
                            style={{ background: isActive ? colour : undefined, borderColor: colour }}
                            onClick={() => setPhaseFilterPhase(isActive ? "" : phase.name)}
                            title={`${phase.name} · ${count} job${count !== 1 ? "s" : ""}`}
                          />
                          {i < phases.length - 1 && <div className={s.phaseTrackStepLine} style={{ background: `${colour}33` }} />}
                        </div>
                        <div className={`${s.phaseTrackStepLabel} ${isActive ? s.phaseTrackStepLabelActive : ""}`}
                          onClick={() => setPhaseFilterPhase(isActive ? "" : phase.name)}>
                          <span>{phase.name}</span>
                          <span className={s.phaseTrackStepCount}>{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Jobs list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {filteredJobs
                    .filter(j => {
                      const matchPhase = !phaseFilterPhase || jobPhaseName(j) === phaseFilterPhase;
                      const q = phaseFilterSearch.toLowerCase();
                      const matchSearch = !q || j.title.toLowerCase().includes(q) || jobClientName(j).toLowerCase().includes(q);
                      return matchPhase && matchSearch;
                    })
                    .map(job => {
                      const phaseName = jobPhaseName(job);
                      const isExpanded = expandedJobs.has(job.id);
                      return (
                        <div key={job.id} className={s.phaseJobRow}>
                          <div className={s.phaseJobHeader} onClick={() => toggleJobExpansion(job.id)}>
                            <span className={s.phaseJobName}>{jobClientName(job)}</span>
                            <span className={s.phaseJobSep}>·</span>
                            <span className={s.phaseJobMeta}>{job.town_city}</span>
                            <span className={s.phaseJobSep}>·</span>
                            <span className={s.phaseJobMeta}>{relativeTime(job.updated_at)}</span>
                            <span className={s.phaseJobChevron}>{isExpanded ? "▾" : "▸"}</span>
                          </div>
                          {isExpanded && (
                            <JobExpandedDetail
                              job={job}
                              phases={phases}
                              supabase={supabase}
                              onPhaseChange={changePhase}
                              photoUploading={photoUploading}
                              onUploadFile={uploadPhoto}
                              blockedUpload={blockedUpload}
                              setBlockedUpload={setBlockedUpload}
                              photos={photos}
                              onJobUpdate={(jobId, updates) => setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j))}
                            />
                          )}
                        </div>
                      );
                    })}
                  {activeJobs.filter(j => !phaseFilterPhase || jobPhaseName(j) === phaseFilterPhase).length === 0 &&
                    <div className={s.tableEmpty}>No jobs in this phase.</div>}
                </div>
              </div>
            )}

            {view === "list" && !loading && (
              <div className={s.table}>
                <div className={s.tableHead}><div>Job</div><div>Client</div><div>Location</div><div>Phase</div><div>Updated</div><div /></div>
                {filteredJobs.length === 0 && <div className={s.tableEmpty}>No jobs in this filter.</div>}
                {filteredJobs.map(job => {
                  const phaseName = jobPhaseName(job);
                  const phaseIdx = phases.findIndex(p => p.name === phaseName);
                  const colour = PHASE_COLOURS[phaseIdx >= 0 ? phaseIdx % PHASE_COLOURS.length : 0] ?? "#6b7280";
                  return (
                    <div key={job.id} className={s.tableRow}>
                      <div className={s.tableJobTitle}>{job.title}</div>
                      <div className={s.tableCell}>{jobClientName(job)}</div>
                      <div className={s.tableCell}>{job.town_city} {job.postcode}</div>
                      <div className={s.tableCell}>
                        {phaseName ? <span className={s.phaseBadge} style={{ color: colour, borderColor: `${colour}44` }}>{phaseName}</span> : <span className={s.tableNone}>—</span>}
                      </div>
                      <div className={s.tableMeta}>{relativeTime(job.updated_at)}</div>
                      <div><button className={s.btnSmall} disabled>Open →</button></div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Clients tab ── */}
        {activeTab === "clients" && (
          <>
            <div className={s.pageHeader}>
              <div>
                <h1 className={s.pageTitle}>Clients</h1>
                <p className={s.pageSub}>{clientsLoading ? "Loading…" : `${clients.length} client record${clients.length !== 1 ? "s" : ""}`}</p>
              </div>
            </div>
            {clientsLoading && <div className={s.loadingRow}>Loading…</div>}
            {!clientsLoading && clients.length === 0 && <div className={s.tableEmpty}>No clients yet.</div>}
            {!clientsLoading && clients.length > 0 && (
              <div className={s.table}>
                {clients.map(c => {
                  const isOpen = selectedClientId === c.id;
                  const clientJobs = jobs.filter(j => j.client_id === c.id && j.status === "active");
                  return (
                    <div key={c.id} className={s.leadRow}>
                      {/* Summary row */}
                      <div className={s.leadSummary} onClick={() => openClientPanel(c.id)}>
                        <span className={s.leadName}>{c.full_name}</span>
                        <span className={s.leadEmail}>{c.email}</span>
                        <span className={s.leadTime}>{c.phone ?? "—"}</span>
                        <span className={s.leadTime}>{relativeTime(c.created_at)}</span>
                        {c.user_id
                          ? <span style={{ color: "#34d399", fontSize: 10, fontWeight: 700, minWidth: 44 }}>Active</span>
                          : <span style={{ color: "rgba(232,236,248,0.25)", fontSize: 10, minWidth: 44 }}>No login</span>}
                        <span className={`${s.leadChevron} ${isOpen ? s.leadChevronOpen : ""}`}>›</span>
                      </div>

                      {/* Expanded action panel */}
                      {isOpen && (
                        <div className={s.leadDetail}>
                          {clientActionMsg && <div className={s.magicLinkBox}>{clientActionMsg}</div>}

                          {/* Active jobs for this client */}
                          {clientJobs.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,236,248,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                                Active jobs · {clientJobs.length}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {clientJobs.map(j => (
                                  <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 5, background: "rgba(255,255,255,0.03)" }}>
                                    <span style={{ fontSize: 12, color: "#e8ecf8", flex: 1 }}>{j.title}</span>
                                    <span style={{ fontSize: 10, color: "rgba(232,236,248,0.35)" }}>{j.town_city}</span>
                                    <span style={{ fontSize: 10, color: "#7fa5ff", background: "rgba(127,165,255,0.08)", borderRadius: 3, padding: "1px 5px" }}>{jobPhaseName(j) ?? "—"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {clientJobs.length === 0 && (
                            <div style={{ fontSize: 11, color: "rgba(232,236,248,0.25)", marginBottom: 10 }}>No active jobs.</div>
                          )}

                          {/* Quick action buttons */}
                          <div className={s.leadActions}>
                            {!c.user_id && (
                              <button className={s.btnSuccess} disabled={clientActionLoading}
                                onClick={() => assignProfile(c.id, c.email, c.full_name)}>
                                {clientActionLoading ? "…" : "Assign portal access"}
                              </button>
                            )}
                            {c.user_id && (
                              <button className={s.btnSmall} disabled={clientActionLoading}
                                onClick={() => sendMagicLink(c.email)}>
                                {clientActionLoading ? "…" : "Send password reset link"}
                              </button>
                            )}
                            {c.phone && (
                              <a href={`tel:${c.phone}`} className={s.btnSmall} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                                📞 Call {c.phone}
                              </a>
                            )}
                            <button className={s.btnSmall}
                              onClick={() => {
                                const opening = clientActionPanel !== "message";
                                setClientActionPanel(opening ? "message" : "none");
                                if (opening) loadMessages(c.id);
                              }}>
                              💬 Message
                            </button>
                            <button className={s.btnSmall}
                              onClick={() => setClientActionPanel(clientActionPanel === "email" ? "none" : "email")}>
                              ✉ Email
                            </button>
                            {clientJobs.length > 0 && (
                              <button className={s.btnDanger}
                                onClick={() => { setClientActionPanel("cancel"); setCancelJobId(null); setCancelReason(""); }}>
                                Cancel job
                              </button>
                            )}
                            <button className={s.btnSmall}
                              onClick={() => {
                                setClientActionPanel(clientActionPanel === "edit" ? "none" : "edit");
                                setEditClientForm({ full_name: c.full_name ?? "", email: c.email ?? "", phone: c.phone ?? "" });
                              }}>
                              ✏ Edit
                            </button>
                            <button className={s.btnDanger} disabled={clientActionLoading}
                              onClick={() => deleteClientFull(c.id)}>
                              🗑 Delete client
                            </button>
                          </div>

                          {/* Edit panel */}
                          {clientActionPanel === "edit" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <input className={s.drawerInput} placeholder="Full name" value={editClientForm.full_name}
                                  onChange={e => setEditClientForm(p => ({ ...p, full_name: e.target.value }))} />
                                <input className={s.drawerInput} type="email" placeholder="Email" value={editClientForm.email}
                                  onChange={e => setEditClientForm(p => ({ ...p, email: e.target.value }))} />
                                <input className={s.drawerInput} type="tel" placeholder="Phone" value={editClientForm.phone}
                                  onChange={e => setEditClientForm(p => ({ ...p, phone: e.target.value }))} />
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className={s.btnPrimary} disabled={clientActionLoading || !editClientForm.full_name.trim()}
                                  onClick={() => updateClient(c.id)}>
                                  {clientActionLoading ? "Saving…" : "Save changes"}
                                </button>
                                <button className={s.btnGhost} onClick={() => setClientActionPanel("none")}>Cancel</button>
                              </div>
                            </div>
                          )}

                          {/* Chat panel */}
                          {clientActionPanel === "message" && (
                            <div className={s.chatWindow}>
                              <div className={s.chatMessages}>
                                {chatLoading && <div className={s.chatEmpty}>Loading messages…</div>}
                                {!chatLoading && chatMessages.length === 0 && (
                                  <div className={s.chatEmpty}>No messages yet. Start the conversation.</div>
                                )}
                                {chatMessages.map(msg => {
                                  const isAdmin = msg.direction === "admin_to_client";
                                  return (
                                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start" }}>
                                      <div className={`${s.chatBubble} ${isAdmin ? s.chatBubbleAdmin : s.chatBubbleClient}`}>
                                        {msg.body}
                                      </div>
                                      <div className={`${s.chatBubbleMeta} ${isAdmin ? s.chatBubbleMetaAdmin : ""}`}>
                                        {isAdmin ? "You" : c.full_name} · {relativeTime(msg.created_at)}
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
                                  value={messageText}
                                  onChange={e => setMessageText(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendClientMessage(c.id); } }}
                                  rows={1}
                                />
                                <button
                                  className={s.chatSendBtn}
                                  disabled={clientActionLoading || !messageText.trim()}
                                  onClick={() => sendClientMessage(c.id)}
                                >↑</button>
                              </div>
                            </div>
                          )}

                          {/* Email panel */}
                          {clientActionPanel === "email" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <input className={s.drawerInput} placeholder="Subject" value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)} />
                              <textarea className={s.drawerInput} rows={4} placeholder="Email body…"
                                value={emailBody} onChange={e => setEmailBody(e.target.value)} style={{ resize: "vertical" }} />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className={s.btnPrimary} disabled={clientActionLoading || !emailSubject.trim() || !emailBody.trim()}
                                  onClick={() => sendClientEmail(c.email, c.full_name ?? "")}>Send email</button>
                                <button className={s.btnGhost} onClick={() => setClientActionPanel("none")}>Cancel</button>
                              </div>
                            </div>
                          )}

                          {/* Cancel job panel */}
                          {clientActionPanel === "cancel" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ fontSize: 12, color: "rgba(232,236,248,0.5)" }}>
                                Select a job and provide a reason for cancellation.
                              </div>
                              {clientJobs.map(j => (
                                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <input type="radio" name="cancelJob" value={j.id}
                                    checked={cancelJobId === j.id}
                                    onChange={() => setCancelJobId(j.id)} />
                                  <span style={{ fontSize: 12, color: "#e8ecf8" }}>{j.title}</span>
                                  <span style={{ fontSize: 11, color: "rgba(232,236,248,0.35)" }}>{jobPhaseName(j) ?? "—"}</span>
                                </div>
                              ))}
                              <textarea className={s.drawerInput} rows={2}
                                placeholder="Reason for cancellation (required)…"
                                value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                                style={{ resize: "vertical" }} />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className={s.btnDanger}
                                  disabled={clientActionLoading || !cancelJobId || !cancelReason.trim()}
                                  onClick={() => cancelJobId && cancelJob(cancelJobId, cancelReason)}>
                                  {clientActionLoading ? "Cancelling…" : "Cancel job"}
                                </button>
                                <button className={s.btnGhost} onClick={() => setClientActionPanel("none")}>Back</button>
                              </div>
                            </div>
                          )}
                          {/* Undo last cancel */}
                          {lastCancelLogId && clientActionPanel === "none" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                              <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)" }}>Job cancelled.</span>
                              <button className={s.btnSmall} disabled={clientActionLoading}
                                onClick={() => undoCancelJob(lastCancelLogId)}>
                                ↩ Undo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Leads tab ── */}
        {activeTab === "leads" && (
          <>
            <div className={s.pageHeader}>
              <div>
                <h1 className={s.pageTitle}>Leads</h1>
                <p className={s.pageSub}>{leadsLoading ? "Decrypting…" : `${leads.length} enquir${leads.length === 1 ? "y" : "ies"}`}</p>
              </div>
              <button className={s.btnGhost} onClick={loadLeads}>Refresh</button>
            </div>
            {leadsLoading && <div className={s.loadingRow}>Decrypting…</div>}
            {!leadsLoading && leads.length === 0 && <div className={s.tableEmpty}>No leads yet.</div>}
            {!leadsLoading && leads.length > 0 && (
              <div className={s.table}>
                {leads.map(lead => {
                  const isExpanded = expandedLead === lead.id;
                  const badgeCls = lead.status === "new" ? s.leadStatusNew
                    : lead.status === "contacted" ? s.leadStatusContacted
                    : lead.status === "converted" ? s.leadStatusConverted
                    : s.leadStatusDismissed;
                  return (
                    <div key={lead.id} className={s.leadRow}>
                      <div className={s.leadSummary} onClick={() => setExpandedLead(isExpanded ? null : lead.id)}>
                        <span className={s.leadName}>{lead.full_name}</span>
                        <span className={s.leadEmail}>{lead.email ?? "—"}</span>
                        <span className={s.leadTime}>{relativeTime(lead.created_at)}</span>
                        <span className={`${s.leadStatusBadge} ${badgeCls}`}>{lead.status}</span>
                        <span className={`${s.leadChevron} ${isExpanded ? s.leadChevronOpen : ""}`}>›</span>
                      </div>
                      {isExpanded && (
                        <div className={s.leadDetail}>
                          {lead.phone && <div style={{ fontSize: 12, color: "rgba(232,236,248,0.5)" }}>📞 {lead.phone}</div>}
                          {lead.message && <div className={s.leadMessage}>{lead.message}</div>}
                          {lead.status !== "converted" && lead.status !== "dismissed" && (
                            <div className={s.leadActions}>
                              <button className={s.btnSmall} onClick={() => markLeadContacted(lead.id)}>Contacted</button>
                              {lead.email && (
                                <button className={s.btnSuccess} onClick={() => openConvertLead(lead)}>
                                  Convert → Create client
                                </button>
                              )}
                              <button className={s.btnDanger} onClick={() => dismissLead(lead.id)}>Dismiss</button>
                            </div>
                          )}
                          {lead.status === "converted" && (
                            <div className={s.magicLinkBox}>Client record created. Magic link sent to {lead.email}.</div>
                          )}
                          {lead.status === "dismissed" && (
                            <div style={{ fontSize: 12, color: "rgba(232,236,248,0.3)" }}>Dismissed — will be deleted after 24 hours.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Photos tab ── */}
        {activeTab === "photos" && (
          <>
            <div className={s.pageHeader}>
              <div>
                <h1 className={s.pageTitle}>Files & Photos</h1>
                <p className={s.pageSub}>{photos.length} file{photos.length !== 1 ? "s" : ""} across all jobs</p>
              </div>
              <button className={s.btnGhost} onClick={loadPhotos}>Refresh</button>
            </div>

            {/* Per-job sections */}
            {(() => {
              const jobIds = Array.from(new Set(photos.map(p => p.job_id)));
              const jobsWithFiles = jobIds.map(jid => {
                const jobMeta = jobs.find(j => j.id === jid);
                const files = photos.filter(p => p.job_id === jid);
                return { jid, jobMeta, files };
              });
              if (jobsWithFiles.length === 0) return <div className={s.tableEmpty}>No files yet.</div>;
              return jobsWithFiles.map(({ jid, jobMeta, files }) => {
                const byType: Record<string, typeof files> = { quote: [], invoice: [], photo: [], other: [] };
                files.forEach(f => { const t = f.file_type ?? "other"; const bucket = byType[t] ?? byType.other; bucket?.push(f); });
                const typeLabel: Record<string, string> = { quote: "Quotes", invoice: "Invoices", photo: "Photos", other: "Other" };
                const typeColour: Record<string, string> = { quote: "#fbbf24", invoice: "#34d399", photo: "#7fa5ff", other: "#9ca3af" };
                return (
                  <div key={jid} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e8ecf8", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      {jobMeta?.title ?? "Unknown job"}
                      <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)", fontWeight: 400 }}>
                        · {jobMeta?.client?.[0]?.full_name}
                      </span>
                    </div>
                    {(["quote", "invoice", "photo", "other"] as const).map(type => {
                      const typedFiles = byType[type] ?? [];
                      if (typedFiles.length === 0) return null;
                      return (
                        <div key={type} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: typeColour[type], letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                            {typeLabel[type]}
                          </div>
                          <div className={s.photoGrid}>
                            {typedFiles.map(photo => {
                              const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${photo.storage_bucket}/${photo.storage_path}`;
                              const isImage = photo.mime_type?.startsWith("image/");
                              return (
                                <a key={photo.id} href={url} target="_blank" rel="noopener noreferrer" className={s.photoCard} style={{ textDecoration: "none" }}>
                                  {isImage
                                    ? <img src={url} alt={photo.filename} className={s.photoImg} />
                                    : <div className={s.photoImg} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "rgba(255,255,255,0.03)" }}>
                                        {type === "quote" ? "📄" : type === "invoice" ? "🧾" : "📎"}
                                      </div>
                                  }
                                  <div className={s.photoInfo}>
                                    <div className={s.photoFilename}>{photo.filename}</div>
                                    <div style={{ fontSize: 10, color: typeColour[type], fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{typeLabel[type]}</div>
                                    <div className={s.photoDate}>{relativeTime(photo.created_at)}</div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", marginTop: 8 }} />
                  </div>
                );
              });
            })()}
          </>
        )}

        {/* ── Account tab ── */}
        {activeTab === "account" && (
          <>
            <div className={s.pageHeader}>
              <div>
                <h1 className={s.pageTitle}>Accounts</h1>
                <p className={s.pageSub}>All staff &amp; client accounts</p>
              </div>
            </div>
            <AccountsPanel supabase={supabase} currentProfile={profile} onSignOut={signOut} />
          </>
        )}

      </main>

      {/* ── New Job drawer ── */}
      {showNewJob && (
        <div className={s.overlay} onClick={() => setShowNewJob(false)}>
          <div className={s.drawer} onClick={e => e.stopPropagation()}>
            <div className={s.drawerHeader}>
              <div className={s.drawerTitle}>New Job</div>
              <button className={s.drawerClose} onClick={() => setShowNewJob(false)}>✕</button>
            </div>
            {newJobDone ? (
              <div className={s.drawerForm}>
                <div className={s.magicLinkBox}>
                  Job created. A magic link has been sent to <strong>{newJobDone.clientEmail}</strong> — they can use it to access the client portal.
                </div>
                <div className={s.drawerActions}>
                  <button className={s.btnPrimary} onClick={() => setShowNewJob(false)}>Done</button>
                </div>
              </div>
            ) : (
              <form className={s.drawerForm} onSubmit={saveNewJob}>
                {/* Client section */}
                <div className={s.drawerSection} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span>Client</span>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    <button type="button"
                      className={njClientMode === "new" ? s.btnPrimary : s.btnGhost}
                      style={{ fontSize: 11, padding: "2px 10px" }}
                      onClick={() => setNjClientMode("new")}>New client</button>
                    <button type="button"
                      className={njClientMode === "existing" ? s.btnPrimary : s.btnGhost}
                      style={{ fontSize: 11, padding: "2px 10px" }}
                      onClick={() => { setNjClientMode("existing"); if (!clients.length) loadClients(); }}>Existing client</button>
                  </div>
                </div>

                {njClientMode === "new" && (
                  <>
                    <div className={s.drawerGrid2}>
                      <div className={s.drawerField}>
                        <label className={s.drawerLabel}>Full name *</label>
                        <input className={s.drawerInput} required={njClientMode === "new"} value={nj.clientName} onChange={e => setNj(p => ({ ...p, clientName: e.target.value }))} />
                      </div>
                      <div className={s.drawerField}>
                        <label className={s.drawerLabel}>Email *</label>
                        <input className={s.drawerInput} type="email" required={njClientMode === "new"} value={nj.clientEmail} onChange={e => setNj(p => ({ ...p, clientEmail: e.target.value }))} />
                      </div>
                    </div>
                    <div className={s.drawerField}>
                      <label className={s.drawerLabel}>Phone</label>
                      <input className={s.drawerInput} type="tel" value={nj.clientPhone} onChange={e => setNj(p => ({ ...p, clientPhone: e.target.value }))} />
                    </div>
                  </>
                )}

                {njClientMode === "existing" && (
                  <div className={s.drawerField}>
                    <label className={s.drawerLabel}>Search existing client</label>
                    <input className={s.drawerInput} placeholder="Name or email…"
                      value={njExistingSearch} onChange={e => { setNjExistingSearch(e.target.value); setNjExistingId(""); }} />
                    {njExistingSearch.length > 0 && (
                      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                        {clients
                          .filter(c => c.full_name.toLowerCase().includes(njExistingSearch.toLowerCase()) || c.email.toLowerCase().includes(njExistingSearch.toLowerCase()))
                          .slice(0, 6)
                          .map(c => (
                            <button key={c.id} type="button"
                              style={{ textAlign: "left", padding: "6px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                                background: njExistingId === c.id ? "rgba(127,165,255,0.15)" : "rgba(255,255,255,0.04)",
                                color: njExistingId === c.id ? "#7fa5ff" : "#e8ecf8", fontSize: 12 }}
                              onClick={() => { setNjExistingId(c.id); setNjExistingSearch(c.full_name); }}>
                              {c.full_name} <span style={{ color: "rgba(232,236,248,0.4)", fontSize: 11 }}>{c.email}</span>
                            </button>
                          ))}
                        {clients.filter(c => c.full_name.toLowerCase().includes(njExistingSearch.toLowerCase()) || c.email.toLowerCase().includes(njExistingSearch.toLowerCase())).length === 0 && (
                          <div style={{ fontSize: 11, color: "rgba(232,236,248,0.3)", padding: "4px 0" }}>No clients found</div>
                        )}
                      </div>
                    )}
                    {njExistingId && (
                      <div style={{ fontSize: 11, color: "#34d399", marginTop: 4 }}>✓ Linked to {clients.find(c => c.id === njExistingId)?.full_name}</div>
                    )}
                  </div>
                )}

                <div className={s.drawerSection}>Job</div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Job title *</label>
                  <input className={s.drawerInput} required placeholder="e.g. Conservatory extension" value={nj.title} onChange={e => setNj(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Description</label>
                  <textarea className={s.drawerInput} rows={2} style={{ resize: "vertical" }} placeholder="Brief description of the work…" value={nj.description} onChange={e => setNj(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Starting phase</label>
                  <select className={s.drawerInput} value={nj.phaseId} onChange={e => setNj(p => ({ ...p, phaseId: e.target.value }))}>
                    <option value="">— None —</option>
                    {phases.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                  </select>
                </div>

                <div className={s.drawerSection}>Address</div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Line 1 *</label>
                  <input className={s.drawerInput} required value={nj.addressLine1} onChange={e => setNj(p => ({ ...p, addressLine1: e.target.value }))} />
                </div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Line 2</label>
                  <input className={s.drawerInput} value={nj.addressLine2} onChange={e => setNj(p => ({ ...p, addressLine2: e.target.value }))} />
                </div>
                <div className={s.drawerGrid3}>
                  <div className={s.drawerField}>
                    <label className={s.drawerLabel}>Town / City *</label>
                    <input className={s.drawerInput} required value={nj.townCity} onChange={e => setNj(p => ({ ...p, townCity: e.target.value }))} />
                  </div>
                  <div className={s.drawerField}>
                    <label className={s.drawerLabel}>County</label>
                    <input className={s.drawerInput} value={nj.county} onChange={e => setNj(p => ({ ...p, county: e.target.value }))} />
                  </div>
                  <div className={s.drawerField}>
                    <label className={s.drawerLabel}>Postcode *</label>
                    <input className={s.drawerInput} required value={nj.postcode} onChange={e => setNj(p => ({ ...p, postcode: e.target.value }))} />
                  </div>
                </div>

                {newJobError && <div className={s.drawerError}>{newJobError}</div>}
                <div className={s.drawerActions}>
                  <button type="button" className={s.btnGhost} onClick={() => setShowNewJob(false)} disabled={newJobSaving}>Cancel</button>
                  <button type="submit" className={s.btnPrimary}
                    disabled={newJobSaving || (njClientMode === "existing" && !njExistingId)}>
                    {newJobSaving ? "Creating…" : "Create job + send invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Convert Lead modal ── */}
      {convertLeadData && (
        <div className={s.overlay} onClick={() => setConvertLeadData(null)}>
          <div className={s.drawer} onClick={e => e.stopPropagation()}>
            <div className={s.drawerHeader}>
              <div className={s.drawerTitle}>Convert Lead → Client + Job</div>
              <button className={s.drawerClose} onClick={() => setConvertLeadData(null)}>✕</button>
            </div>
            <form className={s.drawerForm} onSubmit={submitConvertLead}>
              <div className={s.drawerSection}>Client details</div>
              <div className={s.drawerGrid2}>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Full name *</label>
                  <input className={s.drawerInput} required value={clForm.clientName}
                    onChange={e => setClForm(p => ({ ...p, clientName: e.target.value }))} />
                </div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Email *</label>
                  <input className={s.drawerInput} type="email" required value={clForm.clientEmail}
                    onChange={e => setClForm(p => ({ ...p, clientEmail: e.target.value }))} />
                </div>
              </div>
              <div className={s.drawerField}>
                <label className={s.drawerLabel}>Phone</label>
                <input className={s.drawerInput} type="tel" value={clForm.clientPhone}
                  onChange={e => setClForm(p => ({ ...p, clientPhone: e.target.value }))} />
              </div>

              <div className={s.drawerSection}>Job</div>
              <div className={s.drawerField}>
                <label className={s.drawerLabel}>Job title *</label>
                <input className={s.drawerInput} required placeholder="e.g. Conservatory extension"
                  value={clForm.jobTitle} onChange={e => setClForm(p => ({ ...p, jobTitle: e.target.value }))} />
              </div>
              <div className={s.drawerField}>
                <label className={s.drawerLabel}>Description</label>
                <textarea className={s.drawerInput} rows={3} style={{ resize: "vertical" }}
                  placeholder="Description from enquiry…"
                  value={clForm.jobDescription} onChange={e => setClForm(p => ({ ...p, jobDescription: e.target.value }))} />
              </div>
              <div className={s.drawerField}>
                <label className={s.drawerLabel}>Starting phase</label>
                <select className={s.drawerInput} value={clForm.phaseId}
                  onChange={e => setClForm(p => ({ ...p, phaseId: e.target.value }))}>
                  <option value="">— None —</option>
                  {phases.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                </select>
              </div>

              <div className={s.drawerSection}>Address</div>
              <div className={s.drawerField}>
                <label className={s.drawerLabel}>Line 1 *</label>
                <input className={s.drawerInput} required value={clForm.addressLine1}
                  onChange={e => setClForm(p => ({ ...p, addressLine1: e.target.value }))} />
              </div>
              <div className={s.drawerField}>
                <label className={s.drawerLabel}>Line 2</label>
                <input className={s.drawerInput} value={clForm.addressLine2}
                  onChange={e => setClForm(p => ({ ...p, addressLine2: e.target.value }))} />
              </div>
              <div className={s.drawerGrid3}>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Town / City *</label>
                  <input className={s.drawerInput} required value={clForm.townCity}
                    onChange={e => setClForm(p => ({ ...p, townCity: e.target.value }))} />
                </div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>County</label>
                  <input className={s.drawerInput} value={clForm.county}
                    onChange={e => setClForm(p => ({ ...p, county: e.target.value }))} />
                </div>
                <div className={s.drawerField}>
                  <label className={s.drawerLabel}>Postcode *</label>
                  <input className={s.drawerInput} required value={clForm.postcode}
                    onChange={e => setClForm(p => ({ ...p, postcode: e.target.value }))} />
                </div>
              </div>

              {clError && <div className={s.drawerError}>{clError}</div>}
              <div className={s.drawerActions}>
                <button type="button" className={s.btnGhost} onClick={() => setConvertLeadData(null)} disabled={clSaving}>Cancel</button>
                <button type="submit" className={s.btnSuccess} disabled={clSaving}>
                  {clSaving ? "Creating…" : "Create client + job + send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Job detail drawer ── */}
      {selectedJobId && (
        <div className={s.overlay} onClick={() => setSelectedJobId(null)}>
          <div className={s.drawer} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className={s.drawerHeader}>
              <div className={s.drawerTitle}>{jobDetail?.title ?? "Job"}</div>
              <button className={s.drawerClose} onClick={() => setSelectedJobId(null)}>✕</button>
            </div>
            {jobDetailLoading && <div style={{ padding: "24px", color: "rgba(232,236,248,0.3)", fontSize: 12 }}>Loading…</div>}
            {!jobDetailLoading && jobDetail && (
              <div className={s.drawerForm}>

                <div className={s.drawerSection}>Phase</div>
                <div className={s.adminTrack}>
                  {phases.map((phase, i) => {
                    const isCurrent = jobDetail.current_phase_id === phase.id;
                    const isDone = phases.findIndex(p => p.id === jobDetail.current_phase_id) > i;
                    return (
                      <div key={phase.id} className={s.adminTrackItem}>
                        <div
                          className={`${s.adminTrackDot} ${isDone ? s.adminTrackDone : isCurrent ? s.adminTrackActive : ""}`}
                          onClick={() => changePhase(phase.id)}
                          style={{ cursor: "pointer" }}
                          title={`Move to ${phase.name}`}
                        />
                        {i < phases.length - 1 && (
                          <div className={`${s.adminTrackLine} ${isDone ? s.adminTrackLineDone : ""}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className={s.adminTrackLabels}>
                  {phases.map((phase, i) => {
                    const isCurrent = jobDetail.current_phase_id === phase.id;
                    return (
                      <div key={phase.id} className={`${s.adminTrackLabel} ${isCurrent ? s.adminTrackLabelActive : ""}`}>
                        {phase.name}
                      </div>
                    );
                  })}
                </div>

                <div className={s.drawerSection}>Roadblock</div>
                {!showRoadblock ? (
                  <button className={s.btnWarning} style={{ alignSelf: "flex-start" }} onClick={() => setShowRoadblock(true)}>+ Log roadblock</button>
                ) : (
                  <form onSubmit={saveRoadblock} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <select className={s.drawerInput} value={roadblockText} onChange={e => setRoadblockText(e.target.value)}>
                      <option value="">— Select or type below —</option>
                      {ROADBLOCK_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input className={s.drawerInput} placeholder="Or describe the issue…" value={roadblockText} onChange={e => setRoadblockText(e.target.value)} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className={s.btnWarning} disabled={noteSaving || !roadblockText.trim()}>Save roadblock</button>
                      <button type="button" className={s.btnGhost} onClick={() => setShowRoadblock(false)}>Cancel</button>
                    </div>
                  </form>
                )}

                <div className={s.drawerSection}>Client</div>
                {jobDetail.client ? (
                  <div className={s.detailGrid}>
                    <div className={s.detailItem}><span className={s.detailLabel}>Name</span><span className={s.detailVal}>{jobDetail.client.full_name}</span></div>
                    <div className={s.detailItem}><span className={s.detailLabel}>Email</span><span className={s.detailVal}>{jobDetail.client.email}</span></div>
                    {jobDetail.client.phone && <div className={s.detailItem}><span className={s.detailLabel}>Phone</span><span className={s.detailVal}>{jobDetail.client.phone}</span></div>}
                  </div>
                ) : <div className={s.tableNone}>No client linked</div>}

                <div className={s.drawerSection}>Address</div>
                <div className={s.detailVal} style={{ lineHeight: 1.7 }}>
                  {jobDetail.address_line_1}<br />
                  {jobDetail.address_line_2 && <>{jobDetail.address_line_2}<br /></>}
                  {jobDetail.town_city}{jobDetail.county ? `, ${jobDetail.county}` : ""}<br />
                  {jobDetail.postcode}
                </div>

                <div className={s.drawerSection}>Photos</div>
                <div className={s.photoGrid}>
                  {jobDetail.files.map(f => {
                    const { data: urlData } = supabase.storage.from(f.storage_bucket).getPublicUrl(f.storage_path);
                    return (
                      <div key={f.id} className={s.photoThumb}>
                        <img src={urlData.publicUrl} alt={f.filename} />
                      </div>
                    );
                  })}
                  <div className={s.photoUploadBox} onClick={() => photoInputRef.current?.click()}>
                    {photoUploading ? <span className={s.loadingRow}>…</span> : <>
                      <span style={{ fontSize: 20, color: "rgba(232,236,248,0.25)" }}>+</span>
                      <span className={s.photoUploadLabel}>Add photo</span>
                    </>}
                  </div>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />

                <div className={s.drawerSection}>Notes &amp; Activity</div>
                <div className={s.notesFeed}>
                  {jobDetail.notes.length === 0 && <div className={s.notesEmpty}>No notes yet.</div>}
                  {jobDetail.notes.map(note => (
                    <div key={note.id} className={s.noteItem}>
                      <div className={s.noteMeta}>
                        <span className={s.noteAuthor}>{note.author?.full_name ?? "Staff"}</span>
                        <span className={s.noteTime}>{relativeTime(note.created_at)}</span>
                        {note.is_client_visible && <span className={s.noteVisibleBadge}>Client visible</span>}
                      </div>
                      <div className={s.noteBody}>{note.body}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={saveNote} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea className={s.drawerInput} rows={3} placeholder="Add a note…" value={noteBody}
                    onChange={e => setNoteBody(e.target.value)} style={{ resize: "vertical" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(232,236,248,0.4)", cursor: "pointer" }}>
                      <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} />
                      Visible to client
                    </label>
                    <button type="submit" className={s.btnPrimary} disabled={noteSaving || !noteBody.trim()}>
                      {noteSaving ? "Saving…" : "Add note"}
                    </button>
                  </div>
                </form>

                <div className={s.drawerSection}>Info</div>
                <div className={s.detailGrid}>
                  <div className={s.detailItem}><span className={s.detailLabel}>Status</span><span className={s.detailVal} style={{ textTransform: "capitalize" }}>{jobDetail.status}</span></div>
                  <div className={s.detailItem}><span className={s.detailLabel}>Created</span><span className={s.detailVal}>{new Date(jobDetail.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                  <div className={s.detailItem}><span className={s.detailLabel}>Updated</span><span className={s.detailVal}>{relativeTime(jobDetail.updated_at)}</span></div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Floating phase filter pill (mobile, jobs pipeline tab only) ── */}
      {activeTab === "jobs" && view === "pipeline" && phases.length > 0 && (
        <PhaseFloatPill
          phases={phases}
          jobs={jobs}
          phaseFilterPhase={phaseFilterPhase}
          setPhaseFilterPhase={setPhaseFilterPhase}
          styles={s}
        />
      )}

    </div>
  );
}
