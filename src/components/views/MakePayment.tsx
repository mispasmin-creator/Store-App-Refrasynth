import { FileText, Building, DollarSign, CheckCircle, AlertCircle, ExternalLink, CheckSquare, XSquare, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { uploadFile } from '@/lib/fetchers';
import { toast } from 'sonner';
import { Checkbox } from '../ui/checkbox';
import { formatDate, formatDateTime as formatTimestamp } from '@/lib/utils';

interface PaymentsRecord {
    rowIndex?: number;
    timestamp?: string;
    uniqueNo?: string;
    partyName?: string;
    poNumber?: string;
    totalPoAmount?: string | number;
    internalCode?: string;
    product?: string;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    pdf?: string;
    payAmount?: string | number;
    file?: string;
    remark?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    planned?: string;
    actual?: string;
    delay?: string;
    status1?: string;
    paymentForm?: string;
    firmNameMatch?: string;
    paymentDone?: boolean;
    billImageStatus?: string;
    billNo?: string;
    rowIds?: number[];
}

interface PaymentHistoryRecord {
    rowIndex?: number;
    timestamp?: string;
    apPaymentNumber?: string;  // Column B (AP-Payment Number)
    status?: string;
    uniqueNumber?: string;
    fmsName?: string;
    payTo?: string;
    amountToBePaid?: string | number;
    remarks?: string;
    anyAttachments?: string;
}

interface DisplayPayment {
    rowIndex: number;
    uniqueNo: string;
    partyName: string;
    poNumber: string;
    totalPoAmount: number;
    internalCode: string;
    product: string;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: number;
    pdf: string;
    payAmount: number;
    file: string;
    remark: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    planned: string;
    actual: string;
    delay: string;
    status1: string;
    paymentForm: string;
    firmNameMatch: string;
    billImageStatus?: string;
    billNo?: string;
    rowIds: number[];
}

interface DisplayPaymentHistory {
    rowIndex: number;
    timestamp: string;
    apPaymentNumber: string;
    status: string;
    uniqueNumber: string;
    fmsName: string;
    payTo: string;
    amountToBePaid: number;
    remarks: string;
    anyAttachments: string;
    planned: string;
    paymentTerms: string;
    billImage: string;
    poImage: string;
    billImageStatus?: string;
    // New fields from schema
    liftNumber: string;
    indentNo: string;
    poNumber: string;
    vendorName: string;
    productName: string;
    billNo: string;
    qty: string;
    typeOfBill: string;
    billAmount: string;
    discountAmount: string;
    paymentType: string;
    advanceAmountIfAny: string;
    transportationInclude: string;
    transporterName: string;
    amount: string;
    billRemark: string;
    timestamp1: string;
    vehicle_no: string;
    driver_name: string;
    driver_mobile_no: string;
}

interface UpdatePayload {
    rowIndex: number;
    actual: string;
    status: string;
    status1: string;
}

export default function MakePayment() {
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentsSheet, setPaymentsSheet] = useState<PaymentsRecord[]>([]);
    const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
    const [paymentHistorySheet, setPaymentHistorySheet] = useState<PaymentHistoryRecord[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const updateAll = () => setReloadKey(k => k + 1);
    const [pendingData, setPendingData] = useState<DisplayPayment[]>([]);
    const [historyData, setHistoryData] = useState<DisplayPaymentHistory[]>([]);
    const [storeInRecords, setStoreInRecords] = useState<any[]>([]); // To store full metadata
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [originalData, setOriginalData] = useState<PaymentsRecord[]>([]);
    const [activeTab, setActiveTab] = useState('pending');

    const [stats, setStats] = useState({
        total: 0,
        totalAmount: 0,
        pendingCount: 0,
        historyCount: 0
    });

    const parseDateHelper = (dateString: string): Date => {
        if (!dateString) return new Date(0);
        try {
            // Try Standard Parsing
            let date = new Date(dateString);
            if (!isNaN(date.getTime())) return date;

            // Try DD/MM/YYYY
            const parts = dateString.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                date = new Date(year, month, day);
                if (!isNaN(date.getTime())) return date;
            }

            // Try YYYY-MM-DD
            date = new Date(dateString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
            if (!isNaN(date.getTime())) return date;

            return new Date(0);
        } catch {
            return new Date(0);
        }
    };

    useEffect(() => {
        // fetch payments and payment_history from Supabase
        const fetchData = async () => {
            try {
                setPaymentsLoading(true);
                setPaymentHistoryLoading(true);

                const { data: paymentsData, error: paymentsError } = await supabase
                    .from('payments')
                    .select('*')
                    .order('id', { ascending: false });

                const { data: storeInData, error: storeInError } = await supabase
                    .from('store_in')
                    .select('*')
                    .order('indent_no', { ascending: false }); // Get all columns for history insertion

                const { data: historyDbData, error: historyDbError } = await supabase
                    .from('payment_history')
                    .select('*')
                    .order('id', { ascending: false });

                if (paymentsError) {
                    console.error('Error fetching payments:', paymentsError);
                }

                const storeInMap = new Map();
                if (storeInData) {
                    setStoreInRecords(storeInData);
                    storeInData.forEach((item: any) => {
                        const indentKey = item.indent_no || item.indent_number || '';
                        if (indentKey) {
                            storeInMap.set(indentKey, {
                                billImageStatus: item.bill_image_status || '',
                                billNo: item.bill_no || ''
                            });
                        }
                    });
                }

                const allPaymentsData = Array.isArray(paymentsData) ? paymentsData : [];

                const mappedPayments: PaymentsRecord[] = allPaymentsData.map((r: any) => ({
                    rowIndex: r.id,
                    timestamp: r.timestamp,
                    uniqueNo: r.unique_no,
                    partyName: r.party_name,
                    poNumber: r.po_number,
                    totalPoAmount: r.total_po_amount,
                    internalCode: r.internal_code,
                    product: r.product,
                    deliveryDate: r.delivery_date,
                    paymentTerms: r.payment_terms,
                    numberOfDays: r.number_of_days,
                    pdf: r.pdf,
                    payAmount: r.pay_amount,
                    file: r.file,
                    remark: r.remark,
                    totalPaidAmount: r.total_paid_amount,
                    outstandingAmount: r.outstanding_amount,
                    status: r.status,
                    planned: r.planned,
                    actual: r.actual,
                    delay: r.delay,
                    paymentForm: r.payment_form,
                    firmNameMatch: r.firm_name,
                    paymentDone: r.payment_done || false,
                    billImageStatus: storeInMap.get(r.internal_code)?.billImageStatus || '',
                    billNo: storeInMap.get(r.internal_code)?.billNo || '',
                    rowIds: [r.id],
                }));

                setOriginalData(mappedPayments);
                setPaymentsSheet(mappedPayments);

                // Filter Pending: Has planned date and status is not 'Completed'
                const pendingBasic = mappedPayments
                    .filter((sheet: PaymentsRecord) => {
                        const plannedValue = String(sheet?.planned || '').trim();
                        const hasPlanned = plannedValue !== '';
                        const status = String(sheet?.status || '').toLowerCase();
                        const isCompleted = status === 'completed';
                        return hasPlanned && !isCompleted;
                    });

                // Filter to show only the latest record for each Indent Number and Product
                const seenPending = new Set();
                const latestPending = [];
                for (const record of pendingBasic) {
                    const key = `${record.internalCode}-${record.product}`;
                    if (!seenPending.has(key)) {
                        seenPending.add(key);
                        latestPending.push(record);
                    }
                }

                const pendingItems: DisplayPayment[] = latestPending.map((sheet: PaymentsRecord, index) => ({
                    rowIndex: sheet?.rowIndex || index,
                    uniqueNo: sheet?.uniqueNo || '',
                    partyName: sheet?.partyName || '',
                    poNumber: sheet?.poNumber || '',
                    totalPoAmount: Number(sheet?.totalPoAmount || 0),
                    internalCode: sheet?.internalCode || '',
                    product: sheet?.product || '',
                    deliveryDate: sheet?.deliveryDate || '',
                    paymentTerms: sheet?.paymentTerms || '',
                    numberOfDays: Number(sheet?.numberOfDays || 0),
                    pdf: sheet?.pdf || '',
                    payAmount: Number(sheet?.payAmount || 0),
                    file: sheet?.file || '',
                    remark: sheet?.remark || '',
                    totalPaidAmount: Number(sheet?.totalPaidAmount || 0),
                    outstandingAmount: Number(sheet?.outstandingAmount || 0),
                    status: sheet?.status || 'Pending',
                    planned: sheet?.planned || '',
                    actual: sheet?.actual || '',
                    delay: sheet?.delay || '',
                    status1: sheet?.status1 || '',
                    paymentForm: sheet?.paymentForm || '',
                    firmNameMatch: sheet?.firmNameMatch || '',
                    billImageStatus: sheet?.billImageStatus || '',
                    billNo: sheet?.billNo || '',
                    rowIds: sheet?.rowIds || [],
                }));

                // Group by Bill No + Party Name
                const groupedPendingMap = new Map<string, DisplayPayment>();
                pendingItems.forEach(item => {
                    const billKey = item.billNo || 'NoBill';
                    const uniqueKey = `${item.partyName || 'NoVendor'}-${billKey}`;

                    if (!groupedPendingMap.has(uniqueKey)) {
                        groupedPendingMap.set(uniqueKey, { ...item });
                    } else {
                        const existing = groupedPendingMap.get(uniqueKey)!;
                        // Add rowIds
                        existing.rowIds = [...existing.rowIds, ...item.rowIds];

                        // Concatenate products
                        const existingProducts = existing.product.split(', ').map(p => p.trim());
                        if (item.product && !existingProducts.includes(item.product.trim())) {
                            existing.product = [...existingProducts, item.product.trim()].join(', ');
                        }

                        // Sum Amounts
                        existing.payAmount += item.payAmount;
                        existing.outstandingAmount += item.outstandingAmount;
                        existing.totalPaidAmount += item.totalPaidAmount;
                        // For unique numbers and other non-summing fields, keep the first one
                    }
                });

                const sortedPending = Array.from(groupedPendingMap.values()).sort((a, b) => b.rowIndex - a.rowIndex);
                setPendingData(sortedPending);

                // 2. Fetch History directly from payment_history table
                const historyItems = (historyDbData || [])
                    .map((r: any, index: number) => ({
                        rowIndex: r.id || index,
                        timestamp: r.timestamp || '',
                        apPaymentNumber: r.ap_payment_number || '',
                        status: r.status || '',
                        uniqueNumber: r.unique_number || '',
                        fmsName: r.fms_name || '',
                        payTo: r.pay_to || '',
                        amountToBePaid: Number(r.amount_to_be_paid) || 0,
                        remarks: r.remarks || '',
                        anyAttachments: r.any_attachments || '',
                        planned: r.planned || '',
                        paymentTerms: r.payment_terms || '',
                        billImage: r.photo_of_bill || r.any_attachments || '',
                        poImage: r.any_attachments || '',
                        billImageStatus: r.bill_status || '',
                        // Mapping new fields
                        liftNumber: r.lift_number || '',
                        indentNo: r.indent_no || '',
                        poNumber: r.po_number || '',
                        vendorName: r.vendor_name || '',
                        productName: r.product_name || '',
                        billNo: r.bill_no || '',
                        qty: r.qty || '',
                        typeOfBill: r.type_of_bill || '',
                        billAmount: r.bill_amount || '',
                        discountAmount: r.discount_amount || '',
                        paymentType: r.payment_type || '',
                        advanceAmountIfAny: r.advance_amount_if_any || '',
                        transportationInclude: r.transportation_include || '',
                        transporterName: r.transporter_name || '',
                        amount: r.amount || '',
                        billRemark: r.bill_remark || '',
                        timestamp1: r.timestamp1 || '',
                        vehicle_no: r.vehicle_no || '',
                        driver_name: r.driver_name || '',
                        driver_mobile_no: r.driver_mobile_no || '',
                    }));

                setHistoryData(historyItems);

                const totalAmount = pendingItems.reduce((sum, item) => sum + item.outstandingAmount, 0);
                setStats({
                    total: pendingItems.length,
                    totalAmount,
                    pendingCount: pendingItems.length,
                    historyCount: historyItems.length
                });

                setSelectedRows(new Set());

            } catch (error) {
                console.error('❌ Error in Make Payment fetchData:', error);
                setPendingData([]);
                setHistoryData([]);
            } finally {
                setPaymentsLoading(false);
                setPaymentHistoryLoading(false);
            }
        };

        fetchData();
    }, [reloadKey]);
    const formatCurrentDate = (): string => {
        return new Date().toISOString();
    };

    const formatCurrentDateTime = (): string => {
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear().toString().slice(-2);
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const handleSelectAll = () => {
        if (selectedRows.size === pendingData.length) {
            // If all are selected, deselect all
            setSelectedRows(new Set());
        } else {
            // Select all
            const allRowIndices = pendingData.map((_, index) => index);
            setSelectedRows(new Set(allRowIndices));
        }
    };

    const handleSelectRow = (rowIndex: number) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(rowIndex)) {
            newSelected.delete(rowIndex);
        } else {
            newSelected.add(rowIndex);
        }
        setSelectedRows(newSelected);
    };

    const handleSubmitSelected = async () => {
        if (selectedRows.size === 0) {
            toast.error('Please select at least one payment to mark as completed');
            return;
        }

        setIsSubmitting(true);
        const isoNow = new Date().toISOString();
        const currentDateOnly = isoNow.split('T')[0];
        const currentDateTime = isoNow;
        const legacyFormatDate = formatCurrentDate(); // Keep for history remarks if needed

        try {
            // Get the selected items
            const selectedItems = Array.from(selectedRows).map(index => pendingData[index]);

            console.log('🔍 Selected items to update:', selectedItems);

            // Prepare IDs and update payments table in Supabase
            const ids = selectedItems.map(item => item.rowIndex).filter(Boolean);
            if (ids.length === 0) {
                toast.error('Could not find matching records to update');
                setIsSubmitting(false);
                return;
            }

            // Update payments rows in bulk
            // Update payments rows in bulk
            const { error: updateError } = await supabase
                .from('payments')
                .update({
                    actual: currentDateOnly,
                    status: 'Completed',
                    status1: 'ok',
                    payment_done: true
                })
                .in('id', ids);

            if (updateError) {
                console.error('❌ Supabase update error:', updateError);
                toast.error('Failed to update payments in database');
                setIsSubmitting(false);
                return;
            }

            // --- INSERT INTO PAYMENT_HISTORY ---
            const historyRows = selectedItems.map(item => {
                // Try to find the matching store_in record to get more metadata
                const storeIn = storeInRecords.find(si =>
                    si.po_number === item.poNumber &&
                    (si.indent_no === item.internalCode || si.indent_number === item.internalCode)
                );

                // Auto-generate AP Payment Number (e.g., AP-7707)
                const apPaymentNumber = `AP-${Math.floor(1000 + Math.random() * 9000)}`;

                return {
                    timestamp: isoNow,
                    ap_payment_number: apPaymentNumber,
                    status: 'Paid',
                    unique_number: item.uniqueNo,
                    fms_name: item.firmNameMatch,
                    pay_to: item.partyName,
                    amount_to_be_paid: String(item.payAmount),
                    remarks: item.remark || `Payment completed for ${item.uniqueNo}`,
                    any_attachments: item.file || item.pdf || '',
                    timestamp1: isoNow,
                    planned: item.planned || '',
                    payment_terms: item.paymentTerms || '',
                    indent_no: item.internalCode,
                    po_number: item.poNumber,
                    product_name: item.product,
                    // Additional fields from store_in if found
                    lift_number: storeIn?.liftNumber || '',
                    bill_status: storeIn?.billStatus || '',
                    bill_no: String(storeIn?.billNo || ''),
                    qty: String(storeIn?.qty || ''),
                    vendor_name: storeIn?.vendorName || item.partyName,
                    type_of_bill: storeIn?.typeOfBill || '',
                    bill_amount: String(storeIn?.billAmount || ''),
                    discount_amount: String(storeIn?.discountAmount || ''),
                    payment_type: storeIn?.paymentType || '',
                    advance_amount_if_any: String(storeIn?.advanceAmountIfAny || ''),
                    photo_of_bill: storeIn?.photoOfBill || item.file || '',
                    transportation_include: storeIn?.transportationInclude || '',
                    transporter_name: storeIn?.transporterName || '',
                    amount: String(storeIn?.amount || ''),
                    lead_time_to_lift_material: String(storeIn?.leadTimeToLiftMaterial || ''),
                    vehicle_no: storeIn?.vehicleNo || '',
                    driver_name: storeIn?.driverName || '',
                    driver_mobile_no: storeIn?.driverMobileNo || '',
                    bill_remark: storeIn?.billRemark || item.remark || '',
                };
            });

            const { error: historyError } = await supabase
                .from('payment_history')
                .insert(historyRows);

            if (historyError) {
                console.warn('⚠️ Error inserting into payment_history:', historyError);
                // We don't block the UI as the main payment update succeeded
            }

            toast.success(`Successfully updated ${ids.length} payment(s)`);

            // Refresh data
            setTimeout(() => updateAll(), 800);
            setSelectedRows(new Set());
        } catch (error) {
            console.error('❌ Error submitting payments:', error);
            toast.error('Error updating payments. Check console for details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pendingColumns: ColumnDef<DisplayPayment>[] = [
        {
            id: 'select',
            header: () => (
                <div className="flex items-center">
                    <Checkbox
                        checked={selectedRows.size === pendingData.length && pendingData.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="mr-2"
                    />
                    Select
                </div>
            ),
            cell: ({ row }: { row: Row<DisplayPayment> }) => {
                const isSelected = selectedRows.has(row.index);
                return (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(row.index)}
                        className="mr-2"
                    />
                );
            },
        },
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }: { row: Row<DisplayPayment> }) => {
                const item = row.original;
                const hasPaymentForm = item.paymentForm?.trim() !== '';

                return (
                    <div className="flex gap-2">
                        {hasPaymentForm ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => window.open(item.paymentForm, '_blank')}
                                className="bg-green-600 hover:bg-green-700 shadow-sm"
                            >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                Make Payment
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-gray-400"
                            >
                                No Form Link
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'planned',
            header: 'Planned Date',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-blue-600">
                    {formatDate(row.original.planned) || '-'}
                </span>
            )
        },
        {
            accessorKey: 'uniqueNo',
            header: 'Payment No.',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.uniqueNo || '-'}
                </div>
            )
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <div className="font-medium text-purple-700">
                    <div>{row.original.poNumber || '-'}</div>
                </div>
            )
        },
        {
            accessorKey: 'partyName',
            header: 'Party Name',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.partyName || '-'}</span>
            )
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm italic text-gray-600">{row.original.paymentTerms || '-'}</span>
            )
        },
        {
            accessorKey: 'internalCode',
            header: 'Indent No.',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.internalCode || '-'}
                </div>
            )
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.product || '-'}</span>
            )
        },
        {
            accessorKey: 'totalPoAmount',
            header: 'Total PO Amount',
            cell: ({ row }) => (
                <span className="font-bold text-purple-600">₹{row.original.totalPoAmount?.toLocaleString('en-IN')}</span>
            )
        },
        {
            accessorKey: 'payAmount',
            header: 'Pay Amount',
            cell: ({ row }) => (
                <span className="font-bold text-emerald-600">
                    ₹{row.original.payAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'outstandingAmount',
            header: 'Outstanding',
            cell: ({ row }) => (
                <span className="font-semibold text-red-600">
                    ₹{row.original.outstandingAmount?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status?.toLowerCase() || '';
                const isPending = status === 'pending' || status === '';
                const isComplete = status === 'complete' || status === 'completed';

                return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${isComplete
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-gray-100 text-gray-800 border border-gray-300'
                        }`}>
                        {isComplete && <CheckCircle className="mr-1 h-3 w-3" />}
                        {isPending && <AlertCircle className="mr-1 h-3 w-3" />}
                        {row.original.status || 'Pending'}
                    </span>
                );
            }
        },
        {
            id: 'bill_image',
            header: 'Bill Image',
            cell: ({ row }) => {
                const url = row.original.file;
                const status = row.original.billImageStatus;
                const hasAttachment = url?.trim() !== '';
                const isStatusUrl = status && (status.startsWith('http') || status.includes('drive.google.com') || status.includes('supabase.co'));

                return (
                    <div className="flex flex-col gap-1">
                        {hasAttachment ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(url, '_blank')}
                                className="text-emerald-600 hover:text-emerald-700 h-8 font-medium"
                            >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                View Bill
                            </Button>
                        ) : null}

                        {status && (
                            isStatusUrl ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(status, '_blank')}
                                    className="text-blue-600 hover:text-blue-700 h-8 font-medium"
                                >
                                    <ExternalLink className="mr-2 h-3 w-3" />
                                    Store Bill
                                </Button>
                            ) : (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block text-center uppercase ${status.toLowerCase() === 'received' || status.toLowerCase() === 'ok'
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : status.toLowerCase() === 'pending'
                                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                    }`}>
                                    {status}
                                </span>
                            )
                        )}
                        {!hasAttachment && !status && <span className="text-gray-400 text-sm">-</span>}
                    </div>
                );
            }
        },
        {
            id: 'po_image',
            header: 'PO Image',
            cell: ({ row }) => {
                const url = row.original.pdf;
                const hasAttachment = url?.trim() !== '';
                return (
                    <div>
                        {hasAttachment ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(url, '_blank')}
                                className="text-purple-600 hover:text-purple-700 h-8 font-medium"
                            >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                View PO
                            </Button>
                        ) : (
                            <span className="text-gray-400 text-sm">-</span>
                        )}
                    </div>
                );
            }
        }
    ];

    const historyColumns: ColumnDef<DisplayPaymentHistory>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Timestamp',
            cell: ({ row }) => (
                <div className="text-sm text-gray-600 whitespace-nowrap">
                    {formatTimestamp(row.original.timestamp)}
                </div>
            )
        },
        {
            accessorKey: 'uniqueNumber',
            header: 'Unique Number',
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-3 rounded-md inline-block border">
                    {row.original.uniqueNumber || '-'}
                </div>
            )
        },
        {
            accessorKey: 'apPaymentNumber',
            header: 'AP Payment No.',
            size: 130,
            cell: ({ row }) => (
                <div className="bg-gray-50 py-1 px-2 rounded-md inline-block border text-xs font-medium whitespace-nowrap">
                    {row.original.apPaymentNumber || '-'}
                </div>
            )
        },
        {
            accessorKey: 'payTo',
            header: 'Pay To',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.payTo || '-'}</span>
            )
        },
        {
            accessorKey: 'amountToBePaid',
            header: 'Amount',
            cell: ({ row }) => (
                <span className="font-bold text-green-600">
                    ₹{row.original.amountToBePaid?.toLocaleString('en-IN')}
                </span>
            )
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm italic text-gray-600">
                    {row.original.paymentTerms || '-'}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status?.toLowerCase() || '';
                const isPaid = status.includes('paid') || status.includes('completed') || status.includes('done');
                const isPending = status.includes('pending') || status === '';

                return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${isPaid
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-gray-100 text-gray-800 border border-gray-300'
                        }`}>
                        {isPaid && <CheckCircle className="mr-1 h-3 w-3" />}
                        {isPending && <AlertCircle className="mr-1 h-3 w-3" />}
                        {row.original.status || 'Pending'}
                    </span>
                );
            }
        },
        {
            accessorKey: 'planned',
            header: 'Planned Date',
            cell: ({ row }) => (
                <span className="text-sm text-gray-600">
                    {formatDate(row.original.planned) || '-'}
                </span>
            )
        },
        {
            id: 'bill_image',
            header: 'Bill Image',
            cell: ({ row }) => {
                const url = row.original.billImage;
                const status = row.original.billImageStatus;
                const hasAttachment = url?.trim() !== '';
                const isStatusUrl = status && (status.startsWith('http') || status.includes('drive.google.com') || status.includes('supabase.co'));

                return (
                    <div className="flex flex-col gap-1">
                        {hasAttachment ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(url, '_blank')}
                                className="text-emerald-600 hover:text-emerald-700 h-8 font-medium"
                            >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                View Bill
                            </Button>
                        ) : null}

                        {status && (
                            isStatusUrl ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(status, '_blank')}
                                    className="text-blue-600 hover:text-blue-700 h-8 font-medium"
                                >
                                    <ExternalLink className="mr-2 h-3 w-3" />
                                    Store Bill
                                </Button>
                            ) : (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block text-center uppercase ${status.toLowerCase() === 'received' || status.toLowerCase() === 'ok'
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : status.toLowerCase() === 'pending'
                                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                    }`}>
                                    {status}
                                </span>
                            )
                        )}
                        {!hasAttachment && !status && <span className="text-gray-400 text-sm">-</span>}
                    </div>
                );
            }
        },
        {
            id: 'po_image',
            header: 'PO Image',
            cell: ({ row }) => {
                const url = row.original.poImage;
                const hasAttachment = url?.trim() !== '';
                return (
                    <div>
                        {hasAttachment ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(url, '_blank')}
                                className="text-purple-600 hover:text-purple-700 h-8 font-medium"
                            >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                View PO
                            </Button>
                        ) : (
                            <span className="text-gray-400 text-sm">-</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'remarks',
            header: 'Remarks',
            size: 160,
            cell: ({ row }) => (
                <span className="text-sm text-gray-600 break-words whitespace-normal leading-snug block max-w-[160px]">
                    {row.original.remarks || '-'}
                </span>
            )
        },
    ];

    const handleRefresh = () => {
        console.log('🔄 Manually refreshing data...');
        updateAll();
    };

    return (
        <div>
            <Heading heading="Make Payment" subtext="Select payments to mark as completed and submit">
                <DollarSign size={28} className="text-primary" />
            </Heading>
            <div className="p-4 md:p-6">
                <div className="mx-auto max-w-7xl">
                    <div className="flex justify-end gap-3 mb-4">
                        {activeTab === 'pending' && selectedRows.size > 0 && (
                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">
                                    {selectedRows.size} selected
                                </span>
                            </div>
                        )}
                        <Button
                            onClick={handleRefresh}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </Button>
                    </div>
                </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                                        <p className="text-2xl font-bold text-blue-600 mt-1">{stats.total}</p>
                                    </div>
                                    <FileText className="h-10 w-10 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Outstanding Amount</p>
                                        <p className="text-2xl font-bold text-red-600 mt-1">
                                            ₹{stats.totalAmount.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <DollarSign className="h-10 w-10 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>
                         */}
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Payment History</p>
                                        <p className="text-2xl font-bold text-purple-600 mt-1">
                                            {stats.historyCount}
                                        </p>
                                    </div>
                                    <History className="h-10 w-10 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Selected</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">
                                            {activeTab === 'pending' ? selectedRows.size : 0}
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
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold text-gray-800">Payment Management</CardTitle>
                                <p className="text-gray-600">Manage pending payments and view payment history</p>
                            </div>
                            {activeTab === 'pending' && selectedRows.size > 0 && (
                                <div className="flex items-center gap-3">
                                    <div className="text-sm text-gray-500">
                                        {selectedRows.size > 0 ? (
                                            <span className="font-medium text-green-600">
                                                {selectedRows.size} payment(s) selected
                                            </span>
                                        ) : (
                                            'Select payments to submit'
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleSubmitSelected}
                                        disabled={isSubmitting}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <CheckSquare className="mr-2 h-4 w-4" />
                                                Mark Done ({selectedRows.size})
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                                <TabsTrigger value="pending" className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Pending Payments
                                    {stats.pendingCount > 0 && (
                                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                            {stats.pendingCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="history" className="flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Payment History
                                    {stats.historyCount > 0 && (
                                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                            {stats.historyCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            {/* Pending Payments Tab */}
                            <TabsContent value="pending">
                                {paymentsLoading ? (
                                    <div className="text-center py-12">
                                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Payment Data...</h3>
                                        <p className="text-gray-500">Fetching data from Payments</p>
                                        <Button
                                            onClick={handleRefresh}
                                            variant="outline"
                                            className="mt-4"
                                        >
                                            Retry Loading
                                        </Button>
                                    </div>
                                ) : pendingData.length > 0 ? (
                                    <>
                                        {/* Selection Summary Bar */}
                                        {selectedRows.size > 0 && (
                                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <CheckSquare className="h-5 w-5 text-green-600" />
                                                        <span className="font-medium text-green-800">
                                                            {selectedRows.size} payment(s) selected
                                                        </span>
                                                        <span className="text-sm text-green-600">
                                                            - Will update: Actual date to {formatCurrentDate()}, Status to "Completed", Status1 to "ok"
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSelectedRows(new Set())}
                                                            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                                        >
                                                            <XSquare className="mr-1 h-3 w-3" />
                                                            Clear All
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Data Table */}
                                        <DataTable<DisplayPayment, ColumnDef<DisplayPayment>>
                                            data={pendingData}
                                            columns={pendingColumns}
                                            searchFields={['uniqueNo', 'poNumber', 'partyName', 'product', 'internalCode', 'firmNameMatch']}
                                            dataLoading={false}
                                            className="border rounded-lg"
                                        />
                                    </>
                                ) : (
                                    <div className="text-center py-12">
                                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Payment Forms</h3>
                                        <div className="mt-6">
                                            <Button
                                                onClick={handleRefresh}
                                                variant="default"
                                            >
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Refresh Data
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Payment History Tab */}
                            <TabsContent value="history">
                                {paymentHistoryLoading ? (
                                    <div className="text-center py-12">
                                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Payment History...</h3>
                                        <p className="text-gray-500">Fetching data from Payment History</p>
                                    </div>
                                ) : historyData.length > 0 ? (
                                    <>
                                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <History className="h-5 w-5 text-gray-600" />
                                                    <span className="font-medium text-gray-700">
                                                        Total Records: {stats.historyCount}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    Last updated: {formatCurrentDateTime()}
                                                </div>
                                            </div>
                                        </div>

                                        <DataTable<DisplayPaymentHistory, ColumnDef<DisplayPaymentHistory>>
                                            data={historyData}
                                            columns={historyColumns}
                                            searchFields={['apPaymentNumber', 'uniqueNumber', 'fmsName', 'payTo', 'remarks']}
                                            dataLoading={false}
                                            className="border rounded-lg"
                                        />
                                    </>
                                ) : (
                                    <div className="text-center py-12">
                                        <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Payment History Found</h3>
                                        <p className="text-gray-500">No payment history records available</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
    );
}