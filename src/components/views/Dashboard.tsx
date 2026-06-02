import Heading from '../element/Heading';
import {
    LayoutDashboard, ClipboardList, Truck, PackageCheck, Warehouse, CreditCard,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, Users, Building2,
    FileText, IndianRupee, BarChart3, Download, Bell, ArrowUpRight, ArrowDownRight,
    Calendar, Filter, RefreshCw, ChevronRight, Package, ShoppingCart, Activity,
    DollarSign, PieChart as PieChartIcon, Layers, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { format, subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, isWithinInterval, differenceInDays, parseISO } from 'date-fns';
import { fetchIndentRecords, type IndentRecord } from '@/services/indentService';
import { fetchStoreInRecords, type StoreInRecord } from '@/services/storeInService';
import { fetchIssueRecords, type IssueRecord } from '@/services/issueService';
import { fetchMasterOptions } from '@/services/masterService';
import { fetchPoMaster } from '@/services/poService';
import { fetchInventoryRecords } from '@/services/inventoryService';
import { fetchPayments } from '@/services/paymentService';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSheets } from '@/context/SheetsContext';
import { cn } from '@/lib/utils';

type QuickFilter = 'today' | 'week' | 'month' | 'quarter' | 'year';

const GREEN_PALETTE = ['#16a34a','#059669','#0d9488','#0891b2','#4f46e5','#7c3aed','#db2777','#ea580c','#ca8a04','#65a30d'];

function fmt(n: number): string {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
}

function exportCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
}

