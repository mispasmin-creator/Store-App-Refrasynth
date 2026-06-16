import type { PoMasterSheet } from '@/types';
import type { PcReportSheet, IndentSheet, StoreInSheet, IssueSheet, FullkittingSheet, TallyEntrySheet, PaymentsSheet, PaymentHistory } from '@/types/sheets';

export const calculatePcReportCounts = (
    indentSheet: IndentSheet[],
    storeInSheet: StoreInSheet[],
    issueSheet: IssueSheet[],
    fullkittingSheet: FullkittingSheet[],
    tallyEntrySheet: TallyEntrySheet[],
    paymentsSheet: PaymentsSheet[],
    poMasterSheet: PoMasterSheet[],
    paymentHistorySheet: PaymentHistory[] = []
): PcReportSheet[] => {
    const calculateCounts = (data: any[], pendingFilter: (item: any) => boolean, completeFilter: (item: any) => boolean, stageName: string): PcReportSheet => {
        const firms = ['PMPL', 'PURAB', 'PMMPL', 'REFRASYNTH'];
        const firmData: Record<string, number> = {};

        firms.forEach(firm => {
            firmData[firm] = data.filter(item =>
                (item.firmNameMatch || item.firm_name_match)?.toUpperCase() === firm && pendingFilter(item)
            ).length;
        });

        return {
            stage: stageName,
            totalPending: data.filter(pendingFilter).length,
            totalComplete: data.filter(completeFilter).length,
            pendingPmpl: firmData['PMPL'],
            pendingPurab: firmData['PURAB'],
            pendingPmmpl: firmData['PMMPL'],
            pendingRefrasynth: firmData['REFRASYNTH']
        };
    };

    return [
        calculateCounts(
            issueSheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Store Issue'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Department Indent Approval'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned2 && !item.actual2,
            (item) => !!item.actual2,
            'Vendor Rate Update'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned3 && !item.actual3,
            (item) => !!item.actual3,
            'Department Approval'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => item.planned4 && !item.actual4,
            (item) => !!item.actual4,
            'Department Approval'
        ),
        calculateCounts(
            indentSheet || [],
            (item) =>
                item.poRequred &&
                item.poRequred.toString().trim() === 'Yes' &&
                item.pendingPoQty &&
                item.pendingPoQty > 0 &&
                item.approvedVendorName &&
                item.approvedVendorName.toString().trim() !== '',
            (item) => !item.poRequred || item.poRequred !== 'Yes' || (item.pendingPoQty || 0) <= 0,
            'Pending PO'
        ),
        calculateCounts(
            indentSheet || [],
            (item) => (item.liftingStatus === 'Pending' || item.lifting_status === 'Pending') && item.planned5 && !item.actual5,
            (item) => !!item.actual5,
            'Lifting'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned6 || item.planned_6) && !(item.actual6 || item.actual_6),
            (item) => !!(item.actual6 || item.actual_6),
            'Store Check'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.plannedHod || item.hod_planned) && !(item.actualHod || item.hod_actual),
            (item) => !!(item.actualHod || item.hod_actual),
            'HOD Check'
        ),
        calculateCounts(
            fullkittingSheet || [],
            (item) => item.planned && !item.actual,
            (item) => !!item.actual,
            'Freight Payment'
        ),
        calculateCounts(
            paymentsSheet || [],
            (item) => item.planned && !item.actual && item.status1 !== 'hod_approval_pending',
            (item) => !!item.actual,
            'Make Payment'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned7 || item.planned_7) && !(item.actual7 || item.actual_7),
            (item) => !!(item.actual7 || item.actual_7),
            'Reject For GRN'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned9 || item.planned_9) && !(item.actual9 || item.actual_9),
            (item) => !!(item.actual9 || item.actual_9),
            'Send Debit Note'
        ),
        calculateCounts(
            tallyEntrySheet || [],
            (item) => item.planned1 && !item.actual1,
            (item) => !!item.actual1,
            'Audit Data'
        ),
        calculateCounts(
            storeInSheet || [],
            (item) => (item.planned11 || item.planned_11) && !(item.actual11 || item.actual_11),
            (item) => !!(item.actual11 || item.actual_11),
            'Bill Not Received'
        ),
        {
            stage: 'Process for Payment / Debit Note',
            totalPending: (() => {
                const receivedPos = new Set((storeInSheet || []).filter((s: any) => s.actual6 && s.actual6 !== '').map((s: any) => s.poNumber || s.po_number).filter(Boolean));
                const paymentsByPo: Record<string, number> = {};
                (paymentsSheet || []).forEach((p: any) => { const k = p.poNumber || p.po_number || ''; if (k) paymentsByPo[k] = (paymentsByPo[k] || 0) + Number(p.payAmount || p.pay_amount || 0); });

                // Same key as the actual page list: Party + PO + Bill, so distinct POs for the
                // same vendor don't collapse into a single count.
                const uniqueBills = new Set<string>();

                const isAlreadyProcessed = (poNum: string, billNo: string, internalCode: string) => {
                    const inPayments = (paymentsSheet || []).some((p: any) => {
                        const poMatch = (p.poNumber || p.po_number) === poNum;
                        if (!poMatch) return false;
                        const billMatch = billNo
                            ? (p.remark || '').includes(`Bill: ${billNo}`) || p.billNo === billNo || p.bill_no === billNo
                            : (p.internalCode || p.internal_code || '') === internalCode;
                        if (!billMatch) return false;
                        const statusVal = String(p.status1 || p.status || '').toLowerCase();
                        const isProcessedStatus = ['pending', 'approved', 'complete', 'completed', 'process'].includes(statusVal);
                        const hasPlannedDate = p.planned && p.planned.toString().trim() !== '';
                        return isProcessedStatus || hasPlannedDate;
                    });
                    if (inPayments) return true;

                    return (paymentHistorySheet || []).some((h: any) => {
                        const poMatch = (h.po_number || h.poNumber) === poNum;
                        if (!poMatch) return false;
                        return billNo
                            ? (h.bill_no || h.billNo) === billNo
                            : (h.indent_no || h.indentNo || '') === internalCode;
                    });
                };

                // PO Based: needs to be received (or advance-term) and HOD-approved + Independent bill type
                (poMasterSheet || []).forEach((r: any) => {
                    const poNum = r.poNumber || r.po_number || '';
                    const isReceived = receivedPos.has(poNum);
                    const paymentTerms = (r.paymentTerms || r.payment_terms || '').toString().trim().toLowerCase();
                    const isPI = paymentTerms.includes("partly pi") || paymentTerms.includes("partly advance");

                    const totalPo = Number(r.totalPoAmount || 0);
                    const totalPaid = paymentsByPo[poNum] || 0;
                    const outstanding = totalPo - totalPaid;
                    const status = String(r.status || '').toLowerCase();
                    const isPending = status === 'pending' || status === '';

                    if (!((isReceived || isPI) && outstanding > 0 && isPending)) return;

                    const linkedStoreIn = (storeInSheet || []).find((s: any) => (s.poNumber || s.po_number) === poNum);
                    if (linkedStoreIn) {
                        if (linkedStoreIn.typeOfBill && linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') return;
                        if ((linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') return;
                    }

                    const billNo = linkedStoreIn?.billNo || '';
                    if (isAlreadyProcessed(poNum, billNo, r.internalCode || r.internal_code || '')) return;

                    uniqueBills.add(`${r.partyName || r.party_name}-${poNum || 'NoPO'}-${billNo || 'NoBill'}`);
                });

                // Payment Based: pending, unscheduled payment rows
                (paymentsSheet || []).forEach((p: any) => {
                    const status = String(p.status || '').toLowerCase();
                    const isPending = status === 'pending';
                    const notScheduled = !p.planned || String(p.planned).trim() === '';
                    if (!(isPending && notScheduled)) return;

                    const poNum = p.poNumber || p.po_number || '';
                    const internalCode = p.internalCode || p.internal_code || '';
                    const linkedStoreIn = (storeInSheet || []).find((s: any) =>
                        (s.indentNo || s.indentNumber) === internalCode &&
                        (!s.poNumber || !poNum || s.poNumber === poNum)
                    );

                    if (linkedStoreIn) {
                        if (linkedStoreIn.typeOfBill && linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') return;
                        if ((linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') return;
                    }

                    const billNo = p.billNo || p.bill_no || linkedStoreIn?.billNo || '';
                    if (isAlreadyProcessed(poNum, billNo, internalCode)) return;

                    uniqueBills.add(`${p.partyName || p.party_name}-${poNum || 'NoPO'}-${billNo || 'NoBill'}`);
                });

                return uniqueBills.size;
            })(),
            totalComplete: 0,
            pendingPmpl: 0,
            pendingPurab: 0,
            pendingPmmpl: 0,
            pendingRefrasynth: 0
        }
    ];
};
