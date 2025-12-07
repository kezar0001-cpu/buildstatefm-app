import { z } from 'zod';

export const unitSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required').trim(),
  floor: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || !isNaN(val), {
      message: 'Must be a valid number',
    }),
  bedrooms: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || !isNaN(val), {
      message: 'Must be a valid number',
    }),
  bathrooms: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || !isNaN(val), {
      message: 'Must be a valid number',
    }),
  area: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      // Fix: Convert to integer to match backend schema (Int type)
      return isNaN(num) ? null : Math.round(num);
    })
    .refine((val) => val === null || !isNaN(val), {
      message: 'Must be a valid number',
    }),
  rentAmount: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || !isNaN(val), {
      message: 'Must be a valid number',
    }),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'VACANT']).default('AVAILABLE'),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
});

export const unitDefaultValues = {
  unitNumber: '',
  floor: '',
  bedrooms: '',
  bathrooms: '',
  area: '',
  rentAmount: '',
  status: 'AVAILABLE',
  description: '',
  imageUrl: '',
};
