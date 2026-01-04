# Dispensax - Sistema de Gestión de Máquinas Expendedoras

## Descripción General
Dispensax es una aplicación web empresarial completa para la gestión de máquinas expendedoras de bebidas. Incluye módulos para control de inventario, rutas de abastecimiento, contabilidad, recursos humanos y más.

## Stack Tecnológico
- **Frontend**: React + TypeScript + Vite
- **Estilos**: Tailwind CSS + shadcn/ui
- **Gráficos**: Recharts
- **Formularios**: React Hook Form + Zod
- **Estado**: TanStack Query
- **Routing**: Wouter
- **Backend**: Express.js + Node.js
- **Base de Datos**: PostgreSQL
- **Autenticación**: JWT (pendiente de implementación completa)

## Estructura del Proyecto

```
client/src/
├── components/
│   ├── ui/              # Componentes shadcn
│   ├── examples/        # Ejemplos de componentes
│   ├── Logo.tsx         # Logo de Dispensax
│   ├── ThemeToggle.tsx  # Toggle de tema claro/oscuro
│   ├── AppSidebar.tsx   # Sidebar de navegación principal
│   ├── SearchBar.tsx    # Barra de búsqueda global
│   ├── NotificationBell.tsx  # Campana de notificaciones
│   ├── StatsCard.tsx    # Tarjetas de estadísticas
│   ├── MachineCard.tsx  # Tarjeta de máquina expendedora
│   ├── AlertCard.tsx    # Tarjeta de alertas
│   ├── TaskCard.tsx     # Tarjeta de tareas
│   ├── ProductCard.tsx  # Tarjeta de productos
│   ├── RouteCard.tsx    # Tarjeta de rutas
│   ├── ServiceTimer.tsx # Temporizador de servicio
│   ├── CalendarStrip.tsx    # Calendario semanal
│   ├── QuickActionCard.tsx  # Acciones rápidas
│   ├── DataTable.tsx    # Tabla de datos reutilizable
│   ├── LoginForm.tsx    # Formulario de login
│   ├── ForgotPasswordForm.tsx # Formulario de recuperación de contraseña
│   └── RegisterForm.tsx # Formulario de registro
├── pages/
│   ├── auth.tsx         # Página de autenticación
│   ├── dashboard.tsx    # Dashboard principal
│   ├── machines.tsx     # Gestión de máquinas
│   ├── supplier.tsx     # Panel de abastecedor
│   ├── warehouse.tsx    # Almacén e inventario
│   ├── accounting.tsx   # Contabilidad y finanzas
│   ├── hr.tsx           # Recursos humanos
│   ├── settings.tsx     # Configuración
│   ├── money-products.tsx # Dinero y Productos
│   ├── petty-cash.tsx   # Caja Chica
│   ├── purchases.tsx    # Compras
│   ├── fuel.tsx         # Combustible
│   ├── reset-password.tsx # Restablecer contraseña
│   └── not-found.tsx    # Página 404
├── lib/
│   ├── auth-context.tsx  # Contexto de autenticación
│   ├── theme-context.tsx # Contexto de tema
│   ├── queryClient.ts    # Cliente TanStack Query
│   └── utils.ts          # Utilidades
└── App.tsx              # Componente principal
```

## Módulos Disponibles

### 1. Dashboard
- Estadísticas generales
- Tarjetas de máquinas coloreadas
- Calendario semanal interactivo
- Lista de tareas del día
- Acciones rápidas

### 2. Máquinas
- Listado con vista de cuadrícula/lista
- Filtros por estado y zona
- Agregar nuevas máquinas
- Detalles de inventario y alertas

### 3. Abastecedor
- Ruta optimizada del día
- Temporizador de servicio
- Registro de productos
- Recolección de efectivo
- Reporte de problemas

### 4. Almacén
- Inventario general
- Movimientos (Kardex)
- Alertas de stock bajo
- Gestión de productos

### 5. Contabilidad
- Ventas por máquina
- Gráficos de ingresos/egresos
- Corte de caja
- Reportes financieros

### 6. Recursos Humanos
- Gestión de personal
- Control de tiempos
- Rendimiento por abastecedor

### 7. Combustible (NUEVO)
- Gestión de vehículos de flota
- Registro de cargas de combustible
- Cálculo automático de rendimiento (km/L)
- Gráficos de tendencia de rendimiento
- Alertas de bajo rendimiento
- Estadísticas de costos por vehículo y ruta
- Distribución por tipo de combustible

### 8. Compras
- Gestión de proveedores
- Órdenes de compra con workflow de aprobación
- Recepción de mercancía
- Historial de transacciones

### 9. Caja Chica
- Registro de gastos menores
- Workflow de aprobación
- Control de fondo fijo
- Transacciones y estadísticas

### 10. Dinero y Productos
- Conciliación transversal de módulos
- Flujo de efectivo
- Movimientos de productos

### 11. Configuración
- Perfil de usuario
- Notificaciones
- Apariencia (tema claro/oscuro)
- Información de empresa
- Seguridad

## Paleta de Colores
- **Azul primario**: #2F6FED
- **Negro/oscuro**: #1D1D1D
- **Púrpura**: #8E59FF
- **Verde éxito**: #4ECB71
- **Naranja/rojo**: #FF6B3D

