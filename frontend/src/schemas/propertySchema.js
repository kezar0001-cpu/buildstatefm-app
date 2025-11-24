import { z } from 'zod';
import { PROPERTY_STATUS_VALUES } from '../constants/propertyStatus';

const currentYear = new Date().getFullYear();

export const propertySchema = z.object({
  name: z.string().min(1, 'Property name is required').trim(),
  address: z.string().min(1, 'Address is required').trim(),
  city: z.string().min(1, 'City / locality is required').trim(),
  state: z.string().trim().optional().nullable(),
  zipCode: z.string().trim().optional().nullable(),
  country: z.string().min(1, 'Country is required'),
  propertyType: z.string().min(1, 'Property type is required'),
  yearBuilt: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 1800 && val <= currentYear), {
      message: `Year must be between 1800 and ${currentYear}`,
    }),
  totalArea: z
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
  status: z.enum(PROPERTY_STATUS_VALUES).default('ACTIVE'),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  // Bug Fix: Add validation for financial fields
  lotSize: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'Lot size must be positive',
    }),
  buildingSize: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'Building size must be positive',
    }),
  numberOfFloors: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val > 0 && val <= 200), {
      message: 'Number of floors must be between 1 and 200',
    }),
  constructionType: z.string().trim().optional().nullable(),
  heatingSystem: z.string().trim().optional().nullable(),
  coolingSystem: z.string().trim().optional().nullable(),
  amenities: z.any().optional().nullable(),
  purchasePrice: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'Purchase price must be positive',
    }),
  purchaseDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
  currentMarketValue: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'Market value must be positive',
    }),
  annualPropertyTax: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'Property tax must be positive',
    }),
  annualInsurance: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'Insurance cost must be positive',
    }),
  monthlyHOA: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || (val >= 0), {
      message: 'HOA fees must be positive',
    }),
});

export const propertyDefaultValues = {
  name: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  propertyType: '',
  yearBuilt: '',
  totalArea: '',
  status: 'ACTIVE',
  description: '',
  imageUrl: '',
  // Bug Fix: Add default values for enhanced fields
  lotSize: '',
  buildingSize: '',
  numberOfFloors: '',
  constructionType: '',
  heatingSystem: '',
  coolingSystem: '',
  amenities: null,
  purchasePrice: '',
  purchaseDate: null,
  currentMarketValue: '',
  annualPropertyTax: '',
  annualInsurance: '',
  monthlyHOA: '',
};

export const DOCUMENT_CATEGORIES = [
  { value: 'LEASE_AGREEMENT', label: 'Lease Agreement' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'PERMIT', label: 'Permit' },
  { value: 'INSPECTION_REPORT', label: 'Inspection Report' },
  { value: 'MAINTENANCE_RECORD', label: 'Maintenance Record' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'PHOTOS', label: 'Photos' },
  { value: 'OTHER', label: 'Other' },
];

export const DOCUMENT_ACCESS_LEVELS = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'PROPERTY_MANAGER', label: 'Property Manager' },
];
