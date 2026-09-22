export type AdminLead = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  stage?: string | null;
  source?: string | null;
  product_interest?: string | null;
  page_origin?: string | null;
  notes?: string | null;
  linked_quote_id?: string | null;
  created_at: string;
  updated_at?: string;
};

export type AdminQuote = {
  id: string;
  quote_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  status?: string | null;
  total?: number | null;
  notes?: string | null;
  created_at: string;
};

export type AdminQuoteRequest = {
  quote: AdminQuote;
  lead: AdminLead | null;
  items: Array<{
    id?: string;
    product_name?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }>;
};

export type AdminQuoteRequestsResponse = {
  requests: AdminQuoteRequest[];
};

export type LeadDraft = { stage?: string; notes?: string };
