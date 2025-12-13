# Filter Structure Guide

## Overview

The filter structure has been refactored to provide a clean, reusable, and maintainable approach to handling filters, search, and view modes across list pages.

## Components

### FilterBar Component

A reusable, responsive filter bar component that handles:
- Search input with debouncing
- Multiple filter types (select, text, date, checkbox)
- View mode toggle (grid, list, table, kanban)
- Mobile-responsive collapsible filters
- Active filter count display

**Location:** `frontend/src/components/FilterBar.jsx`

#### Usage Example

```jsx
import FilterBar from '../components/FilterBar';
import { useFilterState } from '../hooks/useFilterState';
import { useViewMode } from '../hooks/useViewMode';

function MyPage() {
  const {
    filters,
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    setFilter,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
  } = useFilterState({
    initialFilters: { status: '', priority: '' },
  });

  const { viewMode, setViewMode, effectiveViewMode } = useViewMode({
    storageKey: 'mypage-view-mode',
    defaultMode: 'grid',
  });

  const filterConfig = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      minWidth: 150,
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      minWidth: 150,
      options: [
        { value: '', label: 'All' },
        { value: 'HIGH', label: 'High' },
        { value: 'LOW', label: 'Low' },
      ],
    },
    {
      key: 'archived',
      label: 'Show Archived',
      type: 'checkbox',
    },
  ];

  return (
    <Container>
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onSearchClear={() => setSearchTerm('')}
        filters={filterConfig}
        filterValues={filters}
        onFilterChange={(key, value) => setFilter(key, value)}
        onClearFilters={clearFilters}
        viewMode={viewMode}
        onViewModeChange={(_, newMode) => newMode && setViewMode(newMode)}
        searchPlaceholder="Search items..."
        showViewToggle={true}
        viewModes={['grid', 'list', 'table']}
      />

      {/* Your content here */}
    </Container>
  );
}
```

## Hooks

### useFilterState Hook

Manages filter state with URL synchronization for bookmarking and sharing.

**Location:** `frontend/src/hooks/useFilterState.js`

**Features:**
- URL parameter synchronization
- Search term debouncing
- Active filter counting
- Clear all filters functionality
- Persistent state across navigation

**API:**

```javascript
const {
  filters,              // Current filter values object
  searchTerm,           // Current search input
  debouncedSearchTerm,  // Debounced search term (for API calls)
  setSearchTerm,        // Update search term
  setFilter,            // Update single filter
  setFilters,           // Update multiple filters
  clearFilters,         // Clear all filters
  activeFilterCount,    // Number of active filters
  hasActiveFilters,     // Boolean: any filters active?
} = useFilterState({
  initialFilters: { status: '', priority: '' },
  searchParamKey: 'search',
  debounceMs: 300,
});
```

### useViewMode Hook

Manages view mode preference with localStorage persistence.

**Location:** `frontend/src/hooks/useViewMode.js`

**Features:**
- localStorage persistence
- Mobile device detection
- Automatic list view on mobile
- Validation of view modes

**API:**

```javascript
const {
  viewMode,           // Current view mode
  setViewMode,        // Update view mode
  isMobile,           // Is device mobile?
  effectiveViewMode,  // Actual view mode (respects mobile)
} = useViewMode({
  storageKey: 'mypage-view-mode',
  defaultMode: 'grid',
  validModes: ['grid', 'list', 'table'],
  forceListOnMobile: true,
});
```

## Filter Configuration

Filters are defined as an array of configuration objects:

```javascript
const filterConfig = [
  {
    key: 'status',              // Unique identifier
    label: 'Status',            // Display label
    type: 'select',             // 'select', 'text', 'date', 'checkbox'
    minWidth: 150,              // Optional: minimum width
    options: [                  // For select/dropdown types
      { value: '', label: 'All' },
      { value: 'ACTIVE', label: 'Active' },
    ],
  },
  {
    key: 'dateFrom',
    label: 'From',
    type: 'date',
    minWidth: 140,
  },
  {
    key: 'archived',
    label: 'Show Archived',
    type: 'checkbox',
  },
];
```

## Migration Guide

### Before (Old Pattern)

```jsx
// Scattered state management
const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState('');
const [priorityFilter, setPriorityFilter] = useState('');
const [viewMode, setViewMode] = useState('grid');
const [filtersExpanded, setFiltersExpanded] = useState(false);

// Debounce logic repeated
useEffect(() => {
  const timeoutId = setTimeout(() => {
    setDebouncedSearchTerm(searchTerm);
  }, 300);
  return () => clearTimeout(timeoutId);
}, [searchTerm]);

// Filter UI repeated on every page
<TextField
  placeholder="Search..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  // ... more props
/>
<FormControl>
  <InputLabel>Status</InputLabel>
  <Select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
  >
    {/* options */}
  </Select>
</FormControl>
// ... more filters
```

### After (New Pattern)

