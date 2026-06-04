import '@/index.css';

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '@/context/AuthContext.tsx';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Login from './components/views/Login';
import CreateIndent from './components/views/CreateIndent';
import Dashboard from './components/views/Dashboard';
import App from './App';
import ApproveIndent from '@/components/views/ApproveIndent';
import { SheetsProvider } from './context/SheetsContext';
import VendorUpdate from './components/views/VendorUpdate';
import DepartmentApproval from './components/views/TechnicalApproval';
import RateApproval from './components/views/RateApproval';
import StoreOutApproval from './components/views/StoreOutApproval';
import TrainnigVideo from './components/views/TrainingVideo';
import Liecense from './components/views/License'
import MakePayment from './components/views/MakePayment';
import type { RouteAttributes } from './types';
import {
    LayoutDashboard,
    ClipboardList,
    UserCheck,
    Users,
    ClipboardCheck,
    Truck,
    PackageCheck,
    ShieldUser,
    FilePlus2,
    ListTodo,
    Package2,
    Store,
    KeyRound,
    VideoIcon,
    RotateCcw,
    PlusCircle,
    CheckSquare,
    UserCog,
    ShieldCheck,
    Clock,
    FilePlus,
    History,
    ArrowUpCircle,
    CheckCircle2,
    FileX,
    HandCoins,
    RefreshCw,
    CreditCard,
    Send,
    BarChart,
    FileWarning,
} from 'lucide-react';
import type { UserPermissions } from './types/sheets';
import Administration from './components/views/Administration';
import Loading from './components/views/Loading';
import CreatePO from './components/views/CreatePO';
import PendingIndents from './components/views/PendingIndents';
import Order from './components/views/Order';
import Inventory from './components/views/Inventory';
import POMaster from './components/views/POMaster';
import StoreIssue from './components/views/StoreIssue';
import QuantityCheckInReceiveItem from './components/views/QuantityCheckInReceiveItem';
import ReturnMaterialToParty from './components/views/ReturnMaterialToParty';
import SendDebitNote from './components/views/SendDebitNote';
import IssueData from './components/views/IssueData';
import GetLift from './components/views/GetLift';
import StoreIn from './components/views/StoreIn';
import AuditData from './components/views/AuditData';
import RectifyTheMistake from './components/views/RectifyTheMistake';
import ReauditData from './components/views/ReauditData';
import TakeEntryByTally from './components/views/TakeEntryByTally';
import ExchangeMaterials from './components/views/ExchangeMaterials';
import DBforPc from './components/views/DBforPC';
import AgainAuditing from './components/views/AgainAuditing'
import BillNotReceived from './components/views/BillNotReceived';
import FullKiting from './components/views/FullKiting';
import PendingPo from './components/views/PendingPo';
import PaymentStatus from './components/views/PaymentStatus';
import HodStoreApproval from './components/views/HodStoreApproval';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { loggedIn, loading } = useAuth();
    if (loading) return <Loading />;
    return loggedIn ? children : <Navigate to="/login" />;
}

function GatedRoute({
    children,
    identifier,
}: {
    children: React.ReactNode;
    identifier?: keyof UserPermissions;
}) {
    const { user } = useAuth();
    if (!identifier) return children;

    // Check specific permission only — no blanket admin bypass
    const hasPermission = user && ((user as any)[identifier] === true || (user as any)[identifier] === "true");

    if (!hasPermission) {
        return <Navigate to="/" replace />;
    }
    return children;
}

