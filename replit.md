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

### 7. Configuración
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
- [ ] Backend API (pendiente)
- [ ] Autenticación JWT completa (pendiente)
- [ ] Base de datos PostgreSQL (pendiente)
- [ ] Integración frontend-backend (pendiente)

## Preferencias de Usuario
- Idioma: Español
- Diseño basado en el screenshot proporcionado (estilo dashboard moderno)
- Tarjetas coloridas para máquinas

## Próximos Pasos
1. Implementar backend con autenticación JWT
2. Crear esquema de base de datos
3. Desarrollar API REST completa
4. Conectar frontend con backend
5. Implementar funcionalidades en tiempo real
