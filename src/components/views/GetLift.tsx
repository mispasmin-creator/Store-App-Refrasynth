import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState, useMemo } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '@/lib/supabase';
import {
    Dialog, DialogContent, DialogTitle, DialogTrigger, DialogHeader,
    DialogFooter,
} from '../ui/dialog';
import { z } from 'zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
    ShoppingCart, X, Truck, AlertTriangle, CheckCircle2,
    TrendingUp, Package, Users, Download, Calendar,
    AlertCircle, Activity, BarChart2, RefreshCw, Clock, FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime, parseCustomDate } from '@/lib/utils';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import {
    fetchIndentRecords, fetchStoreInRecords, fetchVendorOptions,
    insertStoreInRecord, updateCancelQuantity, updateActual5Timestamp,
    updateLiftingStatus, type GetLiftIndentRecord, type GetLiftStoreInRecord,
} from '@/services/getLiftService';
import { differenceInDays, format, isThisMonth } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────
type LiftStatus = 'completed' | 'overdue' | 'today' | 'this_week' | 'partial' | 'pending';

interface ProcessedRecord {
    indentNumber: string;
    firmNameMatch: string;
    vendorName: string;
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    plannedDate: string;
    actualDate: string;
    productName: string;
    orderedQty: number;
    liftedQty: number;
    remainingQty: number;
    uom: string;
    approvedRate: string;
    liftingStatus: string;
    status: LiftStatus;
    daysRemaining: number;
    completionPct: number;
    department: string;
    areaOfUse: string;
    rawIndent: GetLiftIndentRecord;
    storeIns: GetLiftStoreInRecord[];
    createdAt: string;
    lastLiftDate: string;
    expectedDate: string;
}

