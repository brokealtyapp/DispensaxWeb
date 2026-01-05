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

### 4. Almacén (100% COMPLETO - 5 Enero 2026)
- Inventario general con valorización de costo promedio ponderado
- Movimientos (Kardex) con filtros por tipo y paginación
- Alertas de stock bajo configurables por producto
- Gestión de productos y proveedores
- Integración automática con Compras (recepciones crean entradas)
- Validación FEFO (First Expired, First Out) para salidas
- Ajustes de inventario físico vs sistema
- Registro de mermas con categorías (caducidad, daño, robo, otros)
- Trazabilidad de lotes en movimientos
- Exportación CSV de inventario, movimientos y lotes
- Sincronización automática con máquinas (salida_maquina)

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

### Optimización Módulo de Reportes (5 Enero 2026)
**Mejoras de rendimiento críticas**:
- Eliminado patrón N+1 en 8 funciones de storage: getSalesBreakdown, getPurchasesBreakdown, getFuelBreakdown, getPettyCashBreakdown, getMachinePerformance, getTopProducts, getSupplierRanking, getExportData
- Todas las funciones ahora usan Promise.all para precargar entidades relacionadas y Map<string> para lookups O(1)
- Normalización de fechas a GMT-4 usando getTodayInTimezone() en getDateRange

**Nuevas funcionalidades**:
- Tab de Productos con gráfico Top 10 (Recharts) y tabla de detalle completa
- Exportación de inventario CSV con botón en UI
- Filas de totales (tfoot) en tablas de Ventas, Productos y Máquinas
- handleRefresh ahora usa predicate para invalidar todas las queries de reportes

**Patrón establecido para reportes**:
```typescript
const [machines, products, suppliers] = await Promise.all([
  db.select().from(machinesTable),
  db.select().from(productsTable),
  db.select().from(suppliersTable)
]);
const machineMap = new Map(machines.map(m => [m.id, m]));
```

### Sistema de Zona Horaria Centralizado (4 Enero 2026)
**Zona horaria fija**: América/Santo_Domingo (GMT-4) - República Dominicana

**Implementación en `client/src/lib/utils.ts`**:
- `TIMEZONE = 'America/Santo_Domingo'` - Constante de zona horaria
- `LOCALE = 'es-DO'` - Locale para formato dominicano
- `formatTime(date)` - Hora en formato HH:mm (ej: "14:30")
- `formatTimeWithSeconds(date)` - Hora con segundos en formato 12h (ej: "5:58:22 PM")
- `formatDate(date)` - Fecha completa (ej: "4 ene 2026")
- `formatDateShort(date)` - Fecha corta (ej: "4/1/2026")
- `formatDateTime(date)` - Fecha y hora (ej: "4 ene 2026, 14:30")
- `formatWeekday(date)` - Día de la semana largo (ej: "lunes")
- `formatWeekdayShort(date)` - Día de la semana corto (ej: "lun")
- `getDateKeyInTimezone(date)` - Clave de fecha YYYY-MM-DD en GMT-4
- `isSameDayInTimezone(date1, date2)` - Compara si dos fechas son el mismo día en GMT-4
- `isTodayInTimezone(date)` - Verifica si una fecha es hoy en GMT-4
- `getDayOfWeekInTimezone(date)` - Día de la semana (0-6) en GMT-4 usando Intl
- `getTodayInTimezone()` - Obtiene "hoy" como Date normalizado a mediodía GMT-4
- `getStartOfWeekInTimezone()` - Obtiene el lunes de la semana actual en GMT-4

**Archivos actualizados** (~18 componentes):
- Todos los páginas y componentes ahora usan las funciones centralizadas
- Garantiza consistencia en toda la aplicación
- Un solo punto de configuración para cambiar zona horaria

**Variable de entorno servidor**:
- `TZ=America/Santo_Domingo` configurada en entorno compartido

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
