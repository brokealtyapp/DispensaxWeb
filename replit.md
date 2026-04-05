# Dispensax - Sistema de Gestión de Máquinas Expendedoras (Multi-Tenant SaaS)

## Overview
Dispensax is a multi-tenant SaaS platform designed for managing beverage vending machines. It provides complete data isolation for multiple client companies (tenants) and includes a Super Administrator role for platform-wide management. The system supports operations in the Dominican Republic, handling monetary values in Dominican Pesos (RD$) and standardizing timezone to GMT-4. Key capabilities include managing machines, inventory, sales, and personnel with a robust role-based access control system across 12 operational modules. The platform aims to serve companies with varying numbers of machines, from around 25 to hundreds.

## User Preferences
- Idioma: Español
- Color primario: #E84545 (rojo Dispensax)
- Diseño basado en el screenshot proporcionado (estilo dashboard moderno)
- Tarjetas coloridas para máquinas
- Todos los formularios usan React Hook Form + Zod
- Todos los endpoints validan con Zod

## System Architecture
The application uses a client-server architecture. The frontend is built with React, TypeScript, and Vite, styled with Tailwind CSS and shadcn/ui, and uses Recharts for data visualization, React Hook Form with Zod for forms, TanStack Query for state management, and Wouter for routing. The backend is an Express.js and Node.js API, interacting with a PostgreSQL database.

**Key Architectural Decisions & Features:**
- **Multi-Tenant Architecture:** Features a 4-tier user hierarchy (Super Admin, Admin, Operational Roles, Establishment Viewers) with strict data isolation using `tenantId` across all operational tables. JWT tokens include `tenantId` and `isSuperAdmin` for request-level context, enforced by middleware.
- **Modular Design:** Divided into distinct modules such as Dashboard, Machines, Warehouse, Accounting, HR, Fuel, Purchases, Petty Cash, Money & Products, Work Orders, and Settings.
- **Responsive UI/UX:** Modern dashboard aesthetic with responsive layouts, reusable components, and support for light/dark themes. Utilizes `shadcn/ui` for consistent components.
- **Data Visualization:** Employs Recharts extensively for financial, operational, and inventory data presentation.
- **Robust Form Handling:** All forms use React Hook Form and Zod for validation and consistency.
- **Centralized Timezone Management:** All date/time operations are standardized to 'America/Santo_Domingo' (GMT-4).
- **Optimized Database Interactions:** Utilizes efficient SQL JOINs, query result limits, and 23 critical database indexes for performance.
- **Comprehensive JWT Authentication:** Features access and refresh tokens (HttpOnly cookies), middleware for RBAC, and automatic token renewal.
- **Granular Permission System (RBAC):** Action-based authorization using `authorizeAction(resource, action)` middleware and a permission matrix defined for 8 roles across 20+ resources. Frontend uses `usePermissions()` for conditional UI rendering.
- **Establishment Viewer System:** Allows external users (establishment owners) read-only access to sales and commissions for assigned machines, managed via an invite-based system.
- **Establishments CRM Pipeline:** Manages establishments through a sales pipeline (Prospecto → En Evaluación → En Negociación → Aprobado → Convertido) with follow-ups, document management, and conversion to active locations. Includes contract management (CRUD + renewal) for active establishments.
- **Enhanced Security (RBAC & Ownership):** `authorizeOwnership` middleware and `getEffectiveUserId` prevent horizontal privilege escalation. Fail-closed zone validation ensures users only access machines in their assigned zones.
- **Atomic Inventory Transactions:** All multi-table inventory operations are wrapped in PostgreSQL transactions for data consistency.
- **Warehouse Module (Kardex):** Manages inventory with weighted average cost, movements (Kardex) with FEFO validation, low stock alerts, product/supplier management, and shrinkage recording.
- **Fuel Module:** Tracks fleet vehicles, fuel loads, performance (km/L), and costs.
- **Report Optimization:** Improved reporting performance by eliminating N+1 patterns and using parallel data fetching. Includes product dashboards and CSV exports.
- **Plan Limit Validation:** `checkTenantPlanLimits()` enforces `maxMachines` and `maxUsers` with a 403 response if limits are exceeded.
- **Rate Limiting:** In-memory rate limiter protects public and authentication endpoints.
- **Nayax Integration:** Provides an HTTP client (`server/nayax.ts`) to interact with the Nayax Lynx API for managing machines, sales, and cashless operations, with per-tenant configuration.
- **Work Orders Module:** Manages work orders and tickets with auto-numbering, configurable SLA, default checklists, and various order/ticket types. Features a dedicated frontend interface for management and tracking.
- **Checklist Item Types:** Checklist items support 6 types — checkbox (default), selección única (single choice RadioGroup), selección múltiple (multi-select checkboxes), pregunta abierta (textarea), numérico (number input), foto obligatoria (camera). Templates store `itemType` and `options` (JSONB); executed items store `answer` (text, JSON for multi_select). Non-checkbox types auto-complete when an answer is saved.
- **Cash Denomination Counting Module:** Facilitates triple-count cash reconciliation for collections (machine, delivery, change fund) with specific RD$ denominations.
- **Change Fund (Fondo de Cambio) Module:** Manages change funds issued to suppliers, tracking their status and denominations, ensuring one active fund per supplier.

## External Dependencies
- **Frontend:**
    - React
    - TypeScript
    - Vite
    - Tailwind CSS
    - shadcn/ui
    - Recharts
    - React Hook Form
    - Zod
    - TanStack Query
    - Wouter
- **Backend:**
    - Express.js
    - Node.js
- **Database:**
    - PostgreSQL
- **Authentication:**
    - JSON Web Tokens (JWT)
- **Email Service:**
    - SMTP (for password recovery)
- **Third-party APIs:**
    - Nayax Lynx API (for vending machine integration)