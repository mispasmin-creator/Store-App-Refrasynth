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
                        heading="Department Approval"
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
                    <DialogContent className="w-[98vw] md:max-w-2xl bg-card border-2">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-8"
                            >
                                <DialogHeader className="border-b pb-4">
                                    <DialogTitle>Technical Evaluation Ranking</DialogTitle>
                                    <DialogDescription>
                                        Establish technical priorities for Indent <span className="font-bold text-primary tracking-tight">#{selectedIndent.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Improved Ranking Surface */}
                                <div className="space-y-8">
                                    <div className="grid grid-cols-3 gap-4">
                                        {['T1', 'T2', 'T3'].map((rank) => {
                                            const vendorIdx = ranking[rank];
                                            const vendor = vendorIdx !== null ? selectedIndent.vendors[vendorIdx] : null;

                                            return (
                                                <div
                                                    key={rank}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDropOnBox(e, rank)}
                                                    className={`group relative flex flex-col items-center justify-center min-h-[160px] rounded-2xl border-4 border-dashed transition-all duration-300 p-4 shadow-sm
                                                        ${vendor ? `${rankColors[rank]} border-solid scale-[1.02] shadow-md` : 'border-muted-foreground/10 bg-muted/5 hover:border-primary/20 hover:bg-primary/5'}
                                                    `}
                                                >
                                                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full border shadow-sm text-[10px] font-black uppercase tracking-widest
                                                        ${vendor ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}
                                                    `}>
                                                        {rank}
                                                    </div>

                                                    {vendor ? (
                                                        <div
                                                            draggable
                                                            onDragStart={(e) => handleDragStartBox(e, { type: 'box', indexOrRank: rank })}
                                                            className="w-full text-center space-y-2 cursor-grab active:cursor-grabbing animate-in zoom-in slide-in-from-top-2"
                                                        >
                                                            <div className="mx-auto w-10 h-10 rounded-full bg-background flex items-center justify-center border shadow-sm mb-2 group-hover:scale-110 transition-transform">
                                                                <span className="text-xs font-black">{rank}</span>
                                                            </div>
                                                            <h5 className="font-black text-xs leading-tight line-clamp-2 min-h-[2.5rem]">{vendor[0]}</h5>
                                                            <div className="pt-2 border-t border-primary/10">
                                                                <p className={`text-[12px] font-black
                                                                    ${(() => {
                                                                        const rate = parseFloat(vendor[1]) || 0;
                                                                        const validRates = selectedIndent.vendors.map(v => parseFloat(v[1]) || 0).filter(r => r > 0);
                                                                        const minRate = Math.min(...validRates);
                                                                        const maxRate = Math.max(...validRates);
                                                                        if (rate === minRate) return 'text-green-600';
                                                                        if (rate === maxRate && maxRate !== minRate) return 'text-red-600';
                                                                        return 'text-primary';
                                                                    })()}
                                                                `}>
                                                                    &#8377;{(parseFloat(vendor[1]) || 0).toLocaleString('en-IN')}
                                                                </p>
                                                                <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Effective Rate</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center space-y-2 py-4">
                                                            <div className="w-10 h-10 rounded-full border-2 border-dotted border-muted-foreground/30 flex items-center justify-center">
                                                                <span className="text-muted-foreground/40 text-xs font-black">{rank}</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Empty</p>
                                                        </div>
                                                    )}

                                                    {/* Helper Label */}
                                                    <p className={`absolute -bottom-6 text-[9px] font-bold transition-opacity
                                                        ${vendor ? 'text-primary' : 'text-muted-foreground opacity-50'}
                                                    `}>
                                                        {rankLabels[rank]}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Unranked Pool Drawer */}
                                    <div
                                        onDragOver={handleDragOver}
                                        onDrop={handleDropOnPool}
                                        className="relative mt-8 rounded-2xl border-2 bg-muted/20 p-6 shadow-inner transition-all hover:bg-muted/30"
                                    >
                                        <div className="absolute -top-3 left-6 px-3 bg-card border rounded-md text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                            Available For Ranking ({unrankedIndices.length})
                                        </div>

                                        <div className="flex flex-wrap gap-3 justify-center">
                                            {unrankedIndices.map((idx) => {
                                                const vendor = selectedIndent.vendors[idx];
                                                return (
                                                    <div
                                                        key={idx}
                                                        draggable
                                                        onDragStart={(e) => handleDragStartBox(e, { type: 'pool', indexOrRank: idx })}
                                                        className={`group flex flex-col gap-1 w-44 p-3 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-md hover:-translate-y-1 transition-all
                                                            ${(() => {
                                                                const rate = parseFloat(vendor[1]) || 0;
                                                                const validRates = selectedIndent.vendors.map(v => parseFloat(v[1]) || 0).filter(r => r > 0);
                                                                const minRate = Math.min(...validRates);
                                                                const maxRate = Math.max(...validRates);
                                                                if (rate === minRate) return 'bg-green-300/30';
                                                                if (rate === maxRate && maxRate !== minRate) return 'bg-red-300/30';
                                                                return 'bg-background';
                                                            })()}
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-bold text-muted-foreground">VENDOR {idx + 1}</span>
                                                            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                                                                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"></div>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-black truncate">{vendor[0]}</span>
                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                                            <span className={`text-[10px] font-bold
                                                                ${(() => {
                                                                    const rate = parseFloat(vendor[1]) || 0;
                                                                    const validRates = selectedIndent.vendors.map(v => parseFloat(v[1]) || 0).filter(r => r > 0);
                                                                    const minRate = Math.min(...validRates);
                                                                    const maxRate = Math.max(...validRates);
                                                                    if (rate === minRate) return 'text-green-600';
                                                                    if (rate === maxRate && maxRate !== minRate) return 'text-red-600';
                                                                    return 'text-primary';
                                                                })()}
                                                            `}>
                                                                &#8377;{(parseFloat(vendor[1]) || 0).toLocaleString()}
                                                            </span>
                                                            <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded font-black tracking-tighter uppercase">Rate</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {unrankedIndices.length === 0 && (
                                                <div className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl border-muted-foreground/10">
                                                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                                                        <Loader size={12} color="#10b981" />
                                                    </div>
                                                    <p className="text-[11px] font-black text-primary uppercase">Evaluation Complete</p>
                                                    <p className="text-[9px] text-muted-foreground">All vendors have been assigned a rank</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                        <p className="text-[10px] font-medium text-center text-muted-foreground italic flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-primary/30"></span>
                                            Position T1 determines the top technical choice for management approval.
                                        </p>
                                    </div>
                                </div>

                                <DialogFooter className="border-t pt-4 gap-4">
                                    <Button variant="ghost" type="button" onClick={() => resetRankingState()} className="text-[11px] font-bold uppercase tracking-widest hover:text-red-500">
                                        Reset Board
                                    </Button>
                                    <div className="flex-1"></div>
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button" onClick={() => resetRankingState()}>Cancel</Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        className="px-8 shadow-lg shadow-primary/20"
                                        disabled={form.formState.isSubmitting || Object.values(ranking).every(v => v === null)}
                                    >
                                        {form.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                        Finalize Approval
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent className="w-[95vw] md:max-w-xl border-2 shadow-2xl">
                        <Form {...historyUpdateForm}>
                            <form
                                onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader className="border-b pb-4">
                                    <DialogTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5 text-primary" />
                                        Modify Technical Ranking
                                    </DialogTitle>
                                    <DialogDescription>
                                        Adjust priority levels for Indent <span className="font-bold text-foreground">#{selectedHistory.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Draggable Vendor List (History) */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Current Order (Draggable)</p>
                                    <div className="space-y-2">
                                        {orderedHistoryIndices.map((originalIndex, i) => {
                                            const vendor = selectedHistory.vendors[originalIndex];
                                            const rate = parseFloat(vendor[1]) || 0;
                                            const tax = parseFloat(vendor[5]) || 0;
                                            const total = vendor[3] === 'Basic Rate' ? rate * (1 + tax / 100) : rate;

                                            return (
                                                <div
                                                    key={originalIndex}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('sourceId', i.toString());
                                                    }}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleHistoryDrop(e, i)}
                                                    className={`group relative flex items-center gap-4 p-5 rounded-2xl border hover:border-primary shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-l-[6px]
                                                        ${(() => {
                                                            const validTotals = selectedHistory.vendors.map(v => {
                                                                const r = parseFloat(v[1]) || 0;
                                                                const t = parseFloat(v[5]) || 0;
                                                                return v[3] === 'Basic Rate' ? r * (1 + t / 100) : r;
                                                            }).filter(t => t > 0);
                                                            const minTotal = Math.min(...validTotals);
                                                            const maxTotal = Math.max(...validTotals);
                                                            if (total === minTotal) return 'bg-green-100/30';
                                                            if (total === maxTotal && maxTotal !== minTotal) return 'bg-red-100/30';
                                                            return 'bg-card';
                                                        })()}
                                                    `}
                                                    style={{ borderLeftColor: i === 0 ? '#eab308' : i === 1 ? '#a1a1aa' : '#fb923c' }}
                                                >
                                                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-full border-2 bg-background font-black text-sm text-primary shadow-inner">
                                                        T{i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-sm text-foreground truncate">{vendor[0]}</h4>
                                                        <div className="flex gap-2 mt-1">
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{vendor[3]}</span>
                                                            <span className="text-[9px] font-bold text-muted-foreground">•</span>
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{vendor[10] || 'Generic'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-primary leading-none">
                                                            &#8377;{total.toLocaleString('en-IN')}
                                                        </p>
                                                        <p className="text-[8px] text-muted-foreground mt-1 font-bold">TOTAL VALUE</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4">
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Close View</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={historyUpdateForm.formState.isSubmitting} className="shadow-lg">
                                        {historyUpdateForm.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                        Apply Rank Updates
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};