interface KpiCardProps {
    label: string; value: string | number; sub?: string; subValue?: string | number;
    icon: React.ReactNode; color: string; trend?: 'up' | 'down' | 'neutral'; alert?: boolean;
}
function KpiCard({ label, value, sub, subValue, icon, color, trend, alert }: KpiCardProps) {
    return (
        <Card className={cn('relative overflow-hidden border transition-all hover:shadow-md hover:-translate-y-0.5', alert && 'border-red-200 bg-red-50/40')}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
                        <p className={cn('text-2xl font-black mt-1 truncate', color)}>{value}</p>
                        {sub && <div className="flex items-center gap-1 mt-1 border-t border-border/50 pt-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{sub}</p>
                            {subValue !== undefined && <p className="text-[10px] font-bold ml-auto">{subValue}</p>}
                        </div>}
                    </div>
                    <div className={cn('p-2 rounded-lg ml-2 flex-shrink-0', color.replace('text-', 'bg-').replace('-600','-100').replace('-900','-100'))}>
                        {icon}
                    </div>
                </div>
                {trend && (
                    <div className={cn('absolute top-2 right-2 text-[9px] font-bold', trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400')}>
                        {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface SectionHeaderProps { title: string; subtitle?: string; action?: React.ReactNode; }
function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div>
                <h2 className="text-base font-black text-foreground tracking-tight">{title}</h2>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export default function Dashboard() {
    const { pcReportSheet } = useSheets();

    const [indents, setIndents] = useState<IndentRecord[]>([]);
    const [storeIns, setStoreIns] = useState<StoreInRecord[]>([]);
    const [issues, setIssues] = useState<IssueRecord[]>([]);
    const [poMasterData, setPoMasterData] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('month');
    const [activeSection, setActiveSection] = useState<'overview' | 'financial' | 'lifting' | 'pending' | 'analytics'>('overview');
    const [alerts, setAlerts] = useState({ lowStock: 0, outOfStock: 0 });

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [iData, sData, issueData, poData, invData, payData] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                    fetchIssueRecords(),
                    fetchPoMaster(),
                    fetchInventoryRecords(),
                    fetchPayments().catch(() => []),
                ]);
                setIndents(iData);
                setStoreIns(sData);
                setIssues(issueData);
                setPoMasterData(poData);
                setPayments(payData);
                const low = invData.filter(i => (i.current || 0) < 5 && (i.current || 0) > 0).length;
                const outOf = invData.filter(i => (i.current || 0) <= 0).length;
                setAlerts({ lowStock: low, outOfStock: outOf });
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Date range from quick filter
    const dateRange = useMemo(() => {
        const now = new Date();
        switch (quickFilter) {
            case 'today': return { start: new Date(now.setHours(0,0,0,0)), end: new Date() };
            case 'week':  return { start: subDays(new Date(), 7), end: new Date() };
            case 'month': return { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
            case 'quarter': return { start: startOfQuarter(new Date()), end: endOfQuarter(new Date()) };
            case 'year':  return { start: startOfYear(new Date()), end: new Date() };
        }
    }, [quickFilter]);

    const inRange = (dateStr: string | undefined | null) => {
        if (!dateStr) return false;
        try { return isWithinInterval(new Date(dateStr), dateRange); } catch { return false; }
    };

    // ─── Computed KPIs ───────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const uniquePOs = new Set(poMasterData.map(p => p.poNumber)).size;
        const uniqueVendors = new Set(poMasterData.map(p => p.partyName).filter(Boolean)).size;

        // PO value (unique PO — sum once per PO number)
        const poValueMap: Record<string, number> = {};
        poMasterData.forEach(p => { if (p.poNumber && !poValueMap[p.poNumber]) poValueMap[p.poNumber] = Number(p.totalPoAmount) || 0; });
        const totalPoValue = Object.values(poValueMap).reduce((a, b) => a + b, 0);

        // Monthly PO value
        const monthlyPOValue = poMasterData.filter(p => inRange(p.timestamp)).reduce((s, p) => s + (Number(p.totalPoAmount) || 0), 0);

        // Payments KPIs — latest payment per PO
        const latestPayPerPO: Record<string, any> = {};
        payments.forEach(p => {
            if (!latestPayPerPO[p.poNumber] || (p.id > latestPayPerPO[p.poNumber].id)) latestPayPerPO[p.poNumber] = p;
        });
        const latestPays = Object.values(latestPayPerPO);
        const totalPaid = latestPays.reduce((s, p) => s + (Number(p.totalPaidAmount) || 0), 0);
        const totalOutstanding = latestPays.reduce((s, p) => s + (Number(p.outstandingAmount) || 0), 0);
        const pendingPayCount = latestPays.filter(p => (p.status || '').toLowerCase() !== 'complete' && Number(p.outstandingAmount) > 0).length;
        const overdueCount = latestPays.filter(p => {
            if ((p.status || '').toLowerCase() === 'complete') return false;
            if (!p.deliveryDate) return false;
            try { return differenceInDays(new Date(), new Date(p.deliveryDate)) > 0; } catch { return false; }
        }).length;
        const monthlyPayValue = payments.filter(p => inRange(p.timestamp)).reduce((s, p) => s + (Number(p.payAmount) || 0), 0);

        // Liftings
        const liftCompleted = storeIns.filter(s => s.actual6).length;
        const liftPending = storeIns.filter(s => s.plannedHod && !s.actual6).length;
        const liftToday = storeIns.filter(s => s.actual6 && inRange(s.actual6)).length;
        const delayedLifts = storeIns.filter(s => {
            if (s.actual6) return false;
            if (!s.timestamp) return false;
            try { return differenceInDays(new Date(), new Date(s.timestamp)) > 7; } catch { return false; }
        }).length;

        // Pending approvals breakdown
        const pendingDeptApproval = indents.filter(i => !i.actual1).length;
        const pendingVendorAssign = indents.filter(i => i.actual1 && !i.actual2).length;
        const pendingTechApproval = indents.filter(i => i.actual2 && !i.actual3).length;
        const pendingPOCreation = indents.filter(i => i.actual4 === '' || !i.actual4).length;
        const totalPendingApprovals = pendingDeptApproval + pendingVendorAssign + pendingTechApproval;

        return {
            uniquePOs, uniqueVendors, totalPoValue, monthlyPOValue,
            totalPaid, totalOutstanding, pendingPayCount, overdueCount, monthlyPayValue,
            liftCompleted, liftPending, liftToday, delayedLifts,
            pendingDeptApproval, pendingVendorAssign, pendingTechApproval, pendingPOCreation,
            totalPendingApprovals,
            stockAlerts: alerts.lowStock + alerts.outOfStock,
            totalIssued: issues.length,
        };
    }, [indents, storeIns, poMasterData, payments, issues, alerts, quickFilter]);

    // ─── Vendor Payment Table ─────────────────────────────────────────────────
    const vendorPayments = useMemo(() => {
        const map: Record<string, { totalBill: number; paid: number; outstanding: number; dates: string[] }> = {};
        const latest: Record<string, any> = {};
        payments.forEach(p => {
            if (!latest[p.poNumber] || p.id > latest[p.poNumber].id) latest[p.poNumber] = p;
        });
        Object.values(latest).forEach((p: any) => {
            const v = p.partyName || 'Unknown';
            if (!map[v]) map[v] = { totalBill: 0, paid: 0, outstanding: 0, dates: [] };
            map[v].totalBill += Number(p.totalPoAmount) || 0;
            map[v].paid += Number(p.totalPaidAmount) || 0;
            map[v].outstanding += Number(p.outstandingAmount) || 0;
            if (p.deliveryDate) map[v].dates.push(p.deliveryDate);
        });
        return Object.entries(map).map(([name, d]) => ({
            name, totalBill: d.totalBill, paid: d.paid, outstanding: d.outstanding,
            status: d.outstanding <= 0 ? 'Paid' : 'Pending',
            dueDate: d.dates.sort().pop() || '-',
        })).sort((a, b) => b.outstanding - a.outstanding);
    }, [payments]);

    // ─── Aging Analysis ───────────────────────────────────────────────────────
    const agingData = useMemo(() => {
        const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        const now = new Date();
        payments.forEach(p => {
            if (Number(p.outstandingAmount) <= 0) return;
            if (!p.timestamp) return;
            const age = differenceInDays(now, new Date(p.timestamp));
            if (age <= 30) buckets['0-30'] += Number(p.outstandingAmount);
            else if (age <= 60) buckets['31-60'] += Number(p.outstandingAmount);
            else if (age <= 90) buckets['61-90'] += Number(p.outstandingAmount);
            else buckets['90+'] += Number(p.outstandingAmount);
        });
        return Object.entries(buckets).map(([range, amount]) => ({ range, amount }));
    }, [payments]);

    // ─── Monthly Trend ────────────────────────────────────────────────────────
    const trendData = useMemo(() => {
        const months: Record<string, { month: string; poValue: number; payments: number; liftings: number }> = {};
        const addMonth = (dateStr: string) => {
            if (!dateStr) return;
            try {
                const k = format(new Date(dateStr), 'MMM yy');
                if (!months[k]) months[k] = { month: k, poValue: 0, payments: 0, liftings: 0 };
            } catch {}
            return format(new Date(dateStr), 'MMM yy');
        };
        poMasterData.forEach(p => { const k = addMonth(p.timestamp); if (k) months[k].poValue += Number(p.totalPoAmount) || 0; });
        payments.forEach(p => { const k = addMonth(p.timestamp); if (k) months[k].payments += Number(p.payAmount) || 0; });
        storeIns.forEach(s => { if (s.actual6) { const k = addMonth(s.actual6); if (k) months[k].liftings += 1; } });
        return Object.values(months).slice(-6);
    }, [poMasterData, payments, storeIns]);

    // ─── Dept Breakdown ───────────────────────────────────────────────────────
    const deptData = useMemo(() => {
        const map: Record<string, number> = {};
        indents.forEach(i => { const d = i.department || 'Unknown'; map[d] = (map[d] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0,6);
    }, [indents]);

    // ─── Top Vendors ─────────────────────────────────────────────────────────
    const topVendors = useMemo(() => {
        const map: Record<string, { orders: number; value: number }> = {};
        const seen = new Set<string>();
        poMasterData.forEach(p => {
            const v = p.partyName || 'Unknown';
            if (!map[v]) map[v] = { orders: 0, value: 0 };
            map[v].orders += 1;
            if (!seen.has(p.poNumber)) { seen.add(p.poNumber); map[v].value += Number(p.totalPoAmount) || 0; }
        });
        return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.value - a.value).slice(0,5);
    }, [poMasterData]);

    // ─── Pending Payments List ────────────────────────────────────────────────
    const pendingPaymentsList = useMemo(() => {
        const latest: Record<string, any> = {};
        payments.forEach(p => { if (!latest[p.poNumber] || p.id > latest[p.poNumber].id) latest[p.poNumber] = p; });
        return Object.values(latest)
            .filter(p => Number(p.outstandingAmount) > 0 && (p.status||'').toLowerCase() !== 'complete')
            .map(p => ({
                vendor: p.partyName, poNo: p.poNumber, amount: Number(p.outstandingAmount),
                due: p.deliveryDate || '-',
                days: p.deliveryDate ? differenceInDays(new Date(), new Date(p.deliveryDate)) : 0,
            }))
            .sort((a,b) => b.days - a.days)
            .slice(0, 10);
    }, [payments]);

    // ─── Pending Liftings List ────────────────────────────────────────────────
    const pendingLiftingsList = useMemo(() => {
        return indents
            .filter(i => i.actual4 && !i.actual5)
            .map(i => ({
                indentNo: i.indent_number, vendor: i.vendor_name || '-',
                product: i.product_name, qty: i.approved_quantity || i.quantity,
                planned: i.planned5 || '-',
            }))
            .slice(0, 10);
    }, [indents]);

    // ─── Recent Activities ────────────────────────────────────────────────────
    const recentActivities = useMemo(() => {
        const acts: { time: string; type: string; text: string; color: string }[] = [];
        storeIns.slice(0,5).forEach(s => {
            if (s.timestamp) acts.push({ time: s.timestamp, type: 'Lifting', text: `${s.vendorName} — ${s.productName} (${s.qty} units)`, color: 'text-green-600' });
        });
        poMasterData.slice(0,5).forEach(p => {
            if (p.timestamp) acts.push({ time: p.timestamp, type: 'PO Created', text: `PO ${p.poNumber} — ${p.partyName}`, color: 'text-emerald-600' });
        });
        payments.slice(0,5).forEach(p => {
            if (p.timestamp) acts.push({ time: p.timestamp, type: 'Payment', text: `₹${Number(p.payAmount).toLocaleString()} — ${p.partyName}`, color: 'text-blue-600' });
        });
        indents.filter(i => i.actual1).slice(0,3).forEach(i => {
            if (i.timestamp) acts.push({ time: i.timestamp, type: 'Indent', text: `${i.indent_number} — ${i.product_name}`, color: 'text-amber-600' });
        });
        return acts.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0,8);
    }, [storeIns, poMasterData, payments, indents]);

    const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
        { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
        { key: 'month', label: 'This Month' }, { key: 'quarter', label: 'This Quarter' },
        { key: 'year', label: 'This Year' },
    ];
    const NAV = [
        { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={14}/> },
        { key: 'financial', label: 'Financial', icon: <IndianRupee size={14}/> },
        { key: 'lifting', label: 'Lifting', icon: <Truck size={14}/> },
        { key: 'pending', label: 'Pending Work', icon: <Clock size={14}/> },
        { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={14}/> },
    ] as const;

    if (isLoading) return (
        <div className="flex items-center justify-center h-64 gap-3">
            <RefreshCw size={20} className="animate-spin text-green-600" />
            <p className="text-sm font-medium text-muted-foreground">Loading Business Intelligence Data...</p>
        </div>
    );

    return (
        <div>
            <Heading heading="Dashboard" subtext="Business Intelligence & Financial Control Center">
                <LayoutDashboard size={50} className="text-primary" />
            </Heading>

            <div className="p-3 space-y-4">
                {/* ── Alert Banner ────────────────────────────────────────── */}
                {(kpis.overdueCount > 0 || kpis.delayedLifts > 0 || kpis.stockAlerts > 0) && (
                    <div className="flex flex-wrap gap-2">
                        {kpis.overdueCount > 0 && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs font-semibold text-red-700">
                                <AlertTriangle size={13}/> {kpis.overdueCount} Overdue Payments
                            </div>
                        )}
                        {kpis.delayedLifts > 0 && (
                            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs font-semibold text-orange-700">
                                <AlertCircle size={13}/> {kpis.delayedLifts} Delayed Liftings
                            </div>
                        )}
                        {kpis.stockAlerts > 0 && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-semibold text-amber-700">
                                <Bell size={13}/> {kpis.stockAlerts} Stock Alerts
                            </div>
                        )}
                        {kpis.totalPendingApprovals > 0 && (
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700">
                                <Clock size={13}/> {kpis.totalPendingApprovals} Pending Approvals
                            </div>
                        )}
                    </div>
                )}

                {/* ── Controls Bar ─────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
                    {/* Section Nav */}
                    <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border flex-wrap">
                        {NAV.map(n => (
                            <button key={n.key} onClick={() => setActiveSection(n.key as any)}
                                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                    activeSection === n.key ? 'bg-green-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background')}>
                                {n.icon}{n.label}
                            </button>
                        ))}
                    </div>
                    {/* Quick Filters + Export */}
                    <div className="flex gap-1 flex-wrap">
                        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border">
                            {QUICK_FILTERS.map(f => (
                                <button key={f.key} onClick={() => setQuickFilter(f.key)}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                        quickFilter === f.key ? 'bg-green-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background')}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                            onClick={() => exportCSV(vendorPayments, 'vendor-payments')}>
                            <Download size={12}/> Export
                        </Button>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    OVERVIEW SECTION
                ═══════════════════════════════════════════════════════════ */}
                {activeSection === 'overview' && (
                    <div className="space-y-4">
                        {/* Financial KPIs */}
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <IndianRupee size={10}/> Financial Summary
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                <KpiCard label="Total PO Value" value={fmt(kpis.totalPoValue)} icon={<CreditCard size={16}/>} color="text-emerald-700" sub="Monthly" subValue={fmt(kpis.monthlyPOValue)} />
                                <KpiCard label="Total Paid" value={fmt(kpis.totalPaid)} icon={<CheckCircle2 size={16}/>} color="text-green-700" sub="This Period" subValue={fmt(kpis.monthlyPayValue)} />
                                <KpiCard label="Outstanding" value={fmt(kpis.totalOutstanding)} icon={<TrendingUp size={16}/>} color="text-red-600" alert={kpis.totalOutstanding > 0} />
                                <KpiCard label="Pending Payments" value={kpis.pendingPayCount} icon={<Clock size={16}/>} color="text-orange-600" sub="Overdue" subValue={kpis.overdueCount} alert={kpis.overdueCount > 0} />
                                <KpiCard label="Total POs" value={kpis.uniquePOs} icon={<FileText size={16}/>} color="text-emerald-700" />
                                <KpiCard label="Total Vendors" value={kpis.uniqueVendors} icon={<Building2 size={16}/>} color="text-teal-700" />
                            </div>
                        </div>

                        {/* Operational KPIs */}
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Activity size={10}/> Operational Summary
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                <KpiCard label="Liftings Done" value={kpis.liftCompleted} icon={<Truck size={16}/>} color="text-green-700" sub="Today" subValue={kpis.liftToday} />
                                <KpiCard label="Liftings Pending" value={kpis.liftPending} icon={<Package size={16}/>} color="text-amber-600" sub="Delayed" subValue={kpis.delayedLifts} alert={kpis.delayedLifts > 0} />
                                <KpiCard label="Dept Approvals" value={kpis.pendingDeptApproval} icon={<ClipboardList size={16}/>} color="text-violet-600" />
                                <KpiCard label="Vendor Assign" value={kpis.pendingVendorAssign} icon={<Users size={16}/>} color="text-indigo-600" />
                                <KpiCard label="Tech Approvals" value={kpis.pendingTechApproval} icon={<Layers size={16}/>} color="text-cyan-700" />
                                <KpiCard label="Stock Alerts" value={kpis.stockAlerts} icon={<Warehouse size={16}/>} color="text-red-600" sub="Low Stock" subValue={alerts.lowStock} alert={kpis.stockAlerts > 0} />
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <Card className="lg:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Monthly Business Trend</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="gPO" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/>
                                                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15}/>
                                                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4"/>
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:10}}/>
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize:10}} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${v}`}/>
                                            <Tooltip formatter={(v: any) => fmt(Number(v))}/>
                                            <Area type="monotone" dataKey="poValue" stroke="#16a34a" fill="url(#gPO)" strokeWidth={2} name="PO Value"/>
                                            <Area type="monotone" dataKey="payments" stroke="#059669" fill="url(#gPay)" strokeWidth={2} name="Payments"/>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Dept. Indenting</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[160px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={deptData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                                                    {deptData.map((_, i) => <Cell key={i} fill={GREEN_PALETTE[i % GREEN_PALETTE.length]}/>)}
                                                </Pie>
                                                <Tooltip/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-1 mt-1">
                                        {deptData.slice(0,4).map((d,i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: GREEN_PALETTE[i % GREEN_PALETTE.length]}}/>
                                                <span className="truncate flex-1 text-muted-foreground">{d.name}</span>
                                                <span className="font-bold">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activities + PC Report */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Activity size={14} className="text-green-600"/> Recent Activities
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
                                    {recentActivities.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No recent activities</p>}
                                    {recentActivities.map((a, i) => (
                                        <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                            <div className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-md mt-0.5 flex-shrink-0 bg-muted', a.color)}>
                                                {a.type}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate">{a.text}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {(() => { try { return format(new Date(a.time), 'dd MMM, HH:mm'); } catch { return '-'; } })()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Layers size={14} className="text-green-600"/> PC Report Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto">
                                    {pcReportSheet.map((pc, i) => (
                                        <div key={i} className="p-2.5 bg-muted/20 rounded-lg border border-border/50">
                                            <p className="text-[9px] uppercase font-black text-muted-foreground truncate" title={pc.stage}>{pc.stage}</p>
                                            <div className="flex justify-between items-end mt-1">
                                                <div>
                                                    <p className="text-lg font-black text-foreground">{pc.totalPending}</p>
                                                    <p className="text-[8px] text-red-500 font-bold uppercase">Pending</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-green-600">{pc.totalComplete}</p>
                                                    <p className="text-[8px] text-green-500 font-bold uppercase">Done</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    FINANCIAL SECTION
                ═══════════════════════════════════════════════════════════ */}
                {activeSection === 'financial' && (
                    <div className="space-y-4">
                        {/* Financial KPI Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-xl p-4 text-white">
                                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Total PO Value</p>
                                <p className="text-2xl font-black mt-1">{fmt(kpis.totalPoValue)}</p>
                                <p className="text-[10px] opacity-70 mt-1">{kpis.uniquePOs} Purchase Orders</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
                                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Total Paid</p>
                                <p className="text-2xl font-black mt-1">{fmt(kpis.totalPaid)}</p>
                                <p className="text-[10px] opacity-70 mt-1">This Period: {fmt(kpis.monthlyPayValue)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-red-500 to-rose-500 rounded-xl p-4 text-white">
                                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Outstanding</p>
                                <p className="text-2xl font-black mt-1">{fmt(kpis.totalOutstanding)}</p>
                                <p className="text-[10px] opacity-70 mt-1">{kpis.pendingPayCount} vendors pending</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white">
                                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Overdue</p>
                                <p className="text-2xl font-black mt-1">{kpis.overdueCount}</p>
                                <p className="text-[10px] opacity-70 mt-1">Payments overdue</p>
                            </div>
                        </div>

                        {/* Outstanding Aging */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Outstanding Aging Analysis</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={agingData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="range" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                                            <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v => fmt(Number(v)).replace('₹','')}/>
                                            <Tooltip formatter={(v:any) => fmt(Number(v))}/>
                                            <Bar dataKey="amount" radius={[4,4,0,0]} name="Outstanding">
                                                {agingData.map((_, i) => <Cell key={i} fill={['#16a34a','#ca8a04','#ea580c','#dc2626'][i]}/>)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-bold">Vendor Payment Distribution</CardTitle>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                        onClick={() => exportCSV(vendorPayments, 'vendor-payments')}>
                                        <Download size={11}/> CSV
                                    </Button>
                                </CardHeader>
                                <CardContent className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topVendors} layout="vertical">
                                            <XAxis type="number" hide/>
                                            <YAxis dataKey="name" type="category" width={90} tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                                            <Tooltip formatter={(v:any) => fmt(Number(v))}/>
                                            <Bar dataKey="value" fill="#16a34a" radius={[0,4,4,0]} name="PO Value"/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Vendor Payment Table */}
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-bold">Vendor-wise Payment Analysis</CardTitle>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                    onClick={() => exportCSV(vendorPayments, 'vendor-payments')}>
                                    <Download size={11}/> Export CSV
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b bg-green-50">
                                                <th className="text-left p-3 font-black text-green-800 uppercase tracking-wide">Vendor</th>
                                                <th className="text-right p-3 font-black text-green-800 uppercase tracking-wide">Total Bill</th>
                                                <th className="text-right p-3 font-black text-green-800 uppercase tracking-wide">Paid</th>
                                                <th className="text-right p-3 font-black text-green-800 uppercase tracking-wide">Balance</th>
                                                <th className="text-center p-3 font-black text-green-800 uppercase tracking-wide">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vendorPayments.length === 0 && (
                                                <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">No payment data available</td></tr>
                                            )}
                                            {vendorPayments.slice(0,15).map((v,i) => (
                                                <tr key={i} className={cn('border-b hover:bg-muted/20 transition-colors', i % 2 === 0 ? '' : 'bg-muted/5')}>
                                                    <td className="p-3 font-semibold max-w-[200px] truncate">{v.name}</td>
                                                    <td className="p-3 text-right font-medium">{fmt(v.totalBill)}</td>
                                                    <td className="p-3 text-right font-medium text-green-600">{fmt(v.paid)}</td>
                                                    <td className={cn('p-3 text-right font-black', v.outstanding > 0 ? 'text-red-600' : 'text-green-600')}>{fmt(v.outstanding)}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase', v.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                                            {v.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {vendorPayments.length > 0 && (
                                            <tfoot>
                                                <tr className="bg-green-50 font-black border-t-2 border-green-200">
                                                    <td className="p-3 text-green-800">TOTAL</td>
                                                    <td className="p-3 text-right text-green-800">{fmt(vendorPayments.reduce((s,v)=>s+v.totalBill,0))}</td>
                                                    <td className="p-3 text-right text-green-800">{fmt(vendorPayments.reduce((s,v)=>s+v.paid,0))}</td>
                                                    <td className="p-3 text-right text-red-700">{fmt(vendorPayments.reduce((s,v)=>s+v.outstanding,0))}</td>
                                                    <td/>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    LIFTING SECTION
                ═══════════════════════════════════════════════════════════ */}
                {activeSection === 'lifting' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { label: 'Total Liftings', value: storeIns.length, color: 'from-green-600 to-emerald-500' },
                                { label: 'Completed', value: kpis.liftCompleted, color: 'from-emerald-500 to-teal-500' },
                                { label: 'Pending', value: kpis.liftPending, color: 'from-amber-500 to-orange-500' },
                                { label: 'Delayed', value: kpis.delayedLifts, color: 'from-red-500 to-rose-500' },
                            ].map((s, i) => (
                                <div key={i} className={`bg-gradient-to-br ${s.color} rounded-xl p-4 text-white`}>
                                    <p className="text-[10px] font-black uppercase tracking-wider opacity-80">{s.label}</p>
                                    <p className="text-3xl font-black mt-1">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-bold">Pending Liftings — PO Wise</CardTitle>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                    onClick={() => exportCSV(pendingLiftingsList, 'pending-liftings')}>
                                    <Download size={11}/> CSV
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b bg-amber-50">
                                                {['Indent No.','Vendor','Product','Qty','Planned Date'].map(h => (
                                                    <th key={h} className="text-left p-3 font-black text-amber-800 uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingLiftingsList.length === 0 && (
                                                <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">No pending liftings</td></tr>
                                            )}
                                            {pendingLiftingsList.map((l,i) => (
                                                <tr key={i} className={cn('border-b hover:bg-muted/20', i % 2 === 0 ? '' : 'bg-muted/5')}>
                                                    <td className="p-3 font-bold text-green-700">{l.indentNo}</td>
                                                    <td className="p-3 max-w-[160px] truncate">{l.vendor}</td>
                                                    <td className="p-3 max-w-[160px] truncate">{l.product}</td>
                                                    <td className="p-3 font-semibold">{l.qty}</td>
                                                    <td className="p-3">{(() => { try { return l.planned && l.planned !== '-' ? format(new Date(l.planned), 'dd MMM yy') : '-'; } catch { return l.planned; } })()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold">Monthly Lifting Performance</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                        <XAxis dataKey="month" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                                        <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                                        <Tooltip/>
                                        <Bar dataKey="liftings" fill="#16a34a" radius={[4,4,0,0]} name="Liftings Completed"/>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    PENDING WORK SECTION
                ═══════════════════════════════════════════════════════════ */}
                {activeSection === 'pending' && (
                    <div className="space-y-4">
                        {/* Summary Pills */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { label: 'Pending Payments', value: kpis.pendingPayCount, color: 'bg-red-50 border-red-200 text-red-700' },
                                { label: 'Pending Liftings', value: kpis.liftPending, color: 'bg-amber-50 border-amber-200 text-amber-700' },
                                { label: 'Dept Approvals', value: kpis.pendingDeptApproval, color: 'bg-violet-50 border-violet-200 text-violet-700' },
                                { label: 'PO Creations', value: kpis.pendingPOCreation, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                            ].map((s,i) => (
                                <div key={i} className={cn('rounded-xl p-4 border', s.color)}>
                                    <p className="text-[10px] font-black uppercase tracking-wider opacity-80">{s.label}</p>
                                    <p className="text-3xl font-black mt-1">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Pending Payments Table */}
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-bold text-red-700 flex items-center gap-2">
                                    <IndianRupee size={14}/> Pending Payments
                                </CardTitle>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                    onClick={() => exportCSV(pendingPaymentsList, 'pending-payments')}>
                                    <Download size={11}/> CSV
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b bg-red-50">
                                                {['Vendor','PO No.','Outstanding','Due Date','Days Pending','Status'].map(h => (
                                                    <th key={h} className="text-left p-3 font-black text-red-800 uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingPaymentsList.length === 0 && (
                                                <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">No pending payments — all clear! ✓</td></tr>
                                            )}
                                            {pendingPaymentsList.map((p,i) => (
                                                <tr key={i} className={cn('border-b hover:bg-muted/20', i % 2 === 0 ? '' : 'bg-muted/5')}>
                                                    <td className="p-3 font-semibold max-w-[160px] truncate">{p.vendor}</td>
                                                    <td className="p-3 text-muted-foreground">{p.poNo}</td>
                                                    <td className="p-3 font-black text-red-600">{fmt(p.amount)}</td>
                                                    <td className="p-3">{(() => { try { return p.due !== '-' ? format(new Date(p.due), 'dd MMM yy') : '-'; } catch { return p.due; } })()}</td>
                                                    <td className="p-3">
                                                        <span className={cn('font-black', p.days > 30 ? 'text-red-600' : p.days > 0 ? 'text-orange-500' : 'text-green-600')}>
                                                            {p.days > 0 ? `${p.days}d overdue` : p.days < 0 ? `${Math.abs(p.days)}d left` : 'Due today'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase', p.days > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                                                            {p.days > 0 ? 'Overdue' : 'Pending'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Approval Stages */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Clock size={14}/> Pending Approval Stages
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { stage: 'Dept. Approval', desc: 'Awaiting department head', count: kpis.pendingDeptApproval, color: 'border-violet-200 bg-violet-50 text-violet-700' },
                                        { stage: 'Vendor Assignment', desc: 'Rate comparison pending', count: kpis.pendingVendorAssign, color: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
                                        { stage: 'Tech. Approval', desc: 'Technical review needed', count: kpis.pendingTechApproval, color: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
                                        { stage: 'PO Creation', desc: 'Approved, PO not created', count: kpis.pendingPOCreation, color: 'border-green-200 bg-green-50 text-green-700' },
                                    ].map((s,i) => (
                                        <div key={i} className={cn('rounded-xl p-4 border', s.color)}>
                                            <p className="text-2xl font-black">{s.count}</p>
                                            <p className="text-xs font-black mt-1">{s.stage}</p>
                                            <p className="text-[10px] opacity-70 mt-0.5">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    ANALYTICS SECTION
                ═══════════════════════════════════════════════════════════ */}
                {activeSection === 'analytics' && (
                    <div className="space-y-4">
                        {/* Top Vendors */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Top Vendors by PO Value</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {topVendors.map((v,i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">{i+1}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <p className="text-xs font-semibold truncate">{v.name}</p>
                                                    <p className="text-xs font-black text-emerald-700 ml-2 flex-shrink-0">{fmt(v.value)}</p>
                                                </div>
                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                                                        style={{width: `${topVendors[0].value > 0 ? (v.value / topVendors[0].value) * 100 : 0}%`}}/>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{v.orders} orders</p>
                                            </div>
                                        </div>
                                    ))}
                                    {topVendors.length === 0 && <p className="text-xs text-center text-muted-foreground py-6">No vendor data</p>}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Monthly Trend — PO vs Payments</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={trendData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                                            <YAxis tick={{fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${v}`}/>
                                            <Tooltip formatter={(v:any) => fmt(Number(v))}/>
                                            <Bar dataKey="poValue" fill="#16a34a" radius={[4,4,0,0]} name="PO Value"/>
                                            <Bar dataKey="payments" fill="#059669" radius={[4,4,0,0]} name="Payments"/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Dept + Payment Status Pie */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Department Distribution</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={deptData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="name" tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                                            <YAxis tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                                            <Tooltip/>
                                            <Bar dataKey="value" radius={[4,4,0,0]} name="Indents">
                                                {deptData.map((_,i) => <Cell key={i} fill={GREEN_PALETTE[i % GREEN_PALETTE.length]}/>)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">Payment Status Overview</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center h-[220px]">
                                    <ResponsiveContainer width="100%" height="75%">
                                        <PieChart>
                                            <Pie data={[
                                                { name: 'Paid', value: vendorPayments.filter(v=>v.status==='Paid').length },
                                                { name: 'Pending', value: vendorPayments.filter(v=>v.status!=='Paid').length },
                                            ]} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                                                <Cell fill="#16a34a"/>
                                                <Cell fill="#ef4444"/>
                                            </Pie>
                                            <Tooltip/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex gap-6 text-xs mt-2">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-600"/><span className="font-bold">Paid: {vendorPayments.filter(v=>v.status==='Paid').length}</span></div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"/><span className="font-bold">Pending: {vendorPayments.filter(v=>v.status!=='Paid').length}</span></div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