## Estado Actual
- [x] Prototipo frontend completo
- [x] Diseño responsivo
- [x] Tema claro/oscuro
- [x] Componentes reutilizables
- [x] Backend API completo con PostgreSQL
- [x] Módulo de Compras (órdenes, recepciones, proveedores)
- [x] Módulo de Caja Chica (gastos, aprobaciones, fondo)
- [x] Módulo de Dinero y Productos (conciliación)
- [x] Módulo de Combustible (vehículos, cargas, rendimiento)
- [x] Sistema de recuperación de contraseña por SMTP
- [x] Dashboard conectado a APIs reales (sin datos mock)
- [x] Búsqueda global funcional (/api/search)
- [x] Notificaciones basadas en alertas reales
- [x] **Autenticación JWT completa implementada**

## Cambios Recientes (Enero 2026)

### Sistema de Cache In-Memory (4 Enero 2026)
**CRÍTICO**: Resuelto bloqueo del servidor que causaba login de 67+ segundos.

**Causa raíz arquitectónica**: Express.js corre en un solo thread de Node.js. Cuando múltiples queries CPU-bound corren en paralelo, bloquean el event loop y ninguna solicitud (incluido login) puede procesarse hasta que terminen.

**Solución: Sistema de Cache con Pre-computación No-Bloqueante**

El archivo `server/cache.ts` implementa:
1. **Cache dual en memoria**: dashboardCache + summaryCache
2. **Actualización automática** cada 2 minutos en background (solo si TTL expirado)
3. **Patrón no-bloqueante**: Rutas devuelven cache inmediatamente y disparan refresh en background
4. **Valores por defecto**: Fallback inmediato cuando cache está vacío
5. **Mutex separados**: `isDashboardUpdating` e `isSummaryUpdating` para evitar actualizaciones concurrentes

**Funciones del cache**:
- `getDashboardCache()` / `getSummaryCache()` - Devuelven cache o valores por defecto
- `isDashboardCacheValid()` / `isSummaryCacheValid()` - Verifican TTL
- `refreshDashboardCacheIfStale()` / `refreshSummaryCacheIfStale()` - Refresh no-bloqueante
- `startCacheUpdater()` - Inicializa y programa actualizaciones automáticas

**Datos cacheados**:
- `dashboardCache`: stats, machinesByZone, recentAlerts, machinesList
- `summaryCache`: warehouse, pettyCash, reconciliation, routes, purchases, fuel, hr

**Endpoints optimizados con cache**:
- `/api/machines` - Lista básica desde cache (0-3ms)
- `/api/machines/summary` - Resumen completo para dashboard (1ms)
- `/api/alerts` - Alertas recientes desde cache (0-3ms)
- `/api/summary/*` - Todos los endpoints de resumen (0-3ms)

**Middleware de protección**:
- `server/middleware.ts`: Timeouts de 10s para auth, 30s para otros
- Verificación `res.headersSent` para evitar crashes por double-send

**Resultados finales**:
| Endpoint | Antes | Después | Mejora |
|----------|-------|---------|--------|
| /api/auth/login | 67,000ms | 250ms | **268x** |
| /api/machines | 20,000ms | 1ms | **20,000x** |
| /api/alerts | 43,000ms | 1ms | **43,000x** |
| /api/summary/* | 20,000ms+ | 1ms | **20,000x+** |

### Optimización de Rendimiento de Base de Datos (4 Enero 2026)
Además del cache, se mantienen las optimizaciones previas:
- Reemplazados patrones N+1 con JOINs eficientes
- LIMITs en todas las consultas de listas (20-50 registros)
- 23 índices en columnas críticas (machineId, createdAt, productId, status, userId)

### Sistema de Autenticación JWT Completo
- Nueva tabla `refresh_tokens` para gestión de sesiones
- Access tokens (15 min) + Refresh tokens (7 días) en cookies HttpOnly
- Middleware `authenticateJWT` para proteger rutas
- Middleware `authorizeRoles` para verificar permisos por rol
- Endpoints protegidos: /api/auth/me, PATCH /api/users/:id, POST /api/auth/change-password
- Renovación automática de tokens desde el frontend
- Logout revoca refresh tokens en servidor + cancela queries pendientes
- Cambio de contraseña revoca todas las sesiones activas

### Seguridad Mejorada
- Corregidos roles RBAC en página de Configuración
- Endpoints de perfil y contraseña ahora requieren autenticación JWT
- El userId se obtiene del token (no del body) para prevenir suplantación
- Administradores pueden editar perfiles de otros usuarios

## Cambios Anteriores (Diciembre 2025)
- Dashboard modernizado con datos reales de APIs
- Estadísticas en tiempo real (máquinas activas, alertas, tareas del día)
- Búsqueda global que busca en máquinas, productos, empleados y tareas
- Notificaciones conectadas a alertas reales del sistema
- Calendario semanal dinámico
- Tarjetas de zona con progreso de operatividad

## Preferencias de Usuario
- Idioma: Español
- Color primario: #E84545 (rojo Dispensax)
- Diseño basado en el screenshot proporcionado (estilo dashboard moderno)
- Tarjetas coloridas para máquinas
- Todos los formularios usan React Hook Form + Zod
- Todos los endpoints validan con Zod

## Base de Datos (PostgreSQL)
Tablas principales:
- users, locations, products, machines
- machine_inventory, machine_alerts, machine_visits, machine_sales
- suppliers, warehouse_inventory, product_lots, warehouse_movements
- routes, route_stops, service_records
- cash_collections, product_loads, issue_reports
- cash_movements, bank_deposits, product_transfers, shrinkage_records
- petty_cash_expenses, petty_cash_fund, petty_cash_transactions
- purchase_orders, purchase_order_items, purchase_receptions, reception_items
- vehicles, fuel_records
- password_reset_tokens

## Próximos Pasos
1. Completar autenticación JWT con roles
2. Implementar reportes y exportación de datos
3. Agregar dashboard con gráficos en tiempo real
4. Implementar notificaciones push
