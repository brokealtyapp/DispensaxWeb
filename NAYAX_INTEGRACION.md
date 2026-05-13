# Dispensax — Integración Nayax Lynx
## Estado actual, funcionalidad construida y hoja de ruta

**Versión:** 1.0  
**Fecha:** Mayo 2026  
**API destino:** Nayax Lynx Operational API v1 (`https://lynx.nayax.com/operational/api/v1`)

---

## Tabla de Contenidos

1. [¿Qué es Nayax?](#1-qué-es-nayax)
2. [Arquitectura de la integración](#2-arquitectura-de-la-integración)
3. [Lo que está construido](#3-lo-que-está-construido)
   - [3.1 Configuración del tenant](#31-configuración-del-tenant)
   - [3.2 Vinculación de máquinas](#32-vinculación-de-máquinas)
   - [3.3 Sincronización de ventas](#33-sincronización-de-ventas)
   - [3.4 Categorización de métodos de pago](#34-categorización-de-métodos-de-pago)
   - [3.5 Módulo frontend Nayax](#35-módulo-frontend-nayax)
   - [3.6 Conciliación cruzada](#36-conciliación-cruzada)
4. [Esquema de base de datos](#4-esquema-de-base-de-datos)
5. [Endpoints API disponibles](#5-endpoints-api-disponibles)
6. [Guía de configuración paso a paso](#6-guía-de-configuración-paso-a-paso)
7. [Lo que está pendiente](#7-lo-que-está-pendiente)
8. [Glosario de términos Nayax](#8-glosario-de-términos-nayax)
9. [Advertencias y limitaciones actuales](#9-advertencias-y-limitaciones-actuales)

---

## 1. ¿Qué es Nayax?

**Nayax** es una empresa israelí de tecnología financiera especializada en terminales de pago cashless (sin efectivo) para máquinas expendedoras. Sus dispositivos se instalan en la máquina y permiten aceptar tarjetas de crédito/débito, pagos NFC, Apple Pay, Google Pay y billeteras digitales.

**Nayax Lynx** es su plataforma de gestión operativa en la nube, que expone una API REST para consultar el estado de las máquinas, obtener historial de transacciones y configurar productos/planogramas de forma remota.

### Por qué es relevante para Dispensax

La mayoría de las máquinas expendedoras en RD tienen lector de efectivo (monedas/billetes) y opcionalmente un dispositivo Nayax para pagos cashless. Dispensax necesita integrar ambas fuentes de datos (efectivo recolectado manualmente + transacciones cashless de Nayax) para:

- Tener una visión unificada de los ingresos por máquina
- Hacer conciliación cruzada: confrontar el efectivo físico contado contra las ventas que reporta Nayax
- Detectar faltantes, excedentes o inconsistencias automáticamente
- Eliminar el ingreso manual de ventas cashless

---

## 2. Arquitectura de la integración

```
┌─────────────────────────────────────────────────────┐
│                   DISPENSAX                         │
│                                                     │
│  Frontend (React)                                   │
│  └─► Módulo Nayax (/nayax)                         │
│      └─► Configuración, vinculación, dashboard      │
│                                                     │
│  Backend (Express)                                  │
│  └─► server/nayax.ts  ──────────────────────────┐  │
│      ├─ getNayaxToken()                          │  │
│      ├─ getAllNayaxMachines()                    │  │
│      ├─ getNayaxMachineLastSales()              │  │
│      ├─ syncNayaxSalesForTenant()              │  │
│      ├─ categorizePaymentMethod()              │  │
│      └─ enqueueLaneChangeForNayax() [STUB]    │  │
│                                                │  │
│  Base de datos (PostgreSQL)                   │  │
│  ├─ nayax_config      (token por tenant)      │  │
│  └─ nayax_transactions (ventas importadas)    │  │
└────────────────────────────────────────────────│──┘
                                                 │
                                    HTTP Bearer Token
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────┐
│              NAYAX LYNX API                        │
│   https://lynx.nayax.com/operational/api/v1        │
│                                                    │
│   GET  /machines           ← Lista máquinas        │
│   GET  /machines/:id       ← Detalle máquina       │
│   GET  /machines/:id/lastSales ← Últimas ventas    │
└────────────────────────────────────────────────────┘
```

**Modelo de autenticación:** Bearer Token (API Token) por tenant. Cada empresa cliente tiene su propio token de Nayax Lynx, almacenado cifrado en `nayax_config`.

**Modelo de datos:** Pull-based (Dispensax consulta a Nayax). No hay webhooks activos en este momento.

---

## 3. Lo que está construido

### 3.1 Configuración del tenant

Cada tenant (empresa) puede configurar su propia conexión Nayax. La configuración se almacena en la tabla `nayax_config` y contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `apiToken` | text | Bearer token de Nayax Lynx |
| `isEnabled` | boolean | Activa/desactiva la integración |
| `autoSyncSales` | boolean | Sincronización automática de ventas (UI disponible, scheduler pendiente) |
| `autoSyncMachines` | boolean | Sync automático de máquinas (pendiente) |
| `syncIntervalMinutes` | integer | Frecuencia deseada de sincronización |
| `lastSyncAt` | timestamp | Última vez que se ejecutó un sync exitoso |

**Quién puede configurar:** Solo el rol `admin` del tenant.

**Cómo probar la conexión:** El backend tiene un endpoint `POST /api/nayax/test-connection` que llama a `GET /machines?ResultsLimit=1` en Lynx y devuelve si la respuesta fue exitosa o el error obtenido.

### 3.2 Vinculación de máquinas

Para que Dispensax pueda obtener las ventas de una máquina, primero hay que vincularla: asociar la máquina en Dispensax con su ID en Nayax Lynx.

**Campos añadidos a la tabla `machines`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nayaxMachineId` | integer | ID de la máquina en Nayax |
| `nayaxDeviceSerial` | text | Serial del dispositivo VPOS Nayax |
| `nayaxLinkedAt` | timestamp | Fecha en que se realizó el vínculo |

**Flujo de vinculación:**
1. Admin abre módulo Nayax → pestaña "Máquinas"
2. Sistema muestra las máquinas disponibles en Lynx (consultando `/machines`)
3. Admin selecciona una máquina Nayax y la asocia a una máquina Dispensax
4. El vínculo queda guardado; a partir de ese momento los syncs incluirán esa máquina

**Desvincular:** El admin puede desvincular en cualquier momento (`POST /api/nayax/unlink-machine`). Las transacciones ya importadas permanecen en `nayax_transactions`.

### 3.3 Sincronización de ventas

La función principal de la integración: importar las transacciones cashless de Nayax a la base de datos local.

**Función:** `syncNayaxSalesForTenant(tenantId)`

**Lógica:**
1. Obtiene el token del tenant desde `nayax_config`
2. Consulta todas las máquinas vinculadas (`nayaxMachineId IS NOT NULL`)
3. Para cada máquina, llama a `GET /machines/:id/lastSales`
4. Transforma la respuesta al formato interno `InsertNayaxTransaction`
5. Hace UPSERT en `nayax_transactions` usando `(tenantId, transactionId)` como clave única — evita duplicados al re-sincronizar

**Resultado devuelto:**
```
{
  machinesProcessed: number,   // Máquinas consultadas
  transactionsUpserted: number, // Filas insertadas/actualizadas
  errors: [{ machineId, error }] // Errores por máquina
}
```

**Cuándo se ejecuta (actualmente):** Solo de forma manual vía botón en la UI o endpoint `POST /api/nayax/sync-sales`. El scheduler automático está pendiente de implementar.

**Endpoint:** `POST /api/nayax/sync-sales` (roles: admin, supervisor)

### 3.4 Categorización de métodos de pago

La función `categorizePaymentMethod(method)` transforma el valor crudo de Nayax (strings como `"CREDIT_CARD"`, `"COIN_ACCEPTOR"`, `"NFC_CONTACTLESS"`) en una de tres categorías estándar:

| Categoría | Ejemplos de métodos |
|-----------|---------------------|
| `cash` | coin, bill, cash, mdb, efectivo, currency |
| `card` | card, credit, debit, emv, nfc, contactless, apple pay, google pay, wallet |
| `other` | Cualquier valor no reconocido |

Esta categorización permite a Dispensax separar ventas en efectivo vs. cashless en los reportes de conciliación, sin depender de la nomenclatura exacta de Nayax.

### 3.5 Módulo frontend Nayax

Página completa en `/nayax` (acceso: admin y supervisor). Organizada en 4 pestañas:

#### Pestaña "Resumen"
- KPIs: total de ventas Nayax del período, desglose efectivo/tarjeta/otro
- Gráfica de área (Recharts) con ventas por día
- Indicador de estado de conexión (conectado / sin configurar / deshabilitado)
- Botón "Sincronizar ahora"

#### Pestaña "Máquinas"
- Lista de todas las máquinas Nayax disponibles en Lynx
- Estado de vinculación con máquinas Dispensax
- Acciones: Vincular / Desvincular / Ver últimas ventas
- Dialog de vinculación: seleccionar máquina Dispensax de un dropdown

#### Pestaña "Transacciones"
- Tabla de transacciones importadas con filtros por máquina, período y categoría de pago
- Columnas: fecha, máquina, producto, método de pago, monto, categoría

#### Pestaña "Configuración"
- Formulario para ingresar/actualizar el API Token
- Toggle para activar/desactivar la integración
- Configuración de auto-sync (frecuencia en minutos)
- Botón "Probar conexión" con feedback inmediato

### 3.6 Conciliación cruzada

El módulo de **Conciliación Cruzada** (accesible desde Contabilidad) usa los datos de Nayax para hacer un cruce formal entre:

- **Fondo inicial** dado al abastecedor
- **Ventas Nayax** (cashless, importadas)
- **Movimientos de efectivo** registrados en Dispensax
- **Conteo físico** realizado por el técnico
- **Carriles vacíos** al final del servicio

El resultado es un reporte de conciliación por máquina que muestra:
- Total teórico esperado
- Total real (contado + Nayax)
- Diferencia (faltante/sobrante)
- Desglose efectivo vs. cashless

**Exportación:** CSV y PDF disponibles. El acceso a exportaciones está controlado por `authorizeOwnership`.

La conciliación también genera datos de facturación por máquina con gráficas de tendencia mensual.

---

## 4. Esquema de base de datos

### Tabla `nayax_config`

```sql
CREATE TABLE nayax_config (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL UNIQUE,
  api_token   TEXT,
  is_enabled  BOOLEAN DEFAULT false,
  auto_sync_sales    BOOLEAN DEFAULT false,
  auto_sync_machines BOOLEAN DEFAULT false,
  sync_interval_minutes INTEGER DEFAULT 60,
  last_sync_at TIMESTAMP
);
```

### Tabla `nayax_transactions`

```sql
CREATE TABLE nayax_transactions (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL,
  machine_id                   TEXT NOT NULL,       -- FK a machines.id
  nayax_machine_id             INTEGER NOT NULL,    -- ID en Nayax Lynx
  transaction_id               TEXT NOT NULL,       -- ID único en Nayax
  payment_service_transaction_id TEXT,
  payment_method               TEXT,               -- Valor crudo de Nayax
  payment_category             TEXT,               -- cash | card | other
  card_brand                   TEXT,
  currency_code                TEXT DEFAULT 'DOP',
  settlement_value             NUMERIC NOT NULL,   -- Valor liquidado (RD$)
  authorization_value          NUMERIC,            -- Valor autorizado
  product_name                 TEXT,
  quantity                     INTEGER DEFAULT 1,
  settlement_date              TIMESTAMP NOT NULL,
  authorization_date           TIMESTAMP,
  synced_at                    TIMESTAMP,
  raw                          JSONB,              -- Respuesta completa de Nayax

  UNIQUE (tenant_id, transaction_id)
);

-- Índices de rendimiento
CREATE UNIQUE INDEX uq_nayax_tx_tenant_txid ON nayax_transactions (tenant_id, transaction_id);
CREATE INDEX idx_nayax_tx_machine_date ON nayax_transactions (machine_id, settlement_date);
CREATE INDEX idx_nayax_tx_tenant_date  ON nayax_transactions (tenant_id, settlement_date);
CREATE INDEX idx_nayax_tx_category     ON nayax_transactions (tenant_id, payment_category);
```

### Campos en tabla `machines`

```sql
-- Campos añadidos para vínculo con Nayax:
nayax_machine_id   INTEGER,    -- ID de la máquina en Nayax Lynx
nayax_device_serial TEXT,      -- Serial del VPOS
nayax_linked_at    TIMESTAMP,  -- Fecha de vinculación
```

---

## 5. Endpoints API disponibles

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/api/nayax/config` | admin | Obtiene configuración Nayax del tenant |
| `POST` | `/api/nayax/config` | admin | Guarda/actualiza configuración |
| `POST` | `/api/nayax/test-connection` | admin | Prueba la conexión con Lynx |
| `GET` | `/api/nayax/machines` | admin | Lista máquinas desde Nayax Lynx |
| `GET` | `/api/nayax/machines/:id/sales` | admin, supervisor | Últimas ventas de una máquina Nayax |
| `POST` | `/api/nayax/link-machine` | admin | Vincula máquina Dispensax ↔ Nayax |
| `POST` | `/api/nayax/unlink-machine` | admin | Desvincula máquina |
| `GET` | `/api/nayax/linked-machines` | admin, supervisor | Lista máquinas vinculadas |
| `POST` | `/api/nayax/sync-sales` | admin, supervisor | Ejecuta sincronización manual de ventas |

---

## 6. Guía de configuración paso a paso

### Paso 1: Obtener el API Token de Nayax

1. Inicia sesión en el portal Nayax Lynx de tu empresa
2. Ve a **Configuración → API** (o contacta al soporte de Nayax para obtener el token)
3. Copia el Bearer Token (cadena larga alfanumérica)

### Paso 2: Configurar el token en Dispensax

1. Inicia sesión como **Administrador** en Dispensax
2. Ve a **Integraciones → Nayax** en el menú lateral
3. Haz clic en la pestaña **"Configuración"**
4. Pega el token en el campo "API Token"
5. Activa el toggle **"Integración habilitada"**
6. Haz clic en **"Guardar configuración"**
7. Haz clic en **"Probar conexión"**
   - Si aparece "Conexión exitosa" → continúa al paso 3
   - Si aparece un error → verifica el token y que tu cuenta Nayax tenga acceso a la API

### Paso 3: Vincular tus máquinas

1. Ve a la pestaña **"Máquinas"**
2. Verás dos listas:
   - **Izquierda:** Máquinas en Nayax Lynx (con su nombre y número de serie)
   - **Derecha:** Máquinas en Dispensax (con zona y código)
3. Para cada máquina con dispositivo Nayax:
   - Haz clic en el botón **"Vincular"** junto a la máquina Nayax
   - En el diálogo, selecciona la máquina Dispensax correspondiente
   - Confirma el vínculo
4. Repite para todas las máquinas que tengan VPOS Nayax instalado

### Paso 4: Sincronizar ventas

1. Ve a la pestaña **"Resumen"**
2. Haz clic en **"Sincronizar ahora"**
3. Espera el resultado (puede tomar unos segundos dependiendo del número de máquinas)
4. Verás el número de transacciones importadas
5. Las ventas ahora aparecerán en la pestaña "Transacciones" y en el módulo de Conciliación

### Paso 5: Usar en Conciliación

1. Ve a **Contabilidad → Conciliación Cruzada**
2. Selecciona la máquina y el período
3. El sistema cargará automáticamente las ventas Nayax sincronizadas
4. Completa el conteo físico y el fondo inicial
5. El reporte de conciliación mostrará diferencias detectadas

---

## 7. Lo que está pendiente

### Alta prioridad

#### 7.1 Scheduler de sincronización automática
**Estado:** La UI permite configurar el intervalo (en minutos) pero el scheduler del backend no está implementado.

**Qué falta:**
- Un job periódico (cron o setInterval) que llame a `syncNayaxSalesForTenant` para todos los tenants que tengan `autoSyncSales = true`
- Actualizar `lastSyncAt` en `nayax_config` tras cada sync
- Manejar errores por tenant sin afectar a otros

**Impacto:** Sin esto, el sync es 100% manual.

#### 7.2 Sincronización con rango de fechas
**Estado:** Actualmente se usa el endpoint `/lastSales` de Nayax, que devuelve solo las últimas N transacciones sin filtro de fecha.

**Qué falta:**
- Determinar si Lynx ofrece filtro de fecha en el endpoint de ventas
- Si no lo ofrece, implementar lógica de cursor basada en `settlement_date` máximo de la BD
- Evitar importar transacciones ya procesadas (actualmente el UPSERT lo maneja pero es ineficiente)

**Impacto:** Al crecer el histórico, el sync se vuelve costoso en tiempo y llamadas API.

#### 7.3 Sincronización de planograma (lane_change_events → Nayax)
**Estado:** La función `enqueueLaneChangeForNayax()` en `server/nayax.ts` es un **stub no-op** con un TODO explícito.

```typescript
// TODO Nayax sync: integrar con Lynx API cuando esté disponible.
export async function enqueueLaneChangeForNayax(_event): Promise<void> {
  return; // No hace nada
}
```

Los registros en `lane_change_events` tienen campo `syncStatus = "pending"` pero nunca se actualizan a `"synced"`.

**Qué falta:**
- Investigar el endpoint de Lynx para asignación de planograma (producto → carril)
- Implementar la llamada real
- Implementar reintentos con backoff exponencial
- Actualizar `syncStatus` en la BD (pendiente → synced/failed)

**Impacto:** Los cambios de producto en carriles que se hacen en Dispensax no se reflejan en Nayax, causando que Nayax reporte nombres de producto incorrectos.

### Media prioridad

#### 7.4 Webhooks / Push de Nayax
**Estado:** No implementado. Toda la comunicación es pull (Dispensax consulta a Nayax).

**Qué falta:**
- Verificar si Nayax Lynx ofrece webhooks
- Si los ofrece, implementar endpoint receptor en Dispensax
- Validar firma/autenticación del webhook

**Impacto:** Las ventas cashless no llegan en tiempo real; hay un delay hasta el próximo sync manual.

#### 7.5 Operaciones cashless bidireccionales
**Estado:** Solo se leen datos de Nayax. No se escriben.

**Qué falta (potencial):**
- Enviar precios actualizados a Nayax (cuando cambia el precio de un producto)
- Habilitar/deshabilitar productos en la máquina desde Dispensax
- Configurar fondos de cambio en el lector cashless

#### 7.6 Dashboard de estado de dispositivos
**Estado:** El campo `MachineStatusBit` de Nayax se recibe pero no se interpreta ni se muestra.

**Qué falta:**
- Decodificar el bitmask de `MachineStatusBit` según la documentación de Nayax
- Mostrar alertas cuando el dispositivo VPOS tiene problemas de conectividad
- Integrar el estado del VPOS con las alertas del dashboard de Dispensax

### Baja prioridad

#### 7.7 Historial completo de transacciones
Actualmente solo se obtiene `/lastSales` (últimas ventas). Para historial completo habría que explorar si Lynx ofrece paginación o endpoints de rango histórico.

#### 7.8 Multi-tenant Nayax
Actualmente cada tenant tiene un único token. Si un tenant tiene múltiples cuentas Nayax (por ejemplo, una por sucursal), la arquitectura actual no lo soporta.

---

## 8. Glosario de términos Nayax

| Término | Definición |
|---------|------------|
| **Lynx** | Plataforma de gestión en la nube de Nayax (antes llamada NayaX Management System - NMS) |
| **VPOS** | Virtual Point of Sale — el dispositivo Nayax físico instalado en la máquina |
| **MachineID** | Identificador numérico de la máquina en el sistema Nayax |
| **MachineStatusBit** | Campo bitmask que codifica el estado del dispositivo (conectado, batería baja, etc.) |
| **TransactionID** | Identificador único de una transacción en Nayax |
| **PaymentServiceTransactionID** | ID de la transacción en la red de pago (Visa, Mastercard, etc.) |
| **AuthorizationValue** | Monto autorizado al momento del pago (puede diferir del liquidado) |
| **SettlementValue** | Monto real liquidado/cobrado — el que se usa en Dispensax |
| **AuthorizationDateTimeGMT** | Fecha/hora de autorización en UTC |
| **SettlementDateTimeGMT** | Fecha/hora de liquidación en UTC |
| **PaymentMethod** | Método de pago tal como lo reporta Nayax (string crudo, ej: `"CREDIT_CARD"`) |
| **PaymentCategory** | Categoría normalizada por Dispensax: `cash`, `card` u `other` |
| **CardBrand** | Marca de la tarjeta: Visa, Mastercard, Amex, etc. |
| **RecognitionMethod** | Cómo se reconoció el pago (contactless, chip, swipe) |
| **Planogram** | Configuración de qué producto va en qué carril/posición de la máquina |
| **MDB** | Multi-Drop Bus — protocolo de comunicación entre el lector de efectivo y la máquina. En el contexto de Nayax, ventas MDB son ventas en efectivo. |
| **Bearer Token** | Método de autenticación HTTP: el token se envía en el header `Authorization: Bearer <token>` |
| **UPSERT** | Operación de base de datos que inserta un registro nuevo o actualiza el existente si ya existe |
| **Bitmask** | Número entero donde cada bit representa una bandera de estado independiente |

---

## 9. Advertencias y limitaciones actuales

### Delay de datos
Las ventas cashless solo están disponibles en Dispensax después de ejecutar un sync manual. En entornos de producción esto puede representar un retraso de horas entre la venta real y su visibilidad en el sistema.

**Solución temporal:** Ejecutar sync manualmente antes de cada conciliación.

### `/lastSales` sin filtro de fecha
El endpoint de Nayax que usamos devuelve las últimas ventas sin especificar cuántas ni desde cuándo. Depende de la configuración de Nayax cuántas transacciones incluye. Si no se sincroniza con frecuencia suficiente, pueden perderse transacciones del rango intermedio.

**Mitigación:** El UPSERT garantiza que re-sincronizar no duplique datos, pero no recupera transacciones que hayan "caído" fuera de la ventana de `/lastSales`.

### Planograma desincronizado
Cuando se cambia un producto de carril en Dispensax (módulo Layout y Auditoría de Bandejas), ese cambio NO se refleja en Nayax. Nayax seguirá reportando el nombre de producto antiguo para ese carril hasta que se implemente la sincronización de planograma (tarea pendiente 7.3).

### Token único por tenant
El token de Nayax otorga acceso a TODAS las máquinas de la cuenta Nayax del cliente. No hay granularidad a nivel de máquina individual. Si el token se compromete, todas las máquinas quedan expuestas.

**Mitigación:** El token se almacena en la base de datos del servidor y nunca se expone al cliente frontend.

### Zona horaria
Las fechas de transacción de Nayax vienen en UTC (`GMT`). Dispensax las almacena tal cual en UTC y las convierte a `America/Santo_Domingo` (GMT-4) al mostrarlas en la UI. Verificar que los reportes de conciliación usan la misma zona horaria en ambos lados para evitar discrepancias de un día.

### Dependencia de disponibilidad de Lynx
Si la API de Nayax Lynx tiene downtime, los syncs fallarán. Los errores se reportan por máquina en el resultado del sync pero no generan alertas automáticas. El usuario debe revisar manualmente el resultado.

---

*Este documento refleja el estado de la integración a mayo 2026. Actualizar al implementar cada item de la sección 7.*
