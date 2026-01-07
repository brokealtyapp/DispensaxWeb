# Dispensax - Sistema de Gestión de Máquinas Expendedoras

## Overview
Dispensax is a comprehensive web application designed for managing beverage vending machines. It provides modules for inventory control, supply routes, accounting, human resources, and more. The project aims to streamline operations, optimize routes, and provide robust financial tracking for vending machine businesses.

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
- **In-Memory Caching System:** Implemented on the server (`server/cache.ts`) to pre-compute and store frequently accessed data (dashboard stats, summary data). This non-blocking background refresh mechanism drastically improves API response times by addressing Node.js's single-threaded nature and preventing event loop blocking.
- **Optimized Database Interactions:** Employs efficient SQL JOINs instead of N+1 patterns, limits query results, and utilizes 23 critical database indexes for performance.
- **Comprehensive JWT Authentication:** Features access and refresh tokens (HttpOnly cookies), middleware for role-based access control (RBAC), and automatic token renewal. Password changes revoke all active sessions.
- **Granular Permission System (RBAC):** Complete action-based authorization using `authorizeAction(resource, action)` middleware on all mutation endpoints. Permission matrix defined in `shared/permissions.ts` with 6 roles (admin, supervisor, abastecedor, almacen, contabilidad, rh) and actions (view, create, edit, delete, approve, export) across 20+ resources. Frontend uses `usePermissions()` hook with isLoading/isAuthenticated states for conditional UI rendering.
- **Enhanced Security (RBAC & Ownership):** Implemented `authorizeOwnership` middleware and `getEffectiveUserId` helper to prevent horizontal privilege escalation, ensuring users (especially "abastecedores") can only access their own data. Zone-based filtering for supervisors on machine data.
- **Warehouse Module (Kardex):** Features weighted average cost, inventory movements (Kardex) with FEFO validation, low stock alerts, product/supplier management, and integration with purchases. Includes shrinkage recording and lot traceability.
- **Fuel Module:** Manages fleet vehicles, fuel loads, calculates km/L performance, and tracks costs.
- **Report Optimization:** Critical performance improvements in reporting functions by eliminating N+1 patterns, using `Promise.all` for parallel data fetching, and `Map` for O(1) lookups. New reporting features include product dashboards, CSV exports, and total rows.
- **SMTP Password Recovery:** Implemented for user convenience.

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