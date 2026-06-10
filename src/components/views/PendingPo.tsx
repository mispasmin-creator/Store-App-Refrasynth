import { CheckCircle } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate, formatDateTime } from '@/lib/utils';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { Pill } from '../ui/pill';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '../ui/tabs';

interface ApprovedPOData {
    date: string;
    plannedDate: string;
    indentNo: string;
    product: string;
    quantity: number;
    rate: number;
    uom: string;
    vendorName: string;
    paymentTerm: string;
    specifications: string;
    firmNameMatch: string;
    poRequired: string;
    poRequiredStatus: 'Yes';
    expectedReqDate: string;
    expectedReqDateRaw: string | null;
    rawTimestamp: number;
}

interface CreatedPOData {
    poNumber: string;
    indentNo: string;
    firmNameMatch: string;
    product: string;
    vendorName: string;
    poQty: number;
    unit: string;
    rate: number;
    totalAmount: number;
    paymentTerms: string;
    deliveryDate: string;
    poDate: string;
    pdf: string;
    receivedQty: number;
    pendingQty: number;
    cancelQty: number;
    liftingStatus: string;
    liftPercent: number;
    rawPoDate: number;
}

export default function ApprovedPOs() {
    const { user } = useAuth();

    const [approvedTableData, setApprovedTableData] = useState<ApprovedPOData[]>([]);
    const [createdPOData, setCreatedPOData] = useState<CreatedPOData[]>([]);
    const [dataLoading, setDataLoading] = useState(false);

    const fetchPendingPOs = async () => {
        if (!supabaseEnabled) return;
        try {
            setDataLoading(true);

            const { data: poMasterData, error: poMasterError } = await supabase
                .from('po_master')
                .select('internal_code');
            if (poMasterError) throw poMasterError;

            const poMasterInternalCodes = new Set(
                (poMasterData || [])
                    .filter((r) => r.internal_code)
                    .map((r) => r.internal_code?.toString().trim())
                    .filter(Boolean)
            );

            let query = supabase.from('indent').select('*').eq('po_requred', 'Yes');
            if (user?.firmNameMatch?.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }
            const { data: indentData, error: indentError } = await query;
            if (indentError) throw indentError;

            const filteredData = (indentData || []).filter((sheet) => {
                const indentNumber = sheet.indent_number?.toString().trim();
                return !(indentNumber && poMasterInternalCodes.has(indentNumber));
            });

            const mappedData = filteredData
                .map((sheet) => {
                    let formattedDate = '';
                    let formattedPlannedDate = '';
                    try { if (sheet.timestamp) formattedDate = formatDateTime(sheet.timestamp); } catch {}
                    try { if (sheet.planned5) formattedPlannedDate = formatDate(sheet.planned5); } catch {}

                    let rawExpected = sheet.expected_req_date || sheet.delivery_date || null;
                    let formattedExpectedDate = '';
                    if (rawExpected) {
                        try { formattedExpectedDate = formatDate(new Date(rawExpected)); } catch {}
                    }

                    return {
                        date: formattedDate,
                        plannedDate: formattedPlannedDate,
                        indentNo: sheet.indent_number?.toString() || '',
                        firmNameMatch: sheet.firm_name_match || '',
                        product: sheet.product_name || '',
                        quantity: Number(sheet.pending_po_qty) || Number(sheet.quantity) || 0,
                        rate: Number(sheet.approved_rate) || Number(sheet.rate1) || 0,
                        uom: sheet.uom || '',
                        vendorName: sheet.approved_vendor_name || sheet.vendor_name1 || '',
                        paymentTerm: sheet.approved_payment_term || sheet.payment_term1 || '',
                        specifications: sheet.specifications || '',
                        poRequired: sheet.po_requred?.toString() || '',
                        poRequiredStatus: 'Yes' as const,
                        expectedReqDateRaw: rawExpected,
                        expectedReqDate: formattedExpectedDate,
                        rawTimestamp: sheet.timestamp ? new Date(sheet.timestamp).getTime() : 0,
                    };
                })
                .sort((a, b) => b.rawTimestamp - a.rawTimestamp);

            setApprovedTableData(mappedData);
        } catch (err) {
            console.error('Error fetching pending POs:', err);
            toast.error('Failed to fetch pending POs');
        } finally {
            setDataLoading(false);
        }
    };

    const fetchCreatedPOs = async () => {
        if (!supabaseEnabled) return;
        try {
            setDataLoading(true);

            // Fetch all po_master records
            let poQuery = supabase.from('po_master').select('*').order('timestamp', { ascending: false });
            if (user?.firmNameMatch?.toLowerCase() !== 'all') {
                poQuery = poQuery.eq('firm_name_match', user.firmNameMatch);
            }
            const { data: poData, error: poError } = await poQuery;
            if (poError) throw poError;

            const internalCodes = (poData || [])
                .map((r) => r.internal_code?.toString().trim())
                .filter(Boolean) as string[];

            // Fetch indent records for cancel_qty, lifting_status, received_quantity base
            let indentMap: Record<string, any> = {};
            if (internalCodes.length > 0) {
                const { data: indentData } = await supabase
                    .from('indent')
                    .select('indent_number, received_quantity, cancel_qty, lifting_status, approved_quantity, quantity')
                    .in('indent_number', internalCodes);
                (indentData || []).forEach((r: any) => {
                    indentMap[r.indent_number?.toString().trim()] = r;
                });
            }

            // Fetch store_in records and aggregate qty per indent_no
            // liftedQty = indent.received_quantity + SUM(store_in.qty) for that indent
            let storeInSumMap: Record<string, number> = {};
            if (internalCodes.length > 0) {
                const { data: storeInData } = await supabase
                    .from('store_in')
                    .select('indent_no, qty')
                    .in('indent_no', internalCodes);
                (storeInData || []).forEach((r: any) => {
                    const key = r.indent_no?.toString().trim();
                    if (key) storeInSumMap[key] = (storeInSumMap[key] || 0) + (Number(r.qty) || 0);
                });
            }

            const mapped: CreatedPOData[] = (poData || []).map((r: any) => {
                const indentKey = r.internal_code?.toString().trim();
                const indent = indentMap[indentKey] || {};
                const poQty = Number(r.quantity) || 0;
                const cancelQty = Number(indent.cancel_qty) || 0;
                // liftedQty mirrors GetLift logic: indent.received_quantity + SUM(store_in.qty)
                const receivedQty = (Number(indent.received_quantity) || 0) + (storeInSumMap[indentKey] || 0);
                const effectiveQty = poQty - cancelQty;
                const pendingQty = Math.max(0, effectiveQty - receivedQty);
                const liftPercent = effectiveQty > 0 ? Math.min(100, Math.round((receivedQty / effectiveQty) * 100)) : 0;

                let liftingStatus = indent.lifting_status || '';
                if (!liftingStatus) {
                    if (liftPercent >= 100) liftingStatus = 'Complete';
                    else if (liftPercent > 0) liftingStatus = 'Partial';
                    else liftingStatus = 'Pending';
                }

                let poDate = '';
                try { if (r.timestamp) poDate = formatDateTime(new Date(r.timestamp)); } catch {}
                let deliveryDate = '';
                try { if (r.delivery_date) deliveryDate = formatDate(new Date(r.delivery_date)); } catch {}

                return {
                    poNumber: r.po_number || '',
                    indentNo: r.internal_code || '',
                    firmNameMatch: r.firm_name_match || '',
                    product: r.product || '',
                    vendorName: r.party_name || '',
                    poQty,
                    unit: r.unit || '',
                    rate: Number(r.rate) || 0,
                    totalAmount: Number(r.total_po_amount) || 0,
                    paymentTerms: r.payment_terms || '',
                    deliveryDate,
                    poDate,
                    pdf: r.pdf || '',
                    receivedQty,
                    pendingQty,
                    cancelQty,
                    liftingStatus,
                    liftPercent,
                    rawPoDate: r.timestamp ? new Date(r.timestamp).getTime() : 0,
                };
            });

            setCreatedPOData(mapped);
        } catch (err) {
            console.error('Error fetching created POs:', err);
            toast.error('Failed to fetch created POs');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingPOs();
        fetchCreatedPOs();
    }, [user?.firmNameMatch]);

    const approvedColumns: ColumnDef<ApprovedPOData>[] = [
        {
            accessorKey: 'date',
            header: 'Timestamp',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'expectedReqDate',
            header: 'Expected Date',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent Number',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] break-words whitespace-normal px-1 text-sm">
                    {getValue() as string || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Pending PO Qty',
            cell: ({ getValue }) => <div className="px-2">{getValue() as number || 0}</div>
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => <div className="px-2">&#8377;{row.original.rate || 0}</div>,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'paymentTerm',
            header: 'Payment Term',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string || '-'}</div>
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal px-2 text-sm">
                    {getValue() as string || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'poRequiredStatus',
            header: 'PO Required',
            cell: ({ row }) => (
                <div className="px-2">
                    <Pill variant="primary">{row.original.poRequiredStatus}</Pill>
                </div>
            ),
        },
    ];

    const createdPOColumns: ColumnDef<CreatedPOData>[] = [
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            cell: ({ getValue }) => (
                <div className="text-xs text-muted-foreground whitespace-nowrap">{getValue() as string || '-'}</div>
            ),
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => {
                const { poNumber, pdf } = row.original;
                return pdf ? (
                    <a
                        href={pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-green-700 hover:underline underline-offset-2 whitespace-nowrap"
                    >
                        {poNumber}
                    </a>
                ) : (
                    <span className="font-bold text-gray-800 whitespace-nowrap">{poNumber || '-'}</span>
                );
            },
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <span className="text-xs text-muted-foreground">{getValue() as string || '-'}</span>
            ),
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
            cell: ({ getValue }) => <span>{getValue() as string || '-'}</span>,
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[130px] break-words whitespace-normal font-medium text-sm">
                    {getValue() as string || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor',
            cell: ({ getValue }) => (
                <div className="max-w-[130px] break-words whitespace-normal text-sm">
                    {getValue() as string || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'poQty',
            header: 'PO Qty',
            cell: ({ row }) => (
                <div className="text-center font-semibold">
                    {row.original.poQty}
                    <div className="text-[10px] text-muted-foreground font-normal">{row.original.unit}</div>
                </div>
            ),
        },
        {
            accessorKey: 'receivedQty',
            header: 'Lifted',
            cell: ({ row }) => {
                const { receivedQty, poQty, cancelQty, liftPercent } = row.original;
                const effectiveQty = poQty - cancelQty;
                return (
                    <div className="min-w-[110px]">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-green-700 text-sm">{receivedQty}</span>
                            <span className="text-[10px] text-muted-foreground">/ {effectiveQty}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all ${
                                    liftPercent >= 100 ? 'bg-green-500' :
                                    liftPercent > 0 ? 'bg-amber-400' :
                                    'bg-gray-200'
                                }`}
                                style={{ width: `${liftPercent}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{liftPercent}%</div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'pendingQty',
            header: 'Pending',
            cell: ({ row }) => {
                const { pendingQty } = row.original;
                return (
                    <div className="text-center">
                        <span className={`font-bold text-sm ${pendingQty > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {pendingQty}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'cancelQty',
            header: 'Cancelled',
            cell: ({ row }) => {
                const { cancelQty } = row.original;
                return (
                    <div className="text-center">
                        <span className={`text-sm ${cancelQty > 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                            {cancelQty || '-'}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'liftingStatus',
            header: 'Lift Status',
            cell: ({ row }) => {
                const s = row.original.liftingStatus;
                return (
                    <Pill
                        variant={
                            s === 'Complete' ? 'secondary' :
                            s === 'Partial' ? 'pending' :
                            'reject'
                        }
                    >
                        {s || 'Pending'}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => (
                <span className="font-semibold">&#8377;{row.original.rate.toLocaleString('en-IN')}</span>
            ),
        },
        {
            accessorKey: 'totalAmount',
            header: 'Total Amount',
            cell: ({ row }) => (
                <span className="font-bold text-green-800">
                    &#8377;{row.original.totalAmount.toLocaleString('en-IN')}
                </span>
            ),
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] break-words whitespace-normal text-xs text-muted-foreground">
                    {getValue() as string || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ getValue }) => (
                <span className="text-xs whitespace-nowrap">{getValue() as string || '-'}</span>
            ),
        },
    ];

    // Summary stats and splits for created POs
    const totalPOs = createdPOData.length;
    const completedPOsList = createdPOData.filter((r) => r.liftingStatus === 'Complete');
    const completedPOs = completedPOsList.length;
    const partialPOs = createdPOData.filter((r) => r.liftingStatus === 'Partial').length;
    const pendingLiftPOs = createdPOData.filter((r) => r.liftingStatus === 'Pending' || !r.liftingStatus).length;
    // History tab shows only non-complete (active) POs
    const activePOData = createdPOData.filter((r) => r.liftingStatus !== 'Complete');

    return (
        <div>
            <Tabs defaultValue="pending">
                <Heading
                    heading="Pending POs to be created"
                    subtext="View all pending purchase orders"
                    tabs
                    pendingCount={approvedTableData.length}
                    historyCount={activePOData.length}
                    thirdTabName="Complete"
                    thirdTabCount={completedPOs}
                >
                    <CheckCircle size={50} className="text-green-600" />
                </Heading>

                <TabsContent value="pending">
                    <DataTable
                        data={approvedTableData}
                        columns={approvedColumns}
                        searchFields={['product', 'vendorName', 'paymentTerm', 'specifications', 'firmNameMatch']}
                        dataLoading={dataLoading}
                        className="h-[80dvh]"
                    />
                </TabsContent>

                <TabsContent value="history">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {[
                            { label: 'Total POs', value: totalPOs, color: 'bg-blue-50 border-blue-200 text-blue-800' },
                            { label: 'Completed', value: completedPOs, color: 'bg-green-50 border-green-200 text-green-800' },
                            { label: 'Partial', value: partialPOs, color: 'bg-amber-50 border-amber-200 text-amber-800' },
                            { label: 'Lift Pending', value: pendingLiftPOs, color: 'bg-red-50 border-red-200 text-red-800' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
                                <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{label}</p>
                                <p className="text-2xl font-black mt-0.5">{value}</p>
                            </div>
                        ))}
                    </div>

                    <DataTable
                        data={activePOData}
                        columns={createdPOColumns}
                        searchFields={['poNumber', 'indentNo', 'product', 'vendorName', 'firmNameMatch', 'liftingStatus']}
                        dataLoading={dataLoading}
                        className="h-[62dvh]"
                    />
                </TabsContent>

                <TabsContent value="complete">
                    <DataTable
                        data={completedPOsList}
                        columns={createdPOColumns}
                        searchFields={['poNumber', 'indentNo', 'product', 'vendorName', 'firmNameMatch']}
                        dataLoading={dataLoading}
                        className="h-[72dvh]"
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
