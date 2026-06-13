import { useState, useEffect, useMemo } from 'react';
import Heading from '../element/Heading';
import {
    Package, CheckCircle2, Clock, AlertTriangle, TrendingUp,
    Download, RefreshCw, Search, Activity, Users, ShieldCheck,
    FileText, Truck, UserCheck, CreditCard, FileWarning, Send as SendIcon,
    BarChart3, ArrowRight, Layers, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { differenceInDays, parseISO, format, isValid, isPast } from 'date-fns';
import { fetchIndentRecords, type IndentRecord } from '@/services/indentService';
import { useSheets } from '@/context/SheetsContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─────────────────────────── TYPES ────────────────────────────

interface LifecycleRow {
    indentNumber: string;
    productName: string;
    indenterName: string;
    department: string;
    expectedReqDate: string;
    indentCreationDate: string;
    approvalDate: string;
    rfqDate: string;
    quotationDate: string;
    poDate: string;
    materialReceiptDate: string;
    currentStatus: string;
    isOverdue: boolean;
    lt_creation_to_approval: number | null;
    lt_approval_to_rfq: number | null;
    lt_rfq_to_quotation: number | null;
    lt_quotation_to_po: number | null;
    lt_po_to_receipt: number | null;
    lt_total: number | null;
}

interface PendingItem {
    indentNumber: string;
    productName: string;
    indenterName: string;
    department: string;
    vendor: string;
    pendingStage: string;
    stageColor: string;
    daysPending: number | null;
    plannedDate: string;
    indentDate: string;
    source: 'indent' | 'store';
}

// ─────────────────────────── HELPERS ──────────────────────────

function safeParseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim() === '') return null;
    try {
        const d = parseISO(dateStr);
        if (isValid(d)) return d;
        const d2 = new Date(dateStr);
        if (isValid(d2)) return d2;
        return null;
    } catch { return null; }
}

function daysBetween(from: string, to: string): number | null {
    const d1 = safeParseDate(from);
    const d2 = safeParseDate(to);
    if (!d1 || !d2) return null;
    const diff = differenceInDays(d2, d1);
    return diff < 0 ? null : diff;
}

function daysSince(dateStr: string): number | null {
    if (!dateStr || dateStr.trim() === '') return null;
    const d = safeParseDate(dateStr);
    if (!d) return null;
    return Math.max(0, differenceInDays(new Date(), d));
}

function fmtDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = safeParseDate(dateStr);
    if (!d) return '—';
    try { return format(d, 'dd MMM yy'); } catch { return '—'; }
}

function resolveStatus(row: {
    approvalDate: string; rfqDate: string; quotationDate: string;
    poDate: string; materialReceiptDate: string;
}): string {
    if (row.materialReceiptDate) return 'Material Received';
    if (row.poDate) return 'PO Released';
    if (row.quotationDate) return 'Quotation Reviewed';
    if (row.rfqDate) return 'RFQ Sent';
    if (row.approvalDate) return 'Approved';
    return 'Pending Approval';
}

