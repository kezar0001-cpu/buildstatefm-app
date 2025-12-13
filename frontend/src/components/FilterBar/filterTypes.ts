export type FilterFieldType = 'select' | 'text' | 'date' | 'checkbox';

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterFieldConfig = {
  key: string;
  label: string;
  type: FilterFieldType;
  options?: FilterOption[];
  placeholder?: string;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Primary filters render inline on desktop.
   * Non-primary filters render in the desktop "More filters" popover.
   */
  primary?: boolean;
};

export type FilterValueMap = Record<string, any>;
