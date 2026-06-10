import type { ColumnDef, Row } from '@tanstack/react-table';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Input } from '../ui/input';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface RateApprovalData {
    id: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string, string, string, string, string, string, string, string, string][];
    date: string;
    firmNameMatch?: string;
    plannedDate: string;
    quantity: number;
    uom: string;
    areaOfUse: string;
}

interface HistoryData {
    id: number;
    indentNo: string;
    indenter: string;
    firmNameMatch: string;
    department: string;
    product: string;
    vendors: [string, string, string, string, string, string, string, string, string, string, string][];
    date: string;
    quantity: number;
    uom: string;
    areaOfUse: string;
}

const technicalApprovalSchema = z.object({
    ranks: z.record(z.string()),
}).refine(data => {
    return Object.values(data.ranks).some(val => val !== '');
}, {
    message: "At least one rank must be assigned",
    path: ["ranks"],
});
type TechnicalApprovalValues = z.infer<typeof technicalApprovalSchema>;

const historyUpdateSchema = z.object({
    ranks: z.record(z.string()),
}).refine(data => {
    return Object.values(data.ranks).some(val => val !== '');
}, {
    message: "At least one rank must be assigned",
    path: ["ranks"],
});
type HistoryUpdateValues = z.infer<typeof historyUpdateSchema>;