function exportCSV(data: LifecycleRow[], filename: string) {
    if (!data.length) return;
    const headers = [
        'Indent No', 'Material', 'Requester', 'Department',
        'Expected Req Date', 'Indent Creation Date',
        'Approval Date', 'Days (Creation→Approval)',
        'RFQ Date', 'Days (Approval→RFQ)',
        'Quotation Date', 'Days (RFQ→Quotation)',
        'PO Date', 'Days (Quotation→PO)',
        'Material Receipt Date', 'Days (PO→Receipt)',
        'Total Lead Time (Days)', 'Status', 'Overdue',
    ];
    const rows = data.map(r => [
        r.indentNumber, r.productName, r.indenterName, r.department,
        fmtDate(r.expectedReqDate), fmtDate(r.indentCreationDate),
        fmtDate(r.approvalDate), r.lt_creation_to_approval ?? '',
        fmtDate(r.rfqDate), r.lt_approval_to_rfq ?? '',
        fmtDate(r.quotationDate), r.lt_rfq_to_quotation ?? '',
        fmtDate(r.poDate), r.lt_quotation_to_po ?? '',
        fmtDate(r.materialReceiptDate), r.lt_po_to_receipt ?? '',
        r.lt_total ?? '', r.currentStatus, r.isOverdue ? 'Yes' : 'No',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
}

function exportPendingCSV(data: PendingItem[], filename: string) {
    if (!data.length) return;
    const headers = ['Indent No', 'Material', 'Requester', 'Department', 'Vendor', 'Pending Stage', 'Days Pending', 'Planned Date', 'Indent Date'];
    const rows = data.map(r => [
        r.indentNumber, r.productName, r.indenterName, r.department,
        r.vendor, r.pendingStage, r.daysPending ?? '', fmtDate(r.plannedDate), fmtDate(r.indentDate),
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
}

// ─────────────────────────── KPI CARD ─────────────────────────

function KpiCard({ label, value, icon, colorClass, alert, sub }: {
    label: string; value: number | string; icon: React.ReactNode;
    colorClass: string; alert?: boolean; sub?: string;
}) {
    return (
        <Card className={cn('border transition-all hover:shadow-md hover:-translate-y-0.5 min-w-0 overflow-hidden', alert && 'border-red-200 bg-red-50/40')}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight break-words">{label}</p>
                        <p className={cn('text-2xl font-black mt-1 truncate', colorClass)}>{value}</p>
                        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
                    </div>
                    <div className={cn('p-2 rounded-lg flex-shrink-0', colorClass.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100').replace('-800', '-100'))}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─────────────────────── LEAD TIME BADGE ──────────────────────

function LtBadge({ days }: { days: number | null }) {
    if (days === null) return <span className="text-xs text-muted-foreground">—</span>;
    const cls = days <= 3 ? 'bg-green-100 text-green-800' :
        days <= 7 ? 'bg-yellow-100 text-yellow-800' :
            days <= 14 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';
    return <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold', cls)}>{days}d</span>;
}

// ─────────────────────── PIPELINE STAGE CARD ──────────────────

function PipelineStageCard({ num, name, pending, completed, icon, firmData }: {
    num: number; name: string; pending: number; completed: number;
    icon: React.ReactNode; firmData?: { pmpl: number; purab: number; pmmpl: number; refrasynth: number };
}) {
    const total = pending + completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const urgency = pending === 0 ? 'none' : pending <= 3 ? 'low' : pending <= 8 ? 'med' : 'high';
    const urgencyStyle = {
        none: { bar: 'bg-green-500', badge: 'bg-green-100 text-green-800 border-green-200', border: 'border-green-200' },
        low: { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', border: 'border-yellow-200' },
        med: { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-800 border-orange-200', border: 'border-orange-200' },
        high: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-800 border-red-200', border: 'border-red-200' },
    }[urgency];

    return (
        <div className={cn('bg-white rounded-xl border-2 p-3 flex flex-col gap-2 min-w-0 transition-all hover:shadow-md', urgencyStyle.border)}>
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black flex items-center justify-center flex-shrink-0">{num}</span>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-muted-foreground flex-shrink-0">{icon}</span>
                    <p className="text-[10px] font-semibold text-slate-700 leading-tight break-words">{name}</p>
                </div>
            </div>
            <div className="flex items-end justify-between gap-2">
                <div>
                    <span className={cn('text-2xl font-black', urgency === 'none' ? 'text-green-600' : urgency === 'low' ? 'text-yellow-600' : urgency === 'med' ? 'text-orange-500' : 'text-red-600')}>
                        {pending}
                    </span>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-none mt-0.5">pending</p>
                </div>
                <div className="text-right">
                    <span className="text-sm font-bold text-slate-500">{completed}</span>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-none mt-0.5">done</p>
                </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div className={cn('h-1.5 rounded-full transition-all', urgencyStyle.bar)} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground text-right">{pct}% complete</p>
            {/* Firm breakdown */}
            {firmData && total > 0 && (
                <div className="flex flex-wrap gap-1 border-t pt-1.5">
                    {[
                        { key: 'pmpl', label: 'PMPL', v: firmData.pmpl },
                        { key: 'purab', label: 'PURAB', v: firmData.purab },
                        { key: 'pmmpl', label: 'PMMPL', v: firmData.pmmpl },
                        { key: 'ref', label: 'REF', v: firmData.refrasynth },
                    ].filter(f => f.v > 0).map(f => (
                        <span key={f.key} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                            {f.label}: {f.v}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────── STATUS / CONSTANTS ───────────────────

const STATUS_STYLE: Record<string, string> = {
    'Pending Approval': 'bg-yellow-100 text-yellow-800',
    'Approved': 'bg-cyan-100 text-cyan-800',
    'RFQ Sent': 'bg-indigo-100 text-indigo-800',
    'Quotation Reviewed': 'bg-purple-100 text-purple-800',
    'PO Released': 'bg-blue-100 text-blue-800',
    'Material Received': 'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
    'Pending Approval': '#f59e0b', 'Approved': '#06b6d4',
    'RFQ Sent': '#6366f1', 'Quotation Reviewed': '#8b5cf6',
    'PO Released': '#3b82f6', 'Material Received': '#10b981',
};

const STATUS_OPTIONS = [
    'All', 'Pending Approval', 'Approved', 'RFQ Sent',
    'Quotation Reviewed', 'PO Released', 'Material Received',
];

const STAGE_KEYS: Array<{ key: keyof LifecycleRow; label: string; shortLabel: string }> = [
    { key: 'lt_creation_to_approval', label: 'Indent Creation → Approval', shortLabel: 'Creation→Approval' },
    { key: 'lt_approval_to_rfq', label: 'Approval → RFQ / Vendor Enquiry', shortLabel: 'Approval→RFQ' },
    { key: 'lt_rfq_to_quotation', label: 'RFQ → Quotation Review', shortLabel: 'RFQ→Quotation' },
    { key: 'lt_quotation_to_po', label: 'Quotation → PO Release', shortLabel: 'Quotation→PO' },
    { key: 'lt_po_to_receipt', label: 'PO Release → Material Receipt', shortLabel: 'PO→Receipt' },
];

const CHART_COLORS = ['#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#059669'];

// Stage metadata for pipeline
const PROCUREMENT_STAGES = [
    { name: 'Dept Indent Approval', icon: <CheckCircle2 size={13} />, pcKey: 'Department Indent Approval' },
    { name: 'Vendor Rate Update', icon: <Users size={13} />, pcKey: 'Vendor Rate Update' },
    { name: 'Technical Approval', icon: <ShieldCheck size={13} />, pcKey: 'Department Approval' },
    { name: 'Rate / Mgmt Approval', icon: <ShieldCheck size={13} />, pcKey: 'Department Approval' },
    { name: 'Pending PO', icon: <FileText size={13} />, pcKey: 'Pending PO' },
    { name: 'Material Lifting', icon: <Truck size={13} />, pcKey: 'Lifting' },
    { name: 'Store Check (Receive)', icon: <Package size={13} />, pcKey: 'Store Check' },
    { name: 'HOD Store Approval', icon: <UserCheck size={13} />, pcKey: 'HOD Check' },
];

const POST_RECEIPT_STAGES = [
    { name: 'Freight Payment', icon: <CreditCard size={13} />, pcKey: 'Freight Payment' },
    { name: 'Process for Payment', icon: <RefreshCw size={13} />, pcKey: 'Process for Payment / Debit Note' },
    { name: 'Make Payment', icon: <CreditCard size={13} />, pcKey: 'Make Payment' },
    { name: 'Reject For GRN', icon: <XCircle size={13} />, pcKey: 'Reject For GRN' },
    { name: 'Send Debit Note', icon: <SendIcon size={13} />, pcKey: 'Send Debit Note' },
    { name: 'Audit Data', icon: <BarChart3 size={13} />, pcKey: 'Audit Data' },
    { name: 'Bill Not Received', icon: <FileWarning size={13} />, pcKey: 'Bill Not Received' },
];

const PENDING_STAGE_COLORS: Record<string, string> = {
    'Dept Indent Approval': 'bg-yellow-100 text-yellow-800',
    'Vendor Rate Update': 'bg-indigo-100 text-indigo-800',
    'Technical Approval': 'bg-purple-100 text-purple-800',
    'Rate / Mgmt Approval': 'bg-blue-100 text-blue-800',
    'PO Creation Pending': 'bg-orange-100 text-orange-800',
    'Material Lifting': 'bg-teal-100 text-teal-800',
    'Store Check (Receiving)': 'bg-emerald-100 text-emerald-800',
    'HOD Store Approval': 'bg-cyan-100 text-cyan-800',
};

// ─────────────────────── MAIN COMPONENT ───────────────────────

export default function IndentTrackerDashboard() {
    const { storeInSheet, pcReportSheet } = useSheets();
    const [indents, setIndents] = useState<IndentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'report' | 'pending'>('overview');

    // Lifecycle Report filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [deptFilter, setDeptFilter] = useState('All');

    // Pending Report filters
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingStageFilter, setPendingStageFilter] = useState('All');

    function loadIndents() {
        setIsLoading(true);
        fetchIndentRecords()
            .then(data => { setIndents(data); setIsLoading(false); })
            .catch(() => setIsLoading(false));
    }

    useEffect(() => { loadIndents(); }, []);

    // ── Receipt Map ──
    const receiptMap = useMemo(() => {
        const map = new Map<string, string>();
        (storeInSheet as any[]).forEach(s => {
            const indNo: string = s.indentNo || s.indent_no || s.indentNumber || '';
            const receipt: string = s.actual6 || '';
            if (indNo && receipt.trim() !== '') {
                const existing = map.get(indNo);
                if (!existing || receipt > existing) map.set(indNo, receipt);
            }
        });
        return map;
    }, [storeInSheet]);

    // ── Lifecycle Rows ──
    const lifecycleRows = useMemo((): LifecycleRow[] => {
        return indents.map(r => {
            const receiptDate = receiptMap.get(r.indent_number) || '';
            const approvalDate = r.actual1 || '';
            const rfqDate = r.actual2 || '';
            const quotationDate = r.actual3 || '';
            const poDate = r.actual4 || r.po_date || '';

            const lt_creation_to_approval = daysBetween(r.timestamp, approvalDate);
            const lt_approval_to_rfq = daysBetween(approvalDate, rfqDate);
            const lt_rfq_to_quotation = daysBetween(rfqDate, quotationDate);
            const lt_quotation_to_po = daysBetween(quotationDate, poDate);
            const lt_po_to_receipt = daysBetween(poDate, receiptDate);
            const lastKnownDate = receiptDate || poDate || quotationDate || rfqDate || approvalDate;
            const lt_total = lastKnownDate ? daysBetween(r.timestamp, lastKnownDate) : null;

            const currentStatus = resolveStatus({ approvalDate, rfqDate, quotationDate, poDate, materialReceiptDate: receiptDate });

            const expReqDate = r.expected_req_date || '';
            const isOverdue = (() => {
                if (!expReqDate || currentStatus === 'Material Received') return false;
                const d = safeParseDate(expReqDate);
                return d ? isPast(d) : false;
            })();

            return {
                indentNumber: r.indent_number, productName: r.product_name,
                indenterName: r.indenter_name, department: r.department,
                expectedReqDate: expReqDate, indentCreationDate: r.timestamp,
                approvalDate, rfqDate, quotationDate, poDate,
                materialReceiptDate: receiptDate, currentStatus, isOverdue,
                lt_creation_to_approval, lt_approval_to_rfq, lt_rfq_to_quotation,
                lt_quotation_to_po, lt_po_to_receipt, lt_total,
            };
        });
    }, [indents, receiptMap]);

    // ── KPIs ──
    const kpis = useMemo(() => {
        const total = lifecycleRows.length;
        const pending = lifecycleRows.filter(r => r.currentStatus === 'Pending Approval').length;
        const inProgress = lifecycleRows.filter(r => ['Approved', 'RFQ Sent', 'Quotation Reviewed'].includes(r.currentStatus)).length;
        const poReleased = lifecycleRows.filter(r => r.currentStatus === 'PO Released').length;
        const received = lifecycleRows.filter(r => r.currentStatus === 'Material Received').length;
        const overdue = lifecycleRows.filter(r => r.isOverdue).length;
        const withTotal = lifecycleRows.filter(r => r.lt_total !== null);
        const avgLeadTime = withTotal.length > 0
            ? Math.round(withTotal.reduce((s, r) => s + (r.lt_total ?? 0), 0) / withTotal.length) : 0;
        return { total, pending, inProgress, poReleased, received, overdue, avgLeadTime };
    }, [lifecycleRows]);

    // ── Pipeline Stage Map ──
    const stageMap = useMemo(() => {
        const map: Record<string, { pending: number; completed: number; pmpl: number; purab: number; pmmpl: number; refrasynth: number }> = {};
        pcReportSheet.forEach((s: any) => {
            map[s.stage] = {
                pending: s.totalPending || 0,
                completed: s.totalComplete || 0,
                pmpl: s.pendingPmpl || 0,
                purab: s.pendingPurab || 0,
                pmmpl: s.pendingPmmpl || 0,
                refrasynth: s.pendingRefrasynth || 0,
            };
        });
        return map;
    }, [pcReportSheet]);

    const totalPipelinePending = useMemo(() =>
        pcReportSheet.reduce((s: number, r: any) => s + (Number(r.totalPending) || 0), 0),
        [pcReportSheet]
    );

    const bottleneck = useMemo(() => {
        if (!pcReportSheet.length) return null;
        const max = pcReportSheet.reduce((a: any, b: any) => (Number(a.totalPending) > Number(b.totalPending) ? a : b));
        return Number(max.totalPending) > 0 ? max : null;
    }, [pcReportSheet]);

    // ── Pending Items ──
    const pendingItems = useMemo((): PendingItem[] => {
        const items: PendingItem[] = [];

        indents.forEach(r => {
            let pendingStage = '';
            let plannedDate = '';
            let stageColor = '';

            if (r.planned1 && !r.actual1) {
                pendingStage = 'Dept Indent Approval';
                plannedDate = r.planned1;
                stageColor = PENDING_STAGE_COLORS['Dept Indent Approval'];
            } else if (r.planned2 && !r.actual2) {
                pendingStage = 'Vendor Rate Update';
                plannedDate = r.planned2;
                stageColor = PENDING_STAGE_COLORS['Vendor Rate Update'];
            } else if (r.planned3 && !r.actual3) {
                pendingStage = 'Technical Approval';
                plannedDate = r.planned3;
                stageColor = PENDING_STAGE_COLORS['Technical Approval'];
            } else if (r.planned4 && !r.actual4) {
                pendingStage = 'Rate / Mgmt Approval';
                plannedDate = r.planned4;
                stageColor = PENDING_STAGE_COLORS['Rate / Mgmt Approval'];
            } else if (r.vendor_name && !r.po_number && r.actual4) {
                pendingStage = 'PO Creation Pending';
                plannedDate = r.actual4;
                stageColor = PENDING_STAGE_COLORS['PO Creation Pending'];
            } else if (r.planned5 && !r.actual5) {
                pendingStage = 'Material Lifting';
                plannedDate = r.planned5;
                stageColor = PENDING_STAGE_COLORS['Material Lifting'];
            }

            if (pendingStage) {
                items.push({
                    indentNumber: r.indent_number,
                    productName: r.product_name,
                    indenterName: r.indenter_name,
                    department: r.department,
                    vendor: r.vendor_name || '—',
                    pendingStage,
                    stageColor,
                    daysPending: daysSince(plannedDate),
                    plannedDate,
                    indentDate: r.timestamp,
                    source: 'indent',
                });
            }
        });

        // Store Check pending
        (storeInSheet as any[]).forEach(s => {
            const indNo = s.indentNo || s.indent_no || '';
            const prodName = s.productName || s.product_name || '';

            if ((s.planned6 || s.planned_6) && !(s.actual6 || s.actual_6)) {
                const planned = s.planned6 || s.planned_6 || '';
                items.push({
                    indentNumber: indNo, productName: prodName,
                    indenterName: '—', department: '—',
                    vendor: s.vendorName || s.vendor_name || '—',
                    pendingStage: 'Store Check (Receiving)',
                    stageColor: PENDING_STAGE_COLORS['Store Check (Receiving)'],
                    daysPending: daysSince(planned),
                    plannedDate: planned, indentDate: s.timestamp || '',
                    source: 'store',
                });
            }
            if ((s.plannedHod || s.hod_planned) && !(s.actualHod || s.hod_actual)) {
                const planned = s.plannedHod || s.hod_planned || '';
                items.push({
                    indentNumber: indNo, productName: prodName,
                    indenterName: '—', department: '—',
                    vendor: s.vendorName || s.vendor_name || '—',
                    pendingStage: 'HOD Store Approval',
                    stageColor: PENDING_STAGE_COLORS['HOD Store Approval'],
                    daysPending: daysSince(planned),
                    plannedDate: planned, indentDate: s.timestamp || '',
                    source: 'store',
                });
            }
        });

        return items.sort((a, b) => (b.daysPending ?? 0) - (a.daysPending ?? 0));
    }, [indents, storeInSheet]);

    // ── Pending Stages List ──
    const pendingStageOptions = useMemo(() => {
        const stages = new Set(pendingItems.map(i => i.pendingStage));
        return ['All', ...Array.from(stages)];
    }, [pendingItems]);

    // ── Filtered Pending Items ──
    const filteredPendingItems = useMemo(() => {
        const q = pendingSearch.toLowerCase();
        return pendingItems.filter(item => {
            const matchSearch = !q ||
                item.productName.toLowerCase().includes(q) ||
                item.indentNumber.toLowerCase().includes(q) ||
                item.indenterName.toLowerCase().includes(q) ||
                item.vendor.toLowerCase().includes(q);
            const matchStage = pendingStageFilter === 'All' || item.pendingStage === pendingStageFilter;
            return matchSearch && matchStage;
        });
    }, [pendingItems, pendingSearch, pendingStageFilter]);

    // ── Lifecycle Report Derived ──
    const departments = useMemo(() => {
        const deps = new Set(lifecycleRows.map(r => r.department).filter(Boolean));
        return ['All', ...Array.from(deps).sort()];
    }, [lifecycleRows]);

    const filteredRows = useMemo(() => {
        const q = search.toLowerCase();
        return lifecycleRows.filter(r => {
            const matchSearch = !q ||
                r.indentNumber.toLowerCase().includes(q) ||
                r.productName.toLowerCase().includes(q) ||
                r.indenterName.toLowerCase().includes(q);
            const matchStatus = statusFilter === 'All' || r.currentStatus === statusFilter;
            const matchDept = deptFilter === 'All' || r.department === deptFilter;
            return matchSearch && matchStatus && matchDept;
        });
    }, [lifecycleRows, search, statusFilter, deptFilter]);

    // ── Charts ──
    const statusChartData = useMemo(() => {
        const counts: Record<string, number> = {};
        lifecycleRows.forEach(r => { counts[r.currentStatus] = (counts[r.currentStatus] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [lifecycleRows]);

    const leadTimeChartData = useMemo(() =>
        STAGE_KEYS.map(s => {
            const vals = lifecycleRows.map(r => r[s.key] as number | null).filter((v): v is number => v !== null && v >= 0);
            const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
            return { name: s.shortLabel, avg, count: vals.length };
        }), [lifecycleRows]
    );

    const pipelineBarData = useMemo(() =>
        [...PROCUREMENT_STAGES, ...POST_RECEIPT_STAGES].map(s => ({
            name: s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name,
            pending: stageMap[s.pcKey]?.pending ?? 0,
            completed: stageMap[s.pcKey]?.completed ?? 0,
        })), [stageMap]
    );

    // ─────────────────── RENDER ───────────────────────────────

    const TABS: Array<{ key: typeof activeTab; label: string }> = [
        { key: 'overview', label: 'Overview & Analytics' },
        { key: 'pipeline', label: 'Pipeline Dashboard' },
        { key: 'report', label: 'Lifecycle Report' },
        { key: 'pending', label: 'Pending Report' },
    ];

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Heading heading="Procurement Tracker" subtext="Track indent lifecycle from creation to material receipt">
                    <Activity size={20} />
                </Heading>
                <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                    <RefreshCw className="animate-spin" size={20} />
                    Loading procurement data...
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 flex flex-col gap-5 h-full overflow-hidden">
            {/* ── Header ── */}
            <Heading heading="Indent → Material Receipt Tracker" subtext="Complete procurement lifecycle from indent creation to material receipt">
                <Activity size={20} />
            </Heading>
            <div className="flex justify-end -mt-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={loadIndents}>
                    <RefreshCw size={13} className="mr-1.5" /> Refresh
                </Button>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 flex-shrink-0">
                <KpiCard label="Total Indents" value={kpis.total} icon={<Package size={17} />} colorClass="text-slate-700" />
                <KpiCard label="Pending Approval" value={kpis.pending} icon={<Clock size={17} />} colorClass="text-yellow-600" />
                <KpiCard label="In Progress" value={kpis.inProgress} icon={<Activity size={17} />} colorClass="text-blue-600" sub="Approved / RFQ / Quote" />
                <KpiCard label="PO Released" value={kpis.poReleased} icon={<CheckCircle2 size={17} />} colorClass="text-indigo-600" />
                <KpiCard label="Material Received" value={kpis.received} icon={<CheckCircle2 size={17} />} colorClass="text-green-600" />
                <KpiCard label="Overdue" value={kpis.overdue} icon={<AlertTriangle size={17} />} colorClass="text-red-600" alert={kpis.overdue > 0} sub="Expected date passed" />
                <KpiCard label="Avg Lead Time" value={`${kpis.avgLeadTime}d`} icon={<TrendingUp size={17} />} colorClass="text-purple-600" sub="Creation → Receipt" />
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b gap-0 flex-shrink-0 overflow-x-auto">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            'px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap',
                            activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ════════════════ OVERVIEW TAB ════════════════ */}
            {activeTab === 'overview' && (
                <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pr-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Indent Status Distribution</CardTitle></CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={85} innerRadius={35}>
                                            {statusChartData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => [`${v} indents`]} />
                                        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[11px]">{v}</span>} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Average Lead Time by Stage (Days)</CardTitle></CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={leadTimeChartData} margin={{ top: 5, right: 10, left: -15, bottom: 55 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v: any, _: any, p: any) => [`${v} days (${p.payload.count} records)`, 'Avg Days']} />
                                        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                                            {leadTimeChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Stage-wise Lead Time Summary</CardTitle></CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">Procurement Stage</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground">Avg Days</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground">Min</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground">Max</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground">Completed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {STAGE_KEYS.map((s, idx) => {
                                        const vals = lifecycleRows.map(r => r[s.key] as number | null).filter((v): v is number => v !== null && v >= 0);
                                        const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                                        const min = vals.length ? Math.min(...vals) : null;
                                        const max = vals.length ? Math.max(...vals) : null;
                                        return (
                                            <tr key={s.key} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 px-3 font-medium">
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                                        {s.label}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center"><LtBadge days={avg} /></td>
                                                <td className="py-2.5 px-3 text-center text-xs text-green-700 font-medium">{min !== null ? `${min}d` : '—'}</td>
                                                <td className="py-2.5 px-3 text-center text-xs text-red-700 font-medium">{max !== null ? `${max}d` : '—'}</td>
                                                <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{vals.length}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-muted/20 font-semibold">
                                        <td className="py-2.5 px-3 text-xs uppercase tracking-wide text-muted-foreground">Total: Creation → Material Receipt</td>
                                        <td className="py-2.5 px-3 text-center"><LtBadge days={kpis.avgLeadTime} /></td>
                                        <td className="py-2.5 px-3 text-center text-xs text-green-700">{(() => { const v = lifecycleRows.map(r => r.lt_total).filter((x): x is number => x !== null); return v.length ? `${Math.min(...v)}d` : '—'; })()}</td>
                                        <td className="py-2.5 px-3 text-center text-xs text-red-700">{(() => { const v = lifecycleRows.map(r => r.lt_total).filter((x): x is number => x !== null); return v.length ? `${Math.max(...v)}d` : '—'; })()}</td>
                                        <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{lifecycleRows.filter(r => r.lt_total !== null).length}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ════════════════ PIPELINE TAB ════════════════ */}
            {activeTab === 'pipeline' && (
                <div className="flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto pr-1">
                    {/* Summary banner */}
                    <div className="flex flex-wrap gap-3">
                        <Card className="flex-1 min-w-0 border-2 border-slate-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2.5 bg-slate-100 rounded-xl"><Layers size={22} className="text-slate-600" /></div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Pending (All Stages)</p>
                                    <p className="text-3xl font-black text-slate-800">{totalPipelinePending}</p>
                                </div>
                            </CardContent>
                        </Card>
                        {bottleneck && (
                            <Card className="flex-1 min-w-0 border-2 border-red-200 bg-red-50/30">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-2.5 bg-red-100 rounded-xl"><AlertTriangle size={22} className="text-red-600" /></div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Biggest Bottleneck</p>
                                        <p className="text-base font-black text-red-700">{bottleneck.stage}</p>
                                        <p className="text-xs text-red-500 font-medium">{bottleneck.totalPending} items pending</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        <Card className="flex-1 min-w-0 border-2 border-blue-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2.5 bg-blue-100 rounded-xl"><TrendingUp size={22} className="text-blue-600" /></div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Pending Items in Tracker</p>
                                    <p className="text-3xl font-black text-blue-700">{pendingItems.length}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Pipeline bar chart */}
                    <Card>
                        <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">All Stage Pending vs Completed</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={pipelineBarData} margin={{ top: 5, right: 10, left: -15, bottom: 65 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="pending" name="Pending" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                                    <Legend iconType="circle" iconSize={8} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Procurement Pipeline Cards */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                            <h3 className="text-sm font-bold text-slate-700">Procurement Pipeline</h3>
                            <span className="text-xs text-muted-foreground">(Indent → Material Receipt)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                            {PROCUREMENT_STAGES.map((s, i) => {
                                const data = stageMap[s.pcKey] ?? { pending: 0, completed: 0, pmpl: 0, purab: 0, pmmpl: 0, refrasynth: 0 };
                                return (
                                    <div key={i} className="flex items-stretch gap-0">
                                        <PipelineStageCard
                                            num={i + 1}
                                            name={s.name}
                                            pending={data.pending}
                                            completed={data.completed}
                                            icon={s.icon}
                                            firmData={{ pmpl: data.pmpl, purab: data.purab, pmmpl: data.pmmpl, refrasynth: data.refrasynth }}
                                        />
                                        {i < PROCUREMENT_STAGES.length - 1 && (
                                            <div className="flex items-center px-0.5">
                                                <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Post-Receipt Pipeline Cards */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                            <h3 className="text-sm font-bold text-slate-700">Post-Receipt Processing</h3>
                            <span className="text-xs text-muted-foreground">(Store & Payment stages)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {POST_RECEIPT_STAGES.map((s, i) => {
                                const data = stageMap[s.pcKey] ?? { pending: 0, completed: 0, pmpl: 0, purab: 0, pmmpl: 0, refrasynth: 0 };
                                return (
                                    <div key={i} className="flex items-stretch gap-0">
                                        <PipelineStageCard
                                            num={PROCUREMENT_STAGES.length + i + 1}
                                            name={s.name}
                                            pending={data.pending}
                                            completed={data.completed}
                                            icon={s.icon}
                                            firmData={{ pmpl: data.pmpl, purab: data.purab, pmmpl: data.pmmpl, refrasynth: data.refrasynth }}
                                        />
                                        {i < POST_RECEIPT_STAGES.length - 1 && (
                                            <div className="flex items-center px-0.5">
                                                <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ LIFECYCLE REPORT TAB ════════════════ */}
            {activeTab === 'report' && (
                <div className="flex flex-col flex-1 min-h-0 gap-4">
                    <div className="flex flex-wrap gap-2 items-center flex-shrink-0">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                            <Input className="pl-8 h-8 text-xs" placeholder="Search by indent no, material, requester…" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportCSV(filteredRows, 'procurement-lifecycle')}>
                            <Download size={12} className="mr-1.5" /> Export CSV
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">{filteredRows.length} records</span>
                    </div>
                    <div className="overflow-auto flex-1 min-h-0 rounded-lg border shadow-sm">
                        <table className="text-xs w-full min-w-[1400px]">
                            <thead>
                                <tr className="bg-muted/60 border-b">
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Indent No.</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground min-w-[130px]">Material</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Requester / Dept</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap text-orange-700">Exp Req Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Indent Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap border-l border-slate-200">Approval Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Days</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap border-l border-slate-200">RFQ Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Days</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap border-l border-slate-200">Quotation Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Days</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap border-l border-slate-200">PO Release Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Days</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap border-l border-slate-200">Receipt Date</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Days</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap border-l border-slate-200">Total Days</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                                </tr>
                                <tr className="bg-muted/30 border-b text-[9px]">
                                    <th colSpan={5} />
                                    <th className="py-1 px-3 text-center text-muted-foreground border-l border-slate-200 font-normal" colSpan={2}>← Dept Approval</th>
                                    <th className="py-1 px-3 text-center text-muted-foreground border-l border-slate-200 font-normal" colSpan={2}>← Vendor Rate Update</th>
                                    <th className="py-1 px-3 text-center text-muted-foreground border-l border-slate-200 font-normal" colSpan={2}>← Technical Approval</th>
                                    <th className="py-1 px-3 text-center text-muted-foreground border-l border-slate-200 font-normal" colSpan={2}>← PO Creation</th>
                                    <th className="py-1 px-3 text-center text-muted-foreground border-l border-slate-200 font-normal" colSpan={2}>← Store In</th>
                                    <th colSpan={2} />
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr><td colSpan={17} className="py-16 text-center text-muted-foreground">No records found</td></tr>
                                ) : filteredRows.map((row, i) => (
                                    <tr key={row.indentNumber + i} className={cn('border-b hover:bg-muted/30 transition-colors', row.isOverdue && 'bg-red-50/40')}>
                                        <td className="py-2 px-3 font-semibold whitespace-nowrap">
                                            {row.indentNumber}
                                            {row.isOverdue && <span title="Overdue" className="inline-flex"><AlertTriangle size={9} className="inline ml-1 text-red-500" /></span>}
                                        </td>
                                        <td className="py-2 px-3 max-w-[130px]"><span className="block truncate" title={row.productName}>{row.productName}</span></td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                            <div className="font-medium">{row.indenterName}</div>
                                            <div className="text-[10px] text-muted-foreground">{row.department}</div>
                                        </td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap font-medium text-orange-700">{fmtDate(row.expectedReqDate)}</td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap text-muted-foreground">{fmtDate(row.indentCreationDate)}</td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap border-l border-slate-100">{fmtDate(row.approvalDate)}</td>
                                        <td className="py-2 px-3 text-center"><LtBadge days={row.lt_creation_to_approval} /></td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap border-l border-slate-100">{fmtDate(row.rfqDate)}</td>
                                        <td className="py-2 px-3 text-center"><LtBadge days={row.lt_approval_to_rfq} /></td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap border-l border-slate-100">{fmtDate(row.quotationDate)}</td>
                                        <td className="py-2 px-3 text-center"><LtBadge days={row.lt_rfq_to_quotation} /></td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap border-l border-slate-100">{fmtDate(row.poDate)}</td>
                                        <td className="py-2 px-3 text-center"><LtBadge days={row.lt_quotation_to_po} /></td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap border-l border-slate-100">{fmtDate(row.materialReceiptDate)}</td>
                                        <td className="py-2 px-3 text-center"><LtBadge days={row.lt_po_to_receipt} /></td>
                                        <td className="py-2 px-3 text-center border-l border-slate-100">
                                            {row.lt_total !== null ? (
                                                <span className={cn('font-bold', row.lt_total > 30 ? 'text-red-600' : row.lt_total > 14 ? 'text-orange-600' : 'text-green-600')}>{row.lt_total}d</span>
                                            ) : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', STATUS_STYLE[row.currentStatus] || 'bg-gray-100 text-gray-700')}>
                                                {row.currentStatus}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground flex-shrink-0">
                        <span className="font-semibold">Days color guide:</span>
                        <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium">≤3d Fast</span>
                        <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">4–7d Normal</span>
                        <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-medium">8–14d Slow</span>
                        <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium">&gt; 14d Critical</span>
                        <span className="ml-4 text-orange-700 font-medium">⚠ Overdue rows are highlighted</span>
                    </div>
                </div>
            )}

            {/* ════════════════ PENDING REPORT TAB ════════════════ */}
            {activeTab === 'pending' && (
                <div className="flex flex-col flex-1 min-h-0 gap-4">
                    {/* Summary row */}
                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                        {pendingStageOptions.filter(s => s !== 'All').map(stage => {
                            const cnt = pendingItems.filter(i => i.pendingStage === stage).length;
                            const color = PENDING_STAGE_COLORS[stage] || 'bg-slate-100 text-slate-700';
                            return (
                                <button
                                    key={stage}
                                    onClick={() => setPendingStageFilter(pendingStageFilter === stage ? 'All' : stage)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:shadow-sm',
                                        pendingStageFilter === stage ? 'ring-2 ring-offset-1 ring-slate-400 shadow-md' : 'opacity-80 hover:opacity-100',
                                        color, 'border-current/20'
                                    )}
                                >
                                    {stage}
                                    <span className="bg-white/60 text-current px-1.5 py-0.5 rounded-md font-black text-[10px]">{cnt}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 items-center flex-shrink-0">
                        <div className="relative flex-1 min-w-[250px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                            <Input
                                className="pl-8 h-9 text-xs"
                                placeholder="Search by material name, indent no, vendor…"
                                value={pendingSearch}
                                onChange={e => setPendingSearch(e.target.value)}
                            />
                        </div>
                        <select
                            value={pendingStageFilter}
                            onChange={e => setPendingStageFilter(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {pendingStageOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => exportPendingCSV(filteredPendingItems, 'pending-items')}>
                            <Download size={12} className="mr-1.5" /> Export CSV
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{filteredPendingItems.length} pending items</span>
                            {pendingStageFilter !== 'All' && (
                                <button onClick={() => setPendingStageFilter('All')} className="text-xs text-primary underline">Clear filter</button>
                            )}
                        </div>
                    </div>

                    {/* Pending table */}
                    <div className="overflow-auto flex-1 min-h-0 rounded-lg border shadow-sm">
                        <table className="text-xs w-full min-w-[900px]">
                            <thead>
                                <tr className="bg-muted/60 border-b">
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">#</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Indent No.</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground min-w-[150px]">Material Name</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Requester</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Department</th>
                                    <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Vendor</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Current Pending Stage</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Days Waiting</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Stage Started</th>
                                    <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Indent Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPendingItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-16 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle2 size={32} className="text-green-400" />
                                                <p className="font-medium">No pending items{pendingStageFilter !== 'All' ? ` in "${pendingStageFilter}"` : ''}</p>
                                                {pendingSearch && <p className="text-xs">Try clearing the search</p>}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPendingItems.map((item, i) => (
                                        <tr key={item.indentNumber + i + item.pendingStage}
                                            className={cn('border-b hover:bg-muted/30 transition-colors',
                                                (item.daysPending ?? 0) > 14 && 'bg-red-50/30',
                                                (item.daysPending ?? 0) > 7 && (item.daysPending ?? 0) <= 14 && 'bg-orange-50/20'
                                            )}>
                                            <td className="py-2 px-3 text-muted-foreground font-medium">{i + 1}</td>
                                            <td className="py-2 px-3 font-semibold whitespace-nowrap text-slate-700">{item.indentNumber || '—'}</td>
                                            <td className="py-2 px-3 font-medium max-w-[180px]">
                                                <span className="block truncate" title={item.productName}>{item.productName || '—'}</span>
                                            </td>
                                            <td className="py-2 px-3 whitespace-nowrap">{item.indenterName}</td>
                                            <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{item.department}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">
                                                <span className="block truncate max-w-[120px]" title={item.vendor}>{item.vendor}</span>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', item.stageColor)}>
                                                    {item.pendingStage}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                {item.daysPending !== null ? (
                                                    <span className={cn(
                                                        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold',
                                                        (item.daysPending ?? 0) <= 3 ? 'bg-green-100 text-green-700' :
                                                            (item.daysPending ?? 0) <= 7 ? 'bg-yellow-100 text-yellow-700' :
                                                                (item.daysPending ?? 0) <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                                    )}>
                                                        {item.daysPending}d
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className="py-2 px-3 text-center whitespace-nowrap text-muted-foreground">{fmtDate(item.plannedDate)}</td>
                                            <td className="py-2 px-3 text-center whitespace-nowrap text-muted-foreground">{fmtDate(item.indentDate)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground flex-shrink-0">
                        <span className="font-semibold">Days waiting:</span>
                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">≤3d On Track</span>
                        <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">4–7d Watch</span>
                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">8–14d Delayed</span>
                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">&gt;14d Critical</span>
                        <span className="ml-2 text-slate-500">• Sorted by most days waiting (critical first)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
