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
- [ ] Autenticación JWT completa (parcialmente implementada)

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
