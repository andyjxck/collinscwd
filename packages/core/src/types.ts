export type ZzProfileRole = "owner" | "staff" | "client";

export type ZzClient = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
};

export type ZzJobStatus = "active" | "history" | "deleted";

export type ZzJob = {
  id: string;
  created_at: string;
  updated_at: string;
  status: ZzJobStatus;
  title: string;
  client_id: string;
  current_phase_id: string | null;
  address_line_1: string;
  address_line_2: string | null;
  town_city: string;
  county: string | null;
  postcode: string;
  archived_at: string | null;
  delete_after: string | null;
};

export type ZzJobPhase = {
  id: string;
  created_at: string;
  name: string;
  position: number;
  is_active: boolean;
};

export type ZzQuote = {
  id: string;
  created_at: string;
  job_id: string;
  quote_number: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  issued_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
  pdf_path: string | null;
};

export type ZzInvoice = {
  id: string;
  created_at: string;
  job_id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid";
  issued_at: string | null;
  paid_at: string | null;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
  pdf_path: string | null;
};
