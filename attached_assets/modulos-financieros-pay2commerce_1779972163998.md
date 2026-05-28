# Módulos Financieros – Pay2Commerce
## Especificación Técnica Completa para Replicación

**Versión:** 1.0  
**Cubre:** Egresos · Ingresos · Bancos · Compras  
**Arquitectura:** SAAS Multi-tenant · PostgreSQL · REST API · React

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)  
2. [Módulo de Egresos](#2-módulo-de-egresos)  
3. [Módulo de Ingresos](#3-módulo-de-ingresos)  
4. [Módulo de Bancos](#4-módulo-de-bancos)  
5. [Módulo de Compras](#5-módulo-de-compras)  
6. [Relaciones entre Módulos](#6-relaciones-entre-módulos)  
7. [Lógica de Negocio Compartida](#7-lógica-de-negocio-compartida)  
8. [Apéndice A – Archivos del Proyecto](#apéndice-a--archivos-del-proyecto)  
9. [Apéndice B – Reglas de Negocio Críticas](#apéndice-b--reglas-de-negocio-críticas)

---

## 1. Arquitectura General

### Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Base de datos | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM |
| Backend | Node.js + Express.js (TypeScript ESM) |
| Frontend | React 18 + TypeScript + Vite |
| UI | Radix UI + shadcn/ui + Tailwind CSS |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | Wouter |

### Modelo Multi-Tenant

- Cada registro pertenece a una `organization_id`.
- Todos los endpoints validan que los recursos pertenezcan a la organización del usuario autenticado.
- Las categorías se auto-crean con valores por defecto la primera vez que el usuario accede (seed lazy).
- Aislamiento total de datos: un usuario nunca puede leer ni modificar datos de otra organización.

### Manejo de Monedas

- Moneda base: **DOP (Peso Dominicano)**.
- Todas las métricas de dashboard se convierten a DOP usando tasas de cambio configurables por organización.
- Fórmula: `montoDOP = monto × tasaDeCambio[moneda]`
- Si la moneda es `DOP`, el factor es `1`.
- Monedas adicionales soportadas: USD, EUR (configurables por organización).

### Autenticación y Autorización

- **`requireAuth`**: Cualquier usuario autenticado de la organización.
- **`requireOrgAdmin`**: Solo administradores de la organización.
- JWT en cookie httpOnly (`auth_token`) + validación CSRF double-submit.

---

## 2. Módulo de Egresos

### 2.1 Descripción General

Sistema de control de gastos con dos modalidades:
- **Gastos Fijos:** gastos recurrentes programados (renta, nómina, servicios, etc.)
- **Gastos Variables:** gastos únicos o irregulares registrados manualmente

### 2.2 Estructura de Navegación

```
/egresos                → Dashboard principal con KPIs y gráficos
/egresos/fijos          → Gestión de gastos recurrentes
/egresos/variables      → Registro de gastos puntuales
/egresos/historial      → Historial paginado de todos los registros
/egresos/categorias     → CRUD de categorías con presupuesto mensual
```

### 2.3 Esquema de Base de Datos

#### Tabla: `egresos_categorias`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `nombre` | varchar | NOT NULL | Nombre de la categoría |
| `descripcion` | text | nullable | Descripción opcional |
| `color` | varchar | NOT NULL, default `#6366f1` | Color hex para UI |
| `icono` | varchar | NOT NULL, default `tag` | Nombre de ícono Lucide React |
| `presupuesto_mensual` | decimal(12,2) | nullable | Límite de gasto mensual |
| `is_active` | boolean | default true | Estado activo/inactivo |
| `created_at` | timestamp | defaultNow | Fecha de creación |

**Categorías por defecto (seed automático al primer acceso por organización):**

| Nombre | Color | Ícono |
|--------|-------|-------|
| Nómina | `#3b82f6` | `users` |
| Tecnología | `#8b5cf6` | `cpu` |
| Hosting / Servidor | `#06b6d4` | `server` |
| Telecomunicaciones | `#0ea5e9` | `wifi` |
| Servicios Públicos | `#f59e0b` | `zap` |
| Alquiler | `#f97316` | `home` |
| Transporte | `#10b981` | `truck` |
| Suministros | `#84cc16` | `package` |
| Marketing | `#ec4899` | `megaphone` |
| Seguros | `#6366f1` | `shield` |
| Capacitación | `#14b8a6` | `book-open` |
| Impuestos y Tasas | `#ef4444` | `landmark` |
| Otros | `#6b7280` | `more-horizontal` |

---

#### Tabla: `egresos_fijos`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que lo registró |
| `nombre` | varchar | NOT NULL | Nombre del gasto (ej: "Renta oficina") |
| `categoria_id` | varchar | FK → `egresos_categorias.id`, nullable | Categoría del gasto |
| `monto` | decimal(12,2) | NOT NULL | Monto por ciclo |
| `moneda` | varchar | default `DOP` | Código de moneda |
| `frecuencia` | varchar | NOT NULL | Ver valores válidos abajo |
| `dia_del_mes` | integer | nullable | Día del mes (para frecuencia mensual) |
| `fecha_inicio` | date | NOT NULL | Fecha de inicio del gasto |
| `fecha_fin` | date | nullable | Fecha de vencimiento (null = indefinido) |
| `proxima_fecha` | date | NOT NULL | Próxima fecha de pago del ciclo |
| `proveedor_id` | varchar | FK → `contacts.id`, nullable | Proveedor asociado |
| `cuenta_bancaria_id` | varchar | FK → `bank_accounts.id`, onDelete: set null | Cuenta bancaria de débito |
| `metodo_pago` | varchar | nullable | Método de pago preferido |
| `alert_dias_previos` | integer | default 3 | Días de anticipación para alerta |
| `is_active` | boolean | default true | Si está activo |
| `notas` | text | nullable | Notas adicionales |
| `total_pagado_ciclo` | decimal(12,2) | default `0` | Total abonado en el ciclo actual |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

**Valores válidos de `frecuencia`:**

```
diario | semanal | quincenal | mensual | bimestral | trimestral | semestral | anual
```

---

#### Tabla: `egresos_registros`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que lo registró |
| `fijo_id` | varchar | FK → `egresos_fijos.id`, nullable | Si es pago de un fijo |
| `categoria_id` | varchar | FK → `egresos_categorias.id`, nullable | Categoría del gasto |
| `monto` | decimal(12,2) | NOT NULL | Monto del gasto ejecutado |
| `moneda` | varchar | default `DOP` | Código de moneda |
| `fecha` | date | NOT NULL | Fecha del gasto |
| `metodo_pago` | varchar | nullable | Efectivo, transferencia, tarjeta, etc. |
| `proveedor_id` | varchar | FK → `contacts.id`, nullable | Proveedor al que se pagó |
| `cuenta_bancaria_id` | varchar | FK → `bank_accounts.id`, onDelete: set null | Cuenta de donde salió el dinero |
| `descripcion` | text | NOT NULL | Descripción del gasto |
| `notas` | text | nullable | Notas adicionales |
| `comprobante_url` | varchar | nullable | URL de imagen/PDF del comprobante |
| `es_parcial` | boolean | NOT NULL, default false | Si es un pago parcial de un fijo |
| `ciclo_fecha` | varchar | nullable | Identificador del ciclo (ej: `2024-01`) |
| `created_at` | timestamp | defaultNow | Fecha de creación |

### 2.4 API Endpoints

**Prefijo base:** `/api/egresos`  
**Archivo:** `server/egreso-routes.ts` (1,408 líneas)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/exchange-rates` | requireAuth | Obtener tasas de cambio activas de la org |
| PUT | `/exchange-rates` | requireOrgAdmin | Actualizar tasas de cambio (USD, EUR) |
| GET | `/categorias` | requireAuth | Listar categorías + gasto del mes por categoría |
| POST | `/categorias` | requireAuth | Crear categoría |
| PUT | `/categorias/:id` | requireAuth | Actualizar categoría |
| DELETE | `/categorias/:id` | requireAuth | Eliminar (nullifica FK en fijos y registros primero) |
| GET | `/fijos` | requireAuth | Listar gastos fijos con estado y abonos recientes |
| POST | `/fijos` | requireAuth | Crear gasto fijo |
| PUT | `/fijos/:id` | requireAuth | Actualizar gasto fijo |
| PATCH | `/fijos/:id/toggle` | requireAuth | Activar/desactivar gasto fijo |
| DELETE | `/fijos/:id` | requireAuth | Eliminar gasto fijo |
| POST | `/fijos/:id/registrar-pago` | requireAuth | Registrar pago/abono del ciclo actual |
| GET | `/fijos/:id/abonos` | requireAuth | Ver historial de abonos de un gasto fijo |
| GET | `/registros` | requireAuth | Historial paginado con filtros |
| POST | `/registros` | requireAuth | Registrar gasto variable |
| PUT | `/registros/:id` | requireAuth | Editar registro |
| DELETE | `/registros/:id` | requireAuth | Eliminar registro |
| GET | `/dashboard` | requireAuth | Métricas del dashboard |
| GET | `/por-moneda` | requireAuth | Desglose de gastos por moneda |
| GET | `/alertas-vencimiento` | requireAuth | Gastos fijos vencidos o próximos a vencer |

### 2.5 Lógica de Negocio – Gastos Fijos

#### Flujo de Registro de Pago (POST `/fijos/:id/registrar-pago`)

1. Se valida que el fijo pertenezca a la organización.
2. Se crea un `egresos_registros` con `fijo_id` apuntando al fijo y `es_parcial = true/false`.
3. Se acumula el monto en `total_pagado_ciclo` del fijo.
4. Si `total_pagado_ciclo >= monto` → ciclo **completado**:
   - Se llama a `avanzarProximaFecha(fecha, frecuencia)`.
   - Se resetea `total_pagado_ciclo = 0`.
5. Si `total_pagado_ciclo < monto` → ciclo **parcial** (deuda pendiente).
6. Si `cuenta_bancaria_id` está presente → se crea `bank_transactions` (tipo: `salida`) y se actualiza el saldo.

#### Cálculo de `proxima_fecha` (`avanzarProximaFecha`)

| Frecuencia | Avance |
|------------|--------|
| `diario` | +1 día |
| `semanal` | +7 días |
| `quincenal` | +15 días |
| `mensual` | +1 mes (mismo día) |
| `bimestral` | +2 meses |
| `trimestral` | +3 meses |
| `semestral` | +6 meses |
| `anual` | +12 meses |

#### Estado del Gasto Fijo (calculado en runtime, no almacenado en BD)

| Estado | Condición |
|--------|-----------|
| `vencido` | `proxima_fecha < hoy` |
| `alerta` | `proxima_fecha <= hoy + alert_dias_previos` |
| `al_dia` | `proxima_fecha > hoy + alert_dias_previos` |
| `inactivo` | `is_active = false` |
| `parcial` | `total_pagado_ciclo > 0` y `total_pagado_ciclo < monto` |

### 2.6 GET `/categorias` – Datos enriquecidos

El endpoint no solo retorna las categorías sino también el gasto del mes corriente por categoría:

```json
[
  {
    "id": "uuid",
    "nombre": "Alquiler",
    "color": "#f97316",
    "icono": "home",
    "presupuestoMensual": "25000.00",
    "isActive": true,
    "gastoDelMes": 25000.00
  }
]
```

El campo `gastoDelMes` se calcula sumando todos los `egresos_registros` del mes corriente de esa categoría, convertidos a DOP.

### 2.7 Filtros del Historial (GET `/registros`)

Query params aceptados:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `desde` | date | Fecha inicio del rango |
| `hasta` | date | Fecha fin del rango |
| `categoriaId` | string | Filtrar por categoría |
| `moneda` | string | Filtrar por moneda |
| `fijoId` | string | Ver solo pagos de un gasto fijo específico |
| `page` | integer | Página (default: 1) |
| `pageSize` | integer | Registros por página (default: 20) |
| `search` | string | Búsqueda por descripción |

### 2.8 Dashboard – Métricas Calculadas

| Métrica | Descripción |
|---------|-------------|
| `tasaDiaria` | Suma de egresos del mes ÷ días del mes |
| `totalMes` | Total de egresos del mes corriente (en DOP) |
| `totalAnual` | Total de egresos del año corriente |
| `gastoFijosActivos` | Suma de montos de fijos activos normalizados a mensual |
| `gastoPorCategoria` | Monto por categoría para gráfico de distribución (pie chart) |
| `alertasVencimiento` | Lista de gastos fijos vencidos o próximos a vencer |
| `tendencia` | Comparativa mes actual vs mes anterior |

---

## 3. Módulo de Ingresos

### 3.1 Descripción General

Espejo funcional del módulo de Egresos, orientado al control de entradas de dinero. Soporta ingresos recurrentes (contratos, suscripciones, alquileres cobrados) e ingresos puntuales o variables.

**Diferencias clave vs Egresos:**
- Vincula a `cliente_id` (contacto tipo cliente) en lugar de `proveedor_id`.
- Vincula a `producto_servicio_id` (producto o servicio vendido).
- En categorías usa `meta_mensual` (objetivo de recaudo) en lugar de `presupuesto_mensual` (límite de gasto).
- No tiene campo `total_pagado_ciclo` en los fijos (el cobro se considera completo al registrarlo).

### 3.2 Estructura de Navegación

```
/ingresos/control               → Dashboard principal con KPIs
/ingresos/control/fijos         → Gestión de ingresos recurrentes
/ingresos/control/variables     → Registro de ingresos puntuales
/ingresos/control/historial     → Historial paginado de registros
/ingresos/control/categorias    → CRUD de categorías con meta mensual
```

### 3.3 Esquema de Base de Datos

#### Tabla: `ingresos_categorias`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `nombre` | varchar | NOT NULL | Nombre de la categoría |
| `descripcion` | text | nullable | Descripción opcional |
| `color` | varchar | NOT NULL, default `#10b981` | Color hex para UI |
| `icono` | varchar | NOT NULL, default `tag` | Nombre de ícono Lucide React |
| `meta_mensual` | decimal(12,2) | nullable | Meta de recaudo mensual |
| `is_active` | boolean | default true | Estado activo/inactivo |
| `created_at` | timestamp | defaultNow | Fecha de creación |

**Categorías por defecto (seed automático):**

| Nombre | Color | Ícono |
|--------|-------|-------|
| Ventas de productos | `#10b981` | `package` |
| Servicios profesionales | `#3b82f6` | `briefcase` |
| Contratos de mantenimiento | `#8b5cf6` | `wrench` |
| Alquileres cobrados | `#f59e0b` | `home` |
| Proyectos y consultorías | `#06b6d4` | `clipboard` |
| Comisiones | `#ec4899` | `percent` |
| Licencias / Suscripciones | `#6366f1` | `key` |
| Otros ingresos | `#6b7280` | `more-horizontal` |

---

#### Tabla: `ingresos_fijos`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que lo registró |
| `nombre` | varchar | NOT NULL | Nombre del ingreso (ej: "Contrato mensual Empresa X") |
| `categoria_id` | varchar | FK → `ingresos_categorias.id`, nullable | Categoría del ingreso |
| `monto` | decimal(12,2) | NOT NULL | Monto esperado por ciclo |
| `moneda` | varchar | default `DOP` | Código de moneda |
| `frecuencia` | varchar | NOT NULL | Igual que egresos |
| `dia_del_mes` | integer | nullable | Día del mes de cobro |
| `fecha_inicio` | date | NOT NULL | Inicio del contrato/servicio |
| `fecha_fin` | date | nullable | Fin del contrato (null = indefinido) |
| `proxima_fecha` | date | NOT NULL | Próxima fecha de cobro |
| `cliente_id` | varchar | FK → `contacts.id`, nullable | Cliente al que se le cobra |
| `producto_servicio_id` | varchar | FK → `products.id`, nullable | Producto o servicio asociado |
| `cuenta_bancaria_id` | varchar | FK → `bank_accounts.id`, onDelete: set null | Cuenta donde se acredita |
| `metodo_cobro` | varchar | nullable | Método de cobro preferido |
| `alert_dias_previos` | integer | default 3 | Días de anticipación para alerta |
| `is_active` | boolean | default true | Estado activo |
| `notas` | text | nullable | Notas adicionales |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

---

#### Tabla: `ingresos_registros`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que lo registró |
| `fijo_id` | varchar | FK → `ingresos_fijos.id`, nullable | Si es cobro de un fijo |
| `categoria_id` | varchar | FK → `ingresos_categorias.id`, nullable | Categoría |
| `monto` | decimal(12,2) | NOT NULL | Monto recibido |
| `moneda` | varchar | default `DOP` | Código de moneda |
| `fecha` | date | NOT NULL | Fecha del cobro |
| `metodo_cobro` | varchar | nullable | Efectivo, transferencia, etc. |
| `cliente_id` | varchar | FK → `contacts.id`, nullable | Cliente que pagó |
| `producto_servicio_id` | varchar | FK → `products.id`, nullable | Producto/servicio cobrado |
| `cuenta_bancaria_id` | varchar | FK → `bank_accounts.id`, onDelete: set null | Cuenta donde se recibió |
| `descripcion` | text | NOT NULL | Descripción del ingreso |
| `notas` | text | nullable | Notas adicionales |
| `comprobante_url` | varchar | nullable | URL de comprobante |
| `created_at` | timestamp | defaultNow | Fecha de creación |

### 3.4 API Endpoints

**Prefijo base:** `/api/ingresos`  
**Archivo:** `server/ingreso-routes.ts` (1,228 líneas)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/categorias` | requireAuth | Listar categorías + recaudo del mes por categoría |
| POST | `/categorias` | requireAuth | Crear categoría |
| PUT | `/categorias/:id` | requireAuth | Actualizar categoría |
| DELETE | `/categorias/:id` | requireAuth | Eliminar (nullifica FK primero) |
| GET | `/fijos` | requireAuth | Listar ingresos fijos con estado de cobro |
| POST | `/fijos` | requireAuth | Crear ingreso fijo |
| PUT | `/fijos/:id` | requireAuth | Actualizar ingreso fijo |
| PATCH | `/fijos/:id/toggle` | requireAuth | Activar/desactivar |
| DELETE | `/fijos/:id` | requireAuth | Eliminar ingreso fijo |
| POST | `/fijos/:id/registrar-cobro` | requireAuth | Registrar cobro del ciclo y avanzar próxima fecha |
| GET | `/registros` | requireAuth | Historial paginado con filtros |
| POST | `/registros` | requireAuth | Registrar ingreso variable |
| PUT | `/registros/:id` | requireAuth | Editar registro |
| DELETE | `/registros/:id` | requireAuth | Eliminar registro |
| GET | `/dashboard` | requireAuth | Métricas del dashboard |
| GET | `/por-moneda` | requireAuth | Desglose por moneda |
| GET | `/alertas-proximos-cobros` | requireAuth | Ingresos fijos con cobro próximo |

### 3.5 Lógica de Negocio – Ingresos Fijos

#### Flujo de Registro de Cobro (POST `/fijos/:id/registrar-cobro`)

1. Se valida que el fijo pertenezca a la organización.
2. Se crea un `ingresos_registros` con `fijo_id` apuntando al fijo.
3. Se avanza `proxima_fecha` al siguiente ciclo inmediatamente (no hay concepto de pago parcial como en egresos).
4. Si `cuenta_bancaria_id` está presente → se crea `bank_transactions` (tipo: `entrada`) y se actualiza el saldo.

### 3.6 GET `/categorias` – Datos enriquecidos

```json
[
  {
    "id": "uuid",
    "nombre": "Servicios profesionales",
    "color": "#3b82f6",
    "icono": "briefcase",
    "metaMensual": "50000.00",
    "isActive": true,
    "recaudoDelMes": 45000.00
  }
]
```

El campo `recaudoDelMes` suma todos los `ingresos_registros` del mes corriente de esa categoría, convertidos a DOP.

### 3.7 Dashboard – Métricas Calculadas

| Métrica | Descripción |
|---------|-------------|
| `tasaDiaria` | Total ingresos del mes ÷ días transcurridos |
| `totalMes` | Total recaudado en el mes corriente (DOP) |
| `totalAnual` | Total recaudado en el año |
| `fijosActivos` | Suma de montos de fijos activos (normalizados a mensual) |
| `recaudoPorCategoria` | Monto por categoría para gráfico circular |
| `proximosCobros` | Fijos con cobro en los próximos N días |
| `tendencia` | Comparativa mes actual vs mes anterior |

---

## 4. Módulo de Bancos

### 4.1 Descripción General

Sistema completo de gestión de cuentas financieras. Soporta tres tipos: cuentas bancarias tradicionales, tarjetas de crédito y cajas de efectivo. Integrado con el plan de cuentas contable (doble entrada) y el resto de módulos (egresos, ingresos, facturas, etc.).

### 4.2 Estructura de Navegación

```
/banks    → Página única con pestañas:
             - Resumen (dashboard y tarjetas de cuenta)
             - Transacciones (historial y filtros)
             - Transferencias (entre cuentas)
             - Conciliación (asistente de reconciliación)
```

### 4.3 Esquema de Base de Datos

#### Tabla: `bank_accounts`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario creador |
| `organization_id` | varchar | FK → `organizations.id`, onDelete: cascade | Organización dueña |
| `bank_name` | varchar | NOT NULL | Nombre del banco/institución financiera |
| `account_name` | varchar | NOT NULL | Nombre descriptivo (ej: "Cuenta Corriente BHD") |
| `account_number` | varchar | NOT NULL | Número de cuenta (se muestra enmascarado en UI) |
| `account_holder` | varchar | nullable | Titular de la cuenta |
| `account_type` | varchar | NOT NULL | `banco` / `tarjeta_credito` / `efectivo` |
| `account_subtype` | varchar | default `corriente` | `corriente` / `ahorros` |
| `bank_profile` | varchar | default `empresarial` | `personal` / `empresarial` |
| `pais` | varchar | default `DO` | Código de país ISO 3166-1 alpha-2 |
| `currency` | varchar | default `DOP` | Moneda principal de la cuenta |
| `balance` | decimal(12,2) | default `0` | Saldo actual (actualizado automáticamente en cada transacción) |
| `initial_balance` | decimal(12,2) | default `0` | Saldo al momento de crear la cuenta |
| `initial_balance_date` | date | defaultNow | Fecha del saldo inicial |
| `connection_status` | varchar | default `disconnected` | `connected` / `disconnected` / `syncing` / `error` |
| `alert_threshold` | decimal(12,2) | nullable | Umbral de saldo bajo para alertas |
| `credit_limit` | decimal(12,2) | nullable | Límite de crédito (solo `tarjeta_credito`) |
| `statement_closing_day` | integer | nullable | Día de cierre del estado de cuenta (tarjetas) |
| `payment_due_day` | integer | nullable | Día de vencimiento del pago (tarjetas) |
| `last_credit_alert_sent_date` | date | nullable | Última fecha de alerta de crédito enviada |
| `gl_account_id` | varchar | FK → `accounts.id`, nullable | Cuenta contable vinculada (plan de cuentas) |
| `description` | text | nullable | Descripción adicional |
| `is_active` | boolean | default true | Estado activo |
| `notes` | text | nullable | Notas internas |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

---

#### Tabla: `bank_transactions`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id` | Organización dueña |
| `bank_account_id` | varchar | FK → `bank_accounts.id`, onDelete: set null | Cuenta bancaria |
| `beneficiary` | varchar | nullable | Nombre del beneficiario u origen |
| `concept` | varchar | nullable | Concepto corto de la transacción |
| `description` | text | NOT NULL | Descripción completa |
| `detail` | text | nullable | Detalle adicional |
| `amount` | decimal(12,2) | NOT NULL | Monto de la transacción |
| `type` | varchar | NOT NULL | `entrada` / `salida` |
| `category` | varchar | nullable | Clasificación (facturacion, ingresos, egresos, etc.) |
| `transaction_date` | timestamp | NOT NULL | Fecha y hora exacta de la transacción |
| `reference_number` | varchar | nullable | Número de referencia o cheque |
| `status` | varchar | default `processed` | `pending` / `processed` / `reconciled` |
| `is_reconciled` | boolean | default false | Si fue conciliada con estado de cuenta |
| `reconciled_at` | timestamp | nullable | Fecha y hora de conciliación |
| `notes` | text | nullable | Notas adicionales |
| `source` | varchar(20) | nullable | Origen: `invoice`, `egreso`, `ingreso`, `transfer`, `manual` |
| `receipt_url` | varchar | nullable | URL del comprobante |
| `created_at` | timestamp | defaultNow | Fecha de creación |

### 4.4 API Endpoints

**Archivo:** `server/routes.ts`

**Cuentas Bancarias** (`/api/bank-accounts`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar todas las cuentas de la organización |
| POST | `/` | requireAuth | Crear nueva cuenta |
| PUT | `/:id` | requireAuth | Actualizar configuración de cuenta |
| DELETE | `/:id` | requireAuth | Eliminar cuenta |
| GET | `/summary` | requireAuth | Resumen: saldo total, distribución por tipo y moneda |
| POST | `/transfer` | requireAuth | Transferencia entre cuentas (atómica + asiento contable) |
| GET | `/reconciliation` | requireAuth | Transacciones pendientes de conciliar |
| POST | `/reconciliation/reconcile` | requireAuth | Marcar lote de transacciones como conciliadas |

**Transacciones** (`/api/bank-transactions`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Historial de transacciones con filtros |
| PATCH | `/:id/classify` | requireAuth | Asignar categoría a una transacción |

### 4.5 Tipos de Cuenta y Campos Específicos

| `account_type` | Descripción | Campos exclusivos |
|---------------|-------------|------------------|
| `banco` | Cuenta bancaria corriente o de ahorros | `account_subtype`, `pais` |
| `tarjeta_credito` | Tarjeta de crédito empresarial o personal | `credit_limit`, `statement_closing_day`, `payment_due_day` |
| `efectivo` | Caja de efectivo o fondo | Ninguno adicional |

### 4.6 Transferencias entre Cuentas

Al ejecutar una transferencia (`POST /api/bank-accounts/transfer`):

1. Se debita la cuenta origen (crea `bank_transaction` tipo `salida`).
2. Se acredita la cuenta destino (crea `bank_transaction` tipo `entrada`).
3. Se actualiza el `balance` de ambas cuentas atómicamente.
4. Si ambas cuentas tienen `gl_account_id` → se generan asientos de diario de doble entrada en `journal_entries`.
5. Si las cuentas tienen monedas distintas → se aplica tasa de cambio.

### 4.7 Conciliación Bancaria

**Flujo:**
1. Listar transacciones con `status = processed` (pendientes de conciliar).
2. El usuario selecciona las que coinciden con el estado de cuenta del banco.
3. Se marcan como `is_reconciled = true` + `reconciled_at = now()` + `status = reconciled`.
4. La conciliación es **irreversible** una vez aplicada.

### 4.8 Alertas Automáticas

| Tipo | Condición | Acción |
|------|-----------|--------|
| Saldo bajo | `balance < alert_threshold` | Envío de email al admin |
| Tarjeta próxima a cierre | `statement_closing_day` próximo | Email de alerta |
| Tarjeta próxima a vencimiento | `payment_due_day` próximo | Email de alerta |

**Archivo de cron:** `server/bank-credit-cron.ts`

### 4.9 Integración Contable (GL Link)

- Cada cuenta bancaria puede vincularse a una cuenta del plan contable (`gl_account_id`).
- Cuando se registra una transacción, se genera automáticamente un asiento de diario en `journal_entries`.
- Esto mantiene el balance contable sincronizado con los movimientos bancarios reales.

### 4.10 Filtros de Transacciones (GET `/api/bank-transactions`)

| Parámetro | Descripción |
|-----------|-------------|
| `bankAccountId` | Filtrar por cuenta específica |
| `desde` / `hasta` | Rango de fechas |
| `type` | `entrada` / `salida` |
| `status` | `pending` / `processed` / `reconciled` |
| `category` | Clasificación |
| `search` | Búsqueda por descripción o beneficiario |
| `page` / `pageSize` | Paginación |

### 4.11 Soporte Multi-País

`client/src/lib/bancos-por-pais.ts` provee catálogos de bancos por país:
- **República Dominicana (`DO`):** BHD León, Banreservas, Popular, Scotiabank, Asociación Cibao, etc.
- **Estados Unidos (`US`):** Bank of America, Chase, Wells Fargo, Citibank, etc.
- Y otros países configurables.

### 4.12 Dashboard de Bancos – Vistas

| Vista | Descripción |
|-------|-------------|
| Tarjetas de cuenta | Saldo, tipo, número enmascarado y estado de cada cuenta |
| Flujo de caja | Gráfico de entradas vs salidas por período (Recharts) |
| Transacciones recientes | Últimos movimientos de todas las cuentas |
| Transferencias | Formulario + historial de transferencias internas |
| Conciliación | Asistente con checkboxes para marcar transacciones conciliadas |
| Clasificación masiva | Asignar categoría a múltiples transacciones en lote |

---

## 5. Módulo de Compras

### 5.1 Descripción General

Gestión completa del ciclo de compras: desde la solicitud formal (orden de compra) hasta la factura del proveedor, pasando por los pagos, gastos recurrentes, caja chica y notas débito.

### 5.2 Estructura de Navegación

```
/purchases/supplier-invoices    → Facturas de proveedores (lista y detalle)
/purchases/purchase-orders      → Órdenes de compra
/purchases/payments             → Pagos y abonos a proveedores
/purchases/recurring-payments   → Pagos recurrentes (alquileres, servicios)
/purchases/petty-cash           → Gastos menores / caja chica
/purchases/debit-notes          → Notas débito emitidas a proveedores
```

### 5.3 Submodulo: Facturas de Proveedores

#### Tabla: `supplier_invoices`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que la registró |
| `supplier_id` | varchar | FK → `contacts.id`, NOT NULL | Proveedor (debe ser tipo supplier) |
| `purchase_order_id` | varchar | FK → `purchase_orders.id`, nullable | Orden de compra de origen |
| `invoice_number` | varchar | NOT NULL | Número de factura del proveedor |
| `reference_number` | varchar | nullable | Referencia interna de la empresa |
| `ncf_type` | varchar | nullable | Tipo NCF dominicano (B02, B04, B14, etc.) |
| `ncf_number` | varchar | nullable | Número NCF completo |
| `issue_date` | date | NOT NULL | Fecha de emisión de la factura |
| `due_date` | date | NOT NULL | Fecha de vencimiento del pago |
| `received_date` | date | default hoy | Fecha en que se recibió la factura |
| `status` | varchar | default `received` | Ver estados válidos abajo |
| `subtotal` | decimal(12,2) | NOT NULL | Subtotal antes de impuestos |
| `tax_amount` | decimal(12,2) | default `0.00` | ITBIS / IVA |
| `withholding_amount` | decimal(12,2) | default `0.00` | Monto de retenciones |
| `discount_amount` | decimal(12,2) | default `0.00` | Descuentos aplicados |
| `total_amount` | decimal(12,2) | NOT NULL | Total a pagar |
| `paid_amount` | decimal(12,2) | default `0.00` | Total ya pagado |
| `balance_amount` | decimal(12,2) | NOT NULL | Saldo pendiente |
| `currency` | varchar | default `DOP` | Moneda de la factura |
| `exchange_rate` | decimal(10,4) | default `1.0000` | Tasa de cambio al momento |
| `payment_terms` | text | nullable | Condiciones de pago |
| `notes` | text | nullable | Notas internas |
| `attachments` | jsonb | default `[]` | Array de URLs de archivos adjuntos |
| `approved_by` | varchar | FK → `users.id`, nullable | Usuario que aprobó |
| `approved_at` | timestamp | nullable | Fecha de aprobación |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

**Estados válidos de `supplier_invoices.status`:**

| Estado | Descripción |
|--------|-------------|
| `draft` | Borrador, no confirmada aún |
| `received` | Recibida del proveedor, pendiente de revisión |
| `approved` | Aprobada internamente para pago |
| `paid` | Completamente pagada |
| `overdue` | Fecha de vencimiento superada sin pago completo |
| `cancelled` | Cancelada o anulada |

#### Tabla: `supplier_invoice_items`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `supplier_invoice_id` | varchar | FK → `supplier_invoices.id`, NOT NULL | Factura padre |
| `product_id` | varchar | FK → `products.id`, nullable | Producto (optional para servicios) |
| `description` | text | NOT NULL | Descripción del ítem o servicio |
| `quantity` | decimal(12,4) | NOT NULL | Cantidad |
| `unit_price` | decimal(12,2) | NOT NULL | Precio unitario |
| `unit_cost` | decimal(12,2) | NOT NULL | Costo unitario (para valuación de inventario) |
| `subtotal_amount` | decimal(12,2) | NOT NULL | Subtotal = qty × unit_price |
| `tax_amount` | decimal(12,2) | default `0.00` | ITBIS del ítem |
| `total_amount` | decimal(12,2) | NOT NULL | Total del ítem |
| `tax_percentage` | decimal(5,2) | default `0.00` | Porcentaje de ITBIS aplicado |
| `withholding_percentage` | decimal(5,2) | default `0.00` | Porcentaje de retención |
| `created_at` | timestamp | defaultNow | Fecha de creación |

### 5.4 Submodulo: Órdenes de Compra

#### Tabla: `purchase_orders`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario creador |
| `supplier_id` | varchar | FK → `contacts.id`, NOT NULL | Proveedor |
| `warehouse_id` | varchar | FK → `warehouses.id`, nullable | Almacén de destino |
| `order_number` | varchar | NOT NULL | Número PO auto-generado secuencialmente |
| `reference_number` | varchar | nullable | Referencia externa del proveedor |
| `issue_date` | date | NOT NULL | Fecha de emisión |
| `expected_date` | date | nullable | Fecha esperada de entrega |
| `received_date` | date | nullable | Fecha real de recepción completa |
| `status` | varchar | default `draft` | Ver estados válidos abajo |
| `subtotal` | decimal(12,2) | NOT NULL | Subtotal |
| `tax_amount` | decimal(12,2) | default `0.00` | ITBIS |
| `total_amount` | decimal(12,2) | NOT NULL | Total |
| `currency` | varchar | default `DOP` | Moneda |
| `payment_terms` | text | nullable | Condiciones de pago |
| `delivery_terms` | text | nullable | Condiciones de entrega (INCOTERMS) |
| `notes` | text | nullable | Notas adicionales |
| `approved_by` | varchar | FK → `users.id`, nullable | Usuario aprobador |
| `approved_at` | timestamp | nullable | Fecha de aprobación |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

**Estados válidos de `purchase_orders.status`:**

| Estado | Descripción |
|--------|-------------|
| `draft` | Borrador, aún en edición |
| `sent` | Enviada al proveedor |
| `confirmed` | Confirmada por el proveedor |
| `partial` | Recepción parcial de ítems |
| `received` | Totalmente recibida |
| `invoiced` | Factura de proveedor ya generada |
| `cancelled` | Cancelada |

#### Tabla: `purchase_order_items`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `purchase_order_id` | varchar | FK → `purchase_orders.id`, NOT NULL | Orden padre |
| `product_id` | varchar | FK → `products.id`, nullable | Producto |
| `description` | text | NOT NULL | Descripción |
| `quantity` | decimal(12,4) | NOT NULL | Cantidad ordenada |
| `received_quantity` | decimal(12,4) | default `0.0000` | Cantidad efectivamente recibida |
| `unit_price` | decimal(12,2) | NOT NULL | Precio unitario |
| `subtotal_amount` | decimal(12,2) | NOT NULL | Subtotal |
| `tax_amount` | decimal(12,2) | default `0.00` | ITBIS |
| `total_amount` | decimal(12,2) | NOT NULL | Total |
| `tax_percentage` | decimal(5,2) | default `0.00` | % ITBIS |
| `created_at` | timestamp | defaultNow | Fecha de creación |

### 5.5 Submodulo: Pagos a Proveedores

#### Tabla: `supplier_payments`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que registró el pago |
| `supplier_id` | varchar | FK → `contacts.id`, NOT NULL | Proveedor pagado |
| `bank_account_id` | varchar | FK → `bank_accounts.id`, nullable | Cuenta de donde salió el dinero |
| `payment_number` | varchar | NOT NULL | Número de pago auto-generado |
| `payment_date` | date | NOT NULL | Fecha del pago |
| `payment_method` | varchar | NOT NULL | `cash` / `transfer` / `check` / `card` |
| `reference_number` | varchar | nullable | Nro. de cheque, referencia de transferencia |
| `amount` | decimal(12,2) | NOT NULL | Monto total del pago |
| `currency` | varchar | default `DOP` | Moneda |
| `exchange_rate` | decimal(10,4) | default `1.0000` | Tasa de cambio al momento |
| `description` | text | nullable | Descripción del pago |
| `notes` | text | nullable | Notas adicionales |
| `attachments` | jsonb | default `[]` | URLs de comprobantes |
| `status` | varchar | default `pending` | `pending` / `completed` / `cancelled` |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

#### Tabla: `payment_allocations` (Distribución de Pagos)

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `payment_id` | varchar | FK → `supplier_payments.id`, NOT NULL | Pago distribuidor |
| `supplier_invoice_id` | varchar | FK → `supplier_invoices.id`, NOT NULL | Factura receptora |
| `allocated_amount` | decimal(12,2) | NOT NULL | Monto aplicado a esta factura |
| `created_at` | timestamp | defaultNow | Fecha de creación |

> **Nota:** Un pago puede distribuirse en múltiples facturas del mismo proveedor. Al crear la distribución, el sistema recalcula automáticamente `paid_amount` y `balance_amount` en cada factura afectada. Si `balance_amount = 0`, la factura pasa a estado `paid`.

### 5.6 Submodulo: Pagos Recurrentes

#### Tabla: `recurring_payments`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario |
| `supplier_id` | varchar | FK → `contacts.id`, nullable | Proveedor (opcional para pagos internos) |
| `bank_account_id` | varchar | FK → `bank_accounts.id`, nullable | Cuenta de débito |
| `name` | varchar | NOT NULL | Nombre descriptivo (ej: "Renta de oficina") |
| `description` | text | nullable | Descripción detallada |
| `amount` | decimal(12,2) | NOT NULL | Monto por ciclo |
| `currency` | varchar | default `DOP` | Moneda |
| `payment_method` | varchar | NOT NULL | Método de pago |
| `frequency` | varchar | NOT NULL | `monthly` / `quarterly` / `yearly` |
| `start_date` | date | NOT NULL | Fecha de inicio |
| `end_date` | date | nullable | Fecha de finalización (null = indefinido) |
| `next_payment_date` | date | NOT NULL | Próxima fecha de pago |
| `day_of_month` | integer | nullable | Día del mes (para frecuencia monthly) |
| `is_active` | boolean | default true | Estado activo |
| `auto_process` | boolean | default false | Crear pagos automáticamente |
| `alert_days_before` | integer | default 3 | Días de anticipación para alerta |
| `total_payments` | integer | default 0 | Contador de pagos procesados |
| `last_payment_date` | date | nullable | Fecha del último pago procesado |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

### 5.7 Submodulo: Gastos Menores (Caja Chica)

#### Tabla: `petty_cash_funds` (Fondos de Caja Chica)

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `name` | varchar | NOT NULL | Nombre del fondo (ej: "Caja Principal", "Almacén Norte") |
| `maximum_amount` | decimal(10,2) | NOT NULL | Límite máximo asignado al fondo |
| `current_balance` | decimal(10,2) | default `0.00` | Saldo disponible actualmente |
| `custodian` | varchar | FK → `users.id`, NOT NULL | Usuario responsable/custodio |
| `location` | varchar | nullable | Ubicación física del fondo |
| `is_active` | boolean | default true | Estado activo |
| `requires_approval` | boolean | default true | Si los gastos requieren aprobación previa |
| `approval_limit` | decimal(10,2) | default `500.00` | Monto máximo sin requerir aprobación |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

#### Tabla: `petty_cash` (Transacciones de Caja Chica)

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario que registró |
| `transaction_number` | varchar | NOT NULL | Número secuencial de la transacción |
| `transaction_date` | date | NOT NULL | Fecha del gasto |
| `type` | varchar | NOT NULL | `expense` / `replenishment` / `return` |
| `category` | varchar | NOT NULL | `fuel` / `food` / `supplies` / `transport` / `other` |
| `amount` | decimal(10,2) | NOT NULL | Monto del gasto |
| `description` | text | NOT NULL | Descripción del gasto |
| `recipient` | varchar | nullable | Persona o entidad que recibió el dinero |
| `approved_by` | varchar | FK → `users.id`, nullable | Usuario que aprobó |
| `approved_at` | timestamp | nullable | Fecha de aprobación |
| `receipt_number` | varchar | nullable | Número de recibo físico |
| `attachments` | jsonb | default `[]` | URLs de comprobantes |
| `status` | varchar | default `pending` | `pending` / `approved` / `rejected` |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

**Tipos de transacción de caja chica:**

| `type` | Descripción |
|--------|-------------|
| `expense` | Gasto menor pagado con el fondo |
| `replenishment` | Recarga/reposición del fondo |
| `return` | Devolución de dinero al fondo |

**Flujo de aprobación:**
1. Se crea el gasto con `status = pending`.
2. Si el monto supera `approval_limit` → requiere aprobación explícita.
3. Admin aprueba → `status = approved`, `approved_by`, `approved_at` se llenan.
4. Admin rechaza → `status = rejected`.

### 5.8 Submodulo: Notas Débito

#### Tabla: `debit_notes`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `organization_id` | varchar | FK → `organizations.id`, NOT NULL | Organización dueña |
| `user_id` | varchar | FK → `users.id`, NOT NULL | Usuario |
| `supplier_id` | varchar | FK → `contacts.id`, NOT NULL | Proveedor al que se emite |
| `supplier_invoice_id` | varchar | FK → `supplier_invoices.id`, nullable | Factura de referencia |
| `debit_note_number` | varchar | NOT NULL | Número de nota débito |
| `reference_number` | varchar | nullable | Referencia adicional |
| `ncf_type` | varchar | nullable | Tipo NCF (B06 para notas débito en RD) |
| `ncf_number` | varchar | nullable | Número NCF completo |
| `issue_date` | date | NOT NULL | Fecha de emisión |
| `status` | varchar | default `draft` | `draft` / `sent` / `applied` / `cancelled` |
| `reason` | varchar | NOT NULL | Ver razones válidas abajo |
| `reason_description` | text | nullable | Descripción detallada del motivo |
| `subtotal` | decimal(12,2) | NOT NULL | Subtotal |
| `tax_amount` | decimal(12,2) | default `0.00` | ITBIS |
| `total_amount` | decimal(12,2) | NOT NULL | Total de la nota |
| `currency` | varchar | default `DOP` | Moneda |
| `notes` | text | nullable | Notas adicionales |
| `attachments` | jsonb | default `[]` | URLs de adjuntos |
| `created_at` | timestamp | defaultNow | Fecha de creación |
| `updated_at` | timestamp | defaultNow | Última actualización |

**Razones válidas de nota débito (`reason`):**

| Valor | Descripción |
|-------|-------------|
| `return` | Devolución de mercancía al proveedor |
| `discount` | Descuento obtenido después de la factura |
| `error_correction` | Corrección de error en la factura original |
| `price_adjustment` | Ajuste de precio acordado posteriormente |

#### Tabla: `debit_note_items`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| `id` | varchar | PK, default UUID | Identificador único |
| `debit_note_id` | varchar | FK → `debit_notes.id`, NOT NULL | Nota débito padre |
| `product_id` | varchar | FK → `products.id`, nullable | Producto |
| `description` | text | NOT NULL | Descripción del ítem |
| `quantity` | decimal(12,4) | NOT NULL | Cantidad |
| `unit_price` | decimal(12,2) | NOT NULL | Precio unitario |
| `subtotal_amount` | decimal(12,2) | NOT NULL | Subtotal |
| `tax_amount` | decimal(12,2) | default `0.00` | ITBIS |
| `total_amount` | decimal(12,2) | NOT NULL | Total del ítem |
| `tax_percentage` | decimal(5,2) | default `0.00` | % ITBIS |
| `created_at` | timestamp | defaultNow | Fecha de creación |

### 5.9 API Endpoints – Compras

**Facturas de Proveedores** (`/api/purchases/supplier-invoices`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar facturas con filtros (estado, proveedor, fecha, moneda) |
| POST | `/` | requireAuth | Crear factura con ítems |
| GET | `/:id` | requireAuth | Obtener detalle completo + ítems + pagos |
| PUT | `/:id` | requireAuth | Actualizar factura (solo `draft` o `received`) |
| DELETE | `/:id` | requireAuth | Eliminar (solo `draft`) |
| PATCH | `/:id/status` | requireOrgAdmin | Cambiar estado (aprobar, cancelar) |
| GET | `/:id/payments` | requireAuth | Ver pagos aplicados a esta factura |

**Órdenes de Compra** (`/api/purchases/purchase-orders`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar con filtros |
| POST | `/` | requireAuth | Crear orden con ítems |
| GET | `/:id` | requireAuth | Detalle + ítems |
| PUT | `/:id` | requireAuth | Actualizar (solo `draft`) |
| PATCH | `/:id/status` | requireAuth | Cambiar estado |
| POST | `/:id/convert-invoice` | requireAuth | Convertir a factura de proveedor |
| PATCH | `/:id/receive` | requireAuth | Registrar recepción parcial o total |

**Pagos** (`/api/purchases/payments`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar pagos con filtros |
| POST | `/` | requireAuth | Crear pago + distribución a facturas |
| GET | `/:id` | requireAuth | Detalle del pago + allocations |
| PATCH | `/:id/cancel` | requireOrgAdmin | Anular pago (revierte saldos) |

**Pagos Recurrentes** (`/api/purchases/recurring-payments`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar pagos recurrentes |
| POST | `/` | requireAuth | Crear pago recurrente |
| PUT | `/:id` | requireAuth | Actualizar configuración |
| PATCH | `/:id/toggle` | requireAuth | Activar/desactivar |
| POST | `/:id/process` | requireAuth | Procesar pago del ciclo actual |
| DELETE | `/:id` | requireAuth | Eliminar |

**Gastos Menores / Caja Chica** (`/api/purchases/petty-cash`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar transacciones con filtros |
| POST | `/` | requireAuth | Registrar gasto/reposición |
| PUT | `/:id` | requireAuth | Editar (solo `pending`) |
| PATCH | `/:id/approve` | requireOrgAdmin | Aprobar transacción |
| PATCH | `/:id/reject` | requireOrgAdmin | Rechazar con motivo |
| GET | `/funds` | requireAuth | Listar fondos de caja chica |
| POST | `/funds` | requireOrgAdmin | Crear fondo |
| PUT | `/funds/:id` | requireOrgAdmin | Actualizar fondo |
| GET | `/config` | requireAuth | Obtener configuración global |
| PUT | `/config` | requireOrgAdmin | Actualizar configuración |

**Notas Débito** (`/api/purchases/debit-notes`):

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Listar notas débito |
| POST | `/` | requireAuth | Crear nota débito con ítems |
| GET | `/:id` | requireAuth | Detalle + ítems |
| PUT | `/:id` | requireAuth | Editar (solo `draft`) |
| PATCH | `/:id/status` | requireAuth | Cambiar estado (enviar, aplicar, cancelar) |

**Entregas de Distribuidoras** (`/api/supplier-deliveries`) — *exclusivo para negocios tipo Colmado*:

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/` | requireAuth | Historial de entregas a crédito |
| POST | `/` | requireAuth | Registrar entrega a crédito del suplidor |
| POST | `/:id/payment` | requireAuth | Registrar abono a la deuda |
| GET | `/summary` | requireAuth | Resumen de deuda total por suplidor |

---

## 6. Relaciones entre Módulos

### Diagrama de Dependencias (simplificado)

```
organizations
└── users

contacts (proveedores / clientes)
├── supplier_invoices         (proveedor → facturas recibidas)
├── purchase_orders           (proveedor → órdenes de compra)
├── supplier_payments         (proveedor → pagos emitidos)
├── debit_notes               (proveedor → notas débito)
├── recurring_payments        (proveedor → pagos recurrentes)
├── egresos_fijos             (proveedor → gastos fijos)
├── egresos_registros         (proveedor → registros de gasto)
├── ingresos_fijos            (cliente → ingresos fijos contratados)
└── ingresos_registros        (cliente → cobros registrados)

products
├── supplier_invoice_items    (producto comprado en factura)
├── purchase_order_items      (producto ordenado)
├── debit_note_items          (producto devuelto)
├── ingresos_fijos            (producto/servicio que genera ingreso)
└── ingresos_registros        (producto/servicio cobrado)

bank_accounts
├── bank_transactions         (movimientos de la cuenta)
├── egresos_fijos             (gasto que débita esta cuenta)
├── egresos_registros         (pago de gasto de esta cuenta)
├── ingresos_fijos            (ingreso que acredita esta cuenta)
├── ingresos_registros        (cobro recibido en esta cuenta)
├── supplier_payments         (pago a proveedor desde esta cuenta)
└── recurring_payments        (pago recurrente de esta cuenta)

supplier_invoices
├── supplier_invoice_items    (ítems de la factura)
├── payment_allocations       (distribución de pagos aplicados)
└── debit_notes               (notas débito referenciando la factura)

supplier_payments
└── payment_allocations       (cómo se distribuye el pago)

purchase_orders
├── purchase_order_items      (ítems de la orden)
└── supplier_invoices         (factura generada desde esta orden)

petty_cash_funds
└── petty_cash                (transacciones del fondo)

accounts (Plan Contable / GL)
└── bank_accounts             (cuenta bancaria → cuenta contable)
```

---

## 7. Lógica de Negocio Compartida

### 7.1 Helpers de Frecuencia y Fechas (`server/egreso-helpers.ts`)

Funciones disponibles:

```typescript
avanzarProximaFecha(fecha: Date, frecuencia: string): Date
// Calcula la siguiente fecha según la frecuencia del ciclo

retrocederFecha(fecha: Date, frecuencia: string): Date
// Retrocede la fecha al ciclo anterior (útil para correcciones)

calcTasaDiaria(montoMensual: number): number
// monto / días en el mes corriente

calcMontoMensual(monto: number, frecuencia: string): number
// Normaliza el monto a su equivalente mensual en DOP

calcMontoAnual(monto: number, frecuencia: string): number
// Normaliza el monto a su equivalente anual
```

**Tabla de normalización a mensual:**

| Frecuencia | Operación | Ejemplo (monto: 1,000) |
|------------|-----------|----------------------|
| `diario` | × 30 | 30,000/mes |
| `semanal` | × 4.33 | 4,330/mes |
| `quincenal` | × 2 | 2,000/mes |
| `mensual` | × 1 | 1,000/mes |
| `bimestral` | ÷ 2 | 500/mes |
| `trimestral` | ÷ 3 | 333/mes |
| `semestral` | ÷ 6 | 167/mes |
| `anual` | ÷ 12 | 83/mes |

### 7.2 Conversión de Monedas

```typescript
// Obtener tasas de cambio de la org (desde tabla currencies)
async function getExchangeRates(orgId: string): Promise<Record<string, number>>
// Retorna: { DOP: 1, USD: 59.5, EUR: 64.2 }

// Convertir monto a DOP
function toDOP(monto: number, moneda: string, rates: Record<string, number>): number
// Si moneda = DOP → retorna monto tal cual
// Si moneda = USD → retorna monto × rates.USD
```

### 7.3 Coerciones Numéricas (`server/coerce-utils.ts`)

`coerceMontos()` convierte strings a numbers en los campos de monto antes de insertar en BD. Previene errores de tipo cuando el frontend envía valores como cadenas de texto (caso común con inputs de formulario).

### 7.4 Integración Automática con Cuentas Bancarias

Cuando cualquier registro (egreso, ingreso, pago de factura) incluye un `cuenta_bancaria_id`:

1. Se crea automáticamente un `bank_transactions`:
   - `type = 'salida'` para egresos y pagos a proveedores.
   - `type = 'entrada'` para ingresos cobrados.
2. El `balance` de la cuenta se actualiza atómicamente.
3. El campo `source` de la transacción identifica el módulo de origen.

### 7.5 Validación Multi-Tenant

Antes de insertar cualquier FK foránea (categoría, fijo, cuenta bancaria, contacto, producto), el sistema valida que el recurso referenciado pertenezca a la misma `organization_id` del usuario autenticado.

Si la validación falla → `403 Forbidden` con mensaje descriptivo.

### 7.6 Alertas por Email (`server/email.ts` + cron jobs)

| Evento | Condición | Destinatario |
|--------|-----------|-------------|
| Gasto fijo vencido | `proxima_fecha < hoy` y sin pago | Admin de la org |
| Gasto fijo próximo | `proxima_fecha <= hoy + alert_dias_previos` | Admin de la org |
| Ingreso próximo a cobrar | `proxima_fecha <= hoy + alert_dias_previos` | Admin de la org |
| Saldo bancario bajo | `balance < alert_threshold` | Admin de la org |
| Tarjeta por cerrar | `statement_closing_day` próximo | Admin de la org |
| Tarjeta por vencer | `payment_due_day` próximo | Admin de la org |

### 7.7 Exportación de Datos

Los historiales de Egresos e Ingresos soportan exportación con los filtros aplicados:
- **CSV:** Compatible con Excel y Google Sheets.
- **PDF:** Con logo de la empresa y encabezados del período.

---

## Apéndice A – Archivos del Proyecto

| Archivo | Módulo | Descripción |
|---------|--------|-------------|
| `shared/schema.ts` | Todos | Definición de tablas Drizzle ORM (6,611 líneas totales) |
| `server/egreso-routes.ts` | Egresos | Routes + lógica de negocio (1,408 líneas) |
| `server/ingreso-routes.ts` | Ingresos | Routes + lógica de negocio (1,228 líneas) |
| `server/egreso-helpers.ts` | Egresos + Ingresos | Cálculos de fechas y normalización de montos |
| `server/coerce-utils.ts` | Todos | Coerciones de tipos numéricos |
| `server/routes.ts` | Todos | Router central que monta sub-routers |
| `server/bank-credit-cron.ts` | Bancos | Cron job para alertas de tarjetas de crédito |
| `server/supplier-delivery-routes.ts` | Compras/Colmado | Entregas a crédito de distribuidoras |
| `client/src/pages/egresos/dashboard.tsx` | Egresos | Dashboard con KPIs y gráficos |
| `client/src/pages/egresos/fijos.tsx` | Egresos | Lista y gestión de gastos fijos |
| `client/src/pages/egresos/variables.tsx` | Egresos | Registro de gastos variables |
| `client/src/pages/egresos/historial.tsx` | Egresos | Historial paginado con filtros y exportación |
| `client/src/pages/egresos/categorias.tsx` | Egresos | CRUD de categorías |
| `client/src/pages/ingresos/dashboard.tsx` | Ingresos | Dashboard con KPIs y gráficos |
| `client/src/pages/ingresos/fijos.tsx` | Ingresos | Lista y gestión de ingresos fijos |
| `client/src/pages/ingresos/variables.tsx` | Ingresos | Registro de ingresos variables |
| `client/src/pages/ingresos/historial.tsx` | Ingresos | Historial paginado con filtros y exportación |
| `client/src/pages/ingresos/categorias.tsx` | Ingresos | CRUD de categorías |
| `client/src/pages/banks.tsx` | Bancos | Página única del módulo (~2,500 líneas) |
| `client/src/components/bank-form.tsx` | Bancos | Modal para crear/editar cuentas bancarias |
| `client/src/lib/bancos-por-pais.ts` | Bancos | Catálogo de bancos por país |
| `client/src/components/expense-form.tsx` | Egresos | Formulario reutilizable de gastos |
| `client/src/components/expense-distribution.tsx` | Egresos | Gráfico de distribución por categoría |
| `client/src/components/income-form.tsx` | Ingresos | Formulario reutilizable de ingresos |
| `client/src/pages/purchases/supplier-invoices.tsx` | Compras | Lista de facturas de proveedores |
| `client/src/pages/purchases/supplier-invoice-form.tsx` | Compras | Formulario crear/editar factura |
| `client/src/pages/purchases/purchase-orders.tsx` | Compras | Lista de órdenes de compra |
| `client/src/pages/purchases/purchase-order-form.tsx` | Compras | Formulario crear/editar orden |
| `client/src/pages/purchases/payments.tsx` | Compras | Pagos a proveedores |
| `client/src/pages/purchases/payment-form.tsx` | Compras | Formulario de pago con distribución |
| `client/src/pages/purchases/recurring-payments.tsx` | Compras | Pagos recurrentes |
| `client/src/pages/purchases/recurring-payment-form.tsx` | Compras | Formulario pago recurrente |
| `client/src/pages/purchases/petty-cash.tsx` | Compras | Gestión de caja chica |
| `client/src/pages/purchases/petty-cash-form.tsx` | Compras | Registro de gasto menor |
| `client/src/pages/purchases/debit-notes.tsx` | Compras | Lista de notas débito |
| `client/src/pages/purchases/debit-note-form.tsx` | Compras | Formulario nota débito |

---

## Apéndice B – Reglas de Negocio Críticas

### Egresos

1. **Pagos parciales de gastos fijos:** Al registrar un abono menor al monto total, el ciclo queda en estado `parcial`. La `proxima_fecha` solo avanza cuando `total_pagado_ciclo >= monto`. El acumulado se resetea a `0` al completar el ciclo.

2. **Eliminación de categorías:** Antes de borrar una categoría, el sistema nullifica `categoria_id` en todos los `egresos_fijos` y `egresos_registros` relacionados, para no violar restricciones de FK.

3. **Alertas de vencimiento:** El cálculo de alertas no es un campo almacenado — se computa en tiempo real al listar los fijos comparando `proxima_fecha` con `today + alert_dias_previos`.

### Ingresos

4. **Cobro de ingresos fijos es completo por diseño:** A diferencia de los gastos (que admiten abonos parciales), un cobro de ingreso fijo siempre avanza la `proxima_fecha` sin importar si el monto es parcial. Si se quiere reflejar un cobro parcial, se registra como ingreso variable con el monto real.

### Bancos

5. **La conciliación bancaria es irreversible:** Una vez que una transacción pasa a `status = reconciled`, no puede deshacerse desde la UI. Requiere intervención directa en base de datos.

6. **Las transferencias son atómicas:** Si cualquier paso de una transferencia falla (débito, crédito o asiento contable), toda la operación se revierte mediante una transacción de base de datos.

7. **El saldo de la cuenta se recalcula en tiempo real:** No hay una columna calculada — el `balance` en `bank_accounts` se actualiza directamente en cada inserción de `bank_transactions`.

### Compras

8. **Distribución de pagos actualiza facturas automáticamente:** Al crear un `payment_allocation`, el backend recalcula `paid_amount = SUM(allocations)` y `balance_amount = total_amount - paid_amount` en la factura. Si `balance_amount = 0` → el status cambia a `paid`.

9. **Las notas débito no afectan inventario automáticamente:** Registrar una nota débito no mueve el stock. El ajuste de inventario debe hacerse manualmente en el módulo de inventario.

10. **La caja chica requiere flujo de aprobación:** Montos que superen el `approval_limit` del fondo quedan en `status = pending` hasta que un admin los apruebe o rechace. Los rechazados no afectan el saldo del fondo.

11. **Las órdenes de compra son documentos independientes:** Una orden no genera ningún movimiento contable ni de inventario. El impacto ocurre cuando se convierte en factura de proveedor (`invoiced`) y cuando se registra la recepción.

12. **NCF fiscal en República Dominicana:** Las facturas de proveedores y notas débito almacenan `ncf_type` y `ncf_number` para cumplimiento con la DGII. Tipos más comunes en compras: B02 (Facturas por compras de B/S para el Giro del Negocio), B04 (Notas de Débito), B14 (Régimen especial).
