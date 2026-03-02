"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "../../../lib/supabase";
import { generateBrandedPDF } from "./generatePDF";

type Phase = { id: string; name: string; position: number };
type Job = { id: string; title: string; address_line_1: string; town_city: string; postcode: string; current_phase: unknown; client: unknown };

type Note = { id: string; created_at: string; body: string; is_client_visible: boolean };
type QuoteItem = { id: string; position: number; description: string; qty: number; unit_price_pence: number; line_total_pence: number };
type InvoiceItem = { id: string; position: number; description: string; qty: number; unit_price_pence: number; line_total_pence: number };
type QuoteRow = { id: string; quote_number: string; status: string; total_pence: number; subtotal_pence: number; vat_pence: number };
type InvoiceRow = { id: string; invoice_number: string; status: string; total_pence: number; subtotal_pence: number; vat_pence: number };
type Appointment = {
  id: string; created_at: string; job_id: string;
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

function pence(n: number) { return `£${(n / 100).toFixed(2)}`; }

function jobPhaseName(job: Job): string | null {
  if (!job.current_phase) return null;
  if (Array.isArray(job.current_phase)) return (job.current_phase as { name: string }[])[0]?.name ?? null;
  return (job.current_phase as { name: string }).name ?? null;
}

export default function JobExpandedDetail({
  job, phases, supabase, onPhaseChange, photoUploading, onUploadFile, blockedUpload, setBlockedUpload, photos, onJobUpdate,
}: {
  job: Job;
  phases: Phase[];
  supabase: ReturnType<typeof createClient>;
  onPhaseChange: (phaseId: string, jobId: string) => Promise<void>;
  photoUploading: boolean;
  onUploadFile: (file: File, jobId: string, type: "quote" | "invoice" | "photo" | "other") => Promise<void>;
  blockedUpload: Record<string, string>;
  setBlockedUpload: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  photos: { id: string; job_id: string; file_type: string; filename: string; storage_bucket: string; storage_path: string; mime_type: string | null; created_at: string; staff_deleted_at?: string | null; client_deleted_at?: string | null }[];
  onJobUpdate?: (jobId: string, updates: Partial<Job>) => void;
}) {
  const [tab, setTab] = useState<"notes" | "quote" | "invoice" | "photos" | "appts">("notes");
  const [uploadTypePicker, setUploadTypePicker] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<"quote" | "invoice" | "photo" | "other">("other");
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState(false);
  const [editJobForm, setEditJobForm] = useState({ title: "", address_line_1: "", address_line_2: "", town_city: "", county: "", postcode: "" });
  const [editJobSaving, setEditJobSaving] = useState(false);

  // Appointments
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptSaving, setApptSaving] = useState(false);
  const [apptForm, setApptForm] = useState({
    appt_type: "survey" as Appointment["appt_type"],
    appt_date: "",
    appt_time: "",
    person_in_charge: "",
    is_first_visit: false,
    is_revisit: false,
    is_intended_last: false,
    customer_agreed: false,
    notes: "",
  });

  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  // Quote
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [newQuoteItem, setNewQuoteItem] = useState({ description: "", qty: "1", unit_price: "" });

  // Invoice
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [newInvoiceItem, setNewInvoiceItem] = useState({ description: "", qty: "1", unit_price: "" });

  const currentPhaseName = jobPhaseName(job);
  const currentPhaseIdx = phases.findIndex(p => p.name === currentPhaseName);
  const quotesReceivedIdx = phases.findIndex(p => p.name === "Quotes Received");
  const finalCheckIdx = phases.findIndex(p => p.name === "Final Check");
  const invoicedIdx = phases.findIndex(p => p.name === "Invoiced");


  const hasQuote = photos.some(f => f.job_id === job.id && f.file_type === "quote");
  const hasInvoice = photos.some(f => f.job_id === job.id && f.file_type === "invoice");

  useEffect(() => {
    loadNotes();
  }, [job.id]);

  useEffect(() => {
    if (tab === "quote" && !quote && !quoteLoading) loadQuote();
    if (tab === "invoice" && !invoice && !invoiceLoading) loadInvoice();
    if (tab === "appts") loadAppts();
  }, [tab]);

  async function loadAppts() {
    setApptsLoading(true);
    const { data } = await supabase.from("zz_appointments")
      .select("*").eq("job_id", job.id).is("cancelled_at", null)
      .order("appt_date", { ascending: true });
    if (data) setAppts(data as Appointment[]);
    setApptsLoading(false);
  }

  async function saveAppt(e: React.FormEvent) {
    e.preventDefault();
    if (!apptForm.appt_date) return;
    setApptSaving(true);
    const payload = {
      job_id: job.id,
      appt_type: apptForm.appt_type,
      appt_date: apptForm.appt_date,
      appt_time: apptForm.appt_time || null,
      person_in_charge: apptForm.person_in_charge || null,
      is_first_visit: apptForm.is_first_visit,
      is_revisit: apptForm.is_revisit,
      is_intended_last: apptForm.is_intended_last,
      customer_agreed: apptForm.customer_agreed,
      notes: apptForm.notes || null,
    };
    const { data } = await supabase.from("zz_appointments").insert(payload).select("*").single();
    if (data) setAppts(prev => [...prev, data as Appointment].sort((a, b) => a.appt_date.localeCompare(b.appt_date)));
    setApptForm({ appt_type: "survey", appt_date: "", appt_time: "", person_in_charge: "", is_first_visit: false, is_revisit: false, is_intended_last: false, customer_agreed: false, notes: "" });
    setShowApptForm(false);
    setApptSaving(false);
  }

  async function cancelAppt(id: string) {
    await supabase.from("zz_appointments").update({ cancelled_at: new Date().toISOString() }).eq("id", id);
    setAppts(prev => prev.filter(a => a.id !== id));
  }

  async function loadNotes() {
    setNotesLoading(true);
    const { data } = await supabase.from("zz_job_notes").select("id,created_at,body,is_client_visible")
      .eq("job_id", job.id).order("created_at", { ascending: false });
    if (data) setNotes(data as Note[]);
    setNotesLoading(false);
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setNoteSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("zz_job_notes")
      .insert({ job_id: job.id, body: noteBody.trim(), is_client_visible: noteVisible, author_user_id: user?.id ?? null })
      .select("id,created_at,body,is_client_visible").single();
    if (data) setNotes(prev => [data as Note, ...prev]);
    setNoteBody("");
    setNoteVisible(false);
    setNoteSaving(false);
  }

  async function deleteNote(id: string) {
    await supabase.from("zz_job_notes").delete().eq("id", id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  async function loadQuote() {
    setQuoteLoading(true);
    const { data: q } = await supabase.from("zz_quotes").select("id,quote_number,status,total_pence,subtotal_pence,vat_pence")
      .eq("job_id", job.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (q) {
      setQuote(q as QuoteRow);
      const { data: items } = await supabase.from("zz_quote_items").select("*").eq("quote_id", q.id).order("position");
      if (items) setQuoteItems(items as QuoteItem[]);
    }
    setQuoteLoading(false);
  }

  async function loadInvoice() {
    setInvoiceLoading(true);
    const { data: inv } = await supabase.from("zz_invoices").select("id,invoice_number,status,total_pence,subtotal_pence,vat_pence")
      .eq("job_id", job.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (inv) {
      setInvoice(inv as InvoiceRow);
      const { data: items } = await supabase.from("zz_invoice_items").select("*").eq("invoice_id", inv.id).order("position");
      if (items) setInvoiceItems(items as InvoiceItem[]);
    }
    setInvoiceLoading(false);
  }

  async function createQuote() {
    setQuoteSaving(true);
    const quoteNumber = `Q-${Date.now().toString().slice(-6)}`;
    const { data: q } = await supabase.from("zz_quotes")
      .insert({ job_id: job.id, quote_number: quoteNumber, status: "draft", subtotal_pence: 0, vat_pence: 0, total_pence: 0 })
      .select("id,quote_number,status,total_pence,subtotal_pence,vat_pence").single();
    if (q) { setQuote(q as QuoteRow); setQuoteItems([]); }
    setQuoteSaving(false);
    setTab("quote");
  }

  async function addQuoteItem(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !newQuoteItem.description) return;
    const qty = parseFloat(newQuoteItem.qty) || 1;
    const unit = Math.round(parseFloat(newQuoteItem.unit_price) * 100) || 0;
    const line = Math.round(qty * unit);
    const position = quoteItems.length + 1;
    const { data } = await supabase.from("zz_quote_items")
      .insert({ quote_id: quote.id, position, description: newQuoteItem.description, qty, unit_price_pence: unit, line_total_pence: line })
      .select("*").single();
    if (data) {
      const updated = [...quoteItems, data as QuoteItem];
      setQuoteItems(updated);
      const subtotal = updated.reduce((s, i) => s + i.line_total_pence, 0);
      const vat = Math.round(subtotal * 0.2);
      const total = subtotal + vat;
      await supabase.from("zz_quotes").update({ subtotal_pence: subtotal, vat_pence: vat, total_pence: total }).eq("id", quote.id);
      setQuote(prev => prev ? { ...prev, subtotal_pence: subtotal, vat_pence: vat, total_pence: total } : prev);
    }
    setNewQuoteItem({ description: "", qty: "1", unit_price: "" });
  }

  async function removeQuoteItem(id: string) {
    await supabase.from("zz_quote_items").delete().eq("id", id);
    const updated = quoteItems.filter(i => i.id !== id);
    setQuoteItems(updated);
    if (quote) {
      const subtotal = updated.reduce((s, i) => s + i.line_total_pence, 0);
      const vat = Math.round(subtotal * 0.2);
      const total = subtotal + vat;
      await supabase.from("zz_quotes").update({ subtotal_pence: subtotal, vat_pence: vat, total_pence: total }).eq("id", quote.id);
      setQuote(prev => prev ? { ...prev, subtotal_pence: subtotal, vat_pence: vat, total_pence: total } : prev);
    }
  }

  async function createInvoice() {
    setInvoiceLoading(true);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const { data: inv } = await supabase.from("zz_invoices")
      .insert({ job_id: job.id, invoice_number: invoiceNumber, status: "draft", subtotal_pence: 0, vat_pence: 0, total_pence: 0 })
      .select("id,invoice_number,status,total_pence,subtotal_pence,vat_pence").single();
    if (inv) { setInvoice(inv as InvoiceRow); setInvoiceItems([]); }
    setInvoiceLoading(false);
    setTab("invoice");
  }

  async function addInvoiceItem(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice || !newInvoiceItem.description) return;
    const qty = parseFloat(newInvoiceItem.qty) || 1;
    const unit = Math.round(parseFloat(newInvoiceItem.unit_price) * 100) || 0;
    const line = Math.round(qty * unit);
    const position = invoiceItems.length + 1;
    const { data } = await supabase.from("zz_invoice_items")
      .insert({ invoice_id: invoice.id, position, description: newInvoiceItem.description, qty, unit_price_pence: unit, line_total_pence: line })
      .select("*").single();
    if (data) {
      const updated = [...invoiceItems, data as InvoiceItem];
      setInvoiceItems(updated);
      const subtotal = updated.reduce((s, i) => s + i.line_total_pence, 0);
      const vat = Math.round(subtotal * 0.2);
      const total = subtotal + vat;
      await supabase.from("zz_invoices").update({ subtotal_pence: subtotal, vat_pence: vat, total_pence: total }).eq("id", invoice.id);
      setInvoice(prev => prev ? { ...prev, subtotal_pence: subtotal, vat_pence: vat, total_pence: total } : prev);
    }
    setNewInvoiceItem({ description: "", qty: "1", unit_price: "" });
  }

  async function removeInvoiceItem(id: string) {
    await supabase.from("zz_invoice_items").delete().eq("id", id);
    const updated = invoiceItems.filter(i => i.id !== id);
    setInvoiceItems(updated);
    if (invoice) {
      const subtotal = updated.reduce((s, i) => s + i.line_total_pence, 0);
      const vat = Math.round(subtotal * 0.2);
      const total = subtotal + vat;
      await supabase.from("zz_invoices").update({ subtotal_pence: subtotal, vat_pence: vat, total_pence: total }).eq("id", invoice.id);
      setInvoice(prev => prev ? { ...prev, subtotal_pence: subtotal, vat_pence: vat, total_pence: total } : prev);
    }
  }

  async function downloadPDF(type: "quote" | "invoice") {
    const doc = type === "quote" ? quote : invoice;
    const items = type === "quote" ? quoteItems : invoiceItems;
    if (!doc) return;
    const clientName = Array.isArray(job.client)
      ? (job.client as { full_name: string }[])[0]?.full_name
      : (job.client as { full_name: string } | null)?.full_name;
    await generateBrandedPDF(
      { type, number: type === "quote" ? (doc as QuoteRow).quote_number : (doc as InvoiceRow).invoice_number, subtotal_pence: doc.subtotal_pence, vat_pence: doc.vat_pence, total_pence: doc.total_pence },
      items,
      { title: job.title, address_line_1: job.address_line_1, town_city: job.town_city, postcode: job.postcode, clientName: clientName ?? undefined },
    );
  }

  const detailStyle: React.CSSProperties = { padding: "10px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer",
    background: active ? "rgba(255,255,255,0.08)" : "none",
    color: active ? "#e8ecf8" : "rgba(232,236,248,0.35)",
  });
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 5, padding: "5px 8px", color: "#e8ecf8", fontSize: 11,
  };
  const btnSmall: React.CSSProperties = {
    fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer",
    background: "rgba(127,165,255,0.12)", color: "#7fa5ff",
  };

  // Phase track (shared)
  const PhaseTrack = () => (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "10px 0 4px" }}>
      {phases.map((phase, i) => {
        const isCurrent = currentPhaseName === phase.name;
        const isDone = currentPhaseIdx > i;
        const needsQuote = quotesReceivedIdx >= 0 && i >= quotesReceivedIdx && currentPhaseIdx < quotesReceivedIdx && !hasQuote;
        const needsInvoice = invoicedIdx >= 0 && i >= invoicedIdx && currentPhaseIdx < invoicedIdx && !hasInvoice;
        const isBlocked = needsQuote || needsInvoice;
        return (
          <div key={phase.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div
              title={needsQuote ? "Upload quote first" : needsInvoice ? "Upload invoice first" : phase.name}
              style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0, cursor: isBlocked ? "pointer" : "pointer",
                background: isDone ? "#7fa5ff" : isCurrent ? "#fff" : "rgba(255,255,255,0.1)",
                border: `2px solid ${isDone ? "#7fa5ff" : isCurrent ? "#fff" : "rgba(255,255,255,0.15)"}`,
                opacity: isBlocked ? 0.4 : 1,
                transition: "all 0.15s",
              }}
              onClick={e => {
                e.stopPropagation();
                if (isBlocked) {
                  setBlockedUpload(prev => ({ ...prev, [job.id]: needsQuote ? "quote" : "invoice" }));
                  return;
                }
                onPhaseChange(phase.id, job.id);
              }}
            />
            {i < phases.length - 1 && (
              <div style={{ flex: 1, height: 2, background: isDone ? "rgba(127,165,255,0.4)" : "rgba(255,255,255,0.07)", minWidth: 4 }} />
            )}
          </div>
        );
      })}
    </div>
  );

  async function saveJobEdit() {
    setEditJobSaving(true);
    const updates: Record<string, string> = {};
    if (editJobForm.title.trim()) updates.title = editJobForm.title.trim();
    if (editJobForm.address_line_1.trim()) updates.address_line_1 = editJobForm.address_line_1.trim();
    if (editJobForm.address_line_2.trim()) updates.address_line_2 = editJobForm.address_line_2.trim();
    if (editJobForm.town_city.trim()) updates.town_city = editJobForm.town_city.trim();
    if (editJobForm.county.trim()) updates.county = editJobForm.county.trim();
    if (editJobForm.postcode.trim()) updates.postcode = editJobForm.postcode.trim();
    await supabase.from("zz_jobs").update(updates).eq("id", job.id);
    onJobUpdate?.(job.id, updates);
    setEditingJob(false);
    setEditJobSaving(false);
  }

  return (
    <div style={detailStyle}>
      {editingJob ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Job title" value={editJobForm.title}
              onChange={e => setEditJobForm(p => ({ ...p, title: e.target.value }))} />
            <input style={inputStyle} placeholder="Address line 1" value={editJobForm.address_line_1}
              onChange={e => setEditJobForm(p => ({ ...p, address_line_1: e.target.value }))} />
            <input style={inputStyle} placeholder="Address line 2" value={editJobForm.address_line_2}
              onChange={e => setEditJobForm(p => ({ ...p, address_line_2: e.target.value }))} />
            <input style={inputStyle} placeholder="Town / City" value={editJobForm.town_city}
              onChange={e => setEditJobForm(p => ({ ...p, town_city: e.target.value }))} />
            <input style={inputStyle} placeholder="County" value={editJobForm.county}
              onChange={e => setEditJobForm(p => ({ ...p, county: e.target.value }))} />
            <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Postcode" value={editJobForm.postcode}
              onChange={e => setEditJobForm(p => ({ ...p, postcode: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btnSmall, background: "rgba(52,211,153,0.12)", color: "#34d399" }}
              onClick={saveJobEdit} disabled={editJobSaving}>
              {editJobSaving ? "Saving…" : "Save"}
            </button>
            <button style={{ ...btnSmall, background: "none", color: "rgba(232,236,248,0.35)" }}
              onClick={() => setEditingJob(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8ecf8", marginBottom: 2 }}>{job.title}</div>
            <div style={{ fontSize: 11, color: "rgba(232,236,248,0.35)" }}>{job.address_line_1}, {job.town_city} {job.postcode}</div>
          </div>
          <button style={{ fontSize: 10, background: "none", border: "none", color: "rgba(232,236,248,0.3)", cursor: "pointer", padding: "2px 4px", flexShrink: 0 }}
            onClick={() => { setEditJobForm({ title: job.title, address_line_1: job.address_line_1 ?? "", address_line_2: "", town_city: job.town_city ?? "", county: "", postcode: job.postcode ?? "" }); setEditingJob(true); }}
            title="Edit job details">✏</button>
        </div>
      )}
      <div style={{ marginBottom: 8 }} />

      <PhaseTrack />
      <div style={{ fontSize: 11, color: "rgba(232,236,248,0.35)", marginBottom: 10 }}>{currentPhaseName ?? "No phase set"}</div>

      {/* Blocked upload prompt */}
      {blockedUpload[job.id] && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 10px", background: "rgba(251,191,36,0.06)", borderRadius: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "rgba(251,191,36,0.8)", flexShrink: 0 }}>
            {blockedUpload[job.id] === "quote" ? "Attach a Quote PDF to proceed:" : "Attach an Invoice PDF to proceed:"}
          </span>
          <label title={`Upload ${blockedUpload[job.id] === "quote" ? "Quote" : "Invoice"} PDF`} style={{ cursor: "pointer", fontSize: 16, color: blockedUpload[job.id] === "quote" ? "rgba(251,191,36,0.8)" : "rgba(52,211,153,0.8)", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
            {photoUploading ? <span style={{ fontSize: 11 }}>…</span> : "⬆"}
            <input type="file" accept=".pdf,application/pdf" style={{ display: "none" }}
              onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const ft = blockedUpload[job.id] as "quote" | "invoice";
                await onUploadFile(f, job.id, ft);
                const targetPhaseName = ft === "quote" ? "Quotes Received" : "Invoiced";
                const targetPhase = phases.find(p => p.name === targetPhaseName);
                if (targetPhase) await onPhaseChange(targetPhase.id, job.id);
                setBlockedUpload(prev => { const n = { ...prev }; delete n[job.id]; return n; });
                e.target.value = "";
              }} />
          </label>
          <button style={{ fontSize: 11, background: "none", border: "none", color: "rgba(232,236,248,0.4)", cursor: "pointer" }}
            onClick={() => setBlockedUpload(prev => { const n = { ...prev }; delete n[job.id]; return n; })}>Cancel</button>
        </div>
      )}

      {/* Photo upload — type picker then file dialog */}
      <div style={{ marginBottom: 10, position: "relative" }}>
        {!uploadTypePicker ? (
          <button title="Add file" onClick={() => setUploadTypePicker(true)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "rgba(232,236,248,0.35)", padding: 0, lineHeight: 1 }}>
            {photoUploading ? <span style={{ fontSize: 11, color: "rgba(232,236,248,0.3)" }}>Uploading…</span> : "📷"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "rgba(232,236,248,0.35)", marginRight: 2 }}>Type:</span>
            {(["quote", "invoice", "other"] as const).map(t => (
              <button key={t} type="button"
                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)",
                  background: pendingUploadType === t ? "rgba(127,165,255,0.15)" : "rgba(255,255,255,0.03)",
                  color: pendingUploadType === t ? "#7fa5ff" : "rgba(232,236,248,0.5)", cursor: "pointer" }}
                onClick={() => setPendingUploadType(t)}>
                {t === "other" ? "Photo / Other" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <label style={{ fontSize: 10, padding: "2px 10px", borderRadius: 4, border: "1px solid rgba(52,211,153,0.3)",
              background: "rgba(52,211,153,0.08)", color: "#34d399", cursor: "pointer", marginLeft: 2 }}>
              Upload
              <input ref={uploadFileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) await onUploadFile(f, job.id, pendingUploadType);
                  e.target.value = "";
                  setUploadTypePicker(false);
                }} />
            </label>
            <button type="button" onClick={() => setUploadTypePicker(false)}
              style={{ fontSize: 10, background: "none", border: "none", color: "rgba(232,236,248,0.3)", cursor: "pointer" }}>✕</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 6 }}>
        <button style={tabBtnStyle(tab === "notes")} onClick={() => setTab("notes")}>Notes</button>
        <button style={tabBtnStyle(tab === "quote")} onClick={() => { setTab("quote"); if (!quote && !quoteLoading) loadQuote(); }}>Quote</button>
        <button style={tabBtnStyle(tab === "invoice")} onClick={() => { setTab("invoice"); if (!invoice && !invoiceLoading) loadInvoice(); }}>Invoice</button>
        <button style={tabBtnStyle(tab === "photos")} onClick={() => setTab("photos")}>
          Photos {photos.filter(p => p.job_id === job.id).length > 0 ? `(${photos.filter(p => p.job_id === job.id).length})` : ""}
        </button>
        <button style={tabBtnStyle(tab === "appts")} onClick={() => setTab("appts")}>
          Appts {appts.length > 0 ? `(${appts.length})` : ""}
        </button>
      </div>

      {/* Notes tab */}
      {tab === "notes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <form onSubmit={saveNote} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea
              placeholder="Add a note…" value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={2}
              style={{ ...inputStyle, resize: "vertical", width: "100%", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="submit" disabled={noteSaving || !noteBody.trim()} style={btnSmall}>
                {noteSaving ? "Saving…" : "Add note"}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(232,236,248,0.4)", cursor: "pointer" }}>
                <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} style={{ accentColor: "#7fa5ff" }} />
                Client visible
              </label>
            </div>
          </form>
          {notesLoading && <div style={{ fontSize: 11, color: "rgba(232,236,248,0.3)" }}>Loading…</div>}
          {!notesLoading && notes.length === 0 && <div style={{ fontSize: 11, color: "rgba(232,236,248,0.2)" }}>No notes yet.</div>}
          {notes.map(n => (
            <div key={n.id} style={{ padding: "7px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, position: "relative" }}>
              <div style={{ fontSize: 12, color: "#e8ecf8", whiteSpace: "pre-wrap" }}>{n.body}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "rgba(232,236,248,0.25)" }}>{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                {n.is_client_visible && <span style={{ fontSize: 10, color: "rgba(127,165,255,0.6)", background: "rgba(127,165,255,0.08)", borderRadius: 3, padding: "1px 5px" }}>Client visible</span>}
                <button onClick={() => deleteNote(n.id)} style={{ fontSize: 10, color: "rgba(248,113,113,0.4)", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote tab */}
      {tab === "quote" && (
        <div>
          {quoteLoading && <div style={{ fontSize: 11, color: "rgba(232,236,248,0.3)" }}>Loading…</div>}
          {!quoteLoading && !quote && (
            <div style={{ fontSize: 11, color: "rgba(232,236,248,0.25)" }}>
              No quote yet. <button style={btnSmall} onClick={createQuote}>Create quote</button>
            </div>
          )}
          {quote && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>{quote.quote_number}</span>
                <span style={{ fontSize: 10, color: "rgba(232,236,248,0.35)", background: "rgba(255,255,255,0.05)", borderRadius: 3, padding: "1px 6px" }}>{quote.status}</span>
                <button style={{ ...btnSmall, marginLeft: "auto" }} onClick={() => downloadPDF("quote")}>⬇ Download</button>
              </div>
              {/* Items table */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "4px 8px", fontSize: 11 }}>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600 }}>Description</span>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600, textAlign: "right" }}>Qty</span>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600, textAlign: "right" }}>Unit</span>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600, textAlign: "right" }}>Total</span>
                <span />
                {quoteItems.map(item => (
                  <>
                    <span key={item.id + "d"} style={{ color: "#e8ecf8" }}>{item.description}</span>
                    <span key={item.id + "q"} style={{ color: "rgba(232,236,248,0.5)", textAlign: "right" }}>{item.qty}</span>
                    <span key={item.id + "u"} style={{ color: "rgba(232,236,248,0.5)", textAlign: "right" }}>{pence(item.unit_price_pence)}</span>
                    <span key={item.id + "t"} style={{ color: "#e8ecf8", textAlign: "right" }}>{pence(item.line_total_pence)}</span>
                    <button key={item.id + "x"} onClick={() => removeQuoteItem(item.id)} style={{ fontSize: 10, color: "rgba(248,113,113,0.5)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </>
                ))}
              </div>
              {/* Add item */}
              <form onSubmit={addQuoteItem} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px auto", gap: 4, marginTop: 4 }}>
                <input required placeholder="Description" value={newQuoteItem.description} onChange={e => setNewQuoteItem(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
                <input placeholder="Qty" value={newQuoteItem.qty} onChange={e => setNewQuoteItem(p => ({ ...p, qty: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
                <input required placeholder="£ Unit price" value={newQuoteItem.unit_price} onChange={e => setNewQuoteItem(p => ({ ...p, unit_price: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
                <button type="submit" style={btnSmall}>+ Add</button>
              </form>
              {/* Totals */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)" }}>Subtotal: {pence(quote.subtotal_pence)}</span>
                <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)" }}>VAT (20%): {pence(quote.vat_pence)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Total: {pence(quote.total_pence)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && (() => {
        async function deleteFile(fileId: string) {
          setDeletingFileId(fileId);
          await supabase.from("zz_files").update({ staff_deleted_at: new Date().toISOString() }).eq("id", fileId);
          setDeletingFileId(null);
          // Notify parent to refresh photos — remove from local view
          window.dispatchEvent(new CustomEvent("zz_file_deleted", { detail: { id: fileId } }));
        }
        const jobFiles = photos.filter(p => p.job_id === job.id && !p.staff_deleted_at);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const byType: Record<string, typeof jobFiles> = { quote: [], invoice: [], photo: [], other: [] };
        jobFiles.forEach(f => { const t = f.file_type ?? "other"; const bucket = byType[t] ?? byType.other; bucket?.push(f); });
        const typeLabel: Record<string, string> = { quote: "Quotes", invoice: "Invoices", photo: "Photos", other: "Other" };
        const typeColour: Record<string, string> = { quote: "#fbbf24", invoice: "#34d399", photo: "#7fa5ff", other: "#9ca3af" };
        if (jobFiles.length === 0) return <div style={{ fontSize: 11, color: "rgba(232,236,248,0.25)" }}>No files uploaded yet.</div>;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(["quote", "invoice", "photo", "other"] as const).map(type => {
              const typedFiles = byType[type] ?? [];
              if (typedFiles.length === 0) return null;
              return (
                <div key={type}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: typeColour[type], letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                    {typeLabel[type]}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {typedFiles.map(file => {
                      const url = `${supabaseUrl}/storage/v1/object/public/${file.storage_bucket}/${file.storage_path}`;
                      const isImage = file.mime_type?.startsWith("image/");
                      return (
                        <div key={file.id} style={{ display: "flex", flexDirection: "column", gap: 4, width: 80, position: "relative" }}>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                            <div style={{ width: 80, height: 60, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {isImage
                                ? <img src={url} alt={file.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 22 }}>{type === "quote" ? "📄" : type === "invoice" ? "🧾" : "📎"}</span>
                              }
                            </div>
                          </a>
                          <span style={{ fontSize: 9, color: "rgba(232,236,248,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.filename}</span>
                          <button
                            onClick={() => deleteFile(file.id)}
                            disabled={deletingFileId === file.id}
                            title="Delete (staff)"
                            style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%",
                              background: "rgba(248,113,113,0.8)", border: "none", cursor: "pointer",
                              fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: deletingFileId === file.id ? 0.4 : 1 }}>
                            ✕
                          </button>
                          {file.client_deleted_at && (
                            <span style={{ fontSize: 8, color: "rgba(251,191,36,0.6)", textAlign: "center" }}>Client deleted</span>
                          )}
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

      {/* Invoice tab */}
      {tab === "invoice" && (
        <div>
          {invoiceLoading && <div style={{ fontSize: 11, color: "rgba(232,236,248,0.3)" }}>Loading…</div>}
          {!invoiceLoading && !invoice && (
            <div style={{ fontSize: 11, color: "rgba(232,236,248,0.25)" }}>
              No invoice yet. <button style={btnSmall} onClick={createInvoice}>Create invoice</button>
            </div>
          )}
          {invoice && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>{invoice.invoice_number}</span>
                <span style={{ fontSize: 10, color: "rgba(232,236,248,0.35)", background: "rgba(255,255,255,0.05)", borderRadius: 3, padding: "1px 6px" }}>{invoice.status}</span>
                <button style={{ ...btnSmall, marginLeft: "auto" }} onClick={() => downloadPDF("invoice")}>⬇ Download</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "4px 8px", fontSize: 11 }}>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600 }}>Description</span>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600, textAlign: "right" }}>Qty</span>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600, textAlign: "right" }}>Unit</span>
                <span style={{ color: "rgba(232,236,248,0.35)", fontWeight: 600, textAlign: "right" }}>Total</span>
                <span />
                {invoiceItems.map(item => (
                  <>
                    <span key={item.id + "d"} style={{ color: "#e8ecf8" }}>{item.description}</span>
                    <span key={item.id + "q"} style={{ color: "rgba(232,236,248,0.5)", textAlign: "right" }}>{item.qty}</span>
                    <span key={item.id + "u"} style={{ color: "rgba(232,236,248,0.5)", textAlign: "right" }}>{pence(item.unit_price_pence)}</span>
                    <span key={item.id + "t"} style={{ color: "#e8ecf8", textAlign: "right" }}>{pence(item.line_total_pence)}</span>
                    <button key={item.id + "x"} onClick={() => removeInvoiceItem(item.id)} style={{ fontSize: 10, color: "rgba(248,113,113,0.5)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                  </>
                ))}
              </div>
              <form onSubmit={addInvoiceItem} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px auto", gap: 4, marginTop: 4 }}>
                <input required placeholder="Description" value={newInvoiceItem.description} onChange={e => setNewInvoiceItem(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
                <input placeholder="Qty" value={newInvoiceItem.qty} onChange={e => setNewInvoiceItem(p => ({ ...p, qty: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
                <input required placeholder="£ Unit price" value={newInvoiceItem.unit_price} onChange={e => setNewInvoiceItem(p => ({ ...p, unit_price: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
                <button type="submit" style={btnSmall}>+ Add</button>
              </form>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)" }}>Subtotal: {pence(invoice.subtotal_pence)}</span>
                <span style={{ fontSize: 11, color: "rgba(232,236,248,0.4)" }}>VAT (20%): {pence(invoice.vat_pence)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>Total: {pence(invoice.total_pence)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Appointments tab ── */}
      {tab === "appts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Existing appointments */}
          {apptsLoading && <div style={{ fontSize: 11, color: "rgba(232,236,248,0.3)" }}>Loading…</div>}
          {!apptsLoading && appts.length === 0 && !showApptForm && (
            <div style={{ fontSize: 11, color: "rgba(232,236,248,0.25)" }}>No appointments yet.</div>
          )}
          {appts.map(a => {
            const responseColour = a.client_response === "accepted" ? "#34d399" : a.client_response === "declined" ? "#f87171" : a.client_response === "counter" ? "#fbbf24" : null;
            return (
              <div key={a.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#7fa5ff", background: "rgba(127,165,255,0.08)", borderRadius: 4, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {APPT_LABELS[a.appt_type]}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e8ecf8" }}>
                    {new Date(a.appt_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    {a.appt_time ? ` at ${a.appt_time.slice(0,5)}` : ""}
                  </span>
                  {a.person_in_charge && (
                    <span style={{ fontSize: 11, color: "rgba(232,236,248,0.45)" }}>· {a.person_in_charge}</span>
                  )}
                  <button onClick={() => cancelAppt(a.id)} style={{ marginLeft: "auto", fontSize: 10, color: "rgba(248,113,113,0.4)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {a.is_first_visit && <span style={{ fontSize: 9, color: "rgba(52,211,153,0.7)", background: "rgba(52,211,153,0.07)", borderRadius: 3, padding: "1px 6px" }}>First visit</span>}
                  {a.is_revisit && <span style={{ fontSize: 9, color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.07)", borderRadius: 3, padding: "1px 6px" }}>Re-visit</span>}
                  {a.is_intended_last && <span style={{ fontSize: 9, color: "rgba(167,139,250,0.7)", background: "rgba(167,139,250,0.07)", borderRadius: 3, padding: "1px 6px" }}>Intended last visit</span>}
                  {a.customer_agreed
                    ? <span style={{ fontSize: 9, color: "rgba(52,211,153,0.7)", background: "rgba(52,211,153,0.07)", borderRadius: 3, padding: "1px 6px" }}>✓ Customer agreed</span>
                    : <span style={{ fontSize: 9, color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.07)", borderRadius: 3, padding: "1px 6px" }}>⏳ Awaiting confirmation</span>
                  }
                  {a.client_response && (
                    <span style={{ fontSize: 9, color: responseColour ?? "rgba(232,236,248,0.5)", background: "rgba(255,255,255,0.05)", borderRadius: 3, padding: "1px 6px", fontWeight: 700, textTransform: "capitalize" }}>
                      Client: {a.client_response}
                      {a.counter_message ? ` — "${a.counter_message}"` : ""}
                    </span>
                  )}
                </div>
                {a.notes && <div style={{ fontSize: 11, color: "rgba(232,236,248,0.4)", fontStyle: "italic" }}>{a.notes}</div>}
              </div>
            );
          })}

          {/* Add appointment form */}
          {!showApptForm ? (
            <button onClick={() => setShowApptForm(true)} style={{ ...btnSmall, alignSelf: "flex-start", marginTop: 4 }}>+ Add appointment</button>
          ) : (
            <form onSubmit={saveAppt} style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "12px 12px 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(232,236,248,0.5)", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 2 }}>New appointment</div>

              {/* Type + Date + Time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 6 }}>
                <select value={apptForm.appt_type} onChange={e => setApptForm(p => ({ ...p, appt_type: e.target.value as Appointment["appt_type"] }))} style={inputStyle}>
                  <option value="survey">Survey</option>
                  <option value="parts_eta">Parts ETA</option>
                  <option value="scheduled">Scheduled Visit</option>
                  <option value="final_check">Final Check</option>
                </select>
                <input required type="date" value={apptForm.appt_date} onChange={e => setApptForm(p => ({ ...p, appt_date: e.target.value }))} style={inputStyle} />
                <input type="time" value={apptForm.appt_time} onChange={e => setApptForm(p => ({ ...p, appt_time: e.target.value }))} style={inputStyle} placeholder="Time (opt)" />
              </div>

              {/* Person in charge */}
              <input placeholder="Person in charge (optional)" value={apptForm.person_in_charge} onChange={e => setApptForm(p => ({ ...p, person_in_charge: e.target.value }))} style={inputStyle} />

              {/* Checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 2 }}>
                {([
                  ["is_first_visit", "This is the first visit"],
                  ["is_revisit", "This is a re-visit"],
                  ["is_intended_last", "This is intended to be the last visit"],
                ] as [keyof typeof apptForm, string][]).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "rgba(232,236,248,0.6)", cursor: "pointer" }}>
                    <input type="checkbox" checked={apptForm[key] as boolean} onChange={e => setApptForm(p => ({ ...p, [key]: e.target.checked }))} style={{ accentColor: "#7fa5ff", width: 13, height: 13 }} />
                    {label}
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, cursor: "pointer",
                  color: apptForm.customer_agreed ? "#34d399" : "rgba(251,191,36,0.85)" }}>
                  <input type="checkbox" checked={apptForm.customer_agreed} onChange={e => setApptForm(p => ({ ...p, customer_agreed: e.target.checked }))} style={{ accentColor: "#34d399", width: 13, height: 13 }} />
                  The customer has agreed to this time verbally or outside of the website
                  {!apptForm.customer_agreed && <span style={{ fontSize: 9, color: "rgba(251,191,36,0.6)", marginLeft: 4 }}>(client will be asked to confirm)</span>}
                </label>
              </div>

              {/* Notes */}
              <textarea placeholder="Notes (optional)" value={apptForm.notes} onChange={e => setApptForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                style={{ ...inputStyle, resize: "vertical", width: "100%", boxSizing: "border-box" }} />

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={apptSaving || !apptForm.appt_date} style={btnSmall}>
                  {apptSaving ? "Saving…" : "Save appointment"}
                </button>
                <button type="button" onClick={() => setShowApptForm(false)} style={{ ...btnSmall, color: "rgba(232,236,248,0.3)" }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
