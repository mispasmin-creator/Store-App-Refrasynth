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
    Building, IndianRupee, Route,
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
import {
    fetchStoreInRecords as fetchStoreInServiceRecords,
    updateStoreInReceiving, uploadProductPhoto, uploadBillCopy,
    type StoreInRecord,
} from '@/services/storeInService';
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
    receiveItemView?: boolean;
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

interface SIPendingData {
    liftNumber: string; indentNo: string; billNo: string; vendorName: string;
    productName: string; qty: number; typeOfBill: string; billAmount: number;
    paymentType: string; advanceAmountIfAny: number; photoOfBill: string;
    transportationInclude: string; transporterName: string; amount: number;
    poDate: string; poNumber: string; vendor: string; indentNumber: string;
    product: string; uom: string; poCopy: string; billStatus: string;
    leadTimeToLiftMaterial: number; discountAmount: number; firmNameMatch: string;
    planned6Date: string; timestamp: string; priceAsPerPo: number; remark: string;
    products: string[]; indentNumbers: string[]; originalItems: any[];
}

interface SIHistoryData {
    liftNumber: string; indentNo: string; billNo: string; vendorName: string;
    productName: string; qty: number; typeOfBill: string; billAmount: number;
    paymentType: string; advanceAmountIfAny: number; photoOfBill: string;
    transportationInclude: string; transporterName: string; amount: number;
    billStatus: string; photoOfProduct: string; unitOfMeasurement: string;
    damageOrder: string; quantityAsPerBill: string; priceAsPerPoCheck: string;
    priceAsPerPo: number; remark: string; poDate: string; poNumber: string;
    receiveStatus: string; vendor: string; product: string;
    orderQuantity: number; receivedDate: string; timestamp: string;
    leadTimeToLiftMaterial: number; discountAmount: number; firmNameMatch: string;
    planned6Date: string;
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

    // ── StoreIn (Material Receipt) state ───────────────────────────────
    const [siServiceRecords, setSiServiceRecords] = useState<StoreInRecord[]>([]);
    const [siPendingData, setSiPendingData] = useState<SIPendingData[]>([]);
    const [siHistoryData, setSiHistoryData] = useState<SIHistoryData[]>([]);
    const [selectedSI, setSelectedSI] = useState<SIPendingData | null>(null);
    const [openSIDialog, setOpenSIDialog] = useState(false);
    const [siActiveItemIndex, setSiActiveItemIndex] = useState(0);

    // ── Data fetch ──────────────────────────────────────────────────────
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [vendors, indents, storeIns, siSvc] = await Promise.all([
                fetchVendorOptions(), fetchIndentRecords(), fetchStoreInRecords(),
                fetchStoreInServiceRecords(),
            ]);
            setVendorOptions(vendors);
            setIndentRecords(indents);
            setStoreInRecords(storeIns);
            setSiServiceRecords(siSvc);
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

    // ── Unique vendors for KPI ──────────────────────────────────────────
    const uniqueVendors = useMemo(() => [...new Set(processedRecords.map(r => r.vendorName).filter(Boolean))], [processedRecords]);

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
            sheet.planned5 && sheet.planned5.toString().trim() !== ''
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

