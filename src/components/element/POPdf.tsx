import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 24,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#1f2937',
    },
    mainContainer: {
        border: '1 solid #374151',
        borderRadius: 2,
    },
    headerContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#f8fafc',
        borderBottom: '1 solid #374151',
        alignItems: 'center',
    },
    logoContainer: {
        width: '25%',
    },
    logo: {
        width: 100,
        height: 60,
        objectFit: 'contain',
    },
    companyInfo: {
        width: '75%',
        textAlign: 'right',
    },
    companyName: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    companyText: {
        fontSize: 9,
        color: '#475569',
        marginBottom: 2,
    },
    titleSection: {
        backgroundColor: '#e2e8f0',
        padding: 8,
        borderBottom: '1 solid #374151',
    },
    titleText: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 2,
        color: '#0f172a',
    },
    splitSection: {
        flexDirection: 'row',
        borderBottom: '1 solid #374151',
    },
    leftCol: {
        width: '50%',
        padding: 12,
        borderRight: '1 solid #374151',
    },
    rightCol: {
        width: '50%',
        padding: 12,
        backgroundColor: '#fafafa',
    },
    sectionHeading: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: '#334155',
        marginBottom: 6,
        textTransform: 'uppercase',
        borderBottom: '1 solid #cbd5e1',
        paddingBottom: 2,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    infoLabel: {
        width: '40%',
        color: '#64748b',
        fontSize: 8.5,
    },
    infoValue: {
        width: '60%',
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        fontSize: 9,
    },
    commercialSection: {
        flexDirection: 'row',
        borderBottom: '1 solid #374151',
        backgroundColor: '#f8fafc',
    },
    commercialBox: {
        width: '33.33%',
        padding: 10,
        borderRight: '1 solid #374151',
    },
    commercialBoxLast: {
        width: '33.33%',
        padding: 10,
    },
    commercialLabel: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: '#334155',
        marginBottom: 2,
    },
    commercialValue: {
        fontSize: 8.5,
        color: '#475569',
        lineHeight: 1.3,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderBottom: '1 solid #374151',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e2e8f0',
    },
    tableHeaderCell: {
        padding: 6,
        fontFamily: 'Helvetica-Bold',
        fontSize: 8.5,
        color: '#334155',
    },
    tableCell: {
        padding: 6,
        fontSize: 8.5,
        color: '#1e293b',
    },
    // Widths
    w1: { width: '5%', borderRight: '1 solid #cbd5e1' },
    w2: { width: '12%', borderRight: '1 solid #cbd5e1' },
    w3: { width: '15%', borderRight: '1 solid #cbd5e1' },
    w4: { width: '22%', borderRight: '1 solid #cbd5e1' },
    w5: { width: '7%', borderRight: '1 solid #cbd5e1', textAlign: 'right' },
    w6: { width: '7%', borderRight: '1 solid #cbd5e1', textAlign: 'center' },
    w7: { width: '8%', borderRight: '1 solid #cbd5e1', textAlign: 'right' },
    w8: { width: '6%', borderRight: '1 solid #cbd5e1', textAlign: 'right' },
    w9: { width: '6%', borderRight: '1 solid #cbd5e1', textAlign: 'right' },
    w10: { width: '12%', textAlign: 'right' },

    totalsSection: {
        flexDirection: 'row',
        borderBottom: '1 solid #374151',
        borderTop: '1 solid #374151',
    },
    spacerBox: {
        width: '74%',
        padding: 10,
        borderRight: '1 solid #374151',
    },
    totalsBox: {
        width: '26%',
    },
    totalRow: {
        flexDirection: 'row',
        padding: '6 8',
        borderBottom: '1 solid #e2e8f0',
        justifyContent: 'space-between',
    },
    totalLabel: {
        color: '#475569',
        fontFamily: 'Helvetica-Bold',
    },
    totalValue: {
        fontFamily: 'Helvetica-Bold',
    },
    grandTotalRow: {
        flexDirection: 'row',
        padding: '8',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
    },
    grandTotalLabel: {
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        fontSize: 10,
    },
    termsDescriptionContainer: {
        padding: 12,
        borderBottom: '1 solid #374151',
    },
    termsHeader: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 6,
        textDecoration: 'underline',
    },
    termItem: {
        marginBottom: 3,
        fontSize: 8.5,
        flexDirection: 'row',
    },
    descriptionContainer: {
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1 dashed #cbd5e1',
    },
    ackContainer: {
        padding: 8,
        backgroundColor: '#f8fafc',
        borderBottom: '1 solid #374151',
    },
    ackText: {
        fontSize: 8,
        color: '#64748b',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    signaturesSection: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 40,
        paddingBottom: 20,
    },
    signatureBlock: {
        width: '25%',
        alignItems: 'center',
    },
    signatureLine: {
        width: '100%',
        borderTop: '1 solid #374151',
        paddingTop: 4,
        textAlign: 'center',
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
    },
    signatureName: {
        fontSize: 8,
        color: '#64748b',
        marginTop: 2,
    }
});

