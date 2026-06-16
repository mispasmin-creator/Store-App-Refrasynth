// import { fetchSheet } from '@/lib/fetchers';
import {
    fetchIndentRecords,
    type IndentRecord
} from '@/services/indentService';
import {
    fetchStoreInRecords,
    type StoreInRecord
} from '@/services/storeInService';
import {
    fetchPoMaster
} from '@/services/poService';
import {
    fetchTallyEntryRecords,
    type TallyEntryRecord
} from '@/services/tallyEntryService';
import {
    fetchFullkittingRecords,
    type FullkittingRecord
} from '@/services/fullkittingService';
import {
    fetchPayments,
    fetchPaymentHistory
} from '@/services/paymentService';
import {
    fetchIssueRecords,
    type IssueRecord
} from '@/services/issueService';
import { calculatePcReportCounts } from '@/lib/pcReportUtils';
import {
    fetchInventoryRecords
} from '@/services/inventoryService';
import {
    fetchMasterOptions
} from '@/services/masterService';

import type {
    IndentSheet,
    InventorySheet,
    MasterSheet,
    PoMasterSheet,
    ReceivedSheet,
    StoreInSheet,
    IssueSheet,
    TallyEntrySheet,
    PcReportSheet,
    FullkittingSheet,
    PaymentHistory,
} from '@/types';
import type { PaymentsSheet } from '@/types/sheets';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

interface SheetsState {
    updateReceivedSheet: () => void;
    updatePoMasterSheet: () => void;
    updateIndentSheet: () => void;
    updateAll: () => void;

    updateIssueSheet: () => void;
    issueSheet: IssueSheet[];
    issueLoading: boolean;
    sheets: StoreInSheet[];


    indentSheet: IndentSheet[];
    storeInSheet: StoreInSheet[];
    poMasterSheet: PoMasterSheet[];
    receivedSheet: ReceivedSheet[];
    inventorySheet: InventorySheet[];
    pcReportSheet: PcReportSheet[];
    masterSheet: MasterSheet | undefined;

    indentLoading: boolean;
    poMasterLoading: boolean;
    receivedLoading: boolean;
    inventoryLoading: boolean;
    allLoading: boolean;

    updateStoreInSheet: () => void;
    storeInLoading: boolean;

    tallyEntrySheet: TallyEntrySheet[];
    tallyEntryLoading: boolean;
    updateTallyEntrySheet: () => void;

    updatePcReportSheet: () => void;

    fullkittingSheet: FullkittingSheet[];
    fullkittingLoading: boolean;
    updateFullkittingSheet: () => void;

    // ✅ ADD PAYMENT HISTORY HERE
    paymentHistorySheet: PaymentHistory[];
    paymentHistoryLoading: boolean;
    updatePaymentHistorySheet: () => void;
    paymentsSheet: PaymentsSheet[];
    paymentsLoading: boolean;
    updatePaymentsSheet: () => void;
}

const SheetsContext = createContext<SheetsState | null>(null);