interface AuthUser {
    firmNameMatch?: string;
    receiveItemAction?: boolean;
    administrate?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────
function safeParseDate(val: string | null | undefined): Date | null {
    if (!val) return null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
}

function getStatus(rec: { plannedDate: string; liftingStatus: string; liftedQty: number; remainingQty: number }): LiftStatus {
    if (rec.liftingStatus === 'Complete') return 'completed';
    const d = safeParseDate(rec.plannedDate);
    if (!d) return rec.liftedQty > 0 ? 'partial' : 'pending';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    if (d < today) return 'overdue';
    if (d.getTime() === today.getTime()) return 'today';
    if (differenceInDays(d, today) <= 7) return 'this_week';
    if (rec.liftedQty > 0 && rec.remainingQty > 0) return 'partial';
    return 'pending';
}

function rowBg(status: LiftStatus) {
    const m: Record<LiftStatus, string> = {
        overdue: 'bg-red-50 border-l-4 border-l-red-500',
        today: 'bg-orange-50 border-l-4 border-l-orange-500',
        this_week: 'bg-yellow-50 border-l-4 border-l-yellow-400',
        completed: 'bg-green-50 border-l-4 border-l-green-500',
        partial: 'bg-blue-50 border-l-4 border-l-blue-500',
        pending: '',
    };
    return m[status];
}

function StatusBadge({ status }: { status: LiftStatus }) {
    const m: Record<LiftStatus, { label: string; cls: string }> = {
        overdue: { label: '🔴 Overdue', cls: 'bg-red-100 text-red-700 border border-red-200' },
        today: { label: '🟠 Due Today', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
        this_week: { label: '🟡 This Week', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
        completed: { label: '🟢 Completed', cls: 'bg-green-100 text-green-700 border border-green-200' },
        partial: { label: '🔵 Partial', cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
        pending: { label: '⚪ Pending', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    };
    const s = m[status];
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

function exportCSV(data: ProcessedRecord[], name: string) {
    const hdr = ['PO Number', 'Vendor', 'Product', 'Ordered Qty', 'Lifted Qty', 'Remaining Qty', 'UOM', 'Planned Date', 'Expected Date', 'Days Remaining', 'Status', 'Completion %'];
    const rows = data.map(r => [r.poNumber, r.vendorName, r.productName, r.orderedQty, r.liftedQty, r.remainingQty, r.uom, r.plannedDate, r.expectedDate, r.daysRemaining, r.status, r.completionPct.toFixed(1)]);
    const csv = [hdr, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${name}.csv`;
    a.click();
}

const PIE_COLORS = ['#16a34a', '#ef4444', '#f59e0b', '#eab308', '#3b82f6', '#6b7280'];

// ── KPI Card ───────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color }: {
    title: string; value: number | string; sub?: string;
    icon: React.ElementType; color: string;
}) {
    return (
        <div className={`rounded-xl border bg-white p-4 shadow-sm flex items-start gap-3`}>
            <div className={`p-2 rounded-lg ${color} shrink-0`}>
                <Icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium truncate">{title}</p>
                <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
                {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────
interface GetPurchaseData {
    indentNo: string; firmNameMatch: string; vendorName: string; poNumber: string; poDate: string;
    deliveryDate: string; product?: string; quantity?: number; pendingLiftQty?: number;
    receivedQty?: number; pendingPoQty?: number; plannedDate?: string; approvedRate?: string;
    timestamp?: string; department?: string; areaOfUse?: string; approvedVendorName?: string;
    liftingStatus?: string; products?: string[]; indentNumbers?: string[]; expectedDate?: string;
    originalItems?: any[];
}

interface HistoryData {
    indentNo: string; firmNameMatch: string; vendorName: string; poNumber: string; poDate: string;
    deliveryDate: string; product?: string; photoOfBill?: string; quantity?: number;
    pendingLiftQty?: number; receivedQty?: number; pendingPoQty?: number; timestamp?: string;
    department?: string; areaOfUse?: string; approvedVendorName?: string; liftingStatus?: string;
    products?: string[]; indentNumbers?: string[]; originalItems?: any[]; liftNumber: string;
    qty?: number; billNo?: string; billStatus?: string; typeOfBill?: string; billAmount?: number;
    transportationInclude?: string; transporterName?: string; vehicleNo?: string; driverName?: string;
    driverMobileNo?: string; amount?: number; billRemark?: string; approvedRate?: string;
    taxValue?: number; withTax?: string;
}

export default function GetPurchase() {
    const { user } = useAuth() as { user: AuthUser };

    // ── Existing state ──────────────────────────────────────────────────
    const [selectedIndent, setSelectedIndent] = useState<GetPurchaseData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<GetPurchaseData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [vendorOptions, setVendorOptions] = useState<string[]>([]);
    const [showCancelQty, setShowCancelQty] = useState(false);
    const [cancelQtyValue, setCancelQtyValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [indentRecords, setIndentRecords] = useState<GetLiftIndentRecord[]>([]);
    const [storeInRecords, setStoreInRecords] = useState<GetLiftStoreInRecord[]>([]);

    // ── New dashboard state ─────────────────────────────────────────────
    const [searchFilter, setSearchFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<LiftStatus | 'all'>('all');
    const [vendorFilter, setVendorFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

    // ── Data fetch ──────────────────────────────────────────────────────
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [vendors, indents, storeIns] = await Promise.all([
                fetchVendorOptions(), fetchIndentRecords(), fetchStoreInRecords(),
            ]);
            setVendorOptions(vendors);
            setIndentRecords(indents);
            setStoreInRecords(storeIns);
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

    // ── Process ALL records into unified flat list ──────────────────────
    const processedRecords = useMemo<ProcessedRecord[]>(() => {
        const filtered = indentRecords.filter(r =>
            user?.firmNameMatch?.toLowerCase() === 'all' || r.firmNameMatch === user?.firmNameMatch
        );
        return filtered.map(r => {
            const relatedStoreIns = storeInRecords.filter(
                s => s.indentNo === r.indentNumber?.toString() && s.firmNameMatch === r.firmNameMatch
            );
            const liftedQty = (Number(r.receivedQuantity) || 0) + relatedStoreIns.reduce((s, x) => s + (Number(x.qty) || 0), 0);
            const orderedQty = Number(r.approvedQuantity) || Number(r.quantity) || 0;
            const remainingQty = Math.max(0, orderedQty - liftedQty);
            const completionPct = orderedQty > 0 ? Math.min(100, (liftedQty / orderedQty) * 100) : 0;
            const plannedDate = r.planned5 || '';
            const d = safeParseDate(plannedDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const daysRemaining = d ? differenceInDays(d, today) : 0;
            const rec = { plannedDate, liftingStatus: r.liftingStatus || '', liftedQty, remainingQty };
            const status = getStatus(rec);
            const lastLiftDate = relatedStoreIns.length
                ? relatedStoreIns.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0].timestamp
                : '';
            return {
                indentNumber: r.indentNumber || '',
                firmNameMatch: r.firmNameMatch || '',
                vendorName: r.approvedVendorName || '',
                poNumber: r.poNumber || '',
                poDate: r.actual4 ? formatDate(parseCustomDate(r.actual4)) : '',
                deliveryDate: r.deliveryDate ? formatDate(parseCustomDate(r.deliveryDate)) : '',
                plannedDate,
                actualDate: r.actual5 || '',
                productName: r.productName || '',
                orderedQty,
                liftedQty,
                remainingQty,
                uom: r.uom || '',
                approvedRate: r.approvedRate || '',
                liftingStatus: r.liftingStatus || '',
                status,
                daysRemaining,
                completionPct,
                department: r.department || '',
                areaOfUse: r.areaOfUse || '',
                rawIndent: r,
                storeIns: relatedStoreIns,
                createdAt: r.timestamp || '',
                lastLiftDate,
                expectedDate: r.expectedDate ? formatDate(parseCustomDate(r.expectedDate)) : '',
            } as ProcessedRecord;
        });
    }, [indentRecords, storeInRecords, user?.firmNameMatch]);

    // ── KPIs ────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const today = new Date();
        return {
            totalPOs: new Set(processedRecords.map(r => r.poNumber)).size,
            totalPlanned: processedRecords.filter(r => r.plannedDate).length,
            totalCompleted: processedRecords.filter(r => r.status === 'completed').length,
            totalPending: processedRecords.filter(r => r.status !== 'completed').length,
            overdue: processedRecords.filter(r => r.status === 'overdue').length,
            todayCount: processedRecords.filter(r => r.status === 'today').length,
            thisWeek: processedRecords.filter(r => r.status === 'this_week').length,
            thisMonth: processedRecords.filter(r => {
                const d = safeParseDate(r.plannedDate);
                return d && isThisMonth(d) && r.status !== 'completed';
            }).length,
            totalQtyOrdered: processedRecords.reduce((s, r) => s + r.orderedQty, 0),
            totalQtyLifted: processedRecords.reduce((s, r) => s + r.liftedQty, 0),
            remainingQty: processedRecords.reduce((s, r) => s + r.remainingQty, 0),
        };
    }, [processedRecords]);

    // ── Filtered records ────────────────────────────────────────────────
    const filteredRecords = useMemo(() => {
        let data = [...processedRecords];
        if (searchFilter) {
            const q = searchFilter.toLowerCase();
            data = data.filter(r =>
                r.poNumber.toLowerCase().includes(q) ||
                r.vendorName.toLowerCase().includes(q) ||
                r.productName.toLowerCase().includes(q) ||
                r.indentNumber.toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'all') data = data.filter(r => r.status === statusFilter);
        if (vendorFilter !== 'all') data = data.filter(r => r.vendorName === vendorFilter);
        if (dateFilter === 'today') data = data.filter(r => r.status === 'today' || r.status === 'overdue');
        else if (dateFilter === 'week') data = data.filter(r => ['today', 'this_week', 'overdue'].includes(r.status));
        else if (dateFilter === 'month') {
            data = data.filter(r => {
                const d = safeParseDate(r.plannedDate);
                return d && isThisMonth(d);
            });
        }
        return data;
    }, [processedRecords, searchFilter, statusFilter, vendorFilter, dateFilter]);

    // ── Vendor summary ──────────────────────────────────────────────────
    const vendorSummary = useMemo(() => {
        const map = new Map<string, { vendor: string; totalPOs: number; ordered: number; lifted: number; remaining: number }>();
        processedRecords.forEach(r => {
            if (!map.has(r.vendorName)) map.set(r.vendorName, { vendor: r.vendorName, totalPOs: 0, ordered: 0, lifted: 0, remaining: 0 });
            const v = map.get(r.vendorName)!;
            v.totalPOs++;
            v.ordered += r.orderedQty;
            v.lifted += r.liftedQty;
            v.remaining += r.remainingQty;
        });
        return Array.from(map.values()).map(v => ({ ...v, completion: v.ordered > 0 ? Math.round((v.lifted / v.ordered) * 100) : 0 }));
    }, [processedRecords]);

    // ── Material summary ────────────────────────────────────────────────
    const materialSummary = useMemo(() => {
        const map = new Map<string, { material: string; ordered: number; lifted: number; remaining: number }>();
        processedRecords.forEach(r => {
            if (!map.has(r.productName)) map.set(r.productName, { material: r.productName, ordered: 0, lifted: 0, remaining: 0 });
            const m = map.get(r.productName)!;
            m.ordered += r.orderedQty;
            m.lifted += r.liftedQty;
            m.remaining += r.remainingQty;
        });
        return Array.from(map.values());
    }, [processedRecords]);

    // ── Monthly trend ───────────────────────────────────────────────────
    const monthlyTrend = useMemo(() => {
        const map = new Map<string, { month: string; lifted: number; ordered: number }>();
        processedRecords.forEach(r => {
            const d = safeParseDate(r.plannedDate);
            if (!d) return;
            const key = format(d, 'MMM yy');
            if (!map.has(key)) map.set(key, { month: key, lifted: 0, ordered: 0 });
            const m = map.get(key)!;
            m.ordered += r.orderedQty;
            m.lifted += r.liftedQty;
        });
        return Array.from(map.values()).slice(-12);
    }, [processedRecords]);

    // ── Status distribution for pie chart ──────────────────────────────
    const statusDist = useMemo(() => {
        const cnt: Record<LiftStatus, number> = { completed: 0, overdue: 0, today: 0, this_week: 0, partial: 0, pending: 0 };
        processedRecords.forEach(r => cnt[r.status]++);
        return [
            { name: 'Completed', value: cnt.completed },
            { name: 'Overdue', value: cnt.overdue },
            { name: 'Due Today', value: cnt.today },
            { name: 'This Week', value: cnt.this_week },
            { name: 'Partial', value: cnt.partial },
            { name: 'Pending', value: cnt.pending },
        ].filter(x => x.value > 0);
    }, [processedRecords]);

    // ── Existing pending/history processing (for action modal) ──────────
    useEffect(() => {
        const filteredByFirm = indentRecords.filter(sheet =>
            user?.firmNameMatch?.toLowerCase() === 'all' || sheet.firmNameMatch === user?.firmNameMatch
        );
        const processedData = filteredByFirm.map(sheet => {
            const receivedQty = (Number(sheet.receivedQuantity) || 0) + storeInRecords
                .filter(store => store.indentNo === sheet.indentNumber?.toString() && store.firmNameMatch === sheet.firmNameMatch)
                .reduce((sum, store) => sum + (Number(store.qty) || 0), 0);
            const approvedQtySafe = Number(sheet.approvedQuantity) || Number(sheet.quantity) || 0;
            const pendingPoQty = approvedQtySafe - receivedQty;
            return { ...sheet, pendingPoQty, receivedQty };
        }).filter(item => {
            const hasPlanned5 = item.planned5 && item.planned5.toString().trim() !== '';
            const hasActual5 = item.actual5 && item.actual5.toString().trim() !== '';
            const isPending = item.liftingStatus === 'Pending' || item.liftingStatus === '' || item.liftingStatus === null;
            return isPending && hasPlanned5 && !hasActual5 && item.pendingPoQty > 0;
        });
        const groupedMap = new Map<string, any>();
        processedData.forEach(item => {
            const key = item.poNumber || `NO_PO_${item.indentNumber}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    indentNo: item.indentNumber?.toString() || '', firmNameMatch: item.firmNameMatch || '',
                    vendorName: item.approvedVendorName || '', poNumber: item.poNumber || '',
                    poDate: item.actual4 ? formatDate(parseCustomDate(item.actual4)) : '',
                    deliveryDate: item.deliveryDate ? formatDate(parseCustomDate(item.deliveryDate)) : '',
                    plannedDate: item.planned5 ? formatDate(parseCustomDate(item.planned5)) : 'Not Set',
                    product: item.productName || '', quantity: 0, pendingLiftQty: 0, receivedQty: 0, pendingPoQty: 0,
                    approvedRate: item.approvedRate || '', timestamp: item.timestamp || '',
                    department: item.department || '', areaOfUse: item.areaOfUse || '',
                    approvedVendorName: item.approvedVendorName || '', liftingStatus: item.liftingStatus || '',
                    indentNumbers: [], products: [],
                    expectedDate: item.expectedDate ? formatDate(parseCustomDate(item.expectedDate)) : '',
                    rawExpectedDate: item.expectedDate || null, originalItems: [],
                });
            }
            const group = groupedMap.get(key);
            group.quantity += Number(item.approvedQuantity) || 0;
            group.pendingLiftQty += item.pendingPoQty;
            group.receivedQty += item.receivedQty;
            group.pendingPoQty += item.pendingPoQty;
            group.indentNumbers.push(item.indentNumber);
            group.products.push(item.productName);
            group.originalItems.push(item);
        });
        const sorted = Array.from(groupedMap.values()).sort((a, b) => {
            const dA = a.rawExpectedDate ? parseCustomDate(a.rawExpectedDate).getTime() : Infinity;
            const dB = b.rawExpectedDate ? parseCustomDate(b.rawExpectedDate).getTime() : Infinity;
            return dA - dB;
        });
        setTableData(sorted);
    }, [indentRecords, storeInRecords, user?.firmNameMatch]);