export default () => {
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<RateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [tableData, setTableData] = useState<RateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    // Fetch pending three party approvals from Supabase
    const fetchPendingApprovals = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned3', 'is', null)
                .is('actual3', null)
                .in('vendor_type', ['Three Party', 'Regular']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setTableData(
                rows.filter(r => !r.vendor1_rank && !r.vendor2_rank && !r.vendor3_rank)
                    .map((r): RateApprovalData => ({
                        id: r.id,
                        indentNo: r.indent_number || '',
                        firmNameMatch: r.firm_name_match || '',
                        indenter: r.indenter_name || '',
                        department: r.department || '',
                        product: r.product_name || '',
                        comparisonSheet: r.comparison_sheet || '',
                        date: formatDateTime(new Date(r.timestamp)).replace(/\//g, '-'),
                        plannedDate: r.planned3 ? formatDate(new Date(r.planned3)) : 'Not Set',
                        quantity: r.approved_quantity || r.quantity || 0,
                        uom: r.uom || '',
                        areaOfUse: r.area_of_use || '',
                        vendors: [
                            [
                                r.vendor_name1 || '',
                                r.rate1?.toString() || '0',
                                r.payment_term1 || '',
                                r.select_rate_type1 || 'With Tax',
                                r.with_tax_or_not1 || 'Yes',
                                r.tax_value1?.toString() || '0',
                                r.quotation_no1 || '',
                                r.quotation_date1 || '',
                                r.vendor1_rank || '',
                                r.delivery_time1 || '',
                                r.make1 || ''
                            ],
                            [
                                r.vendor_name2 || '',
                                r.rate2?.toString() || '0',
                                r.payment_term2 || '',
                                r.select_rate_type2 || 'With Tax',
                                r.with_tax_or_not2 || 'Yes',
                                r.tax_value2?.toString() || '0',
                                r.quotation_no2 || '',
                                r.quotation_date2 || '',
                                r.vendor2_rank || '',
                                r.delivery_time2 || '',
                                r.make2 || ''
                            ],
                            [
                                r.vendor_name3 || '',
                                r.rate3?.toString() || '0',
                                r.payment_term3 || '',
                                r.select_rate_type3 || 'With Tax',
                                r.with_tax_or_not3 || 'Yes',
                                r.tax_value3?.toString() || '0',
                                r.quotation_no3 || '',
                                r.quotation_date3 || '',
                                r.vendor3_rank || '',
                                r.delivery_time3 || '',
                                r.make3 || ''
                            ],
                        ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
                    }))
            );
        } catch (err) {
            console.error('Error fetching pending approvals:', err);
            toast.error('Failed to fetch pending approvals');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingApprovals();
    }, [user.firmNameMatch]);


    // Fetch completed three party approvals from Supabase
    const fetchCompletedApprovals = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned3', 'is', null)
                .in('vendor_type', ['Three Party', 'Regular']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setHistoryData(
                rows.filter(r => r.vendor1_rank || r.vendor2_rank || r.vendor3_rank)
                    .map((r): HistoryData => ({
                        id: r.id,
                        indentNo: r.indent_number || '',
                        firmNameMatch: r.firm_name_match || '',
                        indenter: r.indenter_name || '',
                        department: r.department || '',
                        product: r.product_name || '',
                        date: r.actual3 ? formatDate(new Date(r.actual3)) : formatDate(new Date(r.timestamp)),
                        quantity: r.approved_quantity || r.quantity || 0,
                        uom: r.uom || '',
                        areaOfUse: r.area_of_use || '',
                        vendors: [
                            [
                                r.vendor_name1 || '',
                                r.rate1?.toString() || '0',
                                r.payment_term1 || '',
                                r.select_rate_type1 || 'With Tax',
                                r.with_tax_or_not1 || 'Yes',
                                r.tax_value1?.toString() || '0',
                                r.quotation_no1 || '',
                                r.quotation_date1 || '',
                                r.vendor1_rank || '',
                                r.delivery_time1 || '',
                                r.make1 || ''
                            ],
                            [
                                r.vendor_name2 || '',
                                r.rate2?.toString() || '0',
                                r.payment_term2 || '',
                                r.select_rate_type2 || 'With Tax',
                                r.with_tax_or_not2 || 'Yes',
                                r.tax_value2?.toString() || '0',
                                r.quotation_no2 || '',
                                r.quotation_date2 || '',
                                r.vendor2_rank || '',
                                r.delivery_time2 || '',
                                r.make2 || ''
                            ],
                            [
                                r.vendor_name3 || '',
                                r.rate3?.toString() || '0',
                                r.payment_term3 || '',
                                r.select_rate_type3 || 'With Tax',
                                r.with_tax_or_not3 || 'Yes',
                                r.tax_value3?.toString() || '0',
                                r.quotation_no3 || '',
                                r.quotation_date3 || '',
                                r.vendor3_rank || '',
                                r.delivery_time3 || '',
                                r.make3 || ''
                            ],
                        ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
                    }))
            );
        } catch (err) {
            console.error('Error fetching completed approvals:', err);
            toast.error('Failed to fetch completed approvals');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingApprovals();
        fetchCompletedApprovals();
    }, [user.firmNameMatch]);

    const columns: ColumnDef<RateApprovalData>[] = [
        ...(user.threePartyApprovalAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<RateApprovalData> }) => {
                        const indent = row.original;
                        return (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedIndent(indent);
                                    setOpenDialog(true);
                                }}
                            >
                                Approve
                            </Button>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'date', header: 'Timestamp' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'areaOfUse', header: 'Area of Use' },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date', // ✅ ADD THIS COLUMN
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div className={`${plannedDate === 'Not Set' ? 'text-muted-foreground italic' : ''}`}>
                        {plannedDate}
                    </div>
                );
            }
        },
        {
            accessorKey: 'vendors',
            header: 'Vendors',
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor, index) => (
                                <span key={index} className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                    {vendor[0]} - &#8377;{vendor[1]}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            },
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                header: 'Action',
                cell: ({ row }: { row: Row<HistoryData> }) => {
                    const indent = row.original;

                    return (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedHistory(indent);
                                setOpenDialog(true);
                            }}
                        >
                            Update
                        </Button>
                    );
                },
            },
        ] : []),
        { accessorKey: 'date', header: 'Timestamp' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: ' Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'areaOfUse', header: 'Area of Use' },
        {
            accessorKey: 'vendors',
            header: 'Vendors',
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor, index) => {
                                const rank = vendor[8]; // rank is at index 8
                                return (
                                    <span key={index} className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                        {vendor[0]} - &#8377;{vendor[1]}
                                        {rank && (
                                            <span className="ml-2 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                                {rank}
                                            </span>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                );
            },
        },
    ];

    const form = useForm<TechnicalApprovalValues>({
        resolver: zodResolver(technicalApprovalSchema),
        defaultValues: {
            ranks: {},
        },
    });

    // State for ranking boxes
    const [ranking, setRanking] = useState<Record<string, number | null>>({
        T1: null,
        T2: null,
        T3: null,
    });
    const [unrankedIndices, setUnrankedIndices] = useState<number[]>([]);

    const resetRankingState = () => {
        if (selectedIndent) {
            setUnrankedIndices(selectedIndent.vendors.map((_, i) => i));
            setRanking({ T1: null, T2: null, T3: null });
            form.reset({ ranks: {} });
        }
    };

    useEffect(() => {
        if (openDialog && selectedIndent) {
            resetRankingState();
        }
    }, [openDialog, selectedIndent]);

    const handleDragStartBox = (e: React.DragEvent, source: { type: 'pool' | 'box', indexOrRank: number | string }) => {
        e.dataTransfer.setData('sourceType', source.type);
        e.dataTransfer.setData('sourceId', source.indexOrRank.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnBox = (e: React.DragEvent, targetRank: string) => {
        e.preventDefault();
        const sourceType = e.dataTransfer.getData('sourceType');
        const sourceId = e.dataTransfer.getData('sourceId');

        let vendorIndex: number;

        if (sourceType === 'pool') {
            vendorIndex = parseInt(sourceId);
            setUnrankedIndices(prev => prev.filter(idx => idx !== vendorIndex));
        } else {
            // Moving from another box
            const sourceRank = sourceId;
            if (sourceRank === targetRank) return;
            vendorIndex = ranking[sourceRank]!;
            setRanking(prev => ({ ...prev, [sourceRank]: null }));
        }

        // If target box had someone, move them back to pool
        const existingVendor = ranking[targetRank];
        if (existingVendor !== null) {
            setUnrankedIndices(prev => [...prev, existingVendor]);
        }

        setRanking(prev => ({ ...prev, [targetRank]: vendorIndex }));

        // Update form rankings
        const currentRanks = { ...form.getValues('ranks') };
        Object.keys(currentRanks).forEach(k => {
            if (currentRanks[k] === targetRank) delete currentRanks[k];
        });
        currentRanks[vendorIndex.toString()] = targetRank;
        form.setValue('ranks', currentRanks);
    };

    const handleDropOnPool = (e: React.DragEvent) => {
        e.preventDefault();
        const sourceType = e.dataTransfer.getData('sourceType');
        const sourceId = e.dataTransfer.getData('sourceId');

        if (sourceType === 'box') {
            const sourceRank = sourceId;
            const vendorIndex = ranking[sourceRank]!;
            setRanking(prev => ({ ...prev, [sourceRank]: null }));
            setUnrankedIndices(prev => [...prev, vendorIndex]);

            const currentRanks = { ...form.getValues('ranks') };
            delete currentRanks[vendorIndex.toString()];
            form.setValue('ranks', currentRanks);
        }
    };

    const onSubmit: SubmitHandler<TechnicalApprovalValues> = async () => {
        try {
            const updates: any = {
                actual3: new Date().toISOString(),
                planned4: new Date().toISOString(),
            };

            Object.entries(ranking).forEach(([rank, vendorIdx]) => {
                if (vendorIdx === null) return;
                if (vendorIdx === 0) updates.vendor1_rank = rank;
                if (vendorIdx === 1) updates.vendor2_rank = rank;
                if (vendorIdx === 2) updates.vendor3_rank = rank;
            });

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedIndent?.id);

            if (error) throw error;

            toast.success(`Completed Department Approval for ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();

            fetchPendingApprovals();
            fetchCompletedApprovals();
        } catch (error) {
            console.error('Error approving vendor:', error);
            toast.error('Failed to update vendor');
        }
    }

    const historyUpdateForm = useForm<HistoryUpdateValues>({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            ranks: {},
        },
    });

    const [orderedHistoryIndices, setOrderedHistoryIndices] = useState<number[]>([]);

    useEffect(() => {
        if (selectedHistory) {
            const initialOrder = selectedHistory.vendors.map((_, i) => i);
            const rankedOrder = [...initialOrder].sort((a, b) => {
                const rankA = selectedHistory.vendors[a][10] || 'T9';
                const rankB = selectedHistory.vendors[b][10] || 'T9';
                return rankA.localeCompare(rankB);
            });
            setOrderedHistoryIndices(rankedOrder);

            const initialRanks: Record<string, string> = {};
            rankedOrder.forEach((originalIdx, pos) => {
                initialRanks[originalIdx.toString()] = `T${pos + 1}`;
            });
            historyUpdateForm.reset({ ranks: initialRanks });
        }
    }, [selectedHistory]);

    const handleHistoryDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('sourceId'));
        if (sourceIndex === targetIndex) return;

        const newOrder = [...orderedHistoryIndices];
        const [removed] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, removed);
        setOrderedHistoryIndices(newOrder);

        const newRanks: Record<string, string> = {};
        newOrder.forEach((originalIdx, position) => {
            newRanks[originalIdx.toString()] = `T${position + 1}`;
        });
        historyUpdateForm.setValue('ranks', newRanks);
    };

    const onSubmitHistoryUpdate: SubmitHandler<HistoryUpdateValues> = async () => {
        try {
            const updates: any = {};
            orderedHistoryIndices.forEach((originalIdx, position) => {
                const rankVal = `T${position + 1}`;
                if (originalIdx === 0) updates.vendor1_rank = rankVal;
                if (originalIdx === 1) updates.vendor2_rank = rankVal;
                if (originalIdx === 2) updates.vendor3_rank = rankVal;
            });

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedHistory?.id);

            if (error) throw error;

            toast.success(`Updated ranks for ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset({ ranks: {} });
            fetchCompletedApprovals();
        } catch (err) {
            console.error('Error updating ranks:', err);
            toast.error('Failed to update vendor');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    const rankColors: Record<string, string> = {
        T1: 'border-yellow-500 bg-yellow-500/5',
        T2: 'border-zinc-400 bg-zinc-400/5',
        T3: 'border-orange-400 bg-orange-400/5'
    };

    const rankLabels: Record<string, string> = {
        T1: 'Primary Choice',
        T2: 'Secondary Choice',
        T3: 'Backup Option'
    };

    return (
        <div className="p-2">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Technical Approval"
                        subtext="Technical ranking of vendor quotations"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'firmNameMatch', 'areaOfUse']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'firmNameMatch', 'areaOfUse']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="w-[98vw] md:max-w-2xl p-0 gap-0 border-0 shadow-2xl rounded-2xl overflow-hidden">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col">

                                {/* ── Premium Green Header ── */}
                                <div className="bg-gradient-to-br from-green-600 via-green-600 to-emerald-500 px-6 pt-6 pb-5 text-white">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="bg-white/20 rounded-lg p-1.5 backdrop-blur-sm">
                                                    <Users size={14} className="text-white" />
                                                </div>
                                                <span className="text-[10px] font-black text-green-100 uppercase tracking-widest">Technical Evaluation</span>
                                            </div>
                                            <DialogTitle className="text-xl font-black text-white leading-tight">
                                                Vendor Ranking Board
                                            </DialogTitle>
                                            <DialogDescription className="mt-1.5 flex items-center gap-2">
                                                <span className="text-green-200 text-xs">Indent</span>
                                                <span className="bg-white/20 text-white text-xs font-black px-2.5 py-0.5 rounded-full tracking-tight border border-white/20">
                                                    #{selectedIndent.indentNo}
                                                </span>
                                            </DialogDescription>
                                        </div>
                                        <div className="text-right flex-shrink-0 max-w-[150px]">
                                            <p className="text-[9px] text-green-300 uppercase tracking-widest font-black mb-1">Product</p>
                                            <p className="text-sm font-black text-white line-clamp-2 leading-tight">{selectedIndent.product}</p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mt-4 flex items-center gap-3">
                                        {['T1', 'T2', 'T3'].map((r, i) => (
                                            <div key={r} className="flex items-center gap-1.5">
                                                <div className={`w-2.5 h-2.5 rounded-full border-2 border-white/40 transition-all duration-300 ${ranking[r] !== null ? 'bg-white scale-110' : 'bg-white/20'}`} />
                                                <span className="text-[10px] font-black text-green-100">{r}</span>
                                                {i < 2 && <div className={`h-px w-4 transition-all ${ranking[r] !== null ? 'bg-white/60' : 'bg-white/20'}`} />}
                                            </div>
                                        ))}
                                        <span className="ml-auto text-[10px] text-green-200 font-bold">
                                            {Object.values(ranking).filter(v => v !== null).length} / {Object.keys(ranking).length} assigned
                                        </span>
                                    </div>
                                </div>

                                {/* ── Body ── */}
                                <div className="overflow-y-auto max-h-[62vh] p-6 space-y-6 bg-gray-50/60">

                                    {/* Rank Slots */}
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { rank: 'T1', label: 'Primary Choice',   medal: '🥇', emptyColor: 'border-amber-300  bg-amber-50/70  hover:border-amber-400  hover:bg-amber-50',    filledBorder: 'border-amber-400',  filledBg: 'bg-gradient-to-br from-amber-50  to-orange-50',  badge: 'bg-amber-500'  },
                                            { rank: 'T2', label: 'Secondary Choice', medal: '🥈', emptyColor: 'border-slate-300   bg-slate-50/70   hover:border-slate-400   hover:bg-slate-50',    filledBorder: 'border-slate-400',  filledBg: 'bg-gradient-to-br from-slate-50  to-zinc-50',    badge: 'bg-slate-500'  },
                                            { rank: 'T3', label: 'Backup Option',    medal: '🥉', emptyColor: 'border-orange-300  bg-orange-50/70  hover:border-orange-400  hover:bg-orange-50',   filledBorder: 'border-orange-400', filledBg: 'bg-gradient-to-br from-orange-50 to-amber-50',   badge: 'bg-orange-500' },
                                        ].map(({ rank, label, medal, emptyColor, filledBorder, filledBg, badge }) => {
                                            const vendorIdx = ranking[rank];
                                            const vendor    = vendorIdx !== null ? selectedIndent.vendors[vendorIdx] : null;
                                            const validRates = selectedIndent.vendors.map(v => parseFloat(v[1]) || 0).filter(r => r > 0);
                                            const minRate = Math.min(...validRates);
                                            const maxRate = Math.max(...validRates);

                                            return (
                                                <div key={rank} className="flex flex-col items-center">
                                                    <div
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDropOnBox(e, rank)}
                                                        className={`relative w-full flex flex-col items-center min-h-[152px] rounded-2xl border-2 border-dashed transition-all duration-200 shadow-sm
                                                            ${vendor ? `${filledBorder} ${filledBg} border-solid shadow-lg scale-[1.02]` : emptyColor}
                                                        `}
                                                    >
                                                        {/* Rank badge */}
                                                        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${badge} text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md tracking-wider`}>
                                                            {rank}
                                                        </div>

                                                        <div className="flex flex-col items-center justify-center w-full h-full p-4 pt-6">
                                                            {vendor ? (
                                                                <div
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStartBox(e, { type: 'box', indexOrRank: rank })}
                                                                    className="w-full text-center space-y-1.5 cursor-grab active:cursor-grabbing"
                                                                >
                                                                    <div className="text-2xl mb-1">{medal}</div>
                                                                    <h5 className="font-black text-xs leading-snug line-clamp-2 text-gray-800">{vendor[0]}</h5>
                                                                    <div className="pt-2 mt-1 border-t border-black/5">
                                                                        <p className={`text-sm font-black ${
                                                                            parseFloat(vendor[1]) === minRate ? 'text-green-600' :
                                                                            parseFloat(vendor[1]) === maxRate && maxRate !== minRate ? 'text-red-500' :
                                                                            'text-gray-700'
                                                                        }`}>
                                                                            ₹{(parseFloat(vendor[1]) || 0).toLocaleString('en-IN')}
                                                                        </p>
                                                                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Rate</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <div className="w-11 h-11 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                                                                        <span className="text-gray-300 text-xs font-black">{rank}</span>
                                                                    </div>
                                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Empty</p>
                                                                    <p className="text-[8px] text-gray-300 font-medium">Drop vendor here</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Label below slot */}
                                                    <p className={`mt-2 text-[9px] font-black uppercase tracking-wider transition-colors ${vendor ? 'text-green-600' : 'text-gray-400'}`}>
                                                        {label}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* ── Vendor Pool ── */}
                                    <div
                                        onDragOver={handleDragOver}
                                        onDrop={handleDropOnPool}
                                        className="relative rounded-2xl border-2 border-green-200 bg-white p-5 shadow-sm transition-all hover:border-green-300"
                                    >
                                        <div className="absolute -top-3.5 left-4 bg-white border border-green-200 shadow-sm rounded-full px-3 py-1 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                                                Available For Ranking ({unrankedIndices.length})
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-3 justify-center pt-2">
                                            {unrankedIndices.map((idx) => {
                                                const vendor = selectedIndent.vendors[idx];
                                                const rate = parseFloat(vendor[1]) || 0;
                                                const validRates = selectedIndent.vendors.map(v => parseFloat(v[1]) || 0).filter(r => r > 0);
                                                const minRate = Math.min(...validRates);
                                                const maxRate = Math.max(...validRates);
                                                const isMin = rate === minRate;
                                                const isMax = rate === maxRate && maxRate !== minRate;

                                                return (
                                                    <div
                                                        key={idx}
                                                        draggable
                                                        onDragStart={(e) => handleDragStartBox(e, { type: 'pool', indexOrRank: idx })}
                                                        className={`group flex flex-col gap-1 w-44 p-3.5 rounded-xl border-2 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-1.5 transition-all duration-200
                                                            ${isMin ? 'bg-green-50 border-green-200 hover:border-green-400' :
                                                              isMax ? 'bg-red-50 border-red-200 hover:border-red-400' :
                                                              'bg-gray-50 border-gray-200 hover:border-green-300 hover:bg-white'}
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Vendor {idx + 1}</span>
                                                            {isMin && <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-black border border-green-200">Lowest</span>}
                                                            {isMax && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black border border-red-200">Highest</span>}
                                                        </div>
                                                        <span className="text-xs font-black text-gray-800 leading-snug line-clamp-2 min-h-[2rem]">{vendor[0]}</span>
                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                            <span className={`text-sm font-black ${isMin ? 'text-green-600' : isMax ? 'text-red-500' : 'text-gray-700'}`}>
                                                                ₹{rate.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tight">Rate</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {unrankedIndices.length === 0 && (
                                                <div className="w-full flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-green-200 bg-green-50/50">
                                                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3 shadow-sm">
                                                        <Loader size={14} color="#16a34a" />
                                                    </div>
                                                    <p className="text-xs font-black text-green-700 uppercase tracking-wider">All Vendors Ranked!</p>
                                                    <p className="text-[10px] text-green-500 mt-1">Ready to finalize approval</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Vendor Detail Table ── */}
                                    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Vendor Rate Details</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-muted/60">
                                                    <tr>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px]">Vendor</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px]">Make</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px] text-center">Qty</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px] text-right">Rate</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px] text-right">Eff. Rate</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px]">Payment</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px]">Delivery</th>
                                                        <th className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wide text-[10px]">Quotation</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(() => {
                                                        const processed = selectedIndent.vendors.map((v, i) => {
                                                            const rate = parseFloat(v[1]) || 0;
                                                            const tax = parseFloat(v[5]) || 0;
                                                            const effRate = v[3] === 'Basic Rate' ? rate * (1 + tax / 100) : rate;
                                                            return { v, i, rate, effRate };
                                                        });
                                                        const validEffRates = processed.map(p => p.effRate).filter(r => r > 0);
                                                        const minRate = validEffRates.length ? Math.min(...validEffRates) : -1;
                                                        const maxRate = validEffRates.length ? Math.max(...validEffRates) : -1;

                                                        return processed.map(({ v, i, rate, effRate }) => {
                                                            const isMin = effRate === minRate && minRate !== -1;
                                                            const isMax = effRate === maxRate && maxRate !== -1 && maxRate !== minRate;
                                                            return (
                                                                <tr key={i} className={`transition-colors ${isMin ? 'bg-green-50' : isMax ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}>
                                                                    <td className="px-3 py-2.5">
                                                                        <div className="font-bold text-gray-800">{v[0]}</div>
                                                                        <div className="text-[9px] text-gray-400 mt-0.5">Vendor {i + 1}</div>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-gray-600">{v[10] || '-'}</td>
                                                                    <td className="px-3 py-2.5 text-center text-gray-700 font-semibold">
                                                                        {selectedIndent.quantity}
                                                                        <div className="text-[9px] text-gray-400 font-normal">{selectedIndent.uom}</div>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                                                                        ₹{rate.toLocaleString('en-IN')}
                                                                        <div className="text-[8px] text-gray-400 font-normal">{v[3]}{v[3] === 'Basic Rate' ? ` +${v[5]}%` : ''}</div>
                                                                    </td>
                                                                    <td className={`px-3 py-2.5 text-right font-black ${isMin ? 'text-green-600' : isMax ? 'text-red-500' : 'text-gray-700'}`}>
                                                                        ₹{effRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        {isMin && <div className="text-[8px] font-black text-green-600 text-right">Lowest</div>}
                                                                        {isMax && <div className="text-[8px] font-black text-red-500 text-right">Highest</div>}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-gray-600">{v[2] || '-'}</td>
                                                                    <td className="px-3 py-2.5 text-gray-600">{v[9] ? `${v[9]} days` : '-'}</td>
                                                                    <td className="px-3 py-2.5 text-gray-600">
                                                                        {v[6] ? <div>{v[6]}</div> : '-'}
                                                                        {v[7] && <div className="text-[9px] text-gray-400">{v[7]}</div>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Info hint */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                                        <p className="text-[10px] font-medium text-green-700 italic leading-relaxed">
                                            Position T1 determines the top technical choice for management approval.
                                        </p>
                                    </div>
                                </div>

                                {/* ── Footer ── */}
                                <div className="border-t bg-white px-6 py-4 flex items-center justify-between gap-3 shadow-[0_-1px_0_rgba(0,0,0,0.04)]">
                                    <Button
                                        variant="ghost"
                                        type="button"
                                        onClick={() => resetRankingState()}
                                        className="text-[11px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 hover:border-red-200 px-4"
                                    >
                                        Reset Board
                                    </Button>
                                    <div className="flex items-center gap-3">
                                        <DialogClose asChild>
                                            <Button variant="outline" type="button" onClick={() => resetRankingState()} className="font-semibold">
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold px-6 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all"
                                            disabled={form.formState.isSubmitting || Object.values(ranking).every(v => v === null)}
                                        >
                                            {form.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                            Finalize Approval
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent className="w-[95vw] md:max-w-xl p-0 gap-0 border-0 shadow-2xl rounded-2xl overflow-hidden">
                        <Form {...historyUpdateForm}>
                            <form
                                onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)}
                                className="flex flex-col"
                            >
                                {/* Header */}
                                <div className="bg-gradient-to-br from-emerald-600 to-green-500 px-6 pt-5 pb-5 text-white">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-white/20 rounded-lg p-1.5">
                                            <Users size={14} className="text-white" />
                                        </div>
                                        <span className="text-[10px] font-black text-green-100 uppercase tracking-widest">Modify Ranking</span>
                                    </div>
                                    <DialogTitle className="text-xl font-black text-white">Adjust Technical Priorities</DialogTitle>
                                    <DialogDescription className="mt-1.5 flex items-center gap-2">
                                        <span className="text-green-200 text-xs">Indent</span>
                                        <span className="bg-white/20 text-white text-xs font-black px-2.5 py-0.5 rounded-full border border-white/20">
                                            #{selectedHistory.indentNo}
                                        </span>
                                    </DialogDescription>
                                </div>

                                {/* Body */}
                                <div className="overflow-y-auto max-h-[60vh] p-5 space-y-3 bg-gray-50/60">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                        <span className="inline-block w-4 h-px bg-gray-300"></span>
                                        Drag to reorder vendors
                                        <span className="inline-block w-4 h-px bg-gray-300"></span>
                                    </p>

                                    <div className="space-y-2.5">
                                        {orderedHistoryIndices.map((originalIndex, i) => {
                                            const vendor = selectedHistory.vendors[originalIndex];
                                            const rate = parseFloat(vendor[1]) || 0;
                                            const tax = parseFloat(vendor[5]) || 0;
                                            const total = vendor[3] === 'Basic Rate' ? rate * (1 + tax / 100) : rate;
                                            const medals = ['🥇', '🥈', '🥉'];
                                            const rankColors = ['#f59e0b', '#94a3b8', '#f97316'];

                                            const validTotals = selectedHistory.vendors.map(v => {
                                                const r = parseFloat(v[1]) || 0;
                                                const t = parseFloat(v[5]) || 0;
                                                return v[3] === 'Basic Rate' ? r * (1 + t / 100) : r;
                                            }).filter(t => t > 0);
                                            const minTotal = Math.min(...validTotals);
                                            const maxTotal = Math.max(...validTotals);
                                            const isMin = total === minTotal;
                                            const isMax = total === maxTotal && maxTotal !== minTotal;

                                            return (
                                                <div
                                                    key={originalIndex}
                                                    draggable
                                                    onDragStart={(e) => { e.dataTransfer.setData('sourceId', i.toString()); }}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleHistoryDrop(e, i)}
                                                    className={`group flex items-center gap-4 p-4 rounded-2xl border-2 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing border-l-[5px]
                                                        ${isMin ? 'bg-green-50 border-green-200 hover:border-green-400' :
                                                          isMax ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                                          'bg-white border-gray-200 hover:border-green-300'}
                                                    `}
                                                    style={{ borderLeftColor: rankColors[i] ?? '#94a3b8' }}
                                                >
                                                    {/* Rank indicator */}
                                                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-white border-2 shadow-sm flex-shrink-0"
                                                        style={{ borderColor: rankColors[i] ?? '#94a3b8' }}>
                                                        <span className="text-lg leading-none">{medals[i] ?? '🏅'}</span>
                                                        <span className="text-[8px] font-black text-gray-500">T{i + 1}</span>
                                                    </div>

                                                    {/* Vendor info */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-sm text-gray-800 truncate">{vendor[0]}</h4>
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{vendor[3]}</span>
                                                            {vendor[10] && (
                                                                <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{vendor[10]}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Rate */}
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={`text-base font-black leading-tight ${isMin ? 'text-green-600' : isMax ? 'text-red-500' : 'text-gray-700'}`}>
                                                            ₹{total.toLocaleString('en-IN')}
                                                        </p>
                                                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Total Value</p>
                                                    </div>

                                                    {/* Drag handle dots */}
                                                    <div className="flex flex-col gap-0.5 ml-1 opacity-30 group-hover:opacity-60 transition-opacity flex-shrink-0">
                                                        {[...Array(3)].map((_, di) => (
                                                            <div key={di} className="flex gap-0.5">
                                                                <div className="w-1 h-1 rounded-full bg-gray-500"></div>
                                                                <div className="w-1 h-1 rounded-full bg-gray-500"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="border-t bg-white px-5 py-4 flex items-center justify-end gap-3 shadow-[0_-1px_0_rgba(0,0,0,0.04)]">
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button" className="font-semibold">Close</Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        disabled={historyUpdateForm.formState.isSubmitting}
                                        className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold px-6 shadow-lg shadow-green-500/25"
                                    >
                                        {historyUpdateForm.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                        Apply Rank Updates
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};