import { Package2, Calculator, FileCheck, AlertTriangle, RotateCcw, ShieldCheck, CheckSquare, BarChart, ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState, useMemo } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import { formatDateTime, parseCustomDate, formatDate } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '../ui/dialog';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { auditStage, readReport, remarkText, stageNumber, norm } from '@/lib/auditWorkflow';
import { auditAutomationHealth, uploadTallyVoucher, submitHumanRectification } from '@/services/auditAutomationService';
import {
  updateTallyEntryRecord,
} from '@/services/tallyEntryService';

// Define Stage interface

// Define Stage interface
interface StageConfig {
  name: string;
  plannedField: string;
  actualField: string;
  statusField: string;
  remarksField: string;
  color: string;
  icon: LucideIcon;
  description: string;
  formTitle: string;
  statusOptions: string[];
}

// Define Stages object with proper typing
const STAGES: Record<string, StageConfig> = {
  AUDIT: {
    name: 'Audit Data',
    plannedField: 'planned1',
    actualField: 'actual1',
    statusField: 'status1',
    remarksField: 'remarks1',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: FileCheck,
    description: 'Initial audit verification',
    formTitle: 'Process Audit Data',
    statusOptions: ['Done', 'Not Done']
  },
  RECTIFY: {
    name: 'Rectify Mistake',
    plannedField: 'planned2',
    actualField: 'actual2',
    statusField: 'status2',
    remarksField: 'remarks2',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: AlertTriangle,
    description: 'Correct mistakes and add bilty',
    formTitle: 'Rectify The Mistake',
    statusOptions: ['Done', 'Not Done']
  },
  REAUDIT: {
    name: 'Reaudit Data',
    plannedField: 'planned3',
    actualField: 'actual3',
    statusField: 'status3',
    remarksField: 'remarks3',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: RotateCcw,
    description: 'Re-audit after corrections',
    formTitle: 'Reauditing Data',
    statusOptions: ['Done', 'Not Done']
  },
  TALLY_ENTRY: {
    name: 'Tally Entry',
    plannedField: 'planned4',
    actualField: 'actual4',
    statusField: 'status4',
    remarksField: 'remarks4',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: Calculator,
    description: 'Enter data into tally system',
    formTitle: 'Tally Entry',
    statusOptions: ['Done']
  },
  AGAIN_AUDIT: {
    name: 'Again Audit',
    plannedField: 'planned5',
    actualField: 'actual5',
    statusField: 'status5',
    remarksField: 'remarks5',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: ShieldCheck,
    description: 'Final audit verification after tally',
    formTitle: 'Again Audit',
    statusOptions: ['Done', 'Not Done']
  },
  COMPLETED: {
    name: 'Completed',
    plannedField: '',
    actualField: '',
    statusField: '',
    remarksField: '',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckSquare,
    description: 'All stages completed',
    formTitle: '',
    statusOptions: []
  }
};

// Update the ProcessedTallyData interface to include all remarks fields
interface ProcessedTallyData {
  id: number;
  indentNumber: string;
  indentDate: string;
  purchaseDate: string;
  materialInDate: string;
  plannedDate: string;
  productName: string;
  firmNameMatch: string;
  billNo: string;
  qty: number;
  partyName: string;
  billAmt: number;
  billImage: string;
  billReceivedLater: string;
  location: string;
  typeOfBills: string;
  productImage: string;
  area: string;
  indentedFor: string;
  approvedPartyName: string;
  rate: number;
  indentQty: number;
  totalRate: number;
  liftNumber: string;
  poNumber: string;
  currentStage: keyof typeof STAGES | string;
  isCompleted: boolean;

  // Add all remarks fields
  remarks1: string;
  remarks2: string;
  remarks3: string;
  remarks4: string;
  remarks5: string;

  // Add status fields for display
  status1: string;
  status2: string;
  status3: string;
  status4: string;
  status5: string;
  actual5: string;
  timestamp: string;
  damageOrder?: string;
  quantityAsPerBill?: string;
  priceAsPerPoCheck?: string;
  hodStatus?: string;
  hodRemark?: string;
  receivingStatus?: string;
  receivedQuantity?: number;
  sourceData?: Record<string, string | number | undefined>;

  // Grouping fields
  products?: string[];
  originalItems?: ProcessedTallyData[];
  qtySummarized?: number;
  billAmtSummarized?: number;
}

