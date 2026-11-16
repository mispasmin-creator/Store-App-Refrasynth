import { supabase } from '@/lib/supabase';
import { auditStage } from '@/lib/auditWorkflow';
import { sameAuditSnapshot, type AuditSnapshot } from '@/lib/auditRecords';

export async function auditAutomationHealth(): Promise<{ configured: boolean; enabled: boolean }> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('Backend not configured');
  const response = await fetch(`${base}/functions/v1/audit-automation`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('AI worker not available');
  const result = await response.json();
  if (typeof result.configured !== 'boolean' || typeof result.enabled !== 'boolean') throw new Error('Invalid worker status');
  return result;
}

export async function uploadTallyVoucher(file: File, directory: 'tally-vouchers' | 'audit-bills' = 'tally-vouchers'): Promise<string> {
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF, PNG, JPEG or WebP file up to 5 MB.');
  const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
  const path = `${directory}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('images').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
}

export async function submitHumanRectification(id: number, fields: { billNo: string; billAmt: number; qty: number; rate: number; billImage?: string }, remarks: string, firm: string, expected: AuditSnapshot) {
  if (!fields.billNo.trim() || ![fields.billAmt, fields.qty, fields.rate].every(n => Number.isFinite(n) && n > 0) || !remarks.trim()) throw new Error('Bill number, positive amount/quantity/rate and correction remarks are required.');
  const { data: row, error } = await supabase.from('tally_entry').select('*').eq('id', id).single();
  if (error) throw error;
  if (!row || row.firm_name_match !== firm || auditStage(row) !== 'RECTIFY') throw new Error('Record changed. Refresh before rectifying.');
  if (!sameAuditSnapshot(row, expected)) throw new Error('Bill changed while this form was open. Refresh and reapply your correction.');
  const now = new Date().toISOString();
  const updates = { bill_no: fields.billNo.trim(), bill_amt: String(fields.billAmt), qty: String(fields.qty), rate: String(fields.rate),
    ...(fields.billImage ? { bill_image: fields.billImage } : {}),
    status2: 'Done', actual2: now, remarks2: remarks.trim(), planned3: now, actual3: null, status3: '',
  };
  let query = supabase.from('tally_entry').update(updates).eq('id', id);
  for (const field of ['status1', 'status2', 'status3', 'actual1', 'actual2', 'actual3', 'actual4', 'actual5', 'remarks2', 'bill_no', 'bill_amt', 'qty', 'rate', 'bill_image', 'firm_name_match']) {
    query = row[field] === null ? query.is(field, null) : query.eq(field, row[field]);
  }
  const { data, error: saveError } = await query.select('id');
  if (saveError) throw saveError;
  if (data?.length !== 1) throw new Error('Record changed while saving. Refresh and try again.');
}
