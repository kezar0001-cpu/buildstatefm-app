import { z } from 'zod';

export const inspectionSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  type: z.enum(['ROUTINE', 'MOVE_IN', 'MOVE_OUT', 'EMERGENCY', 'COMPLIANCE']).default('ROUTINE'),
  scheduledDate: z
    .union([z.string(), z.date()])
    .refine((val) => val && val !== '', {
      message: 'Scheduled date is required',
    }),
  propertyId: z.string().min(1, 'Property is required'),
  unitId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  tags: z.array(z.string()).default([]),
  templateId: z.string().optional().nullable(),
});

export const inspectionDefaultValues = {
  title: '',
  type: 'ROUTINE',
  scheduledDate: '',
  propertyId: '',
  unitId: '',
  assignedToId: '',
  notes: '',
  tags: [],
  templateId: '',
};
