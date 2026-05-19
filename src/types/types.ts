export interface PaymentHistory {
  timestamp: string;
  apPaymentNumber: string;
  status: string;
  uniqueNumber: string;
  fmsName: string;
  payTo: string;
  amountToBePaid: number;
  remarks: string;
  anyAttachments: string;
  
}


// ✅ UPDATE SHEET TYPE TO INCLUDE PAYMENT HISTORY
export type Sheet = 
  | 'MASTER' 
  | 'INDENT' 
  | 'RECEIVED' 
  | 'USER' 
  | 'PO MASTER' 
  | 'INVENTORY' 
  | 'STORE IN' 
  | 'ISSUE' 
  | 'TALLY ENTRY' 
  | 'PC REPORT'
  | 'FULLKITTING'
  | 'Payment History'
  |'Payments' ;// ✅ ADD THIS

// Your existing PoMasterSheet interface
export interface PoMasterSheet {
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gst: number;
    discount: number;
    amount: number;
    totalPoAmount: number;
    packaging?: number;
    forwarding?: number;
    packagingAndForwarding?: number;
    pdf: string;
    preparedBy: string;
    approvedBy: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    term1: string;
    term2: string;
    term3: string;
    term4: string;
    term5: string;
    term6: string;
    term7: string;
    term8: string;
    term9: string;
    term10: string;
    discountPercent?: number;
    gstPercent?: number;
}
export interface PaymentsSheet {
    timestamp: string;
    uniqueNo: string; // Auto-generated
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
    rowIndex?: number;
}