    useEffect(() => {
        const filteredByFirm = indentRecords.filter(sheet =>
            user?.firmNameMatch?.toLowerCase() === 'all' || sheet.firmNameMatch === user?.firmNameMatch
        );
        const completedIndents = filteredByFirm.filter(sheet =>
            sheet.liftingStatus === 'Complete' && sheet.planned5 && sheet.planned5.toString().trim() !== ''
        );
        const indentDataMap = new Map(completedIndents.map(sheet => [
            `${sheet.indentNumber?.toString() || ''}_${sheet.firmNameMatch || ''}`,
            { poNumber: sheet.poNumber || '', poDate: sheet.actual4 ? formatDate(parseCustomDate(sheet.actual4)) : '', deliveryDate: sheet.deliveryDate ? formatDate(parseCustomDate(sheet.deliveryDate)) : '', approvedVendorName: sheet.approvedVendorName || '', productName: sheet.productName || '', approvedQuantity: sheet.quantity || 0, pendingLiftQty: sheet.pendingQty || 0, firmNameMatch: sheet.firmNameMatch || '' },
        ]));
        const filteredStoreIn = storeInRecords.filter(sheet =>
            user?.firmNameMatch?.toLowerCase() === 'all' || sheet.firmNameMatch === user?.firmNameMatch
        );
        setHistoryData(
            filteredStoreIn
                .filter(sheet => indentDataMap.has(`${sheet.indentNo || ''}_${sheet.firmNameMatch || ''}`))
                .map(sheet => {
                    const indentData = indentDataMap.get(`${sheet.indentNo || ''}_${sheet.firmNameMatch || ''}`)!;
                    const indentRecord = completedIndents.find(i => i.indentNumber?.toString() === sheet.indentNo && i.firmNameMatch === sheet.firmNameMatch);
                    const approvedQty = Number(indentRecord?.approvedQuantity) || 0;
                    const receivedQty = (Number(indentRecord?.receivedQuantity) || 0) + filteredStoreIn
                        .filter(s => s.indentNo === sheet.indentNo && s.firmNameMatch === sheet.firmNameMatch)
                        .reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
                    const pendingLift = approvedQty - receivedQty;
                    return {
                        liftNumber: sheet.liftNumber || '', indentNo: sheet.indentNo || '',
                        firmNameMatch: indentData.firmNameMatch || sheet.firmNameMatch || '',
                        vendorName: indentData.approvedVendorName || sheet.vendorName || '',
                        poNumber: indentData.poNumber, poDate: indentData.poDate, deliveryDate: indentData.deliveryDate,
                        product: indentData.productName, quantity: approvedQty, pendingLiftQty: pendingLift,
                        receivedQty, pendingPoQty: Math.max(0, pendingLift), photoOfBill: sheet.photoOfBill || '',
                        timestamp: sheet.timestamp || '', department: indentRecord?.department || '',
                        areaOfUse: indentRecord?.areaOfUse || '', approvedVendorName: indentRecord?.approvedVendorName || '',
                        liftingStatus: indentRecord?.liftingStatus || '', qty: sheet.qty || 0, billNo: sheet.billNo || '',
                        billStatus: sheet.billStatus || '', typeOfBill: sheet.typeOfBill || '',
                        billAmount: sheet.billAmount || 0, transportationInclude: sheet.transportationInclude || '',
                        transporterName: sheet.transporterName || '', vehicleNo: sheet.vehicleNo || '',
                        driverName: sheet.driverName || '', driverMobileNo: sheet.driverMobileNo || '',
                        amount: sheet.amount || 0, billRemark: sheet.billRemark || '',
                        approvedRate: indentRecord?.approvedRate || '', taxValue: indentRecord?.taxValue || 0,
                        withTax: indentRecord?.withTax || 'No',
                    };
                })
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [storeInRecords, indentRecords, user?.firmNameMatch]);

    // ── Form schema (existing) ──────────────────────────────────────────
    const formSchema = z.object({
        billStatus: z.string().optional(),
        billNo: z.string().optional(),
        qty: z.coerce.number().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        billRemark: z.string().optional(),
        vendorName: z.string().optional(),
        transportationInclude: z.string().optional(),
        transporterName: z.string().optional(),
        vehicleNo: z.string().optional(),
        driverName: z.string().optional(),
        driverMobileNo: z.string().optional(),
        amount: z.coerce.number().optional(),
        cancelPendingQty: z.coerce.number().optional(),
        items: z.array(z.object({
            indentNo: z.string(), product: z.string(), poNumber: z.string(),
            quantity: z.coerce.number(), pendingLiftQty: z.coerce.number(),
            receivedQty: z.coerce.number(), pendingPoQty: z.coerce.number(),
            approvedRate: z.union([z.string(), z.number()]), taxValue: z.coerce.number(),
            withTax: z.string(), uom: z.string().optional(),
            liftQty: z.coerce.number().min(0),
        })).superRefine((items, ctx) => {
            items.forEach((item, index) => {
                if (Number(item.liftQty) > item.pendingLiftQty) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Lift qty (${item.liftQty}) cannot exceed Pending (${item.pendingLiftQty})`, path: [`${index}`, 'liftQty'] });
                }
            });
        }),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            billStatus: '', billNo: '', qty: 0, typeOfBill: 'independent', billAmount: 0,
            billRemark: '', vendorName: '', transportationInclude: 'No', transporterName: '',
            vehicleNo: '', driverName: '', driverMobileNo: '', amount: 0, cancelPendingQty: 0, items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
    const itemsWatcher = useWatch({ control: form.control, name: 'items' }) || [];

    const calculateTotalAmount = (items: any[]) =>
        (items || []).reduce((sum: number, item: any) => {
            const qty = Number(item.liftQty) || 0;
            const rate = parseFloat(String(item.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
            const tax = Number(item.taxValue) || 0;
            const effectiveRate = item.withTax === 'No' ? rate * (1 + tax / 100) : rate;
            return sum + qty * effectiveRate;
        }, 0);

    const currentCalculatedTotal = calculateTotalAmount(itemsWatcher);

    useEffect(() => { form.setValue('billAmount', currentCalculatedTotal); }, [currentCalculatedTotal, form]);

    const handleOpenChange = (open: boolean) => {
        setOpenDialog(open);
        if (!open) { setSelectedIndent(null); setSelectedHistory(null); setShowCancelQty(false); setCancelQtyValue(''); form.reset(); }
    };

    useEffect(() => {
        if (selectedIndent) {
            const allVendorGroups = tableData.filter(g => g.vendorName === selectedIndent.vendorName);
            const allItems = allVendorGroups.flatMap(g => g.originalItems || []);
            form.reset({
                billStatus: '', billNo: '', qty: selectedIndent.pendingLiftQty || 0,
                typeOfBill: 'independent', billAmount: 0, billRemark: '', vendorName: selectedIndent.vendorName || '',
                transportationInclude: 'No', transporterName: '', vehicleNo: '', driverName: '', driverMobileNo: '',
                amount: 0, cancelPendingQty: 0,
                items: allItems.map(item => ({
                    indentNo: item.indentNumber?.toString() || '', product: item.productName || '',
                    poNumber: item.poNumber || '', quantity: Number(item.approvedQuantity) || 0,
                    pendingLiftQty: item.pendingPoQty || 0, receivedQty: item.receivedQty || 0,
                    pendingPoQty: item.pendingPoQty || 0, approvedRate: item.approvedRate || '0',
                    taxValue: item.taxValue || 0, withTax: item.withTax || 'No', uom: item.uom || '',
                    liftQty: item.pendingPoQty || 0,
                })),
            });
            const initialTotal = allItems.reduce((sum: number, item: any) => {
                const rate = parseFloat(String(item.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
                const tax = item.taxValue || 0;
                const effectiveRate = item.withTax === 'No' ? rate * (1 + tax / 100) : rate;
                return sum + effectiveRate * (item.pendingPoQty || 0);
            }, 0);
            form.setValue('billAmount', initialTotal);
        }
    }, [selectedIndent, form, tableData]);

    useEffect(() => {
        if (selectedHistory) {
            form.reset({
                billStatus: selectedHistory.billStatus === 'Not Received' ? 'Bill Not Received' : selectedHistory.billStatus || '',
                billNo: selectedHistory.billNo || '', qty: selectedHistory.qty || 0,
                typeOfBill: selectedHistory.typeOfBill || 'independent', billAmount: selectedHistory.billAmount || 0,
                billRemark: selectedHistory.billRemark || '', vendorName: selectedHistory.vendorName || '',
                transportationInclude: selectedHistory.transportationInclude || 'No',
                transporterName: selectedHistory.transporterName || '', vehicleNo: selectedHistory.vehicleNo || '',
                driverName: selectedHistory.driverName || '', driverMobileNo: selectedHistory.driverMobileNo || '',
                amount: selectedHistory.amount || 0, cancelPendingQty: 0,
                items: [{
                    indentNo: selectedHistory.indentNo || '', product: selectedHistory.product || '',
                    poNumber: selectedHistory.poNumber || '', quantity: selectedHistory.quantity || 0,
                    pendingLiftQty: (selectedHistory.pendingLiftQty || 0) + (selectedHistory.qty || 0),
                    receivedQty: selectedHistory.receivedQty || 0, pendingPoQty: selectedHistory.pendingPoQty || 0,
                    approvedRate: selectedHistory.approvedRate || '0', taxValue: selectedHistory.taxValue || 0,
                    withTax: selectedHistory.withTax || 'No', uom: '', liftQty: selectedHistory.qty || 0,
                }],
            });
        }
    }, [selectedHistory, form]);

    // ── Cancel qty submit ───────────────────────────────────────────────
    const handleCancelQtySubmit = async () => {
        if (!cancelQtyValue || Number(cancelQtyValue) <= 0) { toast.error('Enter a valid quantity'); return; }
        const cancelQty = Number(cancelQtyValue);
        if (cancelQty > (selectedIndent?.pendingPoQty || 0)) { toast.error(`Cannot exceed pending PO qty: ${selectedIndent?.pendingPoQty || 0}`); return; }
        try {
            if (!selectedIndent?.indentNo) { toast.error('Could not find indent record'); return; }
            await updateCancelQuantity(selectedIndent.indentNo, cancelQty);
            toast.success(`Cancelled ${cancelQty} quantity`);
            setShowCancelQty(false); setCancelQtyValue('');
            setTimeout(async () => {
                const [indents, storeIns] = await Promise.all([fetchIndentRecords(), fetchStoreInRecords()]);
                setIndentRecords(indents); setStoreInRecords(storeIns);
            }, 1500);
        } catch { toast.error('Failed to cancel quantity'); }
    };

    // ── Main submit ─────────────────────────────────────────────────────
    async function onSubmit() {
        const values = form.getValues();
        try {
            if (selectedHistory) {
                const newLiftQty = Number(values.items?.[0]?.liftQty || selectedHistory.qty || 0);
                const updatedRecord = {
                    vendor_name: values.vendorName || selectedHistory.vendorName || '',
                    qty: newLiftQty.toString(), transportation_include: values.transportationInclude || '',
                    transporter_name: values.transporterName || '', amount: Number(values.amount) || 0,
                    quantity_as_per_bill: newLiftQty.toString(), vehicle_no: values.vehicleNo || '',
                    driver_name: values.driverName || '', driver_mobile_no: values.driverMobileNo || '',
                };
                const { error } = await supabase.from('store_in').update(updatedRecord).eq('lift_number', selectedHistory.liftNumber);
                if (error) throw error;
                const originalPending = (selectedHistory.pendingLiftQty || 0) + (selectedHistory.qty || 0);
                const remaining = originalPending - newLiftQty;
                await updateLiftingStatus(selectedHistory.indentNo, remaining <= 0 ? 'Complete' : 'Pending');
                toast.success(`Updated lift: ${selectedHistory.liftNumber}`);
                setOpenDialog(false); setSelectedHistory(null); form.reset();
                setTimeout(async () => {
                    const [indents, storeIns] = await Promise.all([fetchIndentRecords(), fetchStoreInRecords()]);
                    setIndentRecords(indents); setStoreInRecords(storeIns);
                }, 1500);
                return;
            }
            if (Number(values.qty) > (selectedIndent?.pendingLiftQty || 0)) {
                toast.error(`Lifting qty cannot exceed pending qty`); return;
            }
            if (values.cancelPendingQty && values.cancelPendingQty > 0 && selectedIndent?.indentNo) {
                await updateCancelQuantity(selectedIndent.indentNo, values.cancelPendingQty);
                await updateActual5Timestamp(selectedIndent.indentNo);
                toast.success(`Cancelled ${values.cancelPendingQty} quantity`);
            }
            if (values.items && values.items.length > 0) {
                const currentDateTime = new Date().toISOString();
                for (const item of values.items) {
                    if (Number(item.liftQty) <= 0) continue;
                    await insertStoreInRecord({
                        timestamp: currentDateTime, indentNo: item.indentNo, billNo: '',
                        vendorName: values.vendorName || selectedIndent?.vendorName || '',
                        productName: item.product || '', qty: Number(item.liftQty), discountAmount: 0,
                        typeOfBill: '', billAmount: 0, paymentType: '', advanceAmountIfAny: 0,
                        photoOfBill: '', transportationInclude: values.transportationInclude || '',
                        transporterName: values.transporterName || '', amount: Number(values.amount) || 0,
                        billStatus: '', quantityAsPerBill: Number(item.liftQty),
                        poDate: selectedIndent?.poDate || '', poNumber: item.poNumber || '',
                        vendor: values.vendorName || selectedIndent?.vendorName || '',
                        indentNumber: item.indentNo, product: item.product || '',
                        quantity: Number(item.quantity), vehicleNo: values.vehicleNo || '',
                        driverName: values.driverName || '', driverMobileNo: values.driverMobileNo || '',
                        billRemark: '', firmNameMatch: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                        rate: String(item.approvedRate || ''), department: selectedIndent?.department || '',
                        areaOfUse: selectedIndent?.areaOfUse || '',
                        approvedVendorName: selectedIndent?.approvedVendorName || '',
                        liftingStatus: selectedIndent?.liftingStatus || '', notBillReceivedNo: '',
                    });
                    if ((values.transportationInclude || '').toLowerCase() === 'yes') {
                        await supabase.from('fullkitting').insert([{
                            timestamp: currentDateTime, indent_number: item.indentNo,
                            vendor_name: values.vendorName || selectedIndent?.vendorName || '',
                            product_name: item.product || '', qty: Number(item.liftQty), bill_no: '',
                            transporting_include: 'Yes', transporter_name: values.transporterName || '',
                            amount: Number(values.amount) || 0, vehical_no: values.vehicleNo || '',
                            driver_name: values.driverName || '', driver_mobile_no: values.driverMobileNo || '',
                            planned: currentDateTime, fms_name: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                            firm_name_match: selectedIndent?.firmNameMatch || user?.firmNameMatch || '', status: 'Pending',
                        }]);
                    }
                    const remaining = item.pendingLiftQty - Number(item.liftQty);
                    if (remaining <= 0) await updateLiftingStatus(item.indentNo, 'Complete');
                }
                toast.success(`Created store records for PO: ${selectedIndent?.poNumber}`);
            }
            setOpenDialog(false); form.reset(); setShowCancelQty(false); setCancelQtyValue('');
            setTimeout(async () => {
                const [indents, storeIns] = await Promise.all([fetchIndentRecords(), fetchStoreInRecords()]);
                setIndentRecords(indents); setStoreInRecords(storeIns);
            }, 1500);
        } catch (error: any) {
            const msg = error?.message || JSON.stringify(error) || 'Unknown error';
            toast.error(`Failed to save: ${msg}`, { duration: 10000 });
        }
    }

    function onError() { toast.error('Please fill all required fields correctly'); }

    // ── Pending table columns ───────────────────────────────────────────
    const pendingColumns: ColumnDef<GetPurchaseData>[] = [
        ...(user?.receiveItemAction ? [{
            header: 'Action', cell: ({ row }: { row: Row<GetPurchaseData> }) => (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedIndent(row.original); setShowCancelQty(false); setCancelQtyValue(''); }}>
                        Update
                    </Button>
                </DialogTrigger>
            ),
        }] : []),
        { accessorKey: 'timestamp', header: 'Timestamp', cell: ({ getValue }) => <div className="text-xs">{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div> },
        { accessorKey: 'poNumber', header: 'PO Number', cell: ({ getValue }) => <div className="font-bold text-primary">{(getValue() as string) || '-'}</div> },
        { accessorKey: 'vendorName', header: 'Vendor', cell: ({ getValue }) => <div className="min-w-[120px]">{(getValue() as string) || '-'}</div> },
        {
            accessorKey: 'products', header: 'Products', cell: ({ row }) => {
                const products = row.original.products || [];
                return <div className="max-w-[180px] truncate text-sm" title={products.join(', ')}>{products.length > 1 ? `${products[0]} (+${products.length - 1})` : products[0]}</div>;
            }
        },
        { accessorKey: 'expectedDate', header: 'Expected Date' },
        { accessorKey: 'plannedDate', header: 'Planned Date', cell: ({ getValue }) => { const v = getValue() as string; return <div className={v === 'Not Set' ? 'text-muted-foreground italic text-xs' : ''}>{v}</div>; } },
        { accessorKey: 'pendingLiftQty', header: 'Pending Qty', cell: ({ getValue }) => <div className="font-semibold text-center">{(getValue() as number) || 0}</div> },
        { accessorKey: 'receivedQty', header: 'Received Qty', cell: ({ getValue }) => <div className="text-center text-green-600 font-medium">{(getValue() as number) || 0}</div> },
    ];

    // ── History table columns ───────────────────────────────────────────
    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user?.administrate ? [{
            id: 'edit', header: 'Edit', cell: ({ row }: { row: Row<HistoryData> }) => (
                <Checkbox checked={selectedHistory?.liftNumber === row.original.liftNumber}
                    onCheckedChange={(checked) => { if (checked) { setSelectedHistory(row.original); setSelectedIndent(null); setOpenDialog(true); } else { setSelectedHistory(null); setOpenDialog(false); } }} />
            ),
        }] : []),
        { accessorKey: 'timestamp', header: 'Timestamp', cell: ({ getValue }) => <div className="text-xs">{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div> },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm' },
        { accessorKey: 'vendorName', header: 'Vendor' },
        { accessorKey: 'photoOfBill', header: 'Bill Photo', cell: ({ getValue }) => { const url = getValue() as string; return url ? <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>View</Button> : <span className="text-muted-foreground text-xs">-</span>; } },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'pendingLiftQty', header: 'Pending Qty', cell: ({ getValue }) => <div className="text-center">{(getValue() as number) || 0}</div> },
        { accessorKey: 'receivedQty', header: 'Received Qty', cell: ({ getValue }) => <div className="text-center text-green-600 font-medium">{(getValue() as number) || 0}</div> },
    ];

    // ── Highlighted records table ───────────────────────────────────────
    const DaysLeftCell = ({ r }: { r: ProcessedRecord }) => {
        if (r.status === 'completed') return <span className="text-green-600 font-bold">✓ Done</span>;
        if (r.daysRemaining < 0) return <span className="text-red-600 font-bold">{Math.abs(r.daysRemaining)}d overdue</span>;
        if (r.daysRemaining === 0) return <span className="text-orange-600 font-bold">Today</span>;
        if (r.daysRemaining <= 3) return <span className="text-yellow-600 font-semibold">{r.daysRemaining}d left</span>;
        return <span className="text-gray-600">{r.daysRemaining}d</span>;
    };

    const HightlightedTable = ({ data }: { data: ProcessedRecord[] }) => (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                    <thead className="bg-green-50/80 border-b">
                        <tr>
                            {['PO Number', 'Vendor', 'Product', 'Indent No.', 'Planned Date', 'Expected Date', 'Days Left', 'Ordered Qty', 'Lifted Qty', 'Remaining', 'UOM', 'Completion', 'Status'].map(h => (
                                <th key={h} className="px-3 py-3 text-left font-semibold text-gray-600 text-xs whitespace-nowrap border-b">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={13} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <Package size={40} />
                                        <p className="font-medium">No records found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : data.map((r, i) => (
                            <tr key={i} className={`border-b last:border-0 ${rowBg(r.status)} transition-colors`}>
                                <td className="px-3 py-2.5 font-bold text-primary whitespace-nowrap">{r.poNumber || '-'}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-700">{r.vendorName || <span className="text-gray-400 italic">—</span>}</td>
                                <td className="px-3 py-2.5 max-w-[180px]">
                                    <div className="truncate font-medium text-gray-800" title={r.productName}>{r.productName || '-'}</div>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{r.indentNumber}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{r.plannedDate ? formatDate(parseCustomDate(r.plannedDate)) : <span className="text-gray-400">—</span>}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600">{r.expectedDate || <span className="text-gray-400">—</span>}</td>
                                <td className="px-3 py-2.5 text-center text-xs font-medium whitespace-nowrap">
                                    <DaysLeftCell r={r} />
                                </td>
                                <td className="px-3 py-2.5 text-right font-medium text-gray-700">{r.orderedQty.toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-green-600">{r.liftedQty.toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-orange-500">{r.remainingQty.toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-center text-xs text-gray-500">{r.uom || '—'}</td>
                                <td className="px-3 py-2.5 min-w-[110px]">
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${r.completionPct >= 100 ? 'bg-green-500' : r.completionPct > 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                                                style={{ width: `${Math.min(100, r.completionPct)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-600 w-9 text-right">{Math.round(r.completionPct)}%</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ── Unique vendors for filter ───────────────────────────────────────
    const uniqueVendors = useMemo(() => [...new Set(processedRecords.map(r => r.vendorName).filter(Boolean))], [processedRecords]);

    // ── Active (non-completed) records for Dashboard ─────────────────
    const activeFilteredRecords = useMemo(
        () => filteredRecords.filter(r => r.status !== 'completed'),
        [filteredRecords]
    );

    // ── History columns WITHOUT edit ─────────────────────────────────
    const historyColumnsNoEdit: ColumnDef<HistoryData>[] = [
        { accessorKey: 'timestamp', header: 'Timestamp', cell: ({ getValue }) => <div className="text-xs">{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div> },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm' },
        { accessorKey: 'vendorName', header: 'Vendor' },
        { accessorKey: 'photoOfBill', header: 'Bill Photo', cell: ({ getValue }) => { const url = getValue() as string; return url ? <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>View</Button> : <span className="text-muted-foreground text-xs">-</span>; } },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'pendingLiftQty', header: 'Pending Qty', cell: ({ getValue }) => <div className="text-center">{(getValue() as number) || 0}</div> },
        { accessorKey: 'receivedQty', header: 'Received Qty', cell: ({ getValue }) => <div className="text-center text-green-600 font-medium">{(getValue() as number) || 0}</div> },
    ];

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <div className="bg-gray-50/60 min-h-screen">
            <Dialog open={openDialog} onOpenChange={handleOpenChange}>

                {/* ── Page Header ─────────────────────────────────── */}
                <Heading
                    heading="Get Lift — Lifting Management"
                    subtext="Track, monitor & control all lifting activities"
                >
                    <ShoppingCart size={50} className="text-primary" />
                </Heading>

                <div className="p-5 space-y-4">

                {/* ── Alert Banners ───────────────────────────────── */}
                {(kpis.overdue > 0 || kpis.todayCount > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {kpis.overdue > 0 && (
                            <div className="flex items-center gap-3 bg-gradient-to-r from-red-500 to-red-600 rounded-xl px-4 py-3 shadow-sm">
                                <div className="bg-white/20 rounded-lg p-1.5 shrink-0">
                                    <AlertTriangle size={15} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">{kpis.overdue} Overdue Lifting{kpis.overdue > 1 ? 's' : ''}</p>
                                    <p className="text-red-100 text-xs">Immediate attention required!</p>
                                </div>
                            </div>
                        )}
                        {kpis.todayCount > 0 && (
                            <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl px-4 py-3 shadow-sm">
                                <div className="bg-white/20 rounded-lg p-1.5 shrink-0">
                                    <Clock size={15} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">{kpis.todayCount} Due Today</p>
                                    <p className="text-orange-100 text-xs">Schedule before day ends</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── KPI Cards ──────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    <KpiCard title="Total POs" value={kpis.totalPOs} icon={Package} color="bg-slate-600" sub="All orders" />
                    <KpiCard title="Completed" value={kpis.totalCompleted} icon={CheckCircle2} color="bg-green-600" sub="Fully lifted" />
                    <KpiCard title="Pending" value={kpis.totalPending} icon={Clock} color="bg-blue-500" sub="Awaiting lift" />
                    <KpiCard title="Overdue" value={kpis.overdue} icon={AlertTriangle} color="bg-red-500" sub="Past date" />
                    <KpiCard title="Due Today" value={kpis.todayCount} icon={Calendar} color="bg-orange-500" sub="Act now" />
                    <KpiCard title="This Week" value={kpis.thisWeek} icon={Activity} color="bg-yellow-500" sub="Next 7 days" />
                    <KpiCard title="This Month" value={kpis.thisMonth} icon={TrendingUp} color="bg-purple-500" sub="Monthly pending" />
                    <KpiCard title="Vendors" value={uniqueVendors.length} icon={Users} color="bg-indigo-500" sub="Active" />
                    <KpiCard title="Qty Ordered" value={kpis.totalQtyOrdered.toFixed(0)} icon={Package} color="bg-teal-600" sub="Total ordered" />
                    <KpiCard title="Qty Lifted" value={kpis.totalQtyLifted.toFixed(0)} icon={CheckCircle2} color="bg-emerald-500" sub="Lifted so far" />
                    <KpiCard title="Remaining" value={kpis.remainingQty.toFixed(0)} icon={AlertCircle} color="bg-rose-500" sub="Yet to lift" />
                    <KpiCard title="Total Planned" value={kpis.totalPlanned} icon={BarChart2} color="bg-cyan-600" sub="With plan date" />
                </div>

                {/* ── Main Tabs ───────────────────────────────────── */}
                <Tabs defaultValue="dashboard">
                    {/* Tab bar + action buttons */}
                    <div className="bg-white rounded-xl border shadow-sm p-2 flex items-center justify-between flex-wrap gap-2 mb-3">
                        <TabsList className="bg-gray-100 rounded-lg p-1 gap-0.5 h-auto">
                            {[
                                { value: 'dashboard', label: 'Dashboard', icon: <Activity size={13}/> },
                                { value: 'pending',   label: 'Pending',   icon: <Clock size={13}/>,    count: tableData.length,   dot: 'bg-green-600' },
                                { value: 'history',   label: 'History',   icon: <FileText size={13}/>, count: historyData.length, dot: 'bg-gray-500' },
                                { value: 'reports',   label: 'Reports',   icon: <BarChart2 size={13}/> },
                                { value: 'analytics', label: 'Analytics', icon: <TrendingUp size={13}/> },
                            ].map(t => (
                                <TabsTrigger key={t.value} value={t.value}
                                    className="rounded-md px-3 py-1.5 text-sm font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-700 transition-all">
                                    {t.icon}{t.label}
                                    {t.count !== undefined && t.count > 0 && (
                                        <span className={`${t.dot} text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold`}>{t.count}</span>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading}
                                className="gap-1.5 h-8 hover:border-green-400 hover:text-green-700">
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 h-8 hover:border-green-400 hover:text-green-700"
                                onClick={() => exportCSV(activeFilteredRecords, 'get-lift-report')}>
                                <Download size={13} /> Export CSV
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 h-8 hover:border-green-400 hover:text-green-700"
                                onClick={() => window.print()}>
                                <FileText size={13} /> Print
                            </Button>
                        </div>
                    </div>

                    {/* ── Dashboard Tab ─────────────────────── */}
                    <TabsContent value="dashboard" className="space-y-3">
                        <div className="bg-white rounded-xl border shadow-sm p-4">
                            <div className="flex flex-wrap gap-3 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Search</label>
                                    <div className="relative">
                                        <Input placeholder="PO, Vendor, Product, Indent..." value={searchFilter}
                                            onChange={e => setSearchFilter(e.target.value)} className="h-9 pl-8" />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                        </span>
                                    </div>
                                </div>
                                <div className="min-w-[145px]">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Status</label>
                                    <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="overdue">🔴 Overdue</SelectItem>
                                            <SelectItem value="today">🟠 Due Today</SelectItem>
                                            <SelectItem value="this_week">🟡 This Week</SelectItem>
                                            <SelectItem value="partial">🔵 Partial</SelectItem>
                                            <SelectItem value="pending">⚪ Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="min-w-[170px]">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Vendor</label>
                                    <Select value={vendorFilter} onValueChange={setVendorFilter}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Vendors</SelectItem>
                                            {uniqueVendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="min-w-[140px]">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Date Range</label>
                                    <Select value={dateFilter} onValueChange={v => setDateFilter(v as any)}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Dates</SelectItem>
                                            <SelectItem value="today">Due Today</SelectItem>
                                            <SelectItem value="week">This Week</SelectItem>
                                            <SelectItem value="month">This Month</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button variant="ghost" size="sm" className="h-9 text-gray-500 hover:text-red-600 gap-1"
                                        onClick={() => { setSearchFilter(''); setStatusFilter('all'); setVendorFilter('all'); setDateFilter('all'); }}>
                                        <X size={13}/> Clear
                                    </Button>
                                    <span className="text-xs text-gray-400 pb-2 whitespace-nowrap">
                                        <span className="font-semibold text-gray-700">{activeFilteredRecords.length}</span> records
                                    </span>
                                </div>
                            </div>
                        </div>
                        <HightlightedTable data={activeFilteredRecords} />
                    </TabsContent>

                    {/* ── Pending Tab ───────────────────────── */}
                    <TabsContent value="pending">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b flex items-center gap-3">
                                <div className="bg-green-600 rounded-lg p-1.5"><Clock size={14} className="text-white"/></div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 text-sm">Pending Liftings</h3>
                                    <p className="text-xs text-gray-500">{tableData.length} PO{tableData.length !== 1 ? 's' : ''} awaiting lift</p>
                                </div>
                            </div>
                            <DataTable
                                data={tableData}
                                columns={pendingColumns}
                                searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                                dataLoading={loading}
                            />
                        </div>
                    </TabsContent>

                    {/* ── History Tab ────────────────────────── */}
                    <TabsContent value="history">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-600 rounded-lg p-1.5"><FileText size={14} className="text-white"/></div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-sm">Lifting History</h3>
                                        <p className="text-xs text-gray-500">{historyData.length} completed store-in records</p>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1.5 h-8"
                                    onClick={() => exportCSV(processedRecords.filter(r => r.status === 'completed'), 'lifting-history')}>
                                    <Download size={13}/> Export
                                </Button>
                            </div>
                            <DataTable
                                data={historyData}
                                columns={historyColumnsNoEdit}
                                searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                                dataLoading={false}
                            />
                        </div>
                    </TabsContent>

                    {/* ── Reports Tab ───────────────────────── */}
                    <TabsContent value="reports">
                        <Tabs defaultValue="pending_report">
                            <div className="bg-white rounded-xl border shadow-sm p-2 mb-3">
                                <TabsList className="bg-gray-100 rounded-lg p-1 gap-0.5 h-auto flex-wrap">
                                    {[
                                        { value: 'pending_report',  label: 'Pending',       icon: <Clock size={12}/>,          count: processedRecords.filter(r => r.status !== 'completed').length, iconCls: 'text-blue-500' },
                                        { value: 'overdue_report',  label: 'Overdue',        icon: <AlertTriangle size={12}/>,   count: processedRecords.filter(r => r.status === 'overdue').length,    iconCls: 'text-red-500' },
                                        { value: 'upcoming_report', label: 'Upcoming',       icon: <Calendar size={12}/>,        count: processedRecords.filter(r => ['today','this_week'].includes(r.status)).length, iconCls: 'text-orange-500' },
                                        { value: 'vendor_report',   label: 'Vendor-wise',    icon: <Users size={12}/>,                                                                                   iconCls: 'text-green-600' },
                                        { value: 'material_report', label: 'Material-wise',  icon: <Package size={12}/>,                                                                                 iconCls: 'text-purple-600' },
                                    ].map(t => (
                                        <TabsTrigger key={t.value} value={t.value}
                                            className="rounded-md px-3 py-1.5 text-sm font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
                                            <span className={t.iconCls}>{t.icon}</span>
                                            {t.label}
                                            {t.count !== undefined && t.count > 0 && (
                                                <span className="bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold">{t.count}</span>
                                            )}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </div>

                            {/* Pending Report */}
                            <TabsContent value="pending_report">
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-blue-50 border-b flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-blue-800 text-sm">Pending Lifting Report</h3>
                                            <p className="text-xs text-blue-500">{processedRecords.filter(r => r.status !== 'completed').length} items awaiting lift</p>
                                        </div>
                                        <Button size="sm" variant="outline" className="gap-1.5 h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                                            onClick={() => exportCSV(processedRecords.filter(r => r.status !== 'completed'), 'pending-liftings')}>
                                            <Download size={13}/> Export
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>{['#','Vendor','PO Number','Product','Remaining Qty','Planned Date','Days','Status'].map(h => (
                                                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-xs text-gray-600 whitespace-nowrap">{h}</th>
                                                ))}</tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {processedRecords.filter(r => r.status !== 'completed').length === 0 ? (
                                                    <tr><td colSpan={8} className="py-14 text-center">
                                                        <CheckCircle2 size={36} className="mx-auto mb-2 text-green-300"/>
                                                        <p className="text-green-600 font-medium">All liftings completed!</p>
                                                    </td></tr>
                                                ) : processedRecords.filter(r => r.status !== 'completed').map((r, i) => (
                                                    <tr key={i} className={`${rowBg(r.status)} hover:opacity-90 transition-opacity`}>
                                                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{i+1}</td>
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.vendorName || '—'}</td>
                                                        <td className="px-4 py-2.5 font-bold text-primary">{r.poNumber}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[150px] truncate">{r.productName}</td>
                                                        <td className="px-4 py-2.5 text-center font-bold text-orange-600">{r.remainingQty}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.plannedDate ? formatDate(parseCustomDate(r.plannedDate)) : '—'}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.daysRemaining < 0 ? 'bg-red-100 text-red-700' : r.daysRemaining === 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d over` : r.daysRemaining === 0 ? 'Today' : `${r.daysRemaining}d`}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5"><StatusBadge status={r.status}/></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Overdue Report */}
                            <TabsContent value="overdue_report">
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-red-50 border-b flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-red-800 text-sm flex items-center gap-1.5"><AlertTriangle size={14}/> Overdue Liftings</h3>
                                            <p className="text-xs text-red-500">{processedRecords.filter(r => r.status === 'overdue').length} past planned date</p>
                                        </div>
                                        <Button size="sm" variant="outline" className="gap-1.5 h-8 border-red-200 text-red-700 hover:bg-red-50"
                                            onClick={() => exportCSV(processedRecords.filter(r => r.status === 'overdue'), 'overdue-liftings')}>
                                            <Download size={13}/> Export
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-red-50 border-b">
                                                <tr>{['#','Vendor','PO Number','Product','Delay','Pending Qty','Planned Date'].map(h => (
                                                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-xs text-red-700 whitespace-nowrap">{h}</th>
                                                ))}</tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {processedRecords.filter(r => r.status === 'overdue').sort((a,b) => a.daysRemaining - b.daysRemaining).length === 0 ? (
                                                    <tr><td colSpan={7} className="py-14 text-center">
                                                        <CheckCircle2 size={36} className="mx-auto mb-2 text-green-300"/>
                                                        <p className="text-green-600 font-medium">No overdue liftings!</p>
                                                    </td></tr>
                                                ) : processedRecords.filter(r => r.status === 'overdue').sort((a,b) => a.daysRemaining - b.daysRemaining).map((r,i) => (
                                                    <tr key={i} className="bg-red-50/30 hover:bg-red-50 transition-colors">
                                                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{i+1}</td>
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.vendorName}</td>
                                                        <td className="px-4 py-2.5 font-bold text-primary">{r.poNumber}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-600">{r.productName}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="bg-red-100 text-red-700 font-bold text-xs px-2 py-1 rounded-full">{Math.abs(r.daysRemaining)}d</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center font-bold text-orange-600">{r.remainingQty}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.plannedDate ? formatDate(parseCustomDate(r.plannedDate)) : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Upcoming Report */}
                            <TabsContent value="upcoming_report">
                                <div className="space-y-4">
                                    {([
                                        { label: 'Due Today',      emoji: '🟠', bgHeader: 'bg-orange-50', textColor: 'text-orange-800', subColor: 'text-orange-500', filter: (r: ProcessedRecord) => r.status === 'today' },
                                        { label: 'Due This Week',  emoji: '🟡', bgHeader: 'bg-yellow-50', textColor: 'text-yellow-800', subColor: 'text-yellow-600', filter: (r: ProcessedRecord) => r.status === 'this_week' },
                                        { label: 'Due This Month', emoji: '📅', bgHeader: 'bg-gray-50',   textColor: 'text-gray-800',   subColor: 'text-gray-500',   filter: (r: ProcessedRecord) => { const d = safeParseDate(r.plannedDate); return !!d && isThisMonth(d) && r.status !== 'completed'; } },
                                    ] as const).map(({ label, emoji, bgHeader, textColor, subColor, filter }) => {
                                        const rows = processedRecords.filter(filter as any);
                                        return (
                                            <div key={label} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                                <div className={`px-4 py-3 ${bgHeader} border-b flex items-center justify-between`}>
                                                    <div>
                                                        <h3 className={`font-semibold text-sm ${textColor}`}>{emoji} {label}</h3>
                                                        <p className={`text-xs ${subColor}`}>{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 border-b">
                                                            <tr>{['Vendor','PO Number','Product','Remaining Qty','Planned Date','Days'].map(h => (
                                                                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                                            ))}</tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {rows.length === 0 ? (
                                                                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No records in this period</td></tr>
                                                            ) : rows.map((r, i) => (
                                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="px-4 py-2 font-medium text-gray-800">{r.vendorName}</td>
                                                                    <td className="px-4 py-2 font-bold text-primary">{r.poNumber}</td>
                                                                    <td className="px-4 py-2 text-xs text-gray-600">{r.productName}</td>
                                                                    <td className="px-4 py-2 text-center font-bold text-orange-600">{r.remainingQty}</td>
                                                                    <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{r.plannedDate ? formatDate(parseCustomDate(r.plannedDate)) : '—'}</td>
                                                                    <td className="px-4 py-2 text-center">
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.daysRemaining === 0 ? 'bg-orange-100 text-orange-700' : r.daysRemaining > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                            {r.daysRemaining === 0 ? 'Today' : `${r.daysRemaining}d`}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </TabsContent>

                            {/* Vendor Report */}
                            <TabsContent value="vendor_report">
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-green-50 border-b flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-green-800 text-sm flex items-center gap-1.5"><Users size={14}/> Vendor-wise Report</h3>
                                            <p className="text-xs text-green-600">{vendorSummary.length} vendors · performance overview</p>
                                        </div>
                                        <Button size="sm" variant="outline" className="gap-1.5 h-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => {
                                            const csv = ['Vendor,Total POs,Ordered Qty,Lifted Qty,Remaining Qty,Completion %',
                                                ...vendorSummary.map(v => `"${v.vendor}",${v.totalPOs},${v.ordered},${v.lifted},${v.remaining},${v.completion}`)].join('\n');
                                            const a = document.createElement('a');
                                            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                                            a.download = 'vendor-report.csv'; a.click();
                                        }}>
                                            <Download size={13}/> Export
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>{['#','Vendor','Total POs','Ordered Qty','Lifted Qty','Remaining','Completion'].map(h => (
                                                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-xs text-gray-600 whitespace-nowrap">{h}</th>
                                                ))}</tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {vendorSummary.sort((a,b) => b.completion - a.completion).map((v, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i+1}</td>
                                                        <td className="px-4 py-3 font-semibold text-gray-800">{v.vendor || '(Unknown)'}</td>
                                                        <td className="px-4 py-3 text-center font-medium text-blue-600">{v.totalPOs}</td>
                                                        <td className="px-4 py-3 text-center text-gray-600">{v.ordered}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-green-600">{v.lifted}</td>
                                                        <td className="px-4 py-3 text-center font-semibold text-orange-500">{v.remaining}</td>
                                                        <td className="px-4 py-3 min-w-[160px]">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                                                    <div className={`h-2.5 rounded-full transition-all ${v.completion >= 100 ? 'bg-green-500' : v.completion > 60 ? 'bg-blue-500' : v.completion > 30 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                                                        style={{ width: `${v.completion}%` }}/>
                                                                </div>
                                                                <span className={`text-xs font-bold w-9 text-right ${v.completion >= 100 ? 'text-green-600' : v.completion > 60 ? 'text-blue-600' : 'text-orange-600'}`}>{v.completion}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Material Report */}
                            <TabsContent value="material_report">
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-purple-50 border-b flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-purple-800 text-sm flex items-center gap-1.5"><Package size={14}/> Material-wise Report</h3>
                                            <p className="text-xs text-purple-500">{materialSummary.length} materials tracked</p>
                                        </div>
                                        <Button size="sm" variant="outline" className="gap-1.5 h-8 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => {
                                            const csv = ['Material,Ordered Qty,Lifted Qty,Remaining Qty',
                                                ...materialSummary.map(m => `"${m.material}",${m.ordered},${m.lifted},${m.remaining}`)].join('\n');
                                            const a = document.createElement('a');
                                            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                                            a.download = 'material-report.csv'; a.click();
                                        }}>
                                            <Download size={13}/> Export
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>{['#','Material','Ordered Qty','Lifted Qty','Remaining Qty','Completion'].map(h => (
                                                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-xs text-gray-600 whitespace-nowrap">{h}</th>
                                                ))}</tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {materialSummary.sort((a,b) => b.remaining - a.remaining).map((m, i) => {
                                                    const pct = m.ordered > 0 ? Math.round((m.lifted / m.ordered) * 100) : 0;
                                                    return (
                                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i+1}</td>
                                                            <td className="px-4 py-3 font-semibold text-gray-800">{m.material}</td>
                                                            <td className="px-4 py-3 text-center text-gray-600">{m.ordered}</td>
                                                            <td className="px-4 py-3 text-center font-semibold text-green-600">{m.lifted}</td>
                                                            <td className="px-4 py-3 text-center font-semibold text-orange-500">{m.remaining}</td>
                                                            <td className="px-4 py-3 min-w-[160px]">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                                                        <div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 60 ? 'bg-blue-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                                                            style={{ width: `${pct}%` }}/>
                                                                    </div>
                                                                    <span className={`text-xs font-bold w-9 text-right ${pct >= 100 ? 'text-green-600' : pct > 60 ? 'text-blue-600' : 'text-orange-600'}`}>{pct}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>

                    {/* ── Analytics Tab ─────────────────────── */}
                    <TabsContent value="analytics" className="space-y-4">
                        {/* Summary strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Completion Rate', value: `${kpis.totalPlanned > 0 ? Math.round((kpis.totalCompleted / kpis.totalPlanned) * 100) : 0}%`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                                { label: 'Qty Lift Rate',   value: `${kpis.totalQtyOrdered > 0 ? Math.round((kpis.totalQtyLifted / kpis.totalQtyOrdered) * 100) : 0}%`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                                { label: 'Overdue Rate',    value: `${kpis.totalPending > 0 ? Math.round((kpis.overdue / kpis.totalPending) * 100) : 0}%`, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                                { label: 'Active Vendors',  value: uniqueVendors.length, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                            ].map(s => (
                                <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                                    <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Status Distribution */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm">
                                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><BarChart2 size={15}/> Status Distribution</h3>
                                {statusDist.length === 0
                                    ? <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data available</div>
                                    : <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={statusDist} cx="50%" cy="50%" outerRadius={85} innerRadius={38} dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                                {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                                            </Pie>
                                            <Tooltip/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                }
                            </div>

                            {/* Vendor Performance */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm">
                                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Users size={15}/> Vendor Performance (Top 8)</h3>
                                {vendorSummary.length === 0
                                    ? <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No vendor data</div>
                                    : <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={vendorSummary.slice(0,8)} layout="vertical" margin={{ left: 90, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                            <XAxis type="number" domain={[0,100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }}/>
                                            <YAxis type="category" dataKey="vendor" width={90} tick={{ fontSize: 10 }}/>
                                            <Tooltip formatter={(v: any) => `${v}%`}/>
                                            <Bar dataKey="completion" fill="#16a34a" radius={[0,4,4,0]} name="Completion %"/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                }
                            </div>

                            {/* Ordered vs Lifted */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm">
                                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Activity size={15}/> Ordered vs Lifted (Top Vendors)</h3>
                                {vendorSummary.length === 0
                                    ? <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No vendor data</div>
                                    : <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={vendorSummary.slice(0,8)} margin={{ bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="vendor" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0}/>
                                            <YAxis tick={{ fontSize: 11 }}/>
                                            <Tooltip/>
                                            <Legend/>
                                            <Bar dataKey="ordered" fill="#94a3b8" name="Ordered" radius={[3,3,0,0]}/>
                                            <Bar dataKey="lifted"  fill="#16a34a" name="Lifted"  radius={[3,3,0,0]}/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                }
                            </div>

                            {/* Monthly Trend */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm">
                                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={15}/> Monthly Lifting Trend</h3>
                                {monthlyTrend.length === 0
                                    ? <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No trend data</div>
                                    : <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={monthlyTrend}>
                                            <defs>
                                                <linearGradient id="liftGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02}/>
                                                </linearGradient>
                                                <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor="#64748b" stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor="#64748b" stopOpacity={0.02}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
                                            <YAxis tick={{ fontSize: 11 }}/>
                                            <Tooltip/>
                                            <Legend/>
                                            <Area type="monotone" dataKey="ordered" stroke="#64748b" fill="url(#ordGrad)" name="Ordered"/>
                                            <Area type="monotone" dataKey="lifted"  stroke="#16a34a" fill="url(#liftGrad)" name="Lifted"/>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                }
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                </div>

                {/* ── Action Modal (existing form, kept intact) ────── */}
                {(selectedIndent || selectedHistory) && (
                    <DialogContent className="max-h-[95vh] overflow-y-auto" style={{ maxWidth: '80vw', width: '60vw' }}>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary border-b pb-3">
                                        <ShoppingCart size={22} />
                                        {selectedHistory ? 'Edit History Purchase Details' : 'Update Purchase Details'}
                                    </DialogTitle>
                                </DialogHeader>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-xl border">
                                    {[['Indent Number', selectedIndent?.indentNo || selectedHistory?.indentNo],
                                        ['PO Number', selectedIndent?.poNumber || selectedHistory?.poNumber],
                                        ['Vendor', selectedIndent?.vendorName || selectedHistory?.vendorName || '-']
                                    ].map(([label, value]) => (
                                        <div key={label} className="space-y-1">
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="text-sm font-medium">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Product table */}
                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">Product</th>
                                                <th className="px-4 py-3 text-right font-semibold">Rate</th>
                                                <th className="px-4 py-3 text-right font-semibold">Tax%</th>
                                                <th className="px-4 py-3 text-right font-semibold">Eff.Rate</th>
                                                <th className="px-4 py-3 text-right font-semibold">Pending</th>
                                                <th className="px-4 py-3 text-center font-semibold">UOM</th>
                                                <th className="px-4 py-3 text-right font-semibold w-32">Lift Qty</th>
                                                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                                <th className="px-4 py-3 text-center font-semibold w-16">Del</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {fields.map((field, index) => {
                                                const rate = parseFloat(String(field.approvedRate).replace(/[^0-9.-]/g, '')) || 0;
                                                const tax = Number(field.taxValue) || 0;
                                                const effectiveRate = field.withTax === 'No' ? rate * (1 + tax / 100) : rate;
                                                const liftQty = Number(itemsWatcher?.[index]?.liftQty) || 0;
                                                return (
                                                    <tr key={field.id} className="hover:bg-muted/20">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{field.product}</div>
                                                            <div className="text-[10px] text-muted-foreground">PO: {field.poNumber} | Indent: {field.indentNo}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground">₹{rate.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground">{tax}%</td>
                                                        <td className="px-4 py-3 text-right text-primary font-medium">₹{effectiveRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-3 text-right">{field.pendingLiftQty}</td>
                                                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">{field.uom || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <FormField control={form.control} name={`items.${index}.liftQty`} render={({ field: f }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" {...f} className={`h-9 text-right ${form.formState.errors.items?.[index]?.liftQty ? 'border-destructive' : ''}`} max={field.pendingLiftQty} />
                                                                    </FormControl>
                                                                    <FormMessage className="text-[10px]" />
                                                                </FormItem>
                                                            )} />
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-primary">₹{(effectiveRate * liftQty).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                                                                <X size={16} />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-muted/30 border-t font-bold">
                                            <tr>
                                                <td colSpan={6} className="px-4 py-3">Totals</td>
                                                <td className="px-4 py-3 text-right border-x">{itemsWatcher?.reduce((s, i) => s + (Number(i.liftQty) || 0), 0) || 0}</td>
                                                <td className="px-4 py-3 text-right text-primary" colSpan={2}>₹{currentCalculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Cancel section */}
                                {selectedIndent && !showCancelQty ? (
                                    <div className="flex justify-between items-center border rounded-xl p-4 bg-orange-50 border-orange-200">
                                        <div>
                                            <h3 className="font-medium text-orange-800">Cancel Pending PO Quantity</h3>
                                            <p className="text-xs text-orange-600">Cancel quantity</p>
                                        </div>
                                        <Button type="button" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => setShowCancelQty(true)}>Cancel Pending PO</Button>
                                    </div>
                                ) : selectedIndent ? (
                                    <div className="border rounded-xl p-4 bg-orange-50 border-orange-200 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-medium text-orange-800">Cancel Pending PO Quantity</h3>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCancelQty(false); setCancelQtyValue(''); }}><X size={16} /></Button>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-4 items-end">
                                            <div>
                                                <FormLabel className="text-orange-700 text-sm">Quantity to Cancel (Max: {selectedIndent.pendingPoQty || 0})</FormLabel>
                                                <Input type="number" placeholder="Enter quantity" min="0" max={selectedIndent.pendingPoQty} value={cancelQtyValue} onChange={e => setCancelQtyValue(e.target.value)} className="border-orange-300" />
                                            </div>
                                            <Button type="button" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100 h-10" onClick={handleCancelQtySubmit}>Submit Cancel Only</Button>
                                        </div>
                                    </div>
                                ) : null}

                                <FormField control={form.control} name="cancelPendingQty" render={({ field }) => (
                                    <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem>
                                )} />

                                {/* Logistics & Transportation */}
                                <div className="space-y-4 border-t pt-6">
                                    <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                                        <Truck size={18} />
                                        <span>Logistics & Transportation</span>
                                    </div>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormField control={form.control} name="transportationInclude" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Transportation Included?</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">Yes</SelectItem>
                                                        <SelectItem value="No">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        {form.watch('transportationInclude') === 'Yes' && (<>
                                            <FormField control={form.control} name="transporterName" render={({ field }) => (
                                                <FormItem><FormLabel>Transporter Name</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="vehicleNo" render={({ field }) => (
                                                <FormItem><FormLabel>Vehicle No.</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="driverName" render={({ field }) => (
                                                <FormItem><FormLabel>Driver Name</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="driverMobileNo" render={({ field }) => (
                                                <FormItem><FormLabel>Driver Mobile</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={form.control} name="amount" render={({ field }) => (
                                                <FormItem><FormLabel>Freight Amount</FormLabel><FormControl><Input type="number" {...field} className="h-11" /></FormControl></FormItem>
                                            )} />
                                        </>)}
                                    </div>
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
                                    <Button type="submit" disabled={form.formState.isSubmitting} className="min-w-[120px]">
                                        {form.formState.isSubmitting && <Loader size={18} className="mr-2" />}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
