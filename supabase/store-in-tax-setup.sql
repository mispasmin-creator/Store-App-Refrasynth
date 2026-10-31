-- Tax flow: PO (po_master.gst) -> Store In (store_in) -> Audit (tally_entry).
-- Additive only: new nullable columns, a fill trigger and a backfill. No stock/qty/amount column is modified.

create or replace function public.tax_num(v text) returns numeric
language sql immutable as $$
  select nullif(regexp_replace(coalesce(v, ''), '[^0-9.\-]', '', 'g'), '')::numeric
$$;

-- Intra-state supply (same GSTIN state code, or either unknown) => CGST + SGST; otherwise IGST.
create or replace function public.tax_split(taxable numeric, pct numeric, vendor_gstin text, company_gstin text,
  out cgst numeric, out sgst numeric, out igst numeric, out total_tax numeric)
language plpgsql immutable as $$
declare inter boolean;
begin
  inter := length(btrim(coalesce(vendor_gstin, ''))) >= 2 and length(btrim(coalesce(company_gstin, ''))) >= 2
           and left(btrim(vendor_gstin), 2) <> left(btrim(company_gstin), 2);
  if inter then
    cgst := 0; sgst := 0; igst := round(coalesce(taxable, 0) * coalesce(pct, 0) / 100, 2);
  else
    cgst := round(coalesce(taxable, 0) * coalesce(pct, 0) / 200, 2); sgst := cgst; igst := 0;
  end if;
  total_tax := cgst + sgst + igst;
end $$;

alter table public.store_in
  add column if not exists gst_percent numeric,
  add column if not exists taxable_amount numeric,
  add column if not exists cgst_amount numeric,
  add column if not exists sgst_amount numeric,
  add column if not exists igst_amount numeric,
  add column if not exists total_tax numeric;

alter table public.tally_entry
  add column if not exists gst_percent numeric,
  add column if not exists taxable_amount numeric,
  add column if not exists cgst_amount numeric,
  add column if not exists sgst_amount numeric,
  add column if not exists igst_amount numeric,
  add column if not exists total_tax numeric;

-- store_in: derive tax from the PO line when it is missing, or re-derive when qty/rate change without a tax change.
create or replace function public.fill_store_in_tax() returns trigger
language plpgsql as $$
declare g numeric; vg text; cg text; s record;
begin
  if tg_op = 'UPDATE' and new.gst_percent is not null
     and not (new.qty is distinct from old.qty or new.rate is distinct from old.rate)
     then return new; end if;
  if tg_op = 'UPDATE' and new.gst_percent is not null
     and (new.gst_percent, new.taxable_amount, new.total_tax) is distinct from (old.gst_percent, old.taxable_amount, old.total_tax)
     then return new; end if;
  if tg_op = 'INSERT' and new.gst_percent is not null and new.taxable_amount is not null then return new; end if;

  select public.tax_num(p.gst) into g from public.po_master p
   where p.po_number = new.po_number and p.internal_code = new.indent_no and p.product = new.product_name
   order by p.id desc limit 1;
  if g is null then return new; end if;

  select m.vendor_gstin into vg from public.master m
   where btrim(m.vendor_name) = btrim(new.vendor_name) and coalesce(m.vendor_gstin, '') <> '' limit 1;
  select m.company_gstin into cg from public.master m
   where btrim(m.firm_name) = btrim(new.firm_name_match) and coalesce(m.company_gstin, '') <> '' limit 1;

  new.gst_percent := g;
  new.taxable_amount := round(coalesce(public.tax_num(new.qty), 0) * coalesce(public.tax_num(new.rate), 0), 2);
  select * into s from public.tax_split(new.taxable_amount, g, vg, cg);
  new.cgst_amount := s.cgst; new.sgst_amount := s.sgst; new.igst_amount := s.igst; new.total_tax := s.total_tax;
  return new;
end $$;

drop trigger if exists trg_fill_store_in_tax on public.store_in;
create trigger trg_fill_store_in_tax before insert or update on public.store_in
  for each row execute function public.fill_store_in_tax();

-- tally_entry (Audit): copy from the matching store_in receipt, else derive from the PO line.
create or replace function public.fill_tally_entry_tax() returns trigger
language plpgsql as $$
declare s record; g numeric; vg text; cg text; sp record;
begin
  if new.gst_percent is not null and new.taxable_amount is not null then return new; end if;

  select * into s from public.store_in
   where po_number = new.po_number and lift_number = new.lift_number and indent_no = new.indent_number
     and product_name = new.product_name and firm_name_match = new.firm_name_match and gst_percent is not null
   limit 1;
  if found then
    new.gst_percent := s.gst_percent; new.taxable_amount := s.taxable_amount; new.cgst_amount := s.cgst_amount;
    new.sgst_amount := s.sgst_amount; new.igst_amount := s.igst_amount; new.total_tax := s.total_tax;
    return new;
  end if;

  select public.tax_num(p.gst) into g from public.po_master p
   where p.po_number = new.po_number and p.internal_code = new.indent_number and p.product = new.product_name
   order by p.id desc limit 1;
  if g is null then return new; end if;
  select m.vendor_gstin into vg from public.master m
   where btrim(m.vendor_name) = btrim(new.party_name) and coalesce(m.vendor_gstin, '') <> '' limit 1;
  select m.company_gstin into cg from public.master m
   where btrim(m.firm_name) = btrim(new.firm_name_match) and coalesce(m.company_gstin, '') <> '' limit 1;
  new.gst_percent := g;
  new.taxable_amount := round(coalesce(public.tax_num(new.qty), 0) * coalesce(public.tax_num(new.rate), 0), 2);
  select * into sp from public.tax_split(new.taxable_amount, g, vg, cg);
  new.cgst_amount := sp.cgst; new.sgst_amount := sp.sgst; new.igst_amount := sp.igst; new.total_tax := sp.total_tax;
  return new;
end $$;

drop trigger if exists trg_fill_tally_entry_tax on public.tally_entry;
create trigger trg_fill_tally_entry_tax before insert or update on public.tally_entry
  for each row execute function public.fill_tally_entry_tax();

-- Backfill existing rows (the triggers fill only the new tax columns).
update public.store_in set gst_percent = null where gst_percent is null;
update public.tally_entry t set gst_percent = null where gst_percent is null;
