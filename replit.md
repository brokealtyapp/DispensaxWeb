# Dispensax - Sistema de Gestión de Máquinas Expendedoras (Multi-Tenant SaaS)

## Overview
Dispensax is a comprehensive multi-tenant SaaS platform for managing beverage vending machines. It supports multiple companies (tenants) with complete data isolation, featuring a Super Administrator role for managing all client companies. Each tenant operates independently with ~25 machines (scalable to hundreds) in Dominican Republic, implementing 12 operational modules with strict granular RBAC, secure JWT authentication with tenant context, and GMT-4 timezone handling. All monetary values display in Dominican Pesos (RD$).

## Multi-Tenant Architecture
The platform implements a 4-tier user hierarchy:
1. **Super Admin** - Manages SaaS platform (all tenants, subscription plans, global metrics)
2. **Admin** - Manages their company/tenant (machines, users, operations)
3. **Operational Roles** (6 types) - Work within their assigned tenant
4. **Establishment Viewers** - External users (establishment owners) with read-only access to their assigned machines' sales and commissions

**Key Multi-Tenant Components:**
- **New Tables:** tenants, subscription_plans, tenant_subscriptions, tenant_settings, tenant_invites, super_admin_audit_log
- **Data Isolation:** All 40+ operational tables include tenantId for complete data separation
- **JWT Tokens:** Include tenantId + isSuperAdmin for request-level tenant context
- **Middleware:** requireTenant() validates tenant context, requireSuperAdmin() for platform management routes
- **Tenant Switching:** Super Admins can operate in any tenant's context via query params

**Critical IDs (Default Tenant):**
- Tenant ID: `717d5e1f-7a58-42f6-b4cc-95cb58c2270f`
- Plan ID: `75b6fd50-631a-4608-ad67-ad0e48d8f118`
- Subscription ID: `06f9ddc5-7198-44b4-9b54-01bb2a0b8c2c`

## User Preferences
- Idioma: Español
- Color primario: #E84545 (rojo Dispensax)
- Diseño basado en el screenshot proporcionado (estilo dashboard moderno)
- Tarjetas coloridas para máquinas
- Todos los formularios usan React Hook Form + Zod
- Todos los endpoints validan con Zod

## System Architecture
The application follows a client-server architecture. The frontend is built with React, TypeScript, and Vite, utilizing Tailwind CSS and shadcn/ui for styling, Recharts for data visualization, React Hook Form with Zod for forms, TanStack Query for state management, and Wouter for routing. The backend is an Express.js and Node.js API, interacting with a PostgreSQL database.

