# Dispensax - Sistema de Gestión de Máquinas Expendedoras (Multi-Tenant SaaS)

## Overview
Dispensax is a multi-tenant SaaS platform for managing beverage vending machines, providing data isolation for multiple client companies and a Super Administrator role. It operates in the Dominican Republic, handling monetary values in RD$ and standardizing to GMT-4. The platform manages machines, inventory, sales, and personnel with robust role-based access control across 12 operational modules, targeting companies with 25 to hundreds of machines.

## User Preferences
- Idioma: Español
- Color primario: #E84545 (rojo Dispensax)
- Diseño basado en el screenshot proporcionado (estilo dashboard moderno)
- Tarjetas coloridas para máquinas
- Todos los formularios usan React Hook Form + Zod
- Todos los endpoints validan con Zod

## System Architecture
The application uses a client-server architecture with a React, TypeScript, Vite frontend (Tailwind CSS, shadcn/ui, Recharts, React Hook Form + Zod, TanStack Query, Wouter) and an Express.js, Node.js backend interacting with PostgreSQL.

**Key Architectural Decisions & Features:**
- **Multi-Tenant Architecture:** 4-tier user hierarchy (Super Admin, Admin, Operational, Establishment Viewers) with strict data isolation via `tenantId` and JWT-based context.
- **Modular Design:** Divided into distinct modules (e.g., Dashboard, Machines, Warehouse, Accounting, HR, Fuel, Purchases, Petty Cash, Money & Products, Work Orders, Settings).
- **Responsive UI/UX:** Modern dashboard aesthetic with `shadcn/ui` for consistent components, supporting light/dark themes.
- **Data Visualization:** Uses Recharts for financial, operational, and inventory data.
- **Robust Form Handling:** All forms use React Hook Form and Zod for validation.
- **Centralized Timezone Management:** All date/time operations are standardized to 'America/Santo_Domingo' (GMT-4).
- **Optimized Database Interactions:** Efficient SQL JOINs, query limits, and 23 critical indexes for performance.
- **Comprehensive JWT Authentication:** Access and refresh tokens (HttpOnly cookies) with automatic renewal and RBAC middleware.
- **Granular Permission System (RBAC):** Action-based authorization with a permission matrix for 8 roles across 20+ resources, and frontend conditional UI rendering.
- **Establishment Viewer System:** Read-only access for external establishment owners to sales and commissions, managed via invite.
- **Establishments CRM Pipeline:** Manages establishments through a sales pipeline with follow-ups, document management, and contract management.
- **Enhanced Security (RBAC & Ownership):** `authorizeOwnership` middleware and `getEffectiveUserId` prevent horizontal privilege escalation. Fail-closed zone validation ensures access control.
- **Atomic Inventory Transactions:** Multi-table inventory operations are wrapped in PostgreSQL transactions.
- **Warehouse Module (Kardex):** Manages inventory with weighted average cost, FEFO validation, low stock alerts, and shrinkage recording.
- **Fuel Module:** Tracks fleet vehicles, fuel loads, performance, and costs.
- **Report Optimization:** Improved reporting performance by eliminating N+1 patterns and using parallel data fetching.
- **Plan Limit Validation:** `checkTenantPlanLimits()` enforces `maxMachines` and `maxUsers`.
- **Rate Limiting:** In-memory rate limiter for public and authentication endpoints.
- **Nayax Integration:** HTTP client (`server/nayax.ts`) for Nayax Lynx API for machine, sales, and cashless operations, with per-tenant configuration.
- **Work Orders Module:** Manages work orders and tickets with auto-numbering, configurable SLA, and default checklists.
- **Checklist Item Types:** Checklist items support 6 types (checkbox, single/multi-select, open question, numeric, mandatory photo) with template-based storage and dynamic rendering.
- **Cash Denomination Counting Module:** Facilitates triple-count cash reconciliation for collections using specific RD$ denominations.
- **Change Fund (Fondo de Cambio) Module:** Manages change funds issued to suppliers, tracking status and denominations.
- **Migrations:** Schema changes applied via `npm run db:push --force` using Drizzle ORM, with production idempotent backfills.
- **Layout & Tray Audit Module:** Configurable machine layouts (trays × lanes), visual grid editor, and tracking of lane changes (`lane_change_events`) and per-tray audits (`tray_audits`) during service.
- **Planograms Module:** Pivot table for products × machines, allowing editing `standardQuantity`/`maxCapacity` and bulk updates.
- **Establishment Documents:** Full document management system with client-side validation, progress tracking, server-side `multer` processing, secure object storage integration, and best-effort cleanup on deletion.
- **Cross Reconciliation & Billing Module:** Imports Nayax transactions, performs cross-reconciliation of cash collections (initial fund, Nayax sales, cash movements, physical count, empty lanes), generates exportable reports (CSV, PDF), and provides machine-specific billing data and trend graphs. Ownership-based access control for reconciliation exports.

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
    - SMTP
- **Third-party APIs:**
    - Nayax Lynx API