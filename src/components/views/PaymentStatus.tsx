import { Package2, FileText, Building, DollarSign, Calendar, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadFile } from '@/lib/fetchers';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { createPaymentEntry, uploadProductPhoto, updateStoreInReceiving } from '@/services/storeInService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';

// ✅ UPDATED INTERFACE
interface PIPendingData {
    rowIndex: number;
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: string | number;
    firmNameMatch: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    pdf?: string;
    paymentForm?: string;
    billNo?: string;
    billAmount?: number;
    rowIds: number[];
    liftNumber?: string;
}

interface POMasterRecord {
    rowIndex?: number;
    timestamp?: string;
    partyName?: string;
    poNumber?: string;
    internalCode?: string;
    product?: string;
    description?: string;
    quantity?: string | number;
    unit?: string;
    rate?: string | number;
    gstPercent?: string | number;
    discountPercent?: string | number;
    amount?: string | number;
    totalPoAmount?: string | number;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    firmNameMatch?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    pdf?: string;
}

export default function PIApprovals() {
    const {
        poMasterSheet,
        paymentsSheet,
        storeInSheet,
        paymentHistorySheet,
        updateAll,
        allLoading: poMasterLoading
    } = useSheets();
    const { user } = useAuth();
    const [pendingData, setPendingData] = useState<PIPendingData[]>([]);
    const [selectedItem, setSelectedItem] = useState<PIPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [filterTerm, setFilterTerm] = useState('Advance Terms');

    // ✅ Memoized filtered data
    const filteredData = useMemo(() => {
        if (filterTerm === 'All') return pendingData;
        if (filterTerm === 'Advance Terms') {
            return pendingData.filter(item => {
                const pt = (item.paymentTerms || '').toLowerCase();
                return pt.includes('advance') || pt.includes('pi');
            });
        }
        return pendingData.filter(item => item.paymentTerms === filterTerm);
    }, [pendingData, filterTerm]);

    // ✅ Get unique payment terms for the filter
    const uniquePaymentTerms = useMemo(() => {
        const terms = new Set<string>();
        pendingData.forEach(item => {
            if (item.paymentTerms) {
                terms.add(item.paymentTerms);
            }
        });
        return Array.from(terms).sort();
    }, [pendingData]);

    const stats = useMemo(() => {
        const totalOutstanding = filteredData.reduce((sum, item) => sum + item.outstandingAmount, 0);
        return {
            total: filteredData.length,
            totalAmount: totalOutstanding,
            pendingCount: filteredData.length
        };
    }, [filteredData]);



    useEffect(() => {
        try {
            // ✅ Use data from useSheets context
            const safePoMasterSheet: any[] = Array.isArray(poMasterSheet) ? poMasterSheet : [];
            const safePaymentsSheet: any[] = Array.isArray(paymentsSheet) ? paymentsSheet : [];
            const safeStoreInSheet: any[] = Array.isArray(storeInSheet) ? storeInSheet : [];

            // 1. Identify received PO numbers from store_in
            const receivedPoNumbersSet = new Set(
                safeStoreInSheet
                    .filter(s => s.actual6 && s.actual6.toString().trim() !== '')
                    .map(s => s.poNumber || s.po_number || '')
                    .filter(Boolean)
            );

            // 2. Identify PO-based pending items
            const poBasedPendingItems = safePoMasterSheet
                .filter((record: any) => {
                    // Firm filtering
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        record.firmNameMatch === user.firmNameMatch;
                    if (!firmMatch) return false;

                    // Status filtering
                    const status = (record.status || record.indent_status || '').toString().trim().toLowerCase();
                    const isPending = status === 'pending' || status === '' || status === undefined;
                    if (!isPending) return false;

                    // Outstanding amount calculation
                    const totalPo = Number(record.totalPoAmount || 0);

                    // Sum payments for this PO
                    const totalPaid = safePaymentsSheet
                        .filter((p: any) => (p.poNumber || p.po_number || p.po_no) === (record.poNumber || record.po_number || record.po_no))
                        .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);

                    const outstanding = totalPo - totalPaid;


                    return outstanding > 0;
                })
                .map((record: any) => {
                    const totalPo = Number(record.totalPoAmount || 0);
                    const totalPaid = safePaymentsSheet
                        .filter((p: any) => (p.poNumber || p.po_number || p.po_no) === (record.poNumber || record.po_number || record.po_no))
                        .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);

                    const linkedStoreIn = safeStoreInSheet.find((s: any) =>
                        (s.poNumber || s.po_number || '') === (record.poNumber || record.po_number || record.po_no || '')
                    );

                    return {
                        rowIndex: record.id || 0,
                        timestamp: record.timestamp || '',
                        partyName: record.partyName || record.party_name || '',
                        poNumber: record.poNumber || record.po_number || '',
                        internalCode: record.internalCode || record.internal_code || '',
                        product: record.product || '',
                        description: record.description || record.product || '',
                        quantity: Number(record.quantity || 0),
                        unit: record.unit || '',
                        rate: Number(record.rate || 0),
                        gstPercent: Number(record.gstPercent || record.gst_percent || 0),
                        discountPercent: Number(record.discountPercent || record.discount_percent || 0),
                        amount: Number(record.amount || 0),
                        totalPoAmount: totalPo,
                        deliveryDate: record.deliveryDate || record.delivery_date || '',
                        paymentTerms: record.paymentTerms || record.payment_terms || '',
                        numberOfDays: record.numberOfDays || record.number_of_days || 0,
                        firmNameMatch: record.firmNameMatch || '',
                        totalPaidAmount: totalPaid,
                        outstandingAmount: totalPo - totalPaid,
                        status: record.status || 'Pending',
                        pdf: record.pdf || '',
                        billNo: linkedStoreIn?.billNo || linkedStoreIn?.bill_no || '',
                        billAmount: Number(linkedStoreIn?.billAmount || linkedStoreIn?.bill_amount || 0),
                        advanceAmount: Number(record.advanceAmount || record.advance_amount || 0),
                        advancePercent: Number(record.advancePercent || record.advance_percent || record.advance_percentage || record.number_of_days || 0),
                        rowIds: [record.id || 0],
                        liftNumber: linkedStoreIn?.liftNumber || linkedStoreIn?.lift_number || '',
                    };
                });

            // 3. Identify Payment-based pending items (Direct entries like Store In or Freight)
            const paymentBasedItems = safePaymentsSheet
                .filter((payment: any) => {
                    const status = String(payment?.status || '').toLowerCase();
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        (payment?.firmNameMatch || payment?.firm_name) === user?.firmNameMatch;

                    // Show payments that are pending and not yet scheduled
                    const isPending = status === 'pending';
                    const notScheduled = !payment?.planned || String(payment?.planned || '').trim() === '';

                    // ✅ Link with StoreIn to check Bill Type and HOD Status
                    // If Bill Type is "common", or HOD Status is "Rejected", DO NOT show in HOD Approval (Process for Payment)
                    // Match by indent number, and by PO number too when both sides have one,
                    // so an indent with multiple lifts doesn't pick the wrong store_in row.
                    const linkedStoreIn = safeStoreInSheet.find((s: any) =>
                        (s.indentNo || s.indentNumber) === (payment?.internalCode || payment?.internal_code) &&
                        (!s.poNumber || !payment?.poNumber || s.poNumber === payment.poNumber)
                    );

                    if (linkedStoreIn) {
                        if (linkedStoreIn.typeOfBill && linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') {
                            return false;
                        }
                        // ✅ HOD Status Check: Only show if Approved
                        if ((linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') {
                            return false;
                        }
                    }

                    // ✅ Relaxed Payment Terms for paymentBasedItems
                    const paymentTerms = (payment?.paymentTerms || payment?.payment_terms || '').toString().trim();
                    const paymentForm = (payment?.paymentForm || payment?.payment_form || '').toString().trim().toLowerCase();
                    const isPI = paymentTerms === "Partly PI / Party Advance" || paymentTerms === "Partly PI";
                    const isStoreIn = paymentForm === 'store_in';

                    if (!isPI && !isStoreIn && paymentTerms !== '') {
                        // If it's not PI AND not StoreIn AND it HAS some other term, maybe filter out? 
                        // But usually, if it's in payments table, it's there to be paid.
                        // Let's allow if it's pending.
                    }

                    return firmMatch && isPending && notScheduled;
                })
                .map((payment: any) => {
                    const linkedStoreIn = Array.isArray(safeStoreInSheet)
                        ? safeStoreInSheet.find(s =>
                            (s.indentNo || s.indentNumber) === (payment?.internalCode || payment?.internal_code) &&
                            (!s.poNumber || !payment?.poNumber || s.poNumber === payment.poNumber)
                        )
                        : null;

                    return {
                        rowIndex: payment?.id || payment?.rowIndex || 0,
                        timestamp: payment?.timestamp || '',
                        partyName: payment?.partyName || payment?.party_name || '',
                        poNumber: payment?.poNumber || payment?.po_number || '',
                        internalCode: payment?.internalCode || payment?.internal_code || '',
                        product: payment?.product || payment?.product_name || '',
                        description: `${payment?.paymentForm || payment?.payment_form ? (payment.paymentForm || payment.payment_form).toUpperCase() + ' - ' : ''}${payment?.product || ''}`,
                        quantity: 0,
                        unit: '',
                        rate: 0,
                        gstPercent: 0,
                        discountPercent: 0,
                        amount: Number(payment?.payAmount || payment?.pay_amount || 0),
                        totalPoAmount: Number(payment?.totalPoAmount || payment?.total_po_amount || payment?.payAmount || payment?.pay_amount || 0),
                        deliveryDate: payment?.deliveryDate || payment?.delivery_date || '',
                        paymentTerms: payment?.paymentTerms || payment?.payment_terms || '',
                        numberOfDays: Number(payment?.numberOfDays || payment?.number_of_days || 0),
                        firmNameMatch: payment?.firmNameMatch || payment?.firm_name || '',
                        totalPaidAmount: Number(payment?.totalPaidAmount || payment?.total_paid_amount || 0),
                        outstandingAmount: Number(payment?.outstandingAmount || payment?.outstanding_amount || payment?.payAmount || payment?.pay_amount || 0),
                        status: payment?.status || 'Pending',
                        pdf: payment?.pdf || payment?.file || '',
                        billNo: payment?.billNo || payment?.bill_no || linkedStoreIn?.billNo || linkedStoreIn?.bill_no || '',
                        billAmount: Number(payment?.billAmount || payment?.bill_amount || linkedStoreIn?.billAmount || linkedStoreIn?.bill_amount || 0),
                        rowIds: [payment?.id || 0],
                        liftNumber: linkedStoreIn?.liftNumber || linkedStoreIn?.lift_number || '',
                    };
                });

            // 3. Store-In based items: directly from Get Purchase (GetLift) history
            const storeInBasedItems: PIPendingData[] = safeStoreInSheet
                .filter((record: any) => {
                    // Firm filtering
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === 'all' ||
                        record.firmNameMatch === user.firmNameMatch;
                    if (!firmMatch) return false;

                    // Must have a bill number or bill amount
                    const hasBill = Number(record.billAmount || 0) > 0 || (record.billNo || '').trim() !== '';
                    if (!hasBill) return false;

                    return true;
                })
                .map((record: any) => {
                    const billAmt = Number(record.billAmount || 0);
                    return {
                        rowIndex: record.id || 0,
                        timestamp: record.timestamp || '',
                        partyName: record.vendorName || '',
                        poNumber: record.poNumber || '',
                        internalCode: record.indentNo || '',
                        product: record.productName || record.product || '',
                        description: record.productName || record.product || '',
                        quantity: Number(record.qty || 0),
                        unit: record.uom || '',
                        rate: Number(record.priceAsPerPo || 0),
                        gstPercent: 0,
                        discountPercent: 0,
                        amount: billAmt,
                        totalPoAmount: billAmt,
                        deliveryDate: '',
                        paymentTerms: record.paymentTerms || '',
                        numberOfDays: 0,
                        firmNameMatch: record.firmNameMatch || '',
                        totalPaidAmount: 0,
                        outstandingAmount: billAmt,
                        status: 'Pending',
                        billNo: record.billNo || '',
                        billAmount: billAmt,
                        rowIds: [record.id || 0],
                        liftNumber: record.liftNumber || '',
                    } as PIPendingData;
                });

            // Combine all three lists and remove duplicates by Party Name + billNo
            const uniqueBillMap = new Map<string, PIPendingData>();

            // Process poBasedPendingItems first
            poBasedPendingItems.forEach(item => {
                const billKey = item.billNo || 'NoBill';
                const uniqueKey = `${item.partyName || 'NoVendor'}-${item.poNumber || 'NoPO'}-${billKey}`;

                if (!uniqueBillMap.has(uniqueKey)) {
                    uniqueBillMap.set(uniqueKey, { ...item });
                } else {
                    const existing = uniqueBillMap.get(uniqueKey)!;
                    existing.rowIds = Array.from(new Set([...existing.rowIds, ...item.rowIds]));

                    // Concatenate unique products
                    const existingProducts = existing.product.split(', ').map(p => p.trim());
                    if (item.product && !existingProducts.includes(item.product.trim())) {
                        existing.product = [...existingProducts, item.product.trim()].join(', ');
                    }
                }
            });

            // Process paymentBasedItems
            paymentBasedItems.forEach(paymentItem => {
                const billKey = paymentItem.billNo || 'NoBill';
                const uniqueKey = `${paymentItem.partyName || 'NoVendor'}-${paymentItem.poNumber || 'NoPO'}-${billKey}`;

                if (!uniqueBillMap.has(uniqueKey)) {
                    uniqueBillMap.set(uniqueKey, { ...paymentItem });
                } else {
                    const existing = uniqueBillMap.get(uniqueKey)!;
                    existing.rowIds = Array.from(new Set([...existing.rowIds, ...paymentItem.rowIds]));

                    // Concatenate unique products
                    const existingProducts = (existing.product || '').split(', ').map(p => p.trim()).filter(Boolean);
                    const newProduct = paymentItem.product?.trim();
                    if (newProduct && !existingProducts.includes(newProduct)) {
                        existing.product = [...existingProducts, newProduct].join(', ');
                    }
                }
            });

            // Process storeInBasedItems (Get Purchase history)
            storeInBasedItems.forEach(storeItem => {
                const billKey = storeItem.billNo || 'NoBill';
                const uniqueKey = `${storeItem.partyName || 'NoVendor'}-${storeItem.poNumber || 'NoPO'}-${billKey}`;

                if (!uniqueBillMap.has(uniqueKey)) {
                    uniqueBillMap.set(uniqueKey, { ...storeItem });
                } else {
                    const existing = uniqueBillMap.get(uniqueKey)!;
                    // Enrich existing with liftNumber and billAmount if missing
                    if (!existing.liftNumber) existing.liftNumber = storeItem.liftNumber;
                    if (!existing.billAmount) existing.billAmount = storeItem.billAmount;
                    existing.rowIds = Array.from(new Set([...existing.rowIds, ...storeItem.rowIds]));
                    const existingProducts = (existing.product || '').split(', ').map(p => p.trim()).filter(Boolean);
                    const newProduct = storeItem.product?.trim();
                    if (newProduct && !existingProducts.includes(newProduct)) {
                        existing.product = [...existingProducts, newProduct].join(', ');
                    }
                }
            });

            // Final processing: Filter out items that are already "Processed"
            // (meaning a payment record exists for this PO + Bill, OR it's in history)
            const finalProcessedList = Array.from(uniqueBillMap.values()).filter(item => {
                const paymentRecords = Array.isArray(safePaymentsSheet) ? safePaymentsSheet : [];
                const historyRecords = Array.isArray(paymentHistorySheet) ? paymentHistorySheet : [];

                // 1. Check if it exists in the payments table
                const isProcessTable = paymentRecords.some(p => {
                    const poMatch = (p.poNumber || p.po_number || p.po_no) === item.poNumber;
                    // When the item has no bill number, fall back to matching by indent number
                    // instead of treating it as a wildcard match against any payment for the PO
                    // (that previously hid unrelated/advance bills under the same PO).
                    const billMatch = item.billNo
                        ? (p.remark || '').includes(`Bill: ${item.billNo}`) || (p as any).billNo === item.billNo || (p as any).bill_no === item.billNo
                        : (p.internalCode || (p as any).internal_code || '') === item.internalCode;

                    const statusVal = String(p.status1 || p.status || '').toLowerCase();
                    // Processed if it's already scheduled or approved
                    const isProcessedStatus = ['pending', 'approved', 'complete', 'completed', 'process'].includes(statusVal);
                    // Also check for planned date as a sign of proceeding
                    const hasPlannedDate = p.planned && p.planned.toString().trim() !== '';

                    return poMatch && billMatch && (isProcessedStatus || hasPlannedDate);
                });

                // 2. Check if it exists in the payment history
                const isInHistory = historyRecords.some(h => {
                    const poMatch = (h.po_number || (h as any).po_number || (h as any).poNumber) === item.poNumber;
                    const billMatch = item.billNo
                        ? (h.bill_no || (h as any).billNo || (h as any).bill_no) === item.billNo
                        : (h.indent_no || (h as any).indentNo || (h as any).internalCode || '') === item.internalCode;
                    return poMatch && billMatch;
                });

                return !(isProcessTable || isInHistory);
            });

            setPendingData(finalProcessedList);
        } catch (error) {
            console.error('❌ Error in HOD Approval logic:', error);
            setPendingData([]);
        }
    }, [poMasterSheet, paymentsSheet, storeInSheet, paymentHistorySheet, user?.firmNameMatch]);

    const pendingColumns: ColumnDef<PIPendingData>[] = [
        {
            header: 'Action',
            cell: ({ row }: { row: Row<PIPendingData> }) => {
                const item = row.original;
                const paymentRecords = Array.isArray(paymentsSheet) ? paymentsSheet : [];
                const historyRecords = Array.isArray(paymentHistorySheet) ? paymentHistorySheet : [];

                // 1. Check if it exists in the payments table (already processed for payment)
                const isProcessTable = paymentRecords.some(p => {
                    const poMatch = (p.poNumber || p.po_number) === item.poNumber;
                    // Check for bill match in remark or direct match if available.
                    // Without a bill number, match by indent number rather than any payment on the PO.
                    const billMatch = item.billNo
                        ? (p.remark || '').includes(`Bill: ${item.billNo}`) || (p as any).billNo === item.billNo || (p as any).bill_no === item.billNo
                        : (p.internalCode || (p as any).internal_code || '') === item.internalCode;
                    // If it has a planned date or is pending/approved, it's processed
                    const statusVal = String(p.status1 || p.status || '').toLowerCase();
                    const isProcessedStatus = ['pending', 'approved', 'complete', 'completed', 'process'].includes(statusVal);

                    return poMatch && billMatch && isProcessedStatus;
                });

                // 2. Check if it exists in the payment history (already paid)
                const isInHistory = historyRecords.some(h => {
                    const poMatch = (h.po_number || (h as any).poNumber) === item.poNumber;
                    const billMatch = item.billNo
                        ? (h.bill_no || (h as any).billNo) === item.billNo
                        : (h.indent_no || (h as any).indentNo || (h as any).internalCode || '') === item.internalCode;
                    return poMatch && billMatch;
                });

                const isProcessed = isProcessTable || isInHistory;

                return (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessed}
                        onClick={() => {
                            setSelectedItem(item);
                            setOpenDialog(true);
                        }}
                        className={`border-green-200 text-green-700 shadow-sm transition-all ${isProcessed
                            ? 'opacity-40 cursor-not-allowed grayscale'
                            : 'hover:bg-green-50 hover:text-green-800'
                            }`}
                    >
                        {isProcessed ? (
                            <>
                                <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                Processed
                            </>
                        ) : (
                            <>
                                <FileText className="mr-2 h-3.5 w-3.5" />
                                Process Payment
                            </>
                        )}
                    </Button>
                );
            },
        },
        {
            accessorKey: 'billNo',
            header: 'Bill No.',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-green-800">{row.original.billNo || '-'}</span>
            ),
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <span className="font-medium text-gray-700">{row.original.poNumber || '-'}</span>
            ),
        },
        {
            accessorKey: 'partyName',
            header: 'Party Name',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.partyName || '-'}</span>
            ),
        },
        {
            accessorKey: 'internalCode',
            header: 'Indent No.',
            cell: ({ row }) => (
                <div className="bg-slate-100 text-slate-700 py-1 px-2.5 rounded text-[11px] font-bold inline-block border border-slate-200 uppercase tracking-wider">
                    {row.original.internalCode || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-slate-700">{row.original.product || '-'}</span>
            ),
        },
        {
            accessorKey: 'totalPoAmount',
            header: () => <div className="text-right">Total PO Amount</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold text-slate-900">
                    ₹{row.original.totalPoAmount?.toLocaleString('en-IN')}
                </div>
            ),
        },
        {
            accessorKey: 'billAmount',
            header: () => <div className="text-right">Bill Amount</div>,
            cell: ({ row }) => (
                <div className="text-right font-semibold text-green-700">
                    ₹{row.original.billAmount?.toLocaleString('en-IN') || '0'}
                </div>
            ),
        },
        {
            accessorKey: 'totalPaidAmount',
            header: () => <div className="text-right">Total Paid</div>,
            cell: ({ row }) => (
                <div className="text-right font-semibold text-emerald-600">
                    ₹{row.original.totalPaidAmount?.toLocaleString('en-IN')}
                </div>
            ),
        },
        {
            accessorKey: 'outstandingAmount',
            header: () => <div className="text-right text-rose-600">Outstanding</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold text-rose-600">
                    ₹{row.original.outstandingAmount?.toLocaleString('en-IN')}
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status?.toLowerCase() || '';
                const isPending = status === 'pending';
                const isComplete = status === 'complete' || status === 'completed';

                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight ${isComplete
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isPending
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}>
                        {isComplete && <CheckCircle className="mr-1 h-3 w-3" />}
                        {isPending && <AlertCircle className="mr-1 h-3 w-3" />}
                        {row.original.status || 'Pending'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.paymentTerms || '-'}</span>
            ),
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ row }) => {
                const deliveryDate = row.original.deliveryDate;
                if (!deliveryDate) return <span className="text-sm">-</span>;

                try {
                    const date = new Date(deliveryDate);
                    if (isNaN(date.getTime())) {
                        return <span className="text-sm">{deliveryDate}</span>;
                    }
                    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
                    return <span className="text-sm">{formattedDate}</span>;
                } catch (error) {
                    return <span className="text-sm">{deliveryDate}</span>;
                }
            },
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm',
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {row.original.firmNameMatch || '-'}
                </div>
            ),
        },
    ];

    // ✅ UPDATED SCHEMA - Pay Amount, File, Remarks
    const schema = z.object({
        payAmount: z.coerce.number().min(1, 'Amount must be greater than 0'),
        file: z.string().optional(),
        remark: z.string().min(1, 'Remarks are required'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            payAmount: 0,
            file: '',
            remark: '',
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset();
        } else if (selectedItem) {
            const defaultAmt = selectedItem.billAmount && selectedItem.billAmount > 0
                ? selectedItem.billAmount
                : selectedItem.outstandingAmount || 0;
            form.setValue('payAmount', defaultAmt);
        }
    }, [openDialog, selectedItem, form]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only PDF, JPG, and PNG files are allowed');
            return;
        }

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File size must be less than 10MB');
            return;
        }

        try {
            setUploadingFile(true);
            const driveLink = await uploadFile({
                file: file,
                folderId: 'photo_of_bill'
            });

            form.setValue('file', driveLink);
            toast.success('File uploaded successfully');
        } catch (error) {
            toast.error('Failed to upload file');
            console.error('Upload error:', error);
        } finally {
            setUploadingFile(false);
        }
    };

    function generateUniqueNo(): string {
        const existingCount = Array.isArray(paymentsSheet) ? paymentsSheet.length : 0;
        return `PAY-${(existingCount + 1).toString().padStart(4, '0')}`;
    }

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedItem) {
                toast.error('No item selected');
                return;
            }

            const isoNow = new Date().toISOString();
            const payAmount = Number(values.payAmount) || 0;
            const newOutstanding = (selectedItem.outstandingAmount || 0) - payAmount;
            const newStatus = newOutstanding <= 0 ? 'Complete' : 'Pending';
            const finalRemark = selectedItem.billNo
                ? `${values.remark} | Bill: ${selectedItem.billNo}`
                : values.remark;

            const uniqueNo = generateUniqueNo();

            const paymentData = {
                timestamp: isoNow,
                unique_no: uniqueNo,
                party_name: selectedItem.partyName,
                po_number: selectedItem.poNumber,
                total_po_amount: String(selectedItem.totalPoAmount || ''),
                internal_code: selectedItem.internalCode,
                product: selectedItem.product,
                delivery_date: selectedItem.deliveryDate || '',
                payment_terms: selectedItem.paymentTerms || '',
                number_of_days: String(selectedItem.numberOfDays || '0'),
                pdf: selectedItem.pdf || '',
                pay_amount: String(payAmount),
                file: values.file || '',
                remark: finalRemark,
                total_paid_amount: String((selectedItem.totalPaidAmount || 0) + payAmount),
                outstanding_amount: String(newOutstanding),
                status: newStatus,
                planned: isoNow.split('T')[0],
                actual: null,
                firm_name: selectedItem.firmNameMatch || user?.firmNameMatch || '',
                status1: 'pending',
                payment_form: 'store_in',
            };

            const { error: insertError } = await supabase
                .from('payments')
                .insert([paymentData]);

            if (insertError) throw insertError;

            toast.success(`✅ Payment queued for: ${selectedItem.partyName}`);
            setOpenDialog(false);
            setTimeout(() => updateAll(), 1000);
        } catch (error) {
            toast.error('Failed to process payment');
            console.error('Payment error:', error);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields correctly');
    }

    return (
        <div>
            <Heading heading="Process for Payment / Debit Note" subtext="Approved GRN need to process payments for pending purchase orders">
                <Package2 size={28} className="text-primary" />
            </Heading>
            <div className="p-4 md:p-6">
                <div className="mx-auto max-w-7xl">
                    {/* Header Section */}
                    <div className="mb-6">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">{stats.total}</p>
                                    </div>
                                    <FileText className="h-10 w-10 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total PO Amount</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">
                                            ₹{stats.totalAmount.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <DollarSign className="h-10 w-10 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Payment Status</p>
                                        <p className="text-2xl font-bold text-amber-600 mt-1">
                                            {stats.pendingCount > 0 ? 'Pending' : 'Completed'}
                                        </p>
                                    </div>
                                    <div className={`h-10 w-10 flex items-center justify-center rounded-full ${stats.pendingCount > 0 ? 'bg-amber-100' : 'bg-green-100'
                                        }`}>
                                        {stats.pendingCount > 0 ? (
                                            <AlertCircle className="h-6 w-6 text-amber-600" />
                                        ) : (
                                            <CheckCircle className="h-6 w-6 text-green-600" />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Main Content Card */}
                <Card className="bg-white shadow-lg border-0 mb-6">
                    <CardHeader className="">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-gray-800">Pending Payments</CardTitle>
                                <p className="text-gray-600 text-sm mt-1">Click "Process Payment" to process the payment for purchase order</p>
                            </div>
                            {stats.total === 0 ? (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    All Paid
                                </div>
                            ) : (
                                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    {stats.total} Pending
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredData.length > 0 ? (
                            <DataTable
                                data={filteredData}
                                columns={pendingColumns}
                                searchFields={['poNumber', 'partyName', 'product', 'internalCode', 'firmNameMatch']}
                                dataLoading={poMasterLoading}
                                className="border rounded-lg"
                                extraActions={
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-600 whitespace-nowrap mr-2">Payment Terms:</span>
                                        <Select value={filterTerm} onValueChange={setFilterTerm}>
                                            <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200">
                                                <SelectValue placeholder="Select Term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All">All Terms</SelectItem>
                                                <SelectItem value="Advance Terms">Advance Terms (PI/Advance)</SelectItem>
                                                {uniquePaymentTerms.map(term => (
                                                    <SelectItem key={term} value={term}>
                                                        {term}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Payments</h3>
                                <p className="text-gray-500">All payments have been processed or no POs with pending status.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payment Dialog */}
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    {selectedItem && (
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
                                    <DialogHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-green-100 rounded-lg">
                                                <DollarSign className="h-6 w-6 text-green-600" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-xl">Make Payment</DialogTitle>
                                                <DialogDescription>
                                                    Process payment for PO: <span className="font-semibold text-green-600">{selectedItem.poNumber}</span>
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <Separator />

                                    {/* PO Details Card */}
                                    <Card className="bg-green-50 border-green-200">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-semibold text-green-800 flex items-center gap-2">
                                                <Package2 className="h-4 w-4" />
                                                PO Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">PO Number</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.poNumber}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Party Name</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.partyName}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Indent No.</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.internalCode}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Product</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.product}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total PO Amount</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPoAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total Paid</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPaidAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Outstanding</p>
                                                    <p className="text-sm font-semibold text-red-600">
                                                        ₹{selectedItem.outstandingAmount?.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Status</p>
                                                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        {selectedItem.status || 'Pending'}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* ✅ UPDATED Form Fields - Only Pay Amount, File, Remarks */}
                                    <div className="space-y-4">


                                        {/* Bill Amount Display (Read-only) */}
                                        <div className="space-y-1.5 p-3 bg-green-50 rounded-md border border-green-100">
                                            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Bill Amount</p>
                                            <p className="text-lg font-bold text-green-900 flex items-center gap-1.5">
                                                ₹{selectedItem.billAmount?.toLocaleString('en-IN') || '0'}
                                            </p>
                                        </div>

                                        {/* Amount to Pay (editable) */}
                                        <FormField
                                            control={form.control}
                                            name="payAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium">
                                                        Amount to Pay <span className="text-red-500">*</span>
                                                        <span className="ml-2 text-xs text-gray-400 font-normal">
                                                            (Max: ₹{selectedItem.outstandingAmount?.toLocaleString('en-IN') || '0'})
                                                        </span>
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="Enter amount to pay"
                                                            className="border-gray-300 focus:border-green-500 text-lg font-semibold"
                                                            min={1}
                                                            max={selectedItem.outstandingAmount || undefined}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="remark"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium">Remarks *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="text"
                                                            placeholder="Enter payment remarks"
                                                            className="border-gray-300 focus:border-green-500"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="file"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium flex items-center gap-2">
                                                        <Upload className="h-4 w-4" />
                                                        Upload Payment Proof
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="space-y-2">
                                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-green-400 transition-colors">
                                                                <Input
                                                                    type="file"
                                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                                    onChange={handleFileUpload}
                                                                    disabled={uploadingFile}
                                                                    className="border-0 cursor-pointer"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-2">
                                                                    Upload payment proof (PDF, JPG, PNG - Max 10MB)
                                                                </p>
                                                            </div>
                                                            {uploadingFile && (
                                                                <div className="flex items-center gap-2 text-sm text-green-600">
                                                                    <Loader size={16} color="blue" />
                                                                    Uploading...
                                                                </div>
                                                            )}
                                                            {field.value && !uploadingFile && (
                                                                <div className="space-y-1">
                                                                    <p className="text-sm text-green-600 flex items-center gap-2">
                                                                        <CheckCircle className="h-4 w-4" />
                                                                        File uploaded successfully
                                                                    </p>
                                                                    <a
                                                                        href={field.value}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm text-green-600 hover:underline flex items-center gap-1"
                                                                    >
                                                                        View uploaded file →
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="border-gray-300"
                                                disabled={form.formState.isSubmitting || uploadingFile}
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            className="bg-green-600 hover:bg-green-700 shadow-sm"
                                            disabled={form.formState.isSubmitting || uploadingFile}
                                        >
                                            {form.formState.isSubmitting ? (
                                                <>
                                                    <Loader size={18} className="mr-2" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                    Submit Payment
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    )}
                </Dialog>
            </div>
        </div>
        </div>
    );
}