# Dispensax - Design Guidelines

## Design Approach
**Reference-Based Approach**: Enterprise dashboard inspired by Linear, Notion, and modern SaaS applications, with the specific aesthetic and color palette from the provided screenshot. This is a utility-focused, data-rich enterprise application requiring clarity, hierarchy, and efficient information display.

## Color Palette
Based on the provided screenshot, use these exact colors for branding consistency:
- Primary Blue: `#2F6FED`
- Dark/Black: `#1D1D1D`
- Purple Accent: `#8E59FF`
- Success Green: `#4ECB71`
- Orange/Red Accent: `#FF6B3D`
- Background: `#F7F8FA` (light mode), `#0F0F0F` (dark mode)
- Card backgrounds: White (light), `#1A1A1A` (dark)

## Typography
- **Headings**: Inter font family (700 weight for h1/h2, 600 for h3/h4)
  - h1: 2rem (32px)
  - h2: 1.5rem (24px)
  - h3: 1.25rem (20px)
- **Body**: Inter (400 regular, 500 medium for emphasis)
  - Base: 0.875rem (14px)
  - Small: 0.75rem (12px)
- **Data/Numbers**: Tabular numbers enabled, 600 weight for emphasis

## Layout System
**Spacing**: Use Tailwind units 2, 4, 6, 8, 12, 16 for consistent rhythm
- Component padding: `p-6` or `p-8`
- Section spacing: `space-y-6` or `space-y-8`
- Card gaps: `gap-4` or `gap-6`
- Page margins: `mx-4 md:mx-6 lg:mx-8`

**Grid Structure**: 
- Sidebar: Fixed 240px width (`w-60`)
- Main content: Fluid with max-width container (`max-w-7xl`)
- Dashboard cards: 3-column grid on desktop (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)

## Core Components

### Navigation Sidebar
- Fixed left sidebar with app logo at top
- Grouped navigation items by module (collapsible sections)
- Active state with accent border-left and background fill
- Icon + label for each menu item (Heroicons)
- User profile section at bottom with avatar, name, role, logout

### Dashboard Cards (Project/Machine Style)
- Rounded corners (`rounded-xl`)
- Colored left border (4px, using palette colors)
- Padding `p-6`
- Title (font-semibold, text-base)
- Metadata row with icons (location, status, last visit)
- Progress bar or stats section
- Action button/link in bottom-right
- Hover: subtle elevation (`hover:shadow-lg transition-shadow`)

### Data Tables
- Alternating row backgrounds for readability
- Sticky header with sort indicators
- Action column on right with icon buttons
- Status badges (pill-shaped, colored backgrounds)
- Pagination at bottom-right
- Search/filter bar above table

### Forms
- Grouped sections with clear labels above inputs
- Input height: `h-11`
- Border radius: `rounded-lg`
- Focus state: accent color ring
- Helper text below inputs (text-sm)
- Primary action button (filled), secondary (outline)

### Stats Cards
- Grid layout for KPIs (2x2 or 3-across)
- Large number display (text-3xl, font-bold)
- Label below (text-sm, muted)
- Trend indicator (arrow icon + percentage)
- Icon in top-right corner

### Charts & Visualizations
- Use Chart.js for consistency
- Match color palette for data series
- Grid lines: subtle, muted colors
- Tooltips on hover with detailed info
- Legend positioned top-right or bottom

### Modal Dialogs
- Centered overlay with backdrop (`bg-black/50`)
- Max-width 2xl for forms, smaller for confirmations
- Header with title and close button
- Footer with actions (right-aligned)
- Padding: `p-6` or `p-8`

### Toast Notifications
- Top-right positioning
- Color-coded by type (success green, error red, info blue)
- Auto-dismiss after 5 seconds
- Slide-in animation from right

### Filters & Search
- Horizontal filter bar with dropdowns and search
- Clear all filters button
- Active filter pills/badges below bar
- Real-time search (debounced)

## Module-Specific Patterns

### Machine Detail View
- Split layout: 60% main content (inventory, sales charts) / 40% sidebar (alerts, maintenance history)
- Alert cards with colored icons and priority levels
- Timeline component for maintenance history

### Route Planning (Abastecedor)
- Map view integration area (placeholder for Google Maps)
- List view toggle
- Machine cards with route order number
- Start/stop service buttons (large, prominent)
- Timer display during active service

### Inventory Management
- Product cards in grid with thumbnail, name, quantity, expiry
- Low stock highlighting (amber background)
- Batch/lot information in expandable sections
- Barcode scanner integration UI (camera icon button)

### Reports Dashboard
- Date range picker at top
- Export buttons (CSV, PDF)
- Large metric cards above detailed tables
- Comparison view (current vs previous period)

## Responsive Behavior
- **Mobile (< 768px)**: Sidebar collapses to hamburger menu, cards stack vertically, tables scroll horizontally, reduce padding to `p-4`
- **Tablet (768-1024px)**: 2-column card grids, sidebar remains visible, maintain spacing
- **Desktop (> 1024px)**: Full 3-column layouts, fixed sidebar, optimal spacing

## Interaction Patterns
- Loading states: Skeleton screens for tables/cards
- Empty states: Centered icon + message + CTA
- Error states: Alert banner at page top with retry action
- Confirmation dialogs before destructive actions
- Inline validation for forms (real-time feedback)

## Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation with visible focus states
- High contrast mode support
- Form labels properly associated
- Error messages linked to inputs