export const SheetsProvider = ({ children }: { children: React.ReactNode }) => {
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [storeSheet, setStoreInSheet] = useState<StoreInSheet[]>([]);
    const [receivedSheet, setReceivedSheet] = useState<ReceivedSheet[]>([]);
    const [poMasterSheet, setPoMasterSheet] = useState<PoMasterSheet[]>([]);
    const [inventorySheet, setInventorySheet] = useState<InventorySheet[]>([]);
    const [masterSheet, setMasterSheet] = useState<MasterSheet>();

    const [tallyEntrySheet, setTallyEntrySheet] = useState<TallyEntrySheet[]>([]);
    const [fullkittingSheet, setFullkittingSheet] = useState<FullkittingSheet[]>([]);
    const [fullkittingLoading, setFullkittingLoading] = useState(true);

    const [tallyEntryLoading, setTallyEntryLoading] = useState(true);

    const [issueSheet, setIssueSheet] = useState<IssueSheet[]>([]);
    const [issueLoading, setIssueLoading] = useState(true);

    const [indentLoading, setIndentLoading] = useState(true);
    const [poMasterLoading, setPoMasterLoading] = useState(true);
    const [receivedLoading, setReceivedLoading] = useState(true);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [allLoading, setAllLoading] = useState(true);

    const [storeInLoading, setStoreInLoading] = useState(true);
    const [paymentsSheet, setPaymentsSheet] = useState<PaymentsSheet[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(true);


    // ✅ ADD PAYMENT HISTORY STATE
    const [paymentHistorySheet, setPaymentHistorySheet] = useState<PaymentHistory[]>([]);
    const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(true);

    const pcReportSheet = useMemo(() => {
        return calculatePcReportCounts(
            indentSheet,
            storeSheet,
            issueSheet,
            fullkittingSheet,
            tallyEntrySheet,
            paymentsSheet,
            poMasterSheet,
            paymentHistorySheet
        );
    }, [indentSheet, storeSheet, issueSheet, fullkittingSheet, tallyEntrySheet, paymentsSheet, poMasterSheet, paymentHistorySheet]);

    const sheets = storeSheet;

    function updateStoreInSheet() {
        setStoreInLoading(true);
        fetchStoreInRecords()
            .then((res) => {
                // Map to StoreInSheet format
                const mapped = res.map((r: any) => ({
                    ...r,
                    // Ensure compatibility with naming conventions used in UI
                    vendorType: r.vendor_type || '', // Some old code might use this
                    billStatus: r.billStatus || '',
                }));
                setStoreInSheet(mapped as unknown as StoreInSheet[]);
                setStoreInLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching STORE IN from Supabase:', error);
                setStoreInLoading(false);
            });
    }

    function updateIssueSheet() {
        setIssueLoading(true);
        fetchIssueRecords()
            .then((res) => {
                const mapped = res.map(r => ({
                    issueNo: r.issue_no,
                    issueTo: r.issue_to,
                    uom: r.uom,
                    productName: r.product_name,
                    quantity: r.quantity,
                    department: r.department,
                    groupHead: r.group_head,
                    planned1: r.planned1,
                    actual1: r.actual1,
                    location: r.location,
                    status: r.status,
                    givenQty: r.given_qty,
                    firmNameMatch: r.firm_name_match,
                }));
                setIssueSheet(mapped as unknown as IssueSheet[]);
                setIssueLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching ISSUE from Supabase:', error);
                setIssueLoading(false);
            });
    }

    function updateIndentSheet() {
        setIndentLoading(true);
        fetchIndentRecords()
            .then((res) => {
                const mapped = res.map(r => ({
                    indentNumber: r.indent_number,
                    indenterName: r.indenter_name,
                    department: r.department,
                    productName: r.product_name,
                    quantity: r.quantity,
                    uom: r.uom,
                    attachment: r.attachment,
                    specifications: r.specifications,
                    areaOfUse: r.area_of_use,
                    vendorType: r.vendor_type,
                    indentStatus: r.indent_status,
                    indentType: r.indent_type,
                    planned1: r.planned1,
                    actual1: r.actual1,
                    firmNameMatch: r.firm_name_match,
                    approvedQuantity: r.approved_quantity,
                    timestamp: r.timestamp,
                    planned2: r.planned2,
                    actual2: r.actual2,
                    planned3: r.planned3,
                    actual3: r.actual3,
                    approvedVendorName: r.vendor_name || '',
                    planned4: r.planned4,
                    actual4: r.actual4,
                    poNumber: r.po_number,
                    planned5: r.planned5,
                    actual5: r.actual5,
                    status: r.status || r.indent_status || 'Pending',
                    poRequred: r.po_number ? 'Yes' : (r.actual4 ? 'Yes' : ''), // Helper for notification logic
                    liftingStatus: r.lifting_status || 'Pending',
                    poQty: r.po_qty || 0,
                    pendingPoQty: (r.approved_quantity || 0) - (Number(r.po_qty) || 0),
                    pendingLiftQty: (r.approved_quantity || 0) - (Number(r.received_quantity) || 0),
                }));
                setIndentSheet(mapped as unknown as IndentSheet[]);
                setIndentLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching INDENT from Supabase:', error);
                setIndentLoading(false);
            });
    }

    function updateReceivedSheet() {
        setReceivedLoading(true);
        // Using StoreIn service for received items as they are related
        fetchStoreInRecords()
            .then((res) => {
                const mapped = res.filter(r => r.actual6 !== '').map(r => ({
                    timestamp: r.timestamp,
                    indentNumber: r.indentNo,
                    poDate: r.poDate,
                    poNumber: r.poNumber,
                    vendor: r.vendorName,
                    receivedStatus: r.receivingStatus,
                    receivedQuantity: r.receivedQuantity,
                    uom: r.uom,
                    photoOfProduct: r.photoOfProduct,
                    billStatus: r.billStatus,
                    billNumber: r.billNo,
                    billAmount: r.billAmount,
                    photoOfBill: r.photoOfBill,
                    actual6: r.actual6,
                }));
                setReceivedSheet(mapped as unknown as ReceivedSheet[]);
                setReceivedLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching RECEIVED from Supabase:', error);
                setReceivedLoading(false);
            });
    }

    function updatePoMasterSheet() {
        setPoMasterLoading(true);
        fetchPoMaster()
            .then((res) => {
                setPoMasterSheet(res as unknown as PoMasterSheet[]);
                setPoMasterLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching PO MASTER from Supabase:', error);
                setPoMasterLoading(false);
            });
    }

    function updateInventorySheet() {
        setInventoryLoading(true);
        fetchInventoryRecords()
            .then((res) => {
                setInventorySheet(res as unknown as InventorySheet[]);
                setInventoryLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching INVENTORY from Supabase:', error);
                setInventoryLoading(false);
            });
    }

    function updateMasterSheet() {
        fetchMasterOptions()
            .then((res) => {
                setMasterSheet(res as unknown as MasterSheet);
            })
            .catch((error) => {
                console.error('Error fetching MASTER from Supabase:', error);
            });
    }

    function updateFullkittingSheet() {
        setFullkittingLoading(true);
        fetchFullkittingRecords()
            .then((res) => {
                const mapped = res.map(r => ({
                    ...r,
                    vehicleNo: r.vehicalNo, // Matching naming variants
                }));
                setFullkittingSheet(mapped as unknown as FullkittingSheet[]);
                setFullkittingLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching Fullkitting from Supabase:', error);
                setFullkittingLoading(false);
            });
    }

    function updatePaymentsSheet() {
        setPaymentsLoading(true);
        fetchPayments()
            .then((res) => {
                setPaymentsSheet(res as unknown as PaymentsSheet[]);
                setPaymentsLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching PAYMENTS from Supabase:', error);
                setPaymentsLoading(false);
            });
    }

    function updatePaymentHistorySheet() {
        setPaymentHistoryLoading(true);
        fetchPaymentHistory()
            .then((res) => {
                setPaymentHistorySheet(res as unknown as PaymentHistory[]);
                setPaymentHistoryLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching PAYMENT HISTORY from Supabase:', error);
                setPaymentHistoryLoading(false);
            });
    }

    function updateAll() {
        setAllLoading(true);
        updateMasterSheet();
        updateReceivedSheet();
        updateIndentSheet();
        updatePoMasterSheet();
        updateInventorySheet();

        updateStoreInSheet();
        updateIssueSheet();
        updateTallyEntrySheet();
        updatePcReportSheet();
        updateFullkittingSheet();

        updatePaymentHistorySheet();
        updatePaymentsSheet();

        setAllLoading(false);
    }

    useEffect(() => {
        try {
            updateAll();
            toast.success('Fetched all the data');

            // ✅ AUTO-REFRESH EVERY 30 SECONDS
            const intervalId = setInterval(() => {
                console.log('🔄 Auto-refreshing data...');
                updateAll();
            }, 30000); // 30,000 ms = 30 seconds

            return () => clearInterval(intervalId);
        } catch (e) {
            toast.error('Something went wrong while fetching data');
        } finally {
        }
    }, []);

    function updateTallyEntrySheet() {
        setTallyEntryLoading(true);
        console.log('🔄 Fetching Tally Entry records...');
        fetchTallyEntryRecords()
            .then((res) => {
                console.log(`✅ Received ${res.length} Tally Entry records`);
                const mapped = res.map(r => ({
                    timestamp: r.timestamp,
                    indentNo: r.indentNumber,
                    purchaseDate: r.materialInDate,
                    indentDate: r.timestamp,
                    indentNumber: r.indentNumber,
                    liftNumber: r.liftNumber,
                    poNumber: r.poNumber,
                    materialInDate: r.materialInDate,
                    productName: r.productName,
                    billNo: r.billNo,
                    qty: r.qty,
                    partyName: r.partyName,
                    billAmt: r.billAmt,
                    billImage: r.billImage,
                    billReceivedLater: r.billReceivedLater,
                    location: r.location,
                    typeOfBills: r.typeOfBills,
                    productImage: r.productImage,
                    area: r.area,
                    indentedFor: r.indentedFor,
                    approvedPartyName: r.approvedPartyName,
                    rate: r.rate,
                    indentQty: r.indentQty,
                    totalRate: r.totalRate,
                    planned1: r.planned1,
                    actual1: r.actual1,
                    delay1: r.delay1,
                    status1: r.status1,
                    remarks1: r.remarks1,
                    planned2: r.planned2,
                    actual2: r.actual2,
                    delay2: r.delay2,
                    status2: r.status2,
                    remarks2: r.remarks2,
                    planned3: r.planned3,
                    actual3: r.actual3,
                    delay3: r.delay3,
                    status3: r.status3,
                    remarks3: r.remarks3,
                    planned4: r.planned4,
                    actual4: r.actual4,
                    delay4: r.delay4,
                    status4: r.status4,
                    remarks4: r.remarks4,
                    planned5: r.planned5,
                    actual5: r.actual5,
                    status5: r.status5,
                    firmNameMatch: r.firmNameMatch,
                    id: r.id,
                    // Additional fields from join
                    damageOrder: r.damageOrder,
                    quantityAsPerBill: r.quantityAsPerBill,
                    priceAsPerPoCheck: r.priceAsPerPoCheck,
                    hodStatus: r.hodStatus,
                    hodRemark: r.hodRemark,
                    receivingStatus: r.receivingStatus,
                    receivedQuantity: r.receivedQuantity,
                }));
                setTallyEntrySheet(mapped as unknown as TallyEntrySheet[]);
                setTallyEntryLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching TALLY ENTRY from Supabase:', error);
                setTallyEntryLoading(false);
            });
    }

    function updatePcReportSheet() {
        // Now calculated dynamically via useMemo
    }

    return (
        <SheetsContext.Provider
            value={{
                updateIndentSheet,
                updatePoMasterSheet,
                updateReceivedSheet,
                updateAll,
                indentSheet,
                sheets,
                poMasterSheet,
                inventorySheet,
                receivedSheet,
                indentLoading,
                masterSheet,
                poMasterLoading,
                receivedLoading,
                inventoryLoading,
                allLoading,
                storeInSheet: storeSheet,

                updateIssueSheet,
                issueSheet,
                issueLoading,

                updateStoreInSheet,
                storeInLoading,

                tallyEntrySheet,
                tallyEntryLoading,
                updateTallyEntrySheet,

                pcReportSheet,
                updatePcReportSheet,

                fullkittingSheet,
                fullkittingLoading,
                updateFullkittingSheet,

                // ✅ ADD PAYMENT HISTORY TO CONTEXT VALUE
                paymentHistorySheet,
                paymentHistoryLoading,
                updatePaymentHistorySheet,
                paymentsSheet,
                paymentsLoading,
                updatePaymentsSheet,
            }}
        >
            {children}
        </SheetsContext.Provider>
    );
};

export const useSheets = () => useContext(SheetsContext)!;