```jsx
import FilterBar from '../components/FilterBar';
import { useFilterState } from '../hooks/useFilterState';
import { useViewMode } from '../hooks/useViewMode';

function MyPage() {
  const { filters, searchTerm, setSearchTerm, setFilter, clearFilters } = 
    useFilterState({
      initialFilters: { status: '', priority: '' },
    });

  const { viewMode, setViewMode, effectiveViewMode } = useViewMode({
    storageKey: 'mypage-view-mode',
  });

  const filterConfig = [
    { key: 'status', label: 'Status', type: 'select', options: [...] },
    { key: 'priority', label: 'Priority', type: 'select', options: [...] },
  ];

  return (
    <FilterBar
      searchValue={searchTerm}
      onSearchChange={(e) => setSearchTerm(e.target.value)}
      onSearchClear={() => setSearchTerm('')}
      filters={filterConfig}
      filterValues={filters}
      onFilterChange={setFilter}
      onClearFilters={clearFilters}
      viewMode={viewMode}
      onViewModeChange={(_, newMode) => newMode && setViewMode(newMode)}
    />
  );
}
```

## Benefits

1. **DRY (Don't Repeat Yourself)**
   - Filter UI code is centralized
   - Consistent behavior across all pages
   - Reduced code duplication

2. **Maintainability**
   - Single source of truth for filter logic
   - Easy to update filter behavior globally
   - Clear separation of concerns

3. **User Experience**
   - Consistent filter behavior across pages
   - URL synchronization for bookmarking
   - Mobile-responsive design
   - Smooth animations and transitions

4. **Developer Experience**
   - Simple, intuitive API
   - Well-documented components
   - Easy to extend with new filter types
   - TypeScript-ready structure

## Best Practices

### 1. Use Debounced Search for API Calls

```javascript
// Use debouncedSearchTerm for API queries, not searchTerm
const { data } = useQuery({
  queryKey: ['items', debouncedSearchTerm, filters],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    // ... build query
  },
});
```

### 2. Calculate Active Filter Count

```javascript
// FilterBar automatically calculates this, but you can also use it:
const hasActiveFilters = activeFilterCount > 0 || !!debouncedSearchTerm;
```

### 3. Clear Filters Properly

```javascript
// Always use the clearFilters function from useFilterState
const handleClearFilters = () => {
  clearFilters(); // Clears both filters and search
};
```

### 4. Persist View Mode

```javascript
// useViewMode automatically handles localStorage
// Just use the hook and it works!
const { viewMode, setViewMode } = useViewMode({
  storageKey: 'mypage-view-mode',
});
```

### 5. Handle Mobile Responsiveness

```javascript
// useViewMode automatically forces list view on mobile
const { effectiveViewMode } = useViewMode({
  storageKey: 'mypage-view-mode',
  forceListOnMobile: true, // Automatic on mobile
});

// Use effectiveViewMode for rendering, not viewMode
{effectiveViewMode === 'grid' && <GridView />}
{effectiveViewMode === 'list' && <ListView />}
```

## Extending FilterBar

### Adding New Filter Types

To add a new filter type, extend the `renderFilterControl` function in `FilterBar.jsx`:

```javascript
if (filter.type === 'custom') {
  return (
    <CustomFilterComponent
      key={filter.key}
      value={filterValues[filter.key]}
      onChange={(value) => onFilterChange(filter.key, value)}
      {...filter.customProps}
    />
  );
}
```

### Custom View Mode Icons

```javascript
<FilterBar
  // ... other props
  viewModeIcons={{
    grid: <CustomGridIcon />,
    list: <CustomListIcon />,
    kanban: <CustomKanbanIcon />,
  }}
/>
```

## Troubleshooting

### Filters Not Persisting to URL

Ensure you're using `setFilter` or `setFilters` from `useFilterState`:

```javascript
// ✅ Correct
const { setFilter } = useFilterState({ initialFilters: {...} });
onFilterChange={(key, value) => setFilter(key, value)}

// ❌ Wrong
const [filters, setFilters] = useState({});
onFilterChange={(key, value) => setFilters(prev => ({...prev, [key]: value}))}
```

### View Mode Not Persisting

Ensure `storageKey` is unique per page:

```javascript
// ✅ Correct - unique keys
useViewMode({ storageKey: 'properties-view-mode' })
useViewMode({ storageKey: 'jobs-view-mode' })

// ❌ Wrong - same key
useViewMode({ storageKey: 'view-mode' })
useViewMode({ storageKey: 'view-mode' })
```

### Mobile View Not Forcing List

Ensure `forceListOnMobile` is true (default):

```javascript
// ✅ Correct
useViewMode({
  storageKey: 'mypage-view-mode',
  forceListOnMobile: true, // Default
})

// Use effectiveViewMode, not viewMode
{effectiveViewMode === 'list' && <ListView />}
```

## Future Enhancements

- [ ] Advanced filter builder UI
- [ ] Filter presets/saved filters
- [ ] Multi-select filters
- [ ] Range filters (min/max)
- [ ] Custom filter validation
- [ ] Filter analytics/tracking
- [ ] Accessibility improvements
- [ ] Keyboard shortcuts for filters

## Related Files

- `frontend/src/components/FilterBar.jsx` - Main filter component
- `frontend/src/hooks/useFilterState.js` - Filter state management
- `frontend/src/hooks/useViewMode.js` - View mode management
- `frontend/src/pages/PropertiesPage.jsx` - Example implementation
- `frontend/src/pages/InspectionsPage.jsx` - Example implementation
- `frontend/src/pages/JobsPage.jsx` - Example implementation