// Define form values type
export default function PcReportTable() {
  const { tallyEntrySheet, indentSheet, poMasterSheet, storeInSheet, updateAll, tallyEntryLoading: dataLoading } = useSheets();
  const [selectedRow, setSelectedRow] = useState<ProcessedTallyData | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ALL');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [workerStatus, setWorkerStatus] = useState('Checking AI backend…');
  const [tallyAnswer, setTallyAnswer] = useState('');
  const [correction, setCorrection] = useState({ billNo: '', billAmt: 0, qty: 0, rate: 0 });
  const [correctedBill, setCorrectedBill] = useState<File | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = () => auditAutomationHealth().then(health => {
      if (!cancelled) setWorkerStatus(health.enabled ? 'AI automation enabled • runs daily at 12:00 PM IST' : health.configured ? 'AI backend ready • automation is paused' : 'AI setup pending • backend API key and model required');
    }).catch(() => { if (!cancelled) setWorkerStatus('AI worker unavailable • backend setup required'); });
    void check();
    const timer = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Function to toggle product expansion in dialog
  const toggleProductExpand = (id: number) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allData = useMemo(() => {
    const records = Array.isArray(tallyEntrySheet) ? tallyEntrySheet : [];

    const filteredByFirm = records.filter((item) => {
      const itemFirm = (item.firmNameMatch || '').trim().toLowerCase();
      const userFirm = (user.firmNameMatch || '').trim().toLowerCase();
      const matchesFirm = userFirm === "all" || itemFirm === userFirm;
      return matchesFirm;
    });

    return filteredByFirm.map((item): ProcessedTallyData | null => {
      // Require a unique source match; never borrow another firm's or product's data.
      const same = (a: unknown, b: unknown) => norm(a) !== '' && norm(a) === norm(b);
      const indents = indentSheet.filter(source => same(source.firmNameMatch, item.firmNameMatch) && same(source.indentNumber, item.indentNumber) && same(source.productName, item.productName));
      const pos = (poMasterSheet as unknown as Record<string, string | number>[]).filter(source => same(source.firmNameMatch, item.firmNameMatch) && same(source.poNumber, item.poNumber) && same(source.product, item.productName));
      const lifts = storeInSheet.filter(source => same(source.firmNameMatch, item.firmNameMatch) && same(source.poNumber, item.poNumber) && same(source.productName, item.productName) && same(source.liftNumber, item.liftNumber) && same(source.indentNo, item.indentNumber));
      const indent = indents.length === 1 ? indents[0] : undefined;
      const po = pos.length === 1 ? pos[0] : undefined;
      const lift = lifts.length === 1 ? lifts[0] : undefined;
      const currentStage = auditStage(item as unknown as Record<string, unknown>);
      const isCompleted = currentStage === 'COMPLETED';
      const stageConfig = STAGES[currentStage];
      const plannedDate = String((item as unknown as Record<string, unknown>)[stageConfig.plannedField] || item.timestamp || '');

      return {
        id: item.id,
        sourceData: {
          indentProduct: indent?.productName, indentQuantity: indent?.quantity,
          indentApprovedQuantity: indent?.approvedQuantity, indentRate: indent?.approvedRate,
          indentVendor: indent?.approvedVendorName, poProduct: po?.product,
          poQuantity: po?.quantity, poRate: po?.rate, poVendor: po?.partyName,
          liftingQty: lift?.qty, liftingBill: lift?.billNo, liftingVendor: lift?.vendorName,
          liftingBillAmount: lift?.billAmount,
        },
        indentNumber: item.indentNumber,
        indentDate: '',
        purchaseDate: '',
        materialInDate: item.materialInDate,
        plannedDate: plannedDate,
        productName: item.productName,
        firmNameMatch: item.firmNameMatch,
        billNo: item.billNo,
        qty: item.qty,
        partyName: item.partyName,
        billAmt: item.billAmt,
        billImage: item.billImage,
        billReceivedLater: item.billReceivedLater,
        location: item.location,
        typeOfBills: item.typeOfBills,
        productImage: item.productImage,
        area: item.area,
        indentedFor: item.indentedFor,
        approvedPartyName: item.approvedPartyName,
        rate: item.rate,
        indentQty: item.indentQty,
        totalRate: item.totalRate,
        liftNumber: item.liftNumber,
        poNumber: item.poNumber,
        currentStage,
        isCompleted,
        remarks1: item.remarks1,
        remarks2: item.remarks2,
        remarks3: item.remarks3,
        remarks4: item.remarks4,
        remarks5: item.remarks5 || '',
        status1: item.status1,
        status2: item.status2,
        status3: item.status3,
        status4: item.status4,
        status5: item.status5,
        actual5: item.actual5,
        timestamp: item.timestamp || '',
        damageOrder: item.damageOrder,
        quantityAsPerBill: item.quantityAsPerBill,
        priceAsPerPoCheck: item.priceAsPerPoCheck,
        hodStatus: item.hodStatus,
        hodRemark: item.hodRemark,
        receivingStatus: item.receivingStatus,
        receivedQuantity: item.receivedQuantity,
      };
    }).filter((item): item is ProcessedTallyData => item !== null);
  }, [tallyEntrySheet, indentSheet, poMasterSheet, storeInSheet, user.firmNameMatch]);

  // Filter and GROUP data based on active tab
  const filteredData = useMemo(() => {
    let filtered = allData;

    // Filter by stage if not "ALL" or "COMPLETED"
    if (activeTab === 'COMPLETED') {
      filtered = filtered.filter(item => item.isCompleted);
    } else if (activeTab !== 'ALL') {
      filtered = filtered.filter(item =>
        !item.isCompleted && item.currentStage === activeTab
      );
    } else {
      // ALL shows all pending items (not completed)
      filtered = filtered.filter(item => !item.isCompleted);
    }

    // Grouping logic: group by PO number + currentStage
    const groupedMap = new Map<string, ProcessedTallyData>();

    filtered.forEach(item => {
      // Use PO Number and Stage for grouping
      const key = JSON.stringify([item.firmNameMatch, item.partyName, item.poNumber, item.billNo, item.liftNumber, item.currentStage, ['RECTIFY', 'TALLY_ENTRY', 'AGAIN_AUDIT'].includes(item.currentStage) ? item.id : '']);

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...item,
          products: [item.productName],
          originalItems: [item],
          qtySummarized: item.qty,
          billAmtSummarized: item.billAmt
        });
      } else {
        const group = groupedMap.get(key)!;
        if (!group.products?.includes(item.productName)) {
          group.products?.push(item.productName);
        }
        group.originalItems?.push(item);
        group.qtySummarized = (group.qtySummarized || 0) + item.qty;

        // Sum unique bills only
        const uniqueBills = new Map<string, number>();
        group.originalItems?.forEach(oi => {
          const bKey = oi.billNo?.trim() ? oi.billNo.trim().toUpperCase() : `unique-${oi.id}`;
          uniqueBills.set(bKey, oi.billAmt);
        });
        group.billAmtSummarized = Array.from(uniqueBills.values()).reduce((sum, val) => sum + val, 0);
      }
    });

    return Array.from(groupedMap.values());
  }, [allData, activeTab]);

  // Get grouped data for ALL stages (to calculate counts)
  const groupedAllData = useMemo(() => {
    const groupedMap = new Map<string, ProcessedTallyData>();

    allData.forEach(item => {
      const key = JSON.stringify([item.firmNameMatch, item.partyName, item.poNumber, item.billNo, item.liftNumber, item.currentStage, ['RECTIFY', 'TALLY_ENTRY', 'AGAIN_AUDIT'].includes(item.currentStage) ? item.id : '']);

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...item,
          products: [item.productName],
          originalItems: [item],
          qtySummarized: item.qty,
          billAmtSummarized: item.billAmt
        });
      } else {
        const group = groupedMap.get(key)!;
        if (!group.products?.includes(item.productName)) {
          group.products?.push(item.productName);
        }
        group.originalItems?.push(item);
        group.qtySummarized = (group.qtySummarized || 0) + item.qty;

        // Sum unique bills only
        const uniqueBills = new Map<string, number>();
        group.originalItems?.forEach(oi => {
          const bKey = oi.billNo?.trim() ? oi.billNo.trim().toUpperCase() : `unique-${oi.id}`;
          uniqueBills.set(bKey, oi.billAmt);
        });
        group.billAmtSummarized = Array.from(uniqueBills.values()).reduce((sum, val) => sum + val, 0);
      }
    });

    return Array.from(groupedMap.values());
  }, [allData]);

  // Get stage counts (based on grouped data)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: groupedAllData.filter(item => !item.isCompleted).length,
      COMPLETED: groupedAllData.filter(item => item.isCompleted).length
    };

    ['AUDIT', 'RECTIFY', 'REAUDIT', 'TALLY_ENTRY', 'AGAIN_AUDIT'].forEach(stage => {
      counts[stage] = groupedAllData.filter(item =>
        !item.isCompleted && item.currentStage === stage
      ).length;
    });

    return counts;
  }, [groupedAllData]);

  // Get schema based on stage
  const formSchema = z.object({
    remarks: z.string().trim().max(1000, 'Keep remarks under 1,000 characters').refine(value => ['TALLY_ENTRY', 'AGAIN_AUDIT'].includes(selectedRow?.currentStage || '') || value.length > 0, 'Remarks are required'),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      remarks: '',
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!openDialog) {
      form.reset({
        remarks: ''
      });
      setExpandedProducts(new Set());
      setTallyAnswer('');
      setCorrectedBill(null);
    }
  }, [openDialog, form]);

  // Handle item selection
  const handleItemSelect = (item: ProcessedTallyData) => {
    setSelectedRow(item);
    setCorrection({ billNo: item.billNo, billAmt: item.billAmt, qty: item.qty, rate: item.rate });
    form.reset({
      remarks: '',
    });
    setOpenDialog(true);
  };

  // Handle form submission
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedRow) {
      toast.error('No row selected!');
      return;
    }

    if (selectedRow.currentStage === 'RECTIFY') {
      try {
        const billImage = correctedBill ? await uploadTallyVoucher(correctedBill, 'audit-bills') : undefined;
        await submitHumanRectification(selectedRow.id, { ...correction, billImage }, values.remarks, selectedRow.firmNameMatch, selectedRow);
        toast.success('Correction saved. AI Reaudit will check it next.');
        setOpenDialog(false);
        updateAll();
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save correction.'); }
      return;
    }
    if (selectedRow.currentStage === 'AGAIN_AUDIT') {
      if (!['Yes', 'No'].includes(tallyAnswer)) { toast.error('Select Yes or No.'); return; }
      try {
        const now = new Date().toISOString();
        const approved = tallyAnswer === 'Yes';
        await updateTallyEntryRecord(selectedRow.id, {
          status5: approved ? 'Done' : 'Not Done', actual5: approved ? now : null,
          remarks5: `Human final audit: ${tallyAnswer}. Reviewed by ${user.username || user.name}.`,
          ...(!approved ? { status4: 'Correction Needed', actual4: null, planned4: now } : {}),
        }, { firm_name_match: selectedRow.firmNameMatch }, selectedRow, 'AGAIN_AUDIT');
        toast.success(approved ? 'Final audit approved. Entry completed.' : 'Returned to Tally Entry for correction.');
        setOpenDialog(false);
        updateAll();
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save final audit.'); }
      return;
    }
    if (selectedRow.currentStage !== 'TALLY_ENTRY') {
      toast.error('This stage is managed by the AI worker.');
      return;
    }
    if (!['Yes', 'No'].includes(tallyAnswer)) {
      toast.error('Select Yes or No.');
      return;
    }
    if (tallyAnswer === 'No') {
      toast.info('Tally entry remains pending.');
      setOpenDialog(false);
      return;
    }
    try {
      const items = selectedRow.originalItems || [selectedRow];
      if (items.length !== 1) throw new Error('Open an individual Tally entry before submitting.');
      const now = new Date().toISOString();
      const item = items[0];
      await updateTallyEntryRecord(item.id, {
        status4: 'Done', actual4: now, planned5: now,
        remarks4: JSON.stringify({ kind: 'tally-confirmation', answer: 'Yes', at: now,
          enteredBy: user.username || user.name || '' }),
        status5: '', actual5: null,
      }, { ...(item.status1 ? { status1: item.status1 } : {}), ...(item.status3 ? { status3: item.status3 } : {}),
        bill_no: item.billNo, bill_amt: String(item.billAmt), firm_name_match: item.firmNameMatch }, item);
      toast.success('Tally entry confirmed. Submitted for final audit.');
      setOpenDialog(false);
      updateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save Tally entry.');
      updateAll();
    }
  }

  function onError(errors: FieldErrors<z.infer<typeof formSchema>>) {
    console.log(errors);
    toast.error('Please fill all required fields');
  }

  // Keep each product's evidence separate even when the invoice row is grouped.
  const evidenceCell = (item: ProcessedTallyData, render: (product: ProcessedTallyData) => React.ReactNode) => {
    const products = item.originalItems || [item];
    return <div className="min-w-[180px] max-w-[320px] whitespace-normal space-y-2 text-left">
      {products.map(product => <div key={product.id}>
        {products.length > 1 && <div className="font-semibold">{product.productName}</div>}
        {render(product)}
      </div>)}
    </div>;
  };
  const sourceColumns: ColumnDef<ProcessedTallyData>[] = [
    ...([
      ['indentNumber', 'Indent No.'], ['liftNumber', 'Lift No.'],
      ['productName', 'Product'], ['firmNameMatch', 'Company'],
      ['receivedQuantity', 'Received Qty'], ['hodStatus', 'HOD Status'],
      ['hodRemark', 'HOD Remark'], ['receivingStatus', 'Receiving Status'],
      ['quantityAsPerBill', 'Store Quantity Check'], ['damageOrder', 'Physical Check'],
      ['priceAsPerPoCheck', 'Store Price Check'],
    ] as const).map(([key, header]): ColumnDef<ProcessedTallyData> => ({
      id: 'source-' + key, header,
      cell: ({ row }) => evidenceCell(row.original, item => {
        const value = item[key];
        return value === undefined || value === null || value === '' ? '-' : String(value);
      }),
    })),
    ...[
      ['indentProduct', 'Indent Product'], ['indentQuantity', 'Indent Quantity'],
      ['indentApprovedQuantity', 'Indent Approved Qty'], ['indentRate', 'Indent Approved Rate'],
      ['indentVendor', 'Indent Vendor'], ['poProduct', 'PO Product'],
      ['poQuantity', 'PO Quantity'], ['poRate', 'PO Rate'], ['poVendor', 'PO Vendor'],
      ['liftingQty', 'Lifting Qty'], ['liftingBill', 'Lifting Bill No.'],
      ['liftingVendor', 'Lifting Vendor'], ['liftingBillAmount', 'Lifting Bill Amount'],
    ].map(([key, header]): ColumnDef<ProcessedTallyData> => ({
      id: 'source-' + key, header,
      cell: ({ row }) => evidenceCell(row.original, item => String(item.sourceData?.[key] ?? '-')),
    })),
  ];
  const pendingColumns: ColumnDef<ProcessedTallyData>[] = [
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }: { row: Row<ProcessedTallyData> }) => {
        const rowData = row.original;
        const stageInfo = STAGES[rowData.currentStage];
        const IconComponent = stageInfo?.icon;

        return (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() => handleItemSelect(rowData)}
              className="flex items-center gap-2"
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              {rowData.currentStage === 'TALLY_ENTRY' ? 'Update Tally Entry' : rowData.currentStage === 'RECTIFY' ? 'Rectify' : rowData.currentStage === 'AGAIN_AUDIT' ? 'Again Audit' : 'View AI Report'}
            </Button>
          </DialogTrigger>
        );
      },
    },
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ getValue }) => <div>{getValue() ? formatDateTime(parseCustomDate(getValue())) : '-'}</div>,
    },
    {
      accessorKey: 'poNumber',
      header: 'PO Number',
      cell: ({ row }) => (
        <div className="font-bold text-primary">
          {row.original.poNumber || '-'}
        </div>
      )
    },
    { accessorKey: 'partyName', header: 'Bill Vendor (Entered)' },
    {
      accessorKey: 'products',
      header: 'Product Summary',
      cell: ({ row }) => {
        const products = row.original.products || [];
        return (
          <div className="max-w-[200px] truncate font-medium text-green-700" title={products.join(', ')}>
            {products.length > 1 ? `${products[0]} (+${products.length - 1})` : products[0]}
          </div>
        );
      }
    },
    { accessorKey: 'billNo', header: 'Bill No.' },
    {
      accessorKey: 'plannedDate',
      header: 'Planned Date',
      cell: ({ row }) => formatDate(row.original.plannedDate)
    },
    {
      accessorKey: 'currentStage',
      header: 'Current Stage',
      cell: ({ row }) => {
        const stage = row.original.currentStage;
        const stageInfo = STAGES[stage];

        return (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${stageInfo?.color || 'bg-gray-100 text-gray-800'}`}>
            {stageInfo?.name}
          </span>
        );
      },
    },
    {
      accessorKey: 'qtySummarized',
      header: 'Total Qty',
      cell: ({ row }) => row.original.qtySummarized || row.original.qty
    },
    {
      accessorKey: 'billAmtSummarized',
      header: 'Total Bill Amt',
      cell: ({ row }) => row.original.billAmtSummarized || row.original.billAmt
    },
    {
      accessorKey: 'billImage',
      header: 'Bill Image',
      cell: ({ row }) => {
        const image = row.original.billImage;
        return image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'billReceivedLater', header: 'Bill Received Later' },

    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'typeOfBills', header: 'Type Of Bills' },
    {
      accessorKey: 'productImage',
      header: 'Product Image',
      cell: ({ row }) => {
        const image = row.original.productImage;
        return image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
            View
          </a>
        ) : null;
      },
    },
    { accessorKey: 'area', header: 'Area' },
    { accessorKey: 'indentedFor', header: 'Indented For' },
    { accessorKey: 'approvedPartyName', header: 'Approved Party Name' },
    { accessorKey: 'rate', header: 'Bill Rate (Entered)', cell: ({ row }) => evidenceCell(row.original, item => item.rate) },
    { 
      accessorKey: 'indentQty', 
      header: 'Indent Qty',
      cell: ({ row }) => evidenceCell(row.original, item => item.indentQty ?? '-')
    },
    { accessorKey: 'totalRate', header: 'Total Rate' },

    ...sourceColumns,
    // Add status and remarks columns for each stage
    {
      accessorKey: 'status1',
      header: 'Audit Status',
      cell: ({ row }) => {
        const status = row.original.status1;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks1',
      header: 'Audit Remarks',
      cell: ({ row }) => {
        const remarks = remarkText(row.original.remarks1, 'AUDIT');
        return remarks ? (
          <div className="whitespace-nowrap text-left" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status2',
      header: 'Rectify Status',
      cell: ({ row }) => {
        const status = row.original.status2;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks2',
      header: 'Rectify Remarks',
      cell: ({ row }) => {
        const remarks = remarkText(row.original.remarks2, 'RECTIFY');
        return remarks ? (
          <div className="whitespace-nowrap text-left" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status3',
      header: 'Reaudit Status',
      cell: ({ row }) => {
        const status = row.original.status3;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks3',
      header: 'Reaudit Remarks',
      cell: ({ row }) => {
        const remarks = remarkText(row.original.remarks3, 'REAUDIT');
        return remarks ? (
          <div className="whitespace-nowrap text-left" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status4',
      header: 'Tally Status',
      cell: ({ row }) => {
        const status = row.original.status4;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks4',
      header: 'Tally Remarks',
      cell: ({ row }) => {
        const remarks = remarkText(row.original.remarks4, 'TALLY_ENTRY');
        return remarks ? (
          <div className="whitespace-nowrap text-left" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'status5',
      header: 'Again Audit Status',
      cell: ({ row }) => {
        const status = row.original.status5;
        return status ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
            {status}
          </span>
        ) : null;
      },
    },
    {
      accessorKey: 'remarks5',
      header: 'Again Audit Remarks',
      cell: ({ row }) => {
        const remarks = remarkText(row.original.remarks5, 'AGAIN_AUDIT');
        return remarks ? (
          <div className="whitespace-nowrap text-left" title={remarks}>
            {remarks}
          </div>
        ) : null;
      },
    },
  ];

  const completedColumns = pendingColumns.filter(column => column.id !== 'actions');

  // Stats data
  const statsData = [
    { title: 'Total Pending', value: stageCounts.ALL, color: 'text-gray-600' },
    { title: 'Audit', value: stageCounts.AUDIT, color: 'text-amber-600' },
    { title: 'Rectify', value: stageCounts.RECTIFY, color: 'text-green-600' },
    { title: 'Reaudit', value: stageCounts.REAUDIT, color: 'text-emerald-600' },
    { title: 'Tally Entry', value: stageCounts.TALLY_ENTRY, color: 'text-cyan-600' },
    { title: 'Again Audit', value: stageCounts.AGAIN_AUDIT, color: 'text-rose-600' },
  ];

  return (
    <div>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <Heading heading="Audit Data" subtext="AI Audit & Reaudit • Human Rectify & Tally Entry">
          <BarChart size={50} className="text-primary" />
        </Heading>
        <div className="mb-4 rounded-lg border bg-white p-4 space-y-2" role="status">
          <p className="font-medium">{workerStatus}</p>

          <p className="text-sm text-muted-foreground">AI Audit → Human Rectify → AI Reaudit → Human Tally Entry → Human Again Audit → Completed. Failed Reaudit returns to Human Rectify.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {statsData.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-4 border">
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="all" className="w-full" onValueChange={value => setActiveTab(({ all: 'ALL', audit: 'AUDIT', rectify: 'RECTIFY', reaudit: 'REAUDIT', tally: 'TALLY_ENTRY', again_audit: 'AGAIN_AUDIT', completed: 'COMPLETED' } as Record<string, string>)[value] || 'ALL')}>
          {/* Tabs Navigation */}
          <TabsList className="grid grid-cols-2 md:grid-cols-7 mb-6 h-auto w-full gap-1">
            {[
              { value: 'all', stage: 'ALL', label: 'All Pending' },
              { value: 'audit', stage: 'AUDIT', label: 'Audit' },
              { value: 'rectify', stage: 'RECTIFY', label: 'Rectify' },
              { value: 'reaudit', stage: 'REAUDIT', label: 'Reaudit' },
              { value: 'tally', stage: 'TALLY_ENTRY', label: 'Tally Entry' },
              { value: 'again_audit', stage: 'AGAIN_AUDIT', label: 'Again Audit' },
              { value: 'completed', stage: 'COMPLETED', label: 'Completed' },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.label}
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                  {stageCounts[tab.stage] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tabs Content */}
          <TabsContent value="all">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="audit">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="rectify">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="reaudit">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="tally">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="again_audit">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={pendingColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>

          <TabsContent value="completed">
            <DataTable
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              data={filteredData}
              columns={completedColumns}
              searchFields={['indentNumber', 'productName', 'partyName', 'billNo', 'firmNameMatch']}
              dataLoading={dataLoading}
              className='h-[70dvh]'
            />
          </TabsContent>
        </Tabs>

        {selectedRow && !['RECTIFY', 'TALLY_ENTRY', 'AGAIN_AUDIT'].includes(selectedRow.currentStage) && (
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{STAGES[selectedRow.currentStage]?.name} - AI Report</DialogTitle>
              <DialogDescription>PO {selectedRow.poNumber} | Bill {selectedRow.billNo}. This stage is processed automatically.</DialogDescription>
            </DialogHeader>
            {(selectedRow.originalItems || [selectedRow]).map(item => (
              <div key={item.id} className="rounded-lg border p-4 space-y-3">
                <p className="font-semibold">{item.productName} | {item.partyName}</p>
                {[1, 2, 3, 4, 5].map(n => {
                  const text = remarkText((item as unknown as Record<string, unknown>)['remarks' + n]);
                  return text ? <div key={n}><p className="text-sm font-semibold">{['Audit', 'Rectify', 'Reaudit', 'Tally Entry', 'Again Audit'][n - 1]}</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{text}</p></div> : null;
                })}
                {!readReport((item as unknown as Record<string, unknown>)['remarks' + stageNumber(item.currentStage as Parameters<typeof stageNumber>[0])]) && <p className="text-sm text-muted-foreground">Waiting for the AI worker. {workerStatus}</p>}
              </div>
            ))}
            <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
          </DialogContent>
        )}
        {selectedRow && ['RECTIFY', 'TALLY_ENTRY', 'AGAIN_AUDIT'].includes(selectedRow.currentStage) && (
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, onError)}
                className="space-y-5"
              >
                <DialogHeader className="space-y-1">
                  <DialogTitle>
                    {STAGES[selectedRow.currentStage]?.formTitle || 'Update Status'}
                  </DialogTitle>
                  <DialogDescription>
                    Process entries for PO Number{' '}
                    <span className="font-medium">{selectedRow.poNumber}</span>
                    {' '}in{' '}
                    <span className="font-medium">{STAGES[selectedRow.currentStage]?.name}</span> stage
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-gray-50 p-3 rounded-md space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Package2 className="w-5 h-5 text-primary" />
                      Shipment Details
                    </h3>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PO Number</p>
                      <p className="text-lg text-primary font-black tracking-tight">{selectedRow.poNumber}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(selectedRow.originalItems || [selectedRow])
                      .filter((item, index, self) =>
                        index === self.findIndex((t) => t.productName === item.productName)
                      )
                      .map((item, idx) => {
                        const isExpanded = expandedProducts.has(item.id);
                        return (
                          <div key={item.id} className="bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-200">
                            <div
                              className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center select-none"
                              onClick={() => toggleProductExpand(item.id)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Item #{idx + 1}</span>
                                  <h4 className="font-bold text-gray-900">{item.productName}</h4>
                                </div>
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                  <span>Qty: <strong className="text-gray-700">{item.qty}</strong></span>
                                  {Number(item.billAmt) !== Number(item.totalRate) && (
                                    <span>Bill Amt: <strong className="text-gray-700">₹{item.billAmt}</strong></span>
                                  )}
                                  <span>Indent: <strong className="text-gray-700">{item.indentNumber}</strong></span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right mr-2 hidden md:block">
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Lift Number</p>
                                  <p className="text-xs font-bold text-gray-700">{item.liftNumber}</p>
                                </div>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-6 py-5 bg-gray-50/50 border-t animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-6 gap-x-8">
                                  {/* Core Shipment Info */}
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lifting Quantity</p>
                                    <p className="text-sm font-semibold text-gray-900">{item.qty} units</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Store-In Quantity</p>
                                    <p className={`text-sm font-bold ${Number(item.receivedQuantity) !== Number(item.qty) ? 'text-amber-600' : 'text-gray-900'}`}>
                                      {item.receivedQuantity} units
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bill Number</p>
                                    <p className="text-sm font-semibold text-gray-900">{item.billNo || 'Not Provided'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bill Amount</p>
                                    <p className="text-sm font-bold text-green-700">₹{Number(item.billAmt).toLocaleString()}</p>
                                  </div>

                                  {/* Quality Checks */}
                                  <div className="col-span-2 md:col-span-3 lg:col-span-4 mt-2">
                                    <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                      Store Quality Verification
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div className={`flex flex-col p-3 rounded-xl border transition-all ${item.damageOrder === 'No' ? 'bg-red-50/50 border-red-100 shadow-sm' : 'bg-green-50/30 border-green-100/50'}`}>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Physical Condition</span>
                                        <div className="flex items-center justify-between">
                                          <span className={`text-sm font-black ${item.damageOrder === 'No' ? 'text-red-700' : 'text-green-700'}`}>
                                            {item.damageOrder === 'No' ? 'Damaged / Varied' : (item.damageOrder || 'Verified')}
                                          </span>
                                          <div className={`w-2 h-2 rounded-full ${item.damageOrder === 'No' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                                        </div>
                                      </div>

                                      <div className={`flex flex-col p-3 rounded-xl border transition-all ${item.quantityAsPerBill === 'No' ? 'bg-red-50/50 border-red-100 shadow-sm' : 'bg-green-50/30 border-green-100/50'}`}>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Quantity Match</span>
                                        <div className="flex items-center justify-between">
                                          <span className={`text-sm font-black ${item.quantityAsPerBill === 'No' ? 'text-red-700' : 'text-green-700'}`}>
                                            {item.quantityAsPerBill === 'No' ? 'Mismatch' : (item.quantityAsPerBill || 'Yes')}
                                          </span>
                                          <div className={`w-2 h-2 rounded-full ${item.quantityAsPerBill === 'No' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                                        </div>
                                      </div>

                                      <div className={`flex flex-col p-3 rounded-xl border transition-all ${item.priceAsPerPoCheck === 'No' ? 'bg-red-50/50 border-red-100 shadow-sm' : 'bg-emerald-50/30 border-emerald-100/50'}`}>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Price Verification</span>
                                        <div className="flex items-center justify-between">
                                          <span className={`text-sm font-black ${item.priceAsPerPoCheck === 'No' ? 'text-red-700' : 'text-emerald-700'}`}>
                                            {item.priceAsPerPoCheck === 'No' ? 'Price Varied' : (item.priceAsPerPoCheck || 'Yes')}
                                          </span>
                                          <div className={`w-2 h-2 rounded-full ${item.priceAsPerPoCheck === 'No' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">HOD Approval</p>
                                    <div className="flex flex-col gap-1">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded w-fit uppercase ${item.hodStatus === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {item.hodStatus || 'Pending'}
                                      </span>
                                      <p className="text-[10px] text-muted-foreground font-medium italic truncate max-w-[150px]" title={item.hodRemark}>
                                        {item.hodRemark || 'No remarks provided'}
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Location Details</p>
                                    <p className="text-xs font-medium text-gray-600">
                                      {item.location || 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between">
                                  <div className="flex gap-3">
                                    {item.billImage && (
                                      <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold bg-white">
                                        <a href={item.billImage} target="_blank" rel="noopener noreferrer">
                                          <CheckSquare className="w-3.5 h-3.5 mr-2 text-primary" />
                                          Invoice Copy
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed text-primary shadow-inner">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase opacity-70">Total Products</p>
                      <p className="text-lg font-black tracking-tight">
                        {(() => {
                          const items = selectedRow.originalItems || [selectedRow];
                          const uniqueItems = Array.from(new Set(items.map(i => i.productName)));
                          return uniqueItems.length;
                        })()}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase opacity-70">Total Quantity</p>
                      <p className="text-lg font-black tracking-tight">{selectedRow.qtySummarized || selectedRow.qty}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase opacity-70">Total Amount</p>
                      <p className="text-lg font-black tracking-tight">₹{selectedRow.billAmtSummarized || selectedRow.billAmt}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase opacity-70">Firm Name</p>
                      <p className="text-sm font-bold truncate" title={selectedRow.firmNameMatch}>{selectedRow.firmNameMatch}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {selectedRow.currentStage === 'RECTIFY' ? (
                    <div className="space-y-3">
                      <div className="rounded border bg-amber-50 p-3 text-sm whitespace-pre-wrap">{remarkText(selectedRow.remarks3 || selectedRow.remarks1)}</div>
                      <p className="text-sm text-muted-foreground">Correct the bill fields below. Fix PO/receipt issues in their source screens before submitting for Reaudit.</p>
                      <label htmlFor="rectify-bill-no" className="text-sm font-medium">Bill number</label>
                      <Input id="rectify-bill-no" required value={correction.billNo} onChange={e => setCorrection({ ...correction, billNo: e.target.value })} />
                      {(['billAmt', 'qty', 'rate'] as const).map(field => <div key={field} className="space-y-1">
                        <label htmlFor={'rectify-' + field} className="text-sm font-medium">{{ billAmt: 'Bill amount', qty: 'Quantity', rate: 'Unit rate' }[field]}</label>
                        <Input id={'rectify-' + field} type="number" required min="0.001" step="any" value={Number.isFinite(correction[field]) ? correction[field] : ''} onChange={e => setCorrection({ ...correction, [field]: e.target.valueAsNumber })} />
                      </div>)}
                      <label htmlFor="rectify-bill-file" className="text-sm font-medium">Replacement bill (optional, PDF/image up to 5 MB)</label>
                      <Input id="rectify-bill-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => setCorrectedBill(e.target.files?.[0] || null)} />
                    </div>
                  ) : (
                  <div className="space-y-2">
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium">{selectedRow.currentStage === 'AGAIN_AUDIT' ? 'Final audit approved?' : 'Tally entry completed?'} *</legend>
                      <div className="flex gap-6">
                        {['Yes', 'No'].map(answer => (
                          <label key={answer} className="flex cursor-pointer items-center gap-2 rounded-md border px-5 py-3">
                            <input type="radio" name="tally-answer" value={answer} required checked={tallyAnswer === answer} onChange={() => setTallyAnswer(answer)} className="accent-green-600" />
                            {answer}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  )}
                  {selectedRow.currentStage === 'RECTIFY' && <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter remarks..."
                            {...field}
                            rows={4}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />}
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                  </DialogClose>

                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader
                        size={20}
                        color="white"
                        aria-label="Loading Spinner"
                      />
                    )}
                    {selectedRow.currentStage === 'RECTIFY' ? 'Submit for AI Reaudit' : 'Save'}
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