const routes: RouteAttributes[] = [
    {
        path: '',
        name: 'Dashboard',
        icon: <LayoutDashboard size={20} />,
        element: <Dashboard />,
        notifications: () => 0,
    },
    {
        path: 'store-issue',
        gateKey: 'storeIssue',
        name: 'Store Issue',
        icon: <ClipboardList size={20} />,
        element: <StoreIssue />,
        notifications: () => 0,
    },

    {
        path: 'Issue-data',
        gateKey: 'issueData',
        name: 'Issue Data',
        icon: <ClipboardCheck size={20} />,
        element: <IssueData />,
        notifications: (issueSheet: any[], user: any) =>
            issueSheet.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                sheet.planned1 &&
                sheet.planned1.toString().trim() !== '' &&
                (!sheet.actual1 || sheet.actual1.toString().trim() === '')
            ).length,
    },


    {
        path: 'inventory',
        name: 'Inventory',
        gateKey: 'inventory',
        icon: <Store size={20} />,
        element: <Inventory />,
        notifications: () => 0,
    },


    {
        path: 'create-indent',
        gateKey: 'createIndent',
        name: 'Create Indent',
        icon: <PlusCircle size={20} />,
        element: <CreateIndent />,
        notifications: () => 0,
    },
    {
        path: 'approve-indent',
        gateKey: 'indentApprovalView',
        name: 'Department Indent Approval',
        icon: <CheckSquare size={20} />,
        element: <ApproveIndent />,
        notifications: (sheets: any[], user: any) => {
            const data = Array.isArray(sheets[0]) ? sheets[0] : sheets;
            return data.filter(
                (sheet: any) =>
                    (!user || user.firmNameMatch.toLowerCase() === "all" || sheet.firmNameMatch === user.firmNameMatch) &&
                    sheet.planned1 && sheet.planned1 !== '' &&
                    (!sheet.actual1 || sheet.actual1 === '')
            ).length;
        },
    },
    {
        path: 'vendor-rate-update',
        gateKey: 'updateVendorView',
        name: 'Vendor Rate Update',
        icon: <UserCog size={20} />,
        element: <VendorUpdate />,
        notifications: (sheets: any[], user: any) =>
            sheets.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                sheet.planned2 !== '' && sheet.actual2 === ''
            ).length,
    },
    {
        path: 'technical-approval',
        gateKey: 'threePartyApprovalView',
        name: 'Technical Approval',
        icon: <Users size={20} />,
        element: <DepartmentApproval />,
        notifications: (sheetsData: any[], user: any) => {
            const sheets = Array.isArray(sheetsData[0]) ? sheetsData[0] : sheetsData;
            return sheets.filter(
                (sheet: any) =>
                    (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                    (sheet.vendorType || sheet.vendor_type) !== 'Direct' &&
                    sheet.planned3 && sheet.planned3 !== '' &&
                    (!sheet.actual3 || sheet.actual3 === '') &&
                    !(sheet.vendor1_rank || sheet.vendor2_rank || sheet.vendor3_rank)
            ).length;
        },
    },
    {
        path: 'management-approval',
        gateKey: 'threePartyApprovalView',
        name: 'Mgmt Approval',
        icon: <ShieldCheck size={20} />,
        element: <RateApproval />,
        notifications: (sheetsData: any[], user: any) => {
            const sheets = Array.isArray(sheetsData[0]) ? sheetsData[0] : sheetsData;
            return sheets.filter(
                (sheet: any) =>
                    (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                    (sheet.vendorType || sheet.vendor_type) !== 'Direct' &&
                    sheet.planned4 && sheet.planned4 !== '' &&
                    (!sheet.approvedVendorName && !sheet.approved_vendor_name) &&
                    (sheet.vendor1_rank || sheet.vendor2_rank || sheet.vendor3_rank)
            ).length;
        },
    },
    // {
    //     path: 'pending-pos',
    //     gateKey: 'pendingIndentsView',
    //     name: 'PO to Make/Not',
    //     icon: <ListTodo size={20} />,
    //     element: <PendingIndents />,
    //     notifications: (sheets: any[]) =>
    //         sheets.filter((sheet: any) =>
    //             sheet.status === "Pending" &&
    //             sheet.approvedVendorName &&
    //             sheet.approvedVendorName.toString().trim() !== '' &&
    //             (!sheet.poRequred ||
    //                 sheet.poRequred.toString().trim() === '' ||
    //                 sheet.poRequred.toString().trim() === 'undefined' ||
    //                 sheet.poRequred === null)
    //         ).length,
    // },

    {
        path: 'pending-poss',
        gateKey: 'pendingPo', // ✅ CHANGE: lowercase 'o'
        name: 'Pending PO to be Created',
        icon: <Clock size={20} />,
        element: <PendingPo />,
        notifications: (sheets: any[], user: any) => {
            // Count only items that are likely NOT in PO Master yet
            return sheets.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                sheet.poRequred &&
                sheet.poRequred.toString().trim() === 'Yes' &&
                sheet.pendingPoQty &&
                sheet.pendingPoQty > 0 &&
                sheet.approvedVendorName &&
                sheet.approvedVendorName.toString().trim() !== ''
            ).length;
        },
    },

    {
        path: 'create-po',
        gateKey: 'createPo',
        name: 'Create PO',
        icon: <FilePlus size={20} />,
        element: <CreatePO />,
        notifications: () => 0,
    },

    {
        path: 'po-history',
        gateKey: 'poHistory',
        name: 'PO History',
        icon: <History size={20} />,
        element: <Order />, // Changed from <Order /> to <POHistory />
        notifications: (sheets: any[], user: any) => {
            if (!Array.isArray(sheets) || sheets.length === 0) {
                return 0;
            }

            try {
                // Filter by firm and valid PO numbers
                const sheetsWithPoNumbers = sheets.filter((sheet: any) =>
                    (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                    sheet?.poNumber &&
                    sheet?.poNumber.toString().trim() !== ''
                );

                if (sheetsWithPoNumbers.length === 0) {
                    return 0;
                }

                // Create a Map to store unique PO numbers
                const uniquePOMap = new Map<string, any>();

                // Add only unique PO numbers to the Map
                sheetsWithPoNumbers.forEach((sheet: any) => {
                    const poNumber = sheet?.poNumber.toString().trim();
                    if (poNumber && !uniquePOMap.has(poNumber)) {
                        uniquePOMap.set(poNumber, sheet);
                    }
                });

                // Return count of unique PO numbers
                return uniquePOMap.size;
            } catch (error) {
                console.error('Error calculating PO notifications:', error);
                return 0;
            }
        },
    },

    {
        path: 'get-lift',
        gateKey: 'ordersView',
        name: 'Lifting',
        icon: <ArrowUpCircle size={20} />,
        element: <GetLift />,
        notifications: (sheetsData: any[], user: any) => {
            const sheets = Array.isArray(sheetsData[0]) ? sheetsData[0] : sheetsData;

            // Unique PO numbers that satisfy the criteria
            const uniquePOs = new Set<string>();

            sheets.forEach((sheet: any) => {
                const isFirmMatch = !user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch;
                const hasPlanned5 = sheet.planned5 && sheet.planned5.toString().trim() !== '';
                const hasNoActual5 = !sheet.actual5 || sheet.actual5.toString().trim() === '';
                const isPending = sheet.liftingStatus === 'Pending' || !sheet.liftingStatus;

                // pendingLiftQty is calculated in SheetsContext as (approved_quantity - received_quantity)
                const hasPendingQty = (sheet.pendingLiftQty || (Number(sheet.approvedQuantity) - Number(sheet.receivedQuantity))) > 0;

                if (isFirmMatch && hasPlanned5 && hasNoActual5 && isPending && hasPendingQty) {
                    uniquePOs.add(sheet.poNumber || `NO_PO_${sheet.indentNumber}`);
                }
            });

            return uniquePOs.size;
        },
    },


    {
        path: 'store-in',
        gateKey: 'storeIn',
        name: 'Material Receipt / Store In',
        icon: <CheckCircle2 size={20} />,
        element: <StoreIn />,
        notifications: (sheetsData: any[], user: any) => {
            const sheets = Array.isArray(sheetsData[0]) ? sheetsData[0] : sheetsData;
            const filteredByFirm = sheets.filter((item: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (item.firmNameMatch || item.firm_name_match) === user.firmNameMatch)
            );

            // Filter to keep only latest per indent+product (matching StoreIn.tsx line 228)
            const latestRecords: any[] = [];
            const seen = new Set<string>();
            for (const item of filteredByFirm) {
                const key = `${item.indentNo || item.indent_no}-${item.productName || item.product_name}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    latestRecords.push(item);
                }
            }

            // Group by Vendor + Bill No (matching StoreIn.tsx line 241)
            const uniqueGroupedKeys = new Set<string>();
            const pendingItems = latestRecords.filter((i) =>
                (i.planned6 || i.planned_6) && (i.planned6 || i.planned_6) !== '' &&
                (!i.actual6 && !i.actual_6) &&
                ((i.billStatus || i.bill_status) === 'Bill Received' || (i.billStatus || i.bill_status) === 'Not Received')
            );

            pendingItems.forEach((i) => {
                const billNo = String(i.billNo || i.bill_no || '');
                const key = `${i.vendorName || i.vendor_name}-${billNo}`;
                uniqueGroupedKeys.add(key);
            });

            return uniqueGroupedKeys.size;
        },
    },
    {
        path: 'hod-store-check',
        gateKey: 'hodStoreApproval',
        name: 'HOD Check',
        icon: <UserCheck size={20} />,
        element: <HodStoreApproval />,
        notifications: (storeInSheet: any[], user: any) => {
            const data = Array.isArray(storeInSheet[0]) ? storeInSheet[0] : storeInSheet;
            const firmFilter = user.firmNameMatch?.toLowerCase() === 'all' ? null : user.firmNameMatch;

            return data.filter((sheet: any) => {
                const isFirmMatch = !firmFilter || (sheet.firmNameMatch || sheet.firm_name_match) === firmFilter;
                const isPlanned = (sheet.plannedHod || sheet.hod_planned || sheet.hodPlanned);
                const isActual = (sheet.actualHod || sheet.hod_actual || sheet.hodActual);

                return isFirmMatch &&
                    isPlanned && isPlanned.toString().trim() !== '' &&
                    (!isActual || isActual.toString().trim() === '');
            }).length;
        },
    },
    {
        path: 'Full-Kiting',
        gateKey: 'fullKiting',
        name: 'Freight Payment',
        icon: <Truck size={20} />,
        element: <FullKiting />,
        notifications: (sheets: any[], user: any) =>
            sheets.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                sheet.planned &&
                sheet.planned.toString().trim() !== '' &&
                (!sheet.actual || sheet.actual.toString().trim() === '')
            ).length,
    },
    {
        path: 'Payment-Status',
        name: 'Process for Payment / Debit Note',
        icon: <RefreshCw size={20} />,
        element: <PaymentStatus />,
        notifications: (sheetsData: any[]) => {
            try {
                // ✅ IMPORTANT: Expect [poMasterSheet, paymentsSheet, user, storeInSheet] from Sidebar
                const [poMasterSheet = [], paymentsSheet = [], user = null, storeInSheet = []] = sheetsData;

                if (!Array.isArray(poMasterSheet)) return 0;

                // 1. Identify received PO numbers from storeInSheet
                const receivedPos = new Set(
                    (storeInSheet || [])
                        .filter((s: any) => s.actual6 && s.actual6.toString().trim() !== '')
                        .map((s: any) => s.poNumber || s.po_number)
                        .filter(Boolean)
                );

                // 2. Calculate payment totals per PO from payments table
                const paymentsByPo: { [key: string]: number } = {};
                (paymentsSheet || []).forEach((p: any) => {
                    const key = p.poNumber || p.po_number || '';
                    if (key) {
                        paymentsByPo[key] = (paymentsByPo[key] || 0) + Number(p.payAmount || p.pay_amount || 0);
                    }
                });

                // 3. Collect unique bills by Party + Bill No
                const uniqueBills = new Set<string>();

                // Process PO-based items
                poMasterSheet.forEach((record: any) => {
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        record.firmNameMatch === user.firmNameMatch;
                    if (!firmMatch) return;

                    const poNum = record.poNumber || '';
                    const isReceived = receivedPos.has(poNum);
                    const paymentTerms = (record.paymentTerms || record.payment_terms || '').toString().trim().toLowerCase();
                    const isPI = paymentTerms.includes("partly pi") || paymentTerms.includes("partly advance");

                    // Link with StoreIn for HOD and Bill checks
                    const linkedStoreIn = (storeInSheet || []).find((s: any) =>
                        (s.poNumber || s.po_number || '') === (record.poNumber || record.po_number || '')
                    );

                    if (linkedStoreIn) {
                        if (linkedStoreIn.typeOfBill && linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') return;
                        if ((linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') return;
                    }

                    if (!isReceived && !isPI) return;

                    const totalPo = Number(record.totalPoAmount || 0);
                    const totalPaid = paymentsByPo[poNum] || 0;
                    const outstanding = totalPo - totalPaid;
                    const status = (record.status || '').toString().trim().toLowerCase();
                    const isPending = status === 'pending' || status === '';

                    if (outstanding > 0 && isPending) {
                        // ✅ Count ONLY if it matches the 'Advance Terms' logical filter
                        const pt = (record.paymentTerms || record.payment_terms || '').toLowerCase();
                        if (pt.includes('advance') || pt.includes('pi')) {
                            const billNo = linkedStoreIn?.billNo || linkedStoreIn?.bill_no || 'NoBill';
                            const uniqueKey = `${record.partyName || record.party_name || 'NoVendor'}-${billNo}`;
                            uniqueBills.add(uniqueKey);
                        }
                    }
                });

                // Process Payment-based items
                (paymentsSheet || []).forEach((payment: any) => {
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        (payment.firmNameMatch || payment.firm_name) === user.firmNameMatch;
                    if (!firmMatch) return;

                    const status = String(payment.status || '').toLowerCase();
                    const isPending = status === 'pending';
                    const notScheduled = !payment.planned || String(payment.planned || '').trim() === '';

                    if (isPending && notScheduled) {
                        // ✅ Count ONLY if it matches 'Advance Terms'
                        const pt = (payment.paymentTerms || payment.payment_terms || '').toLowerCase();
                        if (pt.includes('advance') || pt.includes('pi')) {
                            const linkedStoreIn = (storeInSheet || []).find((s: any) =>
                                (s.indentNo || s.indentNumber) === (payment.internalCode || payment.internal_code)
                            );
                            if (linkedStoreIn) {
                                if (linkedStoreIn.typeOfBill && linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') return;
                                if ((linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') return;
                            }

                            const billNo = payment.billNo || payment.bill_no || linkedStoreIn?.billNo || linkedStoreIn?.bill_no || 'NoBill';
                            const uniqueKey = `${payment.partyName || payment.party_name || 'NoVendor'}-${billNo}`;
                            uniqueBills.add(uniqueKey);
                        }
                    }
                });

                return uniqueBills.size;
            } catch (error) {
                console.error('Error calculating Payment-Status notifications:', error);
                return 0;
            }
        }
    },


    {
        path: 'Make-Payment',
        gateKey: 'makePayment',
        name: 'Make Payment',
        icon: <CreditCard size={20} />,
        element: <MakePayment />,
        notifications: (sheets: any[], user: any) => {
            const paymentsData = Array.isArray(sheets[0]) ? sheets[0] : sheets;
            const storeInSheet = Array.isArray(sheets[1]) ? sheets[1] : [];

            if (paymentsData.length === 0) return 0;

            const pendingItems = paymentsData.filter((payment: any) => {
                const firmMatch = !user || user.firmNameMatch.toLowerCase() === "all" ||
                    (payment.firmNameMatch || payment.firm_name) === user.firmNameMatch;
                if (!firmMatch) return false;

                // Check payment terms: Only count if Partly Advance or Partly PI
                const terms = String(payment?.paymentTerms || payment?.payment_terms || '').toLowerCase();
                const isPartlyTerms = terms.includes('partly') && (terms.includes('advance') || terms.includes('pi'));
                if (!isPartlyTerms) return false;

                // Check linked Store In for HOD status: Only count if Approved
                const linkedStoreIn = storeInSheet.find((s: any) =>
                    (s.indentNo || s.indentNumber) === (payment.internalCode || payment.internal_code)
                );
                if (linkedStoreIn && (linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') {
                    return false;
                }

                const planned = String(payment?.planned || '').trim();
                const actual = String(payment?.actual || '').trim();
                const status1 = String(payment?.status1 || '').toLowerCase();

                const hasPlanned = planned !== '';
                const noActual = actual === '';
                const isNotHodPending = status1 !== 'hod_approval_pending';

                return hasPlanned && noActual && isNotHodPending;
            });

            // Filter to keep ONLY the latest record per Indent and Product
            const seen = new Set<string>();
            let count = 0;
            pendingItems.forEach((item: any) => {
                const key = `${item.internal_code || item.internalCode || ''}-${item.product || ''}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    count++;
                }
            });
            return count;
        },
    },



    // {
    //     path: 'Exchange-Materials',
    //     gateKey: 'exchangeMaterials',
    //     name: 'Exchange Materials',
    //     icon: <PackageCheck size={20} />,
    //     element: <ExchangeMaterials />,
    //     notifications: (sheets: any[]) =>
    //         sheets.filter((sheet: any) =>
    //             sheet.planned10 &&
    //             sheet.planned10.toString().trim() !== '' &&
    //             (!sheet.actual10 || sheet.actual10.toString().trim() === '')
    //         ).length,
    // },

    // {
    //     path: 'Return-Material-To-Party',
    //     gateKey: 'returnMaterialToParty',
    //     name: 'Return Material To Party',
    //     icon: <RotateCcw size={20} />,
    //     element: <ReturnMaterialToParty />,
    //     notifications: (sheets: any[]) =>
    //         sheets.filter((sheet: any) =>
    //             sheet.planned8 &&
    //             sheet.planned8.toString().trim() !== '' &&
    //             (!sheet.actual8 || sheet.actual8.toString().trim() === '')
    //         ).length,
    // },

    {
        path: 'Quality-Check-In-Received-Item',
        gateKey: 'insteadOfQualityCheckInReceivedItem',
        name: 'Reject For GRN',
        icon: <FileX size={20} />,
        element: <QuantityCheckInReceiveItem />,
        notifications: (sheetsData: any[], user: any) => {
            const sheets = Array.isArray(sheetsData[0]) ? sheetsData[0] : sheetsData;
            return sheets.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                (sheet.planned7 || sheet.planned_7) &&
                (sheet.planned7 || sheet.planned_7).toString().trim() !== '' &&
                (!sheet.actual7 && !sheet.actual_7)
            ).length;
        },
    },
    {
        path: 'Send-Debit-Note',
        gateKey: 'sendDebitNote',
        name: 'Send Debit Note',
        icon: <Send size={20} />,
        element: <SendDebitNote />,
        notifications: (sheetsData: any[], user: any) => {
            const sheets = Array.isArray(sheetsData[0]) ? sheetsData[0] : sheetsData;
            return sheets.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                (sheet.planned9 || sheet.planned_9) &&
                (sheet.planned9 || sheet.planned_9).toString().trim() !== '' &&
                (!sheet.actual9 && !sheet.actual_9)
            ).length;
        },
    },

    {
        path: 'audit-data',
        gateKey: 'auditData',
        name: 'Audit Data',
        icon: <BarChart size={20} />,
        element: <AuditData />,
        notifications: (sheets: any[], user: any) =>
            sheets.filter((sheet: any) =>
                (!user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch) &&
                sheet.planned1 &&
                sheet.planned1.toString().trim() !== '' &&
                (!sheet.actual1 || sheet.actual1.toString().trim() === '')
            ).length,
    },

    // {
    //     path: 'rectify-the-mistake',
    //     gateKey: 'rectifyTheMistake',
    //     name: 'Rectify the mistake',
    //     icon: <Users size={20} />,
    //     element: <RectifyTheMistake />,
    //     notifications: (sheets: any[]) => {
    //         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;

    //         const sheetData = Array.isArray(sheets[0]) ? sheets[0] : sheets;

    //         let count = 0;
    //         sheetData.forEach((item: any) => {
    //             const planned2 = item['Planned 2'] || item['planned2'];
    //             const actual2 = item['Actual 2'] || item['actual2'];

    //             const hasPlanned2 = planned2 && planned2.toString().trim() !== '';
    //             const noActual2 = !actual2 || actual2.toString().trim() === '';

    //             if (hasPlanned2 && noActual2) {
    //                 count++;
    //             }
    //         });

    //         return count;
    //     },
    // },

    // {
    //     path: 'reaudit-data',
    //     gateKey: 'reauditData',
    //     name: 'Reaudit Data',
    //     icon: <Users size={20} />,
    //     element: <ReauditData />,
    //     notifications: (sheets: any[]) => {
    //         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;

    //         const sheetData = Array.isArray(sheets[0]) ? sheets[0] : sheets;

    //         let count = 0;
    //         sheetData.forEach((item: any) => {
    //             const planned3 = item['Planned 3'] || item['planned3'];
    //             const actual3 = item['Actual 3'] || item['actual3'];

    //             const hasPlanned3 = planned3 && planned3.toString().trim() !== '';
    //             const noActual3 = !actual3 || actual3.toString().trim() === '';

    //             if (hasPlanned3 && noActual3) {
    //                 count++;
    //             }
    //         });

    //         return count;
    //     },
    // },


    //     {
    //     path: 'take-entry-by-tally',
    //     gateKey: 'takeEntryByTelly',
    //     name: 'Take Entry By Tally',
    //     icon: <ClipboardList size={20} />,
    //     element: <TakeEntryByTally />,
    //     notifications: (sheets: any[]) => {
    //         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;

    //         const sheetData = Array.isArray(sheets[0]) ? sheets[0] : sheets;

    //         let count = 0;
    //         sheetData.forEach((item: any) => {
    //             const planned4 = item['Planned 4'] || item['planned4'];
    //             const actual4 = item['Actual 4'] || item['actual4'];

    //             const hasPlanned4 = planned4 && planned4.toString().trim() !== '';
    //             const noActual4 = !actual4 || actual4.toString().trim() === '';

    //             if (hasPlanned4 && noActual4) {
    //                 count++;
    //             }
    //         });

    //         return count;
    //     },
    // },

    //   {
    //     path: 'AgainAuditing',
    //     gateKey: 'againAuditing',
    //     name: 'Again Auditing',
    //     icon: <UserCheck size={20} />,
    //     element: <AgainAuditing />,
    //     notifications: (sheets: any[]) => {
    //         if (!sheets || !Array.isArray(sheets) || sheets.length === 0) return 0;

    //         // The sheet data is passed as the first item in the array
    //         const sheetData = sheets[0];
    //         if (!Array.isArray(sheetData)) return 0;

    //         console.log('🔍 Again Auditing - Sheet data count:', sheetData.length);

    //         let count = 0;
    //         sheetData.forEach((item: any) => {
    //             const planned5 = item['Planned 5'] || item['planned5'];
    //             const actual5 = item['Actual 5'] || item['actual5'];

    //             const hasPlanned5 = planned5 && planned5.toString().trim() !== '';
    //             const noActual5 = !actual5 || actual5.toString().trim() === '';

    //             if (hasPlanned5 && noActual5) {
    //                 count++;
    //             }
    //         });

    //         console.log('📈 Again Auditing - Final count:', count);
    //         return count;
    //     },
    // },
    // {
    //     path: 'store-out-approval',
    //     gateKey: 'storeOutApprovalView',
    //     name: 'Store Out Approval',
    //     icon: <PackageCheck size={20} />,
    //     element: <StoreOutApproval />,
    //     notifications: (sheets: any[]) =>
    //         sheets.filter(
    //             (sheet: any) =>
    //                 sheet.planned6 !== '' &&
    //                 sheet.actual6 === '' &&
    //                 sheet.indentType === 'Store Out'
    //         ).length,
    // },
    {
        path: 'Bill-Not-Received',
        gateKey: 'billNotReceived',
        name: 'Bill Not Received',
        icon: <FileWarning size={20} />,
        element: <BillNotReceived />,
        notifications: (sheets: any[], user: any) => {
            // Count items where planned11 is set but actual11 is not
            return sheets.filter((sheet: any) => {
                const firmMatch = !user || (user.firmNameMatch || '').toLowerCase() === "all" || (sheet.firmNameMatch || sheet.firm_name_match) === user.firmNameMatch;
                if (!firmMatch) return false;

                const hasPlanned11 = sheet.planned11 && sheet.planned11.toString().trim() !== '';
                const noActual11 = !sheet.actual11 || sheet.actual11.toString().trim() === '';

                return hasPlanned11 && noActual11;
            }).length;
        },
    },

    // {
    //     path: 'DBforPc',
    //     gateKey: 'dbForPc',
    //     name: 'DB For PC',
    //     icon: <PackageCheck size={20} />,
    //     element: <DBforPc />,
    //     notifications: (pcReportSheet: any[]) => {
    //         const data = Array.isArray(pcReportSheet[0]) ? pcReportSheet[0] : pcReportSheet;
    //         return data.reduce((sum: number, stage: any) => sum + (Number(stage.totalPending) || 0), 0);
    //     },
    // },
    {
        path: 'administration',
        gateKey: 'administrate',
        name: 'Adminstration',
        icon: <ShieldUser size={20} />,
        element: <Administration />,
        notifications: () => 0,
    },
    // {
    //     path: 'training-video',
    //     name: 'Training Video',
    //     icon: <VideoIcon size={20} />,
    //     element: <TrainnigVideo />,
    //     notifications: () => 0,
    // },
    // {
    //     path: 'license',
    //     name: 'License',
    //     icon: <KeyRound size={20} />,
    //     element: <Liecense />,
    //     notifications: () => 0,
    // },

];

const rootElement = document.getElementById('root');

// Cache the root instance to prevent "createRoot() called multiple times" warning
let root: ReturnType<typeof createRoot> | null = null;

if (rootElement) {
    // Only create root once, reuse it on subsequent renders (HMR)
    if (!root) {
        root = createRoot(rootElement);
    }

    root.render(
        <StrictMode>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <SheetsProvider>
                                        <App routes={routes} />
                                    </SheetsProvider>
                                </ProtectedRoute>
                            }
                        >
                            {routes.map(({ path, element, gateKey }) => (
                                <Route
                                    key={path}
                                    path={path}
                                    element={
                                        <GatedRoute identifier={gateKey}>
                                            {element}
                                        </GatedRoute>
                                    }
                                />
                            ))}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </StrictMode>
    );
}