    // ── StoreIn pending processing ──────────────────────────────────────
    useEffect(() => {
        const filteredByFirm = siServiceRecords.filter(item =>
            user?.firmNameMatch?.toLowerCase() === 'all' || item.firmNameMatch === user?.firmNameMatch
        );
        const latestRecords: StoreInRecord[] = [];
        const seen = new Set<string>();
        for (const item of filteredByFirm) {
            const key = `${item.indentNo}-${item.productName}`;
            if (!seen.has(key)) { seen.add(key); latestRecords.push(item); }
        }
        const pendingItems = latestRecords.filter(i => i.planned6 !== '' && i.actual6 === '');
        const groupedMap = new Map<string, SIPendingData>();
        pendingItems.forEach(i => {
            const billNo = String(i.billNo || '');
            const key = `${i.vendorName}-${billNo}`;
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    liftNumber: i.liftNumber || '', indentNo: i.indentNo || '', billNo,
                    vendorName: i.vendorName || '', productName: i.productName || '', qty: 0,
                    typeOfBill: i.typeOfBill || '', billAmount: i.billAmount || 0, amount: i.amount || 0,
                    paymentType: i.paymentType || '', advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                    photoOfBill: i.photoOfBill || '', transportationInclude: i.transportationInclude || '',
                    transporterName: i.transporterName || '', poDate: i.poDate || '', poNumber: i.poNumber || '',
                    vendor: i.vendor || '', indentNumber: i.indentNumber || '', product: i.product || '',
                    uom: i.uom || '', poCopy: i.poCopy || '', billStatus: i.billStatus || '',
                    leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0, discountAmount: i.discountAmount || 0,
                    firmNameMatch: i.firmNameMatch || '', planned6Date: i.planned6 || '',
                    timestamp: i.timestamp || '', priceAsPerPo: i.priceAsPerPo || 0, remark: i.remark || '',
                    products: [], indentNumbers: [], originalItems: [],
                });
            }
            const group = groupedMap.get(key)!;
            group.qty += Number(i.qty) || 0;
            group.products.push(i.productName);
            group.indentNumbers.push(i.indentNo);
            group.originalItems.push(i);
        });
        setSiPendingData(Array.from(groupedMap.values()));
    }, [siServiceRecords, user?.firmNameMatch]);

    // ── StoreIn history processing ──────────────────────────────────────
    useEffect(() => {
        const filteredByFirm = siServiceRecords.filter(item =>
            user?.firmNameMatch?.toLowerCase() === 'all' || item.firmNameMatch === user?.firmNameMatch
        );
        const latestRecords: StoreInRecord[] = [];
        const seen = new Set<string>();
        for (const item of filteredByFirm) {
            const key = `${item.indentNo}-${item.productName}`;
            if (!seen.has(key)) { seen.add(key); latestRecords.push(item); }
        }
        setSiHistoryData(
            latestRecords.filter(i => i.actual6 !== '').map(i => ({
                liftNumber: i.liftNumber || '', indentNo: i.indentNo || '',
                billNo: String(i.billNo) || '', vendorName: i.vendorName || '',
                productName: i.productName || '', qty: i.qty || 0,
                typeOfBill: i.typeOfBill || '', billAmount: i.billAmount || 0,
                paymentType: i.paymentType || '', advanceAmountIfAny: Number(i.advanceAmountIfAny) || 0,
                photoOfBill: i.photoOfBill || '', transportationInclude: i.transportationInclude || '',
                transporterName: i.transporterName || '', amount: i.amount || 0,
                billStatus: i.billStatus || '', photoOfProduct: i.photoOfProduct || '',
                unitOfMeasurement: i.unitOfMeasurement || '', damageOrder: i.damageOrder || '',
                quantityAsPerBill: i.quantityAsPerBill || '', priceAsPerPoCheck: i.priceAsPerPoCheck || '',
                priceAsPerPo: i.priceAsPerPo || 0, remark: i.remark || '', poDate: i.poDate || '',
                poNumber: i.poNumber || '', receiveStatus: i.receivingStatus || '',
                vendor: i.vendorName || '', product: i.productName || '',
                orderQuantity: i.qty || 0,
                receivedDate: i.timestamp ? formatDateTime(parseCustomDate(i.timestamp)) : '',
                timestamp: i.timestamp ? formatDateTime(parseCustomDate(i.timestamp)) : '',
                leadTimeToLiftMaterial: i.leadTimeToLiftMaterial || 0,
                discountAmount: i.discountAmount || 0, firmNameMatch: i.firmNameMatch || '',
                planned6Date: i.planned6 || '',
            }))
        );
    }, [siServiceRecords, user?.firmNameMatch]);

    // ── StoreIn form schema ─────────────────────────────────────────────
    const siSchema = z.object({
        status: z.enum(['Received', 'Not Received'], { required_error: 'Status is required' }),
        remark: z.string().optional(),
    });

    type SIFormValues = z.infer<typeof siSchema>;

    const siForm = useForm<SIFormValues>({
        resolver: zodResolver(siSchema) as any,
        defaultValues: { status: undefined, remark: '' },
    });

    useEffect(() => {
        if (selectedSI) { siForm.reset({ status: undefined, remark: '' }); }
    }, [selectedSI, siForm]);

    useEffect(() => {
        if (!openSIDialog) { siForm.reset(); fetchAllData(); }
    }, [openSIDialog]);

    async function onSISubmit(values: SIFormValues) {
        if (!selectedSI) return;
        try {
            const currentDateTime = new Date().toISOString();
            for (const item of selectedSI.originalItems) {
                const { error } = await supabase.from('store_in').update({
                    actual6: currentDateTime,
                    receiving_status: values.status,
                    remark: values.remark || '',
                    hod_planned: currentDateTime,
                    hod_status: 'Pending',
                }).eq('lift_number', item.liftNumber);
                if (error) throw error;
            }
            toast.success(`Store In completed for ${selectedSI.originalItems.length} item(s)!`);
            setOpenSIDialog(false); setSelectedSI(null);
        } catch (error: any) {
            toast.error('Failed to store in: ' + (error?.message || ''));
        }
    }

    // ── Form schema (existing) ──────────────────────────────────────────
    const formSchema = z.object({
        billStatus: z.string().optional(),
        billNo: z.string().min(1, 'Bill number is required'),
        qty: z.coerce.number().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().min(0.01, 'Bill amount is required'),
        billRemark: z.string().optional(),
        vendorName: z.string().optional(),
        billCopy: z.instanceof(File).optional(),
        receivingStatus: z.string().optional(),
        location: z.string().min(1, 'Storage location is required'),
        photoOfProduct: z.instanceof(File, { message: 'Photo of product is required' }),
        damageOrder: z.string().min(1, 'Physical check is required'),
        quantityAsPerBill: z.string().min(1, 'Required'),
        priceAsPerPoCheck: z.string().min(1, 'Required'),
        remark: z.string().optional(),
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
            billStatus: 'Bill Received', billNo: '', qty: 0, typeOfBill: 'independent', billAmount: 0,
            billRemark: '', vendorName: '', billCopy: undefined, receivingStatus: 'Received',
            location: '', photoOfProduct: undefined, damageOrder: undefined,
            quantityAsPerBill: undefined, priceAsPerPoCheck: undefined, remark: '',
            cancelPendingQty: 0, items: [],
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
                billStatus: 'Bill Received', billNo: '', qty: selectedIndent.pendingLiftQty || 0,
                typeOfBill: 'independent', billAmount: 0, billRemark: '', vendorName: selectedIndent.vendorName || '',
                billCopy: undefined, receivingStatus: 'Received', location: '',
                photoOfProduct: undefined, damageOrder: undefined,
                quantityAsPerBill: undefined, priceAsPerPoCheck: undefined, remark: '',
                cancelPendingQty: 0,
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
                billCopy: undefined, receivingStatus: 'Received', location: '',
                photoOfProduct: undefined, damageOrder: undefined,
                quantityAsPerBill: undefined, priceAsPerPoCheck: undefined, remark: '',
                cancelPendingQty: 0,
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
                let photoProductUrl = '';
                let billCopyUrl = '';
                if (values.photoOfProduct instanceof File) {
                    photoProductUrl = await uploadProductPhoto(values.photoOfProduct, selectedHistory.indentNo || '');
                }
                if (values.billCopy instanceof File) {
                    billCopyUrl = await uploadBillCopy(values.billCopy, selectedHistory.liftNumber || selectedHistory.indentNo || '');
                }
                const updatedRecord = {
                    vendor_name: values.vendorName || selectedHistory.vendorName || '',
                    qty: newLiftQty.toString(),
                    bill_no: values.billNo || selectedHistory.billNo || '',
                    bill_status: values.billStatus || selectedHistory.billStatus || '',
                    type_of_bill: values.typeOfBill || selectedHistory.typeOfBill || '',
                    bill_amount: Number(values.billAmount) || selectedHistory.billAmount || 0,
                    bill_remark: values.billRemark || selectedHistory.billRemark || '',
                    ...(billCopyUrl ? { photo_of_bill: billCopyUrl } : {}),
                    receiving_status: values.receivingStatus || '',
                    location: values.location || '',
                    ...(photoProductUrl ? { photo_of_product: photoProductUrl } : {}),
                    damage_order: values.damageOrder || '',
                    quantity_as_per_bill: values.quantityAsPerBill || newLiftQty.toString(),
                    bill_received2: values.priceAsPerPoCheck || '',
                    remark: values.remark || '',
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
                let photoProductUrl = '';
                let billCopyUrl = '';
                if (values.photoOfProduct instanceof File) {
                    photoProductUrl = await uploadProductPhoto(values.photoOfProduct, selectedIndent?.indentNo || '');
                }
                if (values.billCopy instanceof File) {
                    billCopyUrl = await uploadBillCopy(values.billCopy, selectedIndent?.indentNo || '');
                }
                for (const item of values.items) {
                    if (Number(item.liftQty) <= 0) continue;
                    await insertStoreInRecord({
                        timestamp: currentDateTime, indentNo: item.indentNo,
                        billNo: values.billNo || '',
                        vendorName: values.vendorName || selectedIndent?.vendorName || '',
                        productName: item.product || '', qty: Number(item.liftQty), discountAmount: 0,
                        typeOfBill: values.typeOfBill || '', billAmount: Number(values.billAmount) || 0,
                        paymentType: '', advanceAmountIfAny: 0,
                        photoOfBill: billCopyUrl,
                        transportationInclude: (() => {
                            const match = (selectedIndent?.originalItems || []).find((oi: any) => oi.indentNumber?.toString() === item.indentNo);
                            return match?.rawIndent?.approvedTransportType || (selectedIndent?.originalItems?.[0] as any)?.rawIndent?.approvedTransportType || '';
                        })(), transporterName: '', amount: 0,
                        billStatus: values.billStatus || '',
                        quantityAsPerBill: values.quantityAsPerBill || Number(item.liftQty),
                        poDate: selectedIndent?.poDate || '', poNumber: item.poNumber || '',
                        vendor: values.vendorName || selectedIndent?.vendorName || '',
                        indentNumber: item.indentNo, product: item.product || '',
                        quantity: Number(item.quantity), vehicleNo: '', driverName: '', driverMobileNo: '',
                        billRemark: values.billRemark || '',
                        firmNameMatch: selectedIndent?.firmNameMatch || user?.firmNameMatch || '',
                        rate: String(item.approvedRate || ''), department: selectedIndent?.department || '',
                        areaOfUse: selectedIndent?.areaOfUse || '',
                        approvedVendorName: selectedIndent?.approvedVendorName || '',
                        liftingStatus: selectedIndent?.liftingStatus || '', notBillReceivedNo: '',
                        receivingStatus: values.receivingStatus || '',
                        location: values.location || '',
                        photoOfProduct: photoProductUrl,
                        damageOrder: values.damageOrder || '',
                        priceAsPerPoCheck: values.priceAsPerPoCheck || '',
                        remark: values.remark || '',
                    });
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

    // ── StoreIn pending columns ──────────────────────────────────────────
    const siPendingColumns: ColumnDef<SIPendingData>[] = [
        ...(user?.receiveItemView ? [{
            header: 'Action',
            cell: ({ row }: { row: Row<SIPendingData> }) => (
                <Button variant="outline" size="sm" onClick={() => { setSelectedSI(row.original); setOpenSIDialog(true); }}>
                    Store In
                </Button>
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
        { accessorKey: 'firmNameMatch', header: 'Firm' },

        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'typeOfBill', header: 'Type of Bill' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        { accessorKey: 'transporterName', header: 'Transporter' },
    ];

    // ── StoreIn history columns ──────────────────────────────────────────
    const siHistoryColumns: ColumnDef<SIHistoryData>[] = [
        { accessorKey: 'timestamp', header: 'Timestamp' },
        { accessorKey: 'liftNumber', header: 'Lift No.' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'firmNameMatch', header: 'Firm' },
        { accessorKey: 'vendorName', header: 'Vendor' },
        { accessorKey: 'productName', header: 'Product' },
        { accessorKey: 'billNo', header: 'Bill No.' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'typeOfBill', header: 'Type of Bill' },
        { accessorKey: 'paymentType', header: 'Payment Type' },
        { accessorKey: 'receiveStatus', header: 'Receive Status' },
        { accessorKey: 'damageOrder', header: 'Physical Check', cell: ({ getValue }) => { const v = getValue() as string; return v ? <span className={v === 'Yes' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{v === 'Yes' ? 'OK' : 'Not OK'}</span> : '-'; } },
        { accessorKey: 'quantityAsPerBill', header: 'Qty Match?', cell: ({ getValue }) => { const v = getValue() as string; return v ? <span className={v === 'Yes' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{v === 'Yes' ? 'Match' : 'Mismatch'}</span> : '-'; } },
        { accessorKey: 'priceAsPerPoCheck', header: 'Price Match?', cell: ({ getValue }) => { const v = getValue() as string; return v ? <span className={v === 'Yes' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{v === 'Yes' ? 'Match' : 'Mismatch'}</span> : '-'; } },
        { accessorKey: 'photoOfBill', header: 'Bill Photo', cell: ({ getValue }) => { const url = getValue() as string; return url ? <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>View</Button> : <span className="text-muted-foreground text-xs">-</span>; } },
        { accessorKey: 'photoOfProduct', header: 'Product Photo', cell: ({ getValue }) => { const url = getValue() as string; return url ? <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>View</Button> : <span className="text-muted-foreground text-xs">-</span>; } },
        { accessorKey: 'remark', header: 'Remark' },
    ];

    // ── Combined pending rows (lift + storein in one table) ─────────────
    interface CombinedPendingRow {
        rowType: 'lift' | 'storein';
        timestamp: string;
        poNumber: string;
        vendorName: string;
        products: string[];
        firmNameMatch: string;
        pendingQty: number;
        expectedDate?: string;
        plannedDate?: string;
        billNo?: string;
        billStatus?: string;
        billAmount?: number;
        liftData?: GetPurchaseData;
        siData?: SIPendingData;
    }

    const combinedPendingData = useMemo<CombinedPendingRow[]>(() => {
        const liftRows: CombinedPendingRow[] = tableData.map(r => ({
            rowType: 'lift',
            timestamp: r.timestamp || '',
            poNumber: r.poNumber || '',
            vendorName: r.vendorName || '',
            products: r.products || [],
            firmNameMatch: r.firmNameMatch || '',
            pendingQty: r.pendingLiftQty || 0,
            expectedDate: r.expectedDate || '',
            plannedDate: r.plannedDate || '',
            liftData: r,
        }));
        return liftRows;
    }, [tableData]);

    const combinedColumns: ColumnDef<CombinedPendingRow>[] = [
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }) => {
                const r = row.original;
                if (r.rowType === 'lift' && user?.receiveItemAction && r.liftData) {
                    return (
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm"
                                onClick={() => { setSelectedIndent(r.liftData!); setShowCancelQty(false); setCancelQtyValue(''); }}>
                                Update
                            </Button>
                        </DialogTrigger>
                    );
                }
                if (r.rowType === 'storein' && user?.receiveItemView && r.siData) {
                    return (
                        <Button variant="outline" size="sm"
                            onClick={() => { setSelectedSI(r.siData!); setOpenSIDialog(true); }}>
                            Store In
                        </Button>
                    );
                }
                return null;
            },
        },
        {
            id: 'stage',
            header: 'Stage',
            cell: ({ row }) => {
                const r = row.original;
                return r.rowType === 'lift'
                    ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">Pending</span>
                    : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">Store In</span>;
            },
        },
        {
            accessorKey: 'timestamp', header: 'Timestamp',
            cell: ({ getValue }) => <div className="text-xs">{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
        },
        {
            accessorKey: 'poNumber', header: 'PO Number',
            cell: ({ getValue }) => <div className="font-bold text-primary">{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'vendorName', header: 'Vendor',
            cell: ({ getValue }) => <div className="min-w-[120px]">{(getValue() as string) || '-'}</div>,
        },
        {
            accessorKey: 'products', header: 'Products',
            cell: ({ row }) => {
                const p = row.original.products || [];
                return <div className="max-w-[180px] truncate text-sm" title={p.join(', ')}>{p.length > 1 ? `${p[0]} (+${p.length - 1})` : p[0] || '-'}</div>;
            },
        },
        { accessorKey: 'firmNameMatch', header: 'Firm' },
        {
            accessorKey: 'pendingQty', header: 'Pending Qty',
            cell: ({ getValue }) => <div className="font-semibold text-center">{(getValue() as number) || 0}</div>,
        },
        {
            accessorKey: 'expectedDate', header: 'Expected Date',
            cell: ({ row }) => row.original.rowType === 'lift' ? (row.original.expectedDate || '-') : '-',
        },
        {
            accessorKey: 'plannedDate', header: 'Planned Date',
            cell: ({ row }) => {
                if (row.original.rowType === 'lift') {
                    const v = row.original.plannedDate || '';
                    return <div className={v === 'Not Set' ? 'text-muted-foreground italic text-xs' : ''}>{v || '-'}</div>;
                }
                return '-';
            },
        },

    ];

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <div className="bg-gray-50/60 min-h-screen">
            <Dialog open={openDialog} onOpenChange={handleOpenChange}>

                {/* ── Page Header ─────────────────────────────────── */}
                <Heading
                    heading="Material Receipt / Store In"
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
                <Tabs defaultValue="pending">
                    <div className="bg-white rounded-xl border shadow-sm p-2 flex items-center justify-between flex-wrap gap-2 mb-3">
                        <TabsList className="bg-gray-100 rounded-lg p-1 gap-0.5 h-auto">
                            <TabsTrigger value="pending" className="rounded-md px-3 py-1.5 text-sm font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-700 transition-all">
                                <Clock size={13}/> Pending Liftings
                                {combinedPendingData.length > 0 && <span className="bg-green-600 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold">{combinedPendingData.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="history" className="rounded-md px-3 py-1.5 text-sm font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-700 transition-all">
                                <FileText size={13}/> History
                                {historyData.length > 0 && <span className="bg-gray-500 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold">{historyData.length}</span>}
                            </TabsTrigger>
                        </TabsList>
                        <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading} className="gap-1.5 h-8">
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                        </Button>
                    </div>

                    {/* ── Pending Tab ───────────────────────── */}
                    <TabsContent value="pending">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-600 rounded-lg p-1.5"><Clock size={14} className="text-white"/></div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-sm">Pending Actions</h3>
                                        <p className="text-xs text-gray-500">
                                            {tableData.length} lift{tableData.length !== 1 ? 's' : ''} pending
                                            {siPendingData.length > 0 && ` · ${siPendingData.length} store-in awaiting`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pr-1">
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">Pending Lift</span>
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700"></span>
                                </div>
                            </div>
                            <DataTable
                                data={combinedPendingData}
                                columns={combinedColumns}
                                searchFields={['poNumber', 'vendorName', 'firmNameMatch', 'billNo']}
                                dataLoading={loading}
                            />
                        </div>
                    </TabsContent>

                    {/* ── History Tab ────────────────────────── */}
                    <TabsContent value="history" className="space-y-4">
                        {/* Lifting History */}
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b flex items-center gap-3">
                                <div className="bg-gray-600 rounded-lg p-1.5"><FileText size={14} className="text-white"/></div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 text-sm">Lifting History</h3>
                                    <p className="text-xs text-gray-500">{historyData.length} completed lifting records</p>
                                </div>
                            </div>
                            <DataTable
                                data={historyData}
                                columns={historyColumns}
                                searchFields={['indentNo', 'vendorName', 'poNumber', 'firmNameMatch']}
                                dataLoading={loading}
                            />
                        </div>
                        {/* Material Receipt History */}
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b flex items-center gap-3">
                                <div className="bg-emerald-600 rounded-lg p-1.5"><Truck size={14} className="text-white"/></div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 text-sm">Material Receipt History</h3>
                                    <p className="text-xs text-gray-500">{siHistoryData.length} received store-in records</p>
                                </div>
                            </div>
                            <DataTable
                                data={siHistoryData}
                                columns={siHistoryColumns}
                                searchFields={['indentNo', 'vendorName', 'poNumber', 'billNo', 'productName']}
                                dataLoading={loading}
                            />
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
x
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

                                {/* Bill Information */}
                                <div className="space-y-4 border-t pt-5">
                                    <div className="flex items-center gap-2 text-primary font-semibold">
                                        <FileText size={17} />
                                        <span>Bill Information</span>
                                    </div>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="billNo" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Number <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input {...field} className="h-10" placeholder="Enter bill number" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="billAmount" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Amount (₹) <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input type="number" {...field} className="h-10" disabled={!user?.administrate} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="billRemark" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Remark</FormLabel>
                                                <FormControl><Input {...field} className="h-10" placeholder="Enter remark" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="billCopy" render={({ field: { onChange, ...field } }) => (
                                            <FormItem>
                                                <FormLabel>Bill Copy (Image/PDF)</FormLabel>
                                                <FormControl>
                                                    <Input type="file" accept="image/*,.pdf" onChange={e => onChange(e.target.files?.[0])} {...field} value={undefined} />
                                                </FormControl>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>

                                {/* Receiving & Quality Check */}
                                <div className="space-y-4 border-t pt-5">
                                    <div className="flex items-center gap-2 text-primary font-semibold">
                                        <Package size={17} />
                                        <span>Receiving & Quality Check</span>
                                    </div>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="location" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Storage Location <span className="text-destructive">*</span></FormLabel>
                                                <FormControl><Input {...field} className="h-10" placeholder="Enter location" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="damageOrder" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Physical Check <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">OK</SelectItem>
                                                        <SelectItem value="No">Not OK</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="quantityAsPerBill" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Qty Matches Bill? <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">Yes</SelectItem>
                                                        <SelectItem value="No">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="priceAsPerPoCheck" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Price as per PO? <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">Yes</SelectItem>
                                                        <SelectItem value="No">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="photoOfProduct" render={({ field: { onChange, ...field } }) => (
                                            <FormItem>
                                                <FormLabel>Photo of Product <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="file" accept="image/*" onChange={e => onChange(e.target.files?.[0])} {...field} value={undefined} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="remark" render={({ field }) => (
                                            <FormItem className="md:col-span-2 lg:col-span-3">
                                                <FormLabel>Remark</FormLabel>
                                                <FormControl>
                                                    <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none h-10" placeholder="Enter remark" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )} />
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

            {/* ── StoreIn Dialog ─────────────────────────────────── */}
            <Dialog open={openSIDialog} onOpenChange={(open) => { setOpenSIDialog(open); if (!open) setSelectedSI(null); }}>
                {selectedSI && (
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <Form {...siForm}>
                            <form onSubmit={siForm.handleSubmit(onSISubmit, () => toast.error('Please select a status'))} className="space-y-4">
                                <DialogHeader className="border-b pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Truck className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-xl font-black">Store In Processing</DialogTitle>
                                            <p className="text-xs font-medium text-muted-foreground">Verify and confirm receipt of material for Lift #{selectedSI.liftNumber}</p>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="space-y-5 py-2">
                                    {/* Record Info */}
                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3 border-b border-slate-200/50 pb-2">
                                            <Package className="w-4 h-4 text-slate-400" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Record Information</h4>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Vendor</p>
                                                <p className="text-xs font-bold text-slate-900 line-clamp-1" title={selectedSI.vendorName}>{selectedSI.vendorName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">PO Number</p>
                                                <p className="text-xs font-black text-primary">{selectedSI.poNumber || '—'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Bill Number</p>
                                                <p className="text-xs font-bold text-slate-900">{selectedSI.billNo || 'N/A'}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Bill Amount</p>
                                                <p className="text-sm font-black text-emerald-600">₹{selectedSI.billAmount?.toLocaleString('en-IN') || '0'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Products in shipment (read-only) */}
                                    {(selectedSI.originalItems?.length || 0) > 0 && (
                                        <div className="border rounded-xl overflow-hidden">
                                            <div className="bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b">
                                                Products in this shipment ({selectedSI.originalItems.length})
                                            </div>
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/30 border-b">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Lift No.</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Product</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Indent No.</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedSI.originalItems.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-muted/20">
                                                            <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                                                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.liftNumber}</td>
                                                            <td className="px-3 py-2 text-xs font-medium">{item.productName}</td>
                                                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.indentNo}</td>
                                                            <td className="px-3 py-2 text-xs text-right font-semibold">{item.qty}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Store Verification Results (read-only from lift stage) */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <CheckCircle2 className="w-4 h-4 text-amber-500" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Store Verification Results (from Lift)</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {(() => {
                                                const first = selectedSI.originalItems?.[0] as any;
                                                const damage = first?.damageOrder;
                                                const qtyMatch = first?.quantityAsPerBill;
                                                const priceMatch = first?.priceAsPerPoCheck;
                                                return (<>
                                                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${damage === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Physical Check</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-black ${damage === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                                {damage === 'No' ? 'Damaged' : damage === 'Yes' ? 'Good' : '—'}
                                                            </span>
                                                            {damage === 'No' ? <X className="w-3 h-3 text-red-500" /> : damage === 'Yes' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
                                                        </div>
                                                    </div>
                                                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${qtyMatch === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Qty Matching</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-black ${qtyMatch === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                                {qtyMatch === 'No' ? 'Mismatch' : qtyMatch === 'Yes' ? 'Matches' : '—'}
                                                            </span>
                                                            {qtyMatch === 'No' ? <X className="w-3 h-3 text-red-500" /> : qtyMatch === 'Yes' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
                                                        </div>
                                                    </div>
                                                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${priceMatch === 'No' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Price Matching</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-xs font-black ${priceMatch === 'No' ? 'text-red-700' : 'text-slate-700'}`}>
                                                                {priceMatch === 'No' ? 'Mismatch' : priceMatch === 'Yes' ? 'Matches' : '—'}
                                                            </span>
                                                            {priceMatch === 'No' ? <X className="w-3 h-3 text-red-500" /> : priceMatch === 'Yes' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
                                                        </div>
                                                    </div>
                                                </>);
                                            })()}
                                        </div>
                                        {(selectedSI.originalItems?.[0] as any)?.remark && (
                                            <div className="bg-amber-50/50 rounded-xl border border-amber-100/50 p-3">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Inspector Remarks</p>
                                                        <p className="text-xs text-amber-900 font-medium italic">"{(selectedSI.originalItems[0] as any).remark}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Decision */}
                                    <div className="bg-white rounded-xl border p-4 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-primary" />
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Store In Decision</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField control={siForm.control} name="status" render={({ field }) => (
                                                <FormItem className="space-y-1">
                                                    <FormLabel className="text-[10px] font-bold uppercase text-slate-400 pl-1">Receiving Status <span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-10 border-slate-200">
                                                                <SelectValue placeholder="Select status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Received" className="text-emerald-600 font-bold">Received</SelectItem>
                                                            <SelectItem value="Not Received" className="text-red-600 font-bold">Not Received</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={siForm.control} name="remark" render={({ field }) => (
                                                <FormItem className="space-y-1">
                                                    <FormLabel className="text-[10px] font-bold uppercase text-slate-400 pl-1">Remarks</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Add remarks..." {...field} className="h-10 border-slate-200" />
                                                    </FormControl>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="border-t pt-4">
                                    <Button type="button" variant="ghost" className="h-10 text-slate-500 font-semibold" onClick={() => { setOpenSIDialog(false); setSelectedSI(null); }}>Cancel</Button>
                                    <Button type="submit" disabled={siForm.formState.isSubmitting}
                                        className={`h-10 px-8 font-black transition-all shadow-md ${siForm.watch('status') === 'Not Received' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}>
                                        {siForm.formState.isSubmitting ? <Loader size={16} color="white" className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                        Confirm Store In
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