**Key Architectural Decisions & Features:**
- **Modular Design:** The application is divided into distinct modules like Dashboard, Machines, Warehouse, Accounting, HR, Fuel, Purchases, Petty Cash, Money & Products, and Settings.
- **Responsive UI/UX:** Designed with a modern dashboard aesthetic, featuring responsive layouts and reusable components. Supports light/dark themes.
- **Data Visualization:** Extensive use of Recharts for presenting financial, operational, and inventory data.
- **Robust Form Handling:** All forms are managed using React Hook Form and validated with Zod for consistency and reliability.
- **Centralized Timezone Management:** All date and time operations are standardized to 'America/Santo_Domingo' (GMT-4) for consistency across the application.
- **In-Memory Caching System:** Implemented on the server (`server/cache.ts`) to pre-compute and store frequently accessed data. The DashboardCache (dashboard stats, machine lists, zone data) is no longer actively consumed by API endpoints. The SummaryCache was removed from all 6 summary endpoints (routes, petty-cash, purchases, fuel, hr, reconciliation) in favor of direct per-tenant DB queries to ensure complete tenant data isolation — each request now always filters by the authenticated user's tenantId.
- **Optimized Database Interactions:** Employs efficient SQL JOINs instead of N+1 patterns, limits query results, and utilizes 23 critical database indexes for performance.
- **Comprehensive JWT Authentication:** Features access and refresh tokens (HttpOnly cookies), middleware for role-based access control (RBAC), and automatic token renewal. Password changes revoke all active sessions.
- **Granular Permission System (RBAC):** Complete action-based authorization using `authorizeAction(resource, action)` middleware on all mutation endpoints. Permission matrix defined in `shared/permissions.ts` with 8 roles (super_admin, admin, supervisor, abastecedor, almacen, contabilidad, rh, visor_establecimiento) and actions (view, create, edit, delete, approve, export) across 20+ resources. Frontend uses `usePermissions()` hook with isLoading/isAuthenticated states for conditional UI rendering.
- **Establishment Viewer System:** External users (establishment owners) can view sales data and commissions for their assigned machines. Features include: invite-based onboarding, per-machine commission configuration (default 5%), dedicated dashboard at `/mi-panel`, and admin management panel at `/visores`. Tables: `establishment_viewers`, `machine_viewer_assignments`.
- **Establishments CRM Pipeline + Active Contracts:** Full CRM pipeline with stages (Prospecto → En Evaluación → En Negociación → Aprobado → Convertido). Features: stage-based pipeline view, followups, document management with Object Storage, conversion to active locations. Active establishments tab shows converted establishments with installed machines, contract management (CRUD + renewal), and operational history (visits, services, alerts). Tables: `establishments`, `establishment_stages`, `establishment_followups`, `establishment_documents`, `establishment_contracts`. Contract statuses: activo/vencido/renovado/cancelado. Agreement types: comision/renta_fija/comodato/mixto.
- **Enhanced Security (RBAC & Ownership):** Implemented `authorizeOwnership` middleware and `getEffectiveUserId` helper to prevent horizontal privilege escalation, ensuring users (especially "abastecedores") can only access their own data. Zone-based filtering for supervisors on machine data.
- **Fail-Closed Zone Validation:** Critical security feature - supervisors and suppliers can only access machines in their assigned zone. If user OR machine lacks zone configuration, access is denied (fail closed). Admins bypass zone restrictions. Error codes: MACHINE_NOT_IN_ZONE, NO_VEHICLE_ASSIGNED, INSUFFICIENT_STOCK.
- **Atomic Inventory Transactions:** All multi-table inventory operations (dispatchToVehicle, transferFromVehicleToMachine) use PostgreSQL transactions via `db.transaction()` to ensure consistency - partial updates are impossible on failure.
- **Warehouse Module (Kardex):** Features weighted average cost, inventory movements (Kardex) with FEFO validation, low stock alerts, product/supplier management, and integration with purchases. Includes shrinkage recording and lot traceability.
- **Fuel Module:** Manages fleet vehicles, fuel loads, calculates km/L performance, and tracks costs.
- **Report Optimization:** Critical performance improvements in reporting functions by eliminating N+1 patterns, using `Promise.all` for parallel data fetching, and `Map` for O(1) lookups. New reporting features include product dashboards, CSV exports, and total rows.
- **SMTP Password Recovery:** Implemented for user convenience.
- **Plan Limit Validation:** `checkTenantPlanLimits()` enforces maxMachines and maxUsers before creation. Returns 403 with PLAN_LIMIT_EXCEEDED code when limits are reached.
- **Rate Limiting:** In-memory rate limiter protects public and auth endpoints. Signup: 5/hour, Plans: 60/min, Login: 10/15min. Includes X-RateLimit headers and Retry-After for 429 responses.
- **Tenant Isolation Security:** Complete multi-tenant data isolation across all modules:
  - POST routes: Override tenantId from JWT context, preventing payload tampering
  - GET/PATCH/DELETE routes: 20+ helper functions verify tenant ownership before any operation
  - Protected modules: Machines, Locations, Products, Suppliers, Routes, Vehicles, Fuel, Cash, Purchases, Employees, Tasks, Calendar
  - Returns 404 (not 403) to prevent cross-tenant information disclosure
  - Super Admins bypass tenant checks via isSuperAdmin flag
  - Fail-closed approach: access denied if tenantId missing or mismatched

**UI/UX Decisions:**
- **Primary Color:** #E84545 (Dispensax Red) as per user preference, overriding a previous blue.
- **Color Palette:** Uses a consistent palette including #2F6FED (primary blue), #1D1D1D (dark), #8E59FF (purple), #4ECB71 (success green), and #FF6B3D (orange/red).
- **Dashboard:** Modern design with colorful machine cards, interactive weekly calendar, task lists, and quick actions.
- **Component Library:** Leverages shadcn/ui for consistent and accessible UI components.

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

## Nayax Integration
- **Service:** `server/nayax.ts` - HTTP client for Nayax Lynx API (machines, sales, connection testing)
- **Schema Tables:** `nayax_config` (per-tenant API token + settings), machines table extended with `nayax_machine_id`, `nayax_device_serial`, `nayax_linked_at`
- **API Endpoints:** `/api/nayax/config` (GET/POST), `/api/nayax/test-connection` (POST), `/api/nayax/machines` (GET), `/api/nayax/machines/:id/sales` (GET), `/api/nayax/link-machine` (POST), `/api/nayax/unlink-machine` (POST), `/api/nayax/linked-machines` (GET)
- **Frontend:** `/nayax` page with tabs for machine overview, linking, and cashless sales viewing
- **Auth:** Admin-only access, token stored per tenant in `nayax_config` table
- **Nayax Lynx API Base URL:** `https://lynx.nayax.com/operational/api/v1/`

## Documentation

- **MANUAL_USUARIO.md**: Comprehensive user manual (200+ sections) organized by user role (6 profiles) and module (12+ modules). Includes:
  - Detailed access and authentication instructions
  - Role-specific guides for Admin, Supervisor, Abastecedor, Almacén, Contabilidad, and RH
  - Practical step-by-step examples for every major functionality
  - Module-by-module reference guide
  - FAQ section and glossary
  - All text in Spanish as per user preference