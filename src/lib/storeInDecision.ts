import { z } from 'zod';

export const storeInDecisionSchema = z.object({
    items: z.array(z.object({
        id: z.number().int().positive(),
        status: z.enum(['Received', 'Not Received', ''], { required_error: 'Select Received or Rejected' }).refine((value): boolean => value !== '', 'Select Received or Rejected'),
        remark: z.string().trim().max(1000, 'Keep remarks under 1,000 characters'),
    })).min(1, 'Select at least one item'),
}).superRefine((values, context) => {
    const seen = new Set<number>();
    values.items.forEach((item, index) => {
        if (seen.has(item.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'id'], message: 'Item selected twice' });
        seen.add(item.id);
        if (item.status === 'Not Received' && !item.remark) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'remark'], message: 'Remarks are required for rejected items' });
        }
    });
});

export type StoreInDecisions = z.infer<typeof storeInDecisionSchema>;

export async function submitStoreInSelection(
    values: StoreInDecisions,
    pendingIds: number[],
    at: string,
    save: (id: number, update: ReturnType<typeof storeInDecisionUpdate>) => Promise<void>,
) {
    const selection = storeInDecisionSchema.parse(values);
    if (selection.items.some(item => !pendingIds.includes(item.id))) throw new Error('Selected items changed. Reopen this shipment.');
    for (const item of selection.items) {
        await save(item.id, storeInDecisionUpdate(item, at));
    }
}

export function storeInDecisionUpdate(item: StoreInDecisions['items'][number], at: string) {
    if (!['Received', 'Not Received'].includes(item.status)) throw new Error('Select Received or Rejected');
    const rejected = item.status === 'Not Received';
    return {
        actual6: at,
        receiving_status: item.status,
        remark: item.remark,
        planned7: rejected ? at : null,
        hod_planned: rejected ? null : at,
        hod_status: rejected ? 'Rejected' : 'Pending',
        hod_actual: rejected ? at : null,
    };
}
