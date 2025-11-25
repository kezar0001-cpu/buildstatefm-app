/**
 * Standardized View Icons for Layout Toggles
 *
 * This file defines the standard icons to be used across all pages
 * for consistent view/layout switching UI elements.
 *
 * Usage:
 * import { VIEW_ICONS } from '@/constants/viewIcons';
 * <ViewIconComponent /> where ViewIconComponent = VIEW_ICONS.GRID
 */

import {
  ViewModule,
  ViewList,
  TableChart,
  ViewKanban,
  CalendarMonth,
} from '@mui/icons-material';

/**
 * Standard view icons to be used across the application
 */
export const VIEW_ICONS = {
  /**
   * Grid/Card view - displays items in a grid/card layout
   * Used for: Properties (Grid), Jobs (Card), Plans (Card)
   */
  GRID: ViewModule,

  /**
   * List view - displays items in a vertical list
   * Used for: Properties, Inspections, Jobs
   */
  LIST: ViewList,

  /**
   * Table view - displays items in a data table
   * Used for: Properties (Table), Plans (Table)
   */
  TABLE: TableChart,

  /**
   * Kanban view - displays items in kanban columns
   * Used for: Inspections (Kanban), Jobs (Kanban)
   */
  KANBAN: ViewKanban,

  /**
   * Calendar view - displays items in a calendar format
   * Used for: Inspections (Calendar), Jobs (Calendar), Plans (Calendar)
   */
  CALENDAR: CalendarMonth,
};

/**
 * View mode constants for consistent naming
 */
export const VIEW_MODES = {
  GRID: 'grid',
  CARD: 'card', // Alias for GRID
  LIST: 'list',
  TABLE: 'table',
  KANBAN: 'kanban',
  CALENDAR: 'calendar',
};

/**
 * Helper function to get the appropriate icon component for a view mode
 * @param {string} viewMode - The view mode (grid, list, table, kanban, calendar)
 * @returns {React.Component} The icon component
 */
export const getViewIcon = (viewMode) => {
  const mode = viewMode.toLowerCase();

  switch (mode) {
    case VIEW_MODES.GRID:
    case VIEW_MODES.CARD:
      return VIEW_ICONS.GRID;
    case VIEW_MODES.LIST:
      return VIEW_ICONS.LIST;
    case VIEW_MODES.TABLE:
      return VIEW_ICONS.TABLE;
    case VIEW_MODES.KANBAN:
      return VIEW_ICONS.KANBAN;
    case VIEW_MODES.CALENDAR:
      return VIEW_ICONS.CALENDAR;
    default:
      return VIEW_ICONS.GRID; // Default fallback
  }
};