interface Item {
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    packaging?: number;
    forwarding?: number;
    packagingAndForwarding?: number;
    gst: number;
    discount: number;
    amount: number;
    quotationNumber: string;
}

export interface POPdfProps {
    companyName: string;
    companyPhone: string;
    companyGstin: string;
    companyPan: string;
    companyAddress: string;
    billingAddress: string;
    destinationAddress: string;
    supplierName: string;
    supplierAddress: string;
    supplierGstin: string;
    orderNumber: string;
    orderDate: string;
    deliveryDate: string;
    description: string;
    items: Item[];
    total: number;
    gstAmount: number;
    packaging?: number;
    forwarding?: number;
    packagingAndForwarding?: number;
    grandTotal: number;
    terms: string[];
    preparedBy: string;
    approvedBy: string;
    paymentTerms?: string;
    numberOfDays?: number;
    logo?: string;
}

export default ({
    companyName,
    companyPhone,
    companyGstin,
    companyPan,
    companyAddress,
    billingAddress,
    destinationAddress,
    supplierName,
    supplierAddress,
    supplierGstin,
    orderNumber,
    orderDate,
    deliveryDate,
    description,
    items,
    total,
    gstAmount,
    grandTotal,
    terms,
    preparedBy,
    approvedBy,
    paymentTerms,
    numberOfDays,
    logo,
}: POPdfProps) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.mainContainer}>

                    {/* Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.logoContainer}>
                            {logo && <Image src={logo} style={styles.logo} />}
                        </View>
                        <View style={styles.companyInfo}>
                            <Text style={styles.companyName}>{companyName}</Text>
                            <Text style={styles.companyText}>{companyAddress}</Text>
                            <Text style={styles.companyText}>Office M: {companyPhone}</Text>
                        </View>
                    </View>

                    {/* Title */}
                    <View style={styles.titleSection}>
                        <Text style={styles.titleText}>Purchase Order</Text>
                    </View>

                    {/* Metadata Split */}
                    <View style={styles.splitSection}>
                        <View style={styles.leftCol}>
                            <Text style={styles.sectionHeading}>Supplier Details</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Name:</Text>
                                <Text style={styles.infoValue}>{supplierName}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Address:</Text>
                                <Text style={styles.infoValue}>{supplierAddress}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>GSTIN:</Text>
                                <Text style={styles.infoValue}>{supplierGstin || 'N/A'}</Text>
                            </View>
                        </View>
                        <View style={styles.rightCol}>
                            <Text style={styles.sectionHeading}>Order Details</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>PO Number:</Text>
                                <Text style={styles.infoValue}>{orderNumber}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>PO Date:</Text>
                                <Text style={styles.infoValue}>{orderDate}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Delivery Date:</Text>
                                <Text style={styles.infoValue}>{deliveryDate}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Commercial Info */}
                    <View style={styles.commercialSection}>
                        <View style={styles.commercialBox}>
                            <Text style={styles.commercialLabel}>Our Commercial Details</Text>
                            <Text style={styles.commercialValue}>GSTIN: {companyGstin}</Text>
                            <Text style={styles.commercialValue}>PAN: {companyPan}</Text>
                        </View>
                        <View style={styles.commercialBox}>
                            <Text style={styles.commercialLabel}>Billing Address</Text>
                            <Text style={styles.commercialValue}>{billingAddress}</Text>
                        </View>
                        <View style={styles.commercialBoxLast}>
                            <Text style={styles.commercialLabel}>Destination Address</Text>
                            <Text style={styles.commercialValue}>{destinationAddress}</Text>
                        </View>
                    </View>

                    {/* Items Table */}
                    <View>
                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { width: '4%', borderRight: '1 solid #cbd5e1' }]}>S/N</Text>
                            <Text style={[styles.tableHeaderCell, { width: '10%', borderRight: '1 solid #cbd5e1' }]}>Int. Code</Text>
                            <Text style={[styles.tableHeaderCell, { width: '10%', borderRight: '1 solid #cbd5e1' }]}>Q. No.</Text>
                            <Text style={[styles.tableHeaderCell, { width: '13%', borderRight: '1 solid #cbd5e1' }]}>Product</Text>
                            <Text style={[styles.tableHeaderCell, { width: '14%', borderRight: '1 solid #cbd5e1' }]}>Description</Text>
                            <Text style={[styles.tableHeaderCell, { width: '6%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>Qty</Text>
                            <Text style={[styles.tableHeaderCell, { width: '6%', borderRight: '1 solid #cbd5e1', textAlign: 'center' }]}>Unit</Text>
                            <Text style={[styles.tableHeaderCell, { width: '7%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>Rate</Text>
                            <Text style={[styles.tableHeaderCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>Pkg</Text>
                            <Text style={[styles.tableHeaderCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>Fwd</Text>
                            <Text style={[styles.tableHeaderCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>GST</Text>
                            <Text style={[styles.tableHeaderCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>Disc</Text>
                            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>Amount</Text>
                        </View>

                        {items.map((item, i) => (
                            <View style={styles.tableRow} key={i}>
                                <Text style={[styles.tableCell, { width: '4%', borderRight: '1 solid #cbd5e1' }]}>{i + 1}</Text>
                                <Text style={[styles.tableCell, { width: '10%', borderRight: '1 solid #cbd5e1' }]}>{item.internalCode}</Text>
                                <Text style={[styles.tableCell, { width: '10%', borderRight: '1 solid #cbd5e1' }]}>{item.quotationNumber}</Text>
                                <Text style={[styles.tableCell, { width: '13%', borderRight: '1 solid #cbd5e1' }]}>{item.product}</Text>
                                <Text style={[styles.tableCell, { width: '14%', borderRight: '1 solid #cbd5e1' }]}>{item.description}</Text>
                                <Text style={[styles.tableCell, { width: '6%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>{item.quantity}</Text>
                                <Text style={[styles.tableCell, { width: '6%', borderRight: '1 solid #cbd5e1', textAlign: 'center' }]}>{item.unit}</Text>
                                <Text style={[styles.tableCell, { width: '7%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>{item.rate}</Text>
                                <Text style={[styles.tableCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>{item.packaging || 0}</Text>
                                <Text style={[styles.tableCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>{item.forwarding || 0}</Text>
                                <Text style={[styles.tableCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>{item.gst}%</Text>
                                <Text style={[styles.tableCell, { width: '5%', borderRight: '1 solid #cbd5e1', textAlign: 'right' }]}>{item.discount}%</Text>
                                <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>{item.amount}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Totals Section */}
                    <View style={styles.totalsSection}>
                        <View style={styles.spacerBox}></View>
                        <View style={styles.totalsBox}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Subtotal</Text>
                                <Text style={styles.totalValue}>{total}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>GST Amount</Text>
                                <Text style={styles.totalValue}>{gstAmount}</Text>
                            </View>
                            <View style={styles.grandTotalRow}>
                                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                                <Text style={styles.grandTotalLabel}>{grandTotal}</Text>
                            </View>
                            {(paymentTerms?.toLowerCase().includes('partly') && (paymentTerms?.toLowerCase().includes('advance') || paymentTerms?.toLowerCase().includes('pi'))) && (
                                <View style={[styles.totalRow, { backgroundColor: '#fdf2f2', borderTop: '1 solid #374151' }]}>
                                    <Text style={[styles.totalLabel, { color: '#991b1b' }]}>Advance ({numberOfDays}%)</Text>
                                    <Text style={[styles.totalValue, { color: '#991b1b' }]}>
                                        {((grandTotal * (numberOfDays || 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Payment Terms Section */}
                    {(paymentTerms || numberOfDays !== undefined) && (
                        <View style={{
                            padding: 5,
                            borderBottom: '1 solid #374151',
                            backgroundColor: '#f8fafc',
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingLeft: 12
                        }}>
                            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#334155' }}>Payment Terms : </Text>
                            <Text style={{ fontSize: 9, color: '#475569', marginLeft: 4 }}>
                                {(paymentTerms?.toLowerCase().includes('partly') && (paymentTerms?.toLowerCase().includes('advance') || paymentTerms?.toLowerCase().includes('pi')))
                                    ? `Advance Payment (${numberOfDays}%) of ₹${((grandTotal * (numberOfDays || 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be made.`
                                    : paymentTerms === 'After Delivery'
                                        ? `Payment will be made ${numberOfDays} days after delivery.`
                                        : paymentTerms || 'N/A'}
                            </Text>
                        </View>
                    )}

                    {/* Terms & Description */}
                    <View style={styles.termsDescriptionContainer}>
                        {terms && terms.length > 0 && (
                            <View>
                                <Text style={styles.termsHeader}>The Above</Text>
                                {terms.map((term, i) => (
                                    <View style={styles.termItem} key={i}>
                                        <Text style={{ width: '3%' }}>{i + 1}.</Text>
                                        <Text style={{ width: '97%' }}>{term}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {description && (
                            <View style={styles.descriptionContainer}>
                                <Text style={styles.termsHeader}>Description / Remarks</Text>
                                {description.split('\n').map((line, index) => (
                                    <Text style={{ fontSize: 8.5, marginBottom: 2 }} key={index}>
                                        {line}
                                    </Text>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Ack */}
                    <View style={styles.ackContainer}>
                        <Text style={styles.ackText}>
                            Kindly acknowledge receipt of this Purchase Order along with its enclosures &amp; ensure timely execution.
                        </Text>
                    </View>

                    {/* Signatures */}
                    <View style={styles.signaturesSection}>
                        <View style={styles.signatureBlock}>
                            <Text style={styles.signatureLine}>Prepared By</Text>
                            <Text style={styles.signatureName}>{preparedBy || 'System'}</Text>
                        </View>
                        <View style={styles.signatureBlock}>
                            <Text style={styles.signatureLine}>Approved By</Text>
                            <Text style={styles.signatureName}>{approvedBy || 'Management'}</Text>
                        </View>
                        <View style={styles.signatureBlock}>
                            <Text style={styles.signatureLine}>For {companyName}</Text>
                            <Text style={styles.signatureName}>Authorized Signatory</Text>
                        </View>
                    </View>

                </View>
            </Page>
        </Document>
    );
};
