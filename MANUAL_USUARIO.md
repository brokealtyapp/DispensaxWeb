# Manual de Usuario - Dispensax
## Sistema de Gestión de Máquinas Expendedoras

**Versión:** 2.0  
**Fecha:** Enero 2026  
**Zona Horaria:** América/Santo_Domingo (GMT-4)  
**Moneda:** Pesos Dominicanos (RD$)

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Guía por Perfil de Usuario](#3-guía-por-perfil-de-usuario)
   - [3.1 Administrador](#31-administrador)
   - [3.2 Supervisor](#32-supervisor)
   - [3.3 Abastecedor](#33-abastecedor)
   - [3.4 Almacén](#34-almacén)
   - [3.5 Contabilidad](#35-contabilidad)
   - [3.6 Recursos Humanos](#36-recursos-humanos)
4. [Guía por Módulo](#4-guía-por-módulo)
   - [4.1 Dashboard](#41-dashboard)
   - [4.2 Máquinas](#42-máquinas)
   - [4.3 Almacén](#43-almacén)
   - [4.4 Productos](#44-productos)
   - [4.5 Gestión de Rutas](#45-gestión-de-rutas)
   - [4.6 Combustible](#46-combustible)
   - [4.7 Contabilidad](#47-contabilidad)
   - [4.8 Caja Chica](#48-caja-chica)
   - [4.9 Compras](#49-compras)
   - [4.10 Recursos Humanos](#410-recursos-humanos)
   - [4.11 Reportes](#411-reportes)
   - [4.12 Configuración](#412-configuración)
   - [4.13 Dinero y Productos](#413-dinero-y-productos)
   - [4.14 Monitoreo de Servicios](#414-monitoreo-de-servicios)
   - [4.15 Gestión de Abastecedores](#415-gestión-de-abastecedores)
   - [4.16 Calendario](#416-calendario)
   - [4.17 Mi Vehículo](#417-mi-vehículo)
   - [4.18 Panel de Almacén](#418-panel-de-almacén)
   - [4.19 Panel de Contabilidad](#419-panel-de-contabilidad)
   - [4.20 Detalle de Máquina](#420-detalle-de-máquina)
   - [4.21 Gestión de Ubicaciones](#421-gestión-de-ubicaciones)
   - [4.22 Gestión de Paradas de Ruta](#422-gestión-de-paradas-de-ruta)
5. [Preguntas Frecuentes](#5-preguntas-frecuentes)
6. [Glosario](#glosario)
7. [Anexo A: Matriz de Permisos](#anexo-a-matriz-de-permisos-por-rol)

---

## 1. Introducción

Dispensax es un sistema integral para la gestión de máquinas expendedoras de bebidas. El sistema permite:

- **Control de Inventario**: Seguimiento de productos desde el almacén hasta las máquinas
- **Gestión de Rutas**: Planificación y seguimiento de rutas de abastecimiento
- **Contabilidad**: Control de ventas, gastos y recaudaciones
- **Recursos Humanos**: Gestión de empleados, asistencia y nómina
- **Reportes**: Análisis detallado del rendimiento del negocio

### Características Principales

- Sistema de permisos granular por rol
- Trazabilidad completa de lotes (FEFO - First Expired, First Out)
- Transacciones atómicas para garantizar consistencia de datos
- Soporte para modo oscuro/claro
- Diseño responsivo para uso en dispositivos móviles

---

## 2. Acceso al Sistema

### 2.1 Inicio de Sesión

Para acceder al sistema:

1. Navegue a la página principal de Dispensax
2. Ingrese su **nombre de usuario** y **contraseña**
3. Haga clic en **"Iniciar Sesión"**

**Ejemplo Práctico:**
> Usuario: `jperez`  
> Contraseña: `MiContraseña123`  
> Hacer clic en "Iniciar Sesión" → El sistema lo redirigirá a su panel principal según su rol.

### 2.2 Recuperación de Contraseña

Si olvidó su contraseña:

1. En la pantalla de inicio de sesión, haga clic en **"¿Olvidaste tu contraseña?"**
2. Ingrese su correo electrónico registrado
3. Recibirá un enlace por correo para restablecer su contraseña
4. Haga clic en el enlace y establezca una nueva contraseña (mínimo 6 caracteres)

**Ejemplo Práctico:**
> Correo: `jperez@empresa.com`  
> Hacer clic en "Enviar enlace" → Revisar bandeja de entrada → Hacer clic en el enlace → Ingresar nueva contraseña: `NuevaContraseña456` → Confirmar contraseña → Iniciar sesión con la nueva contraseña.

### 2.3 Cambio de Contraseña

Desde Configuración > Seguridad:

1. Ingrese su contraseña actual
2. Ingrese la nueva contraseña
3. Confirme la nueva contraseña
4. Haga clic en "Cambiar Contraseña"

**Nota de Seguridad:** Al cambiar la contraseña, todas las sesiones activas serán cerradas.

---

## 3. Guía por Perfil de Usuario

### 3.1 Administrador

El Administrador tiene acceso completo a todas las funciones del sistema.

#### Módulos Disponibles

| Módulo | Acciones Permitidas |
|--------|---------------------|
| Dashboard | Ver estadísticas globales, tareas, calendario |
| Máquinas | Ver, crear, editar, eliminar |
| Almacén | Gestión completa de inventario |
| Productos | Crear, editar, eliminar productos |
| Rutas | Crear y gestionar rutas de abastecimiento |
| Abastecedores | Gestión de personal de campo |
| Combustible | Gestión de flota vehicular |
| Contabilidad | Acceso completo a finanzas |
| Caja Chica | Crear, aprobar gastos |
| Compras | Órdenes de compra y proveedores |
| Recursos Humanos | Gestión completa de empleados |
| Usuarios | Crear, editar, eliminar usuarios |
| Supervisores | Gestión de supervisores |
| Reportes | Todos los reportes con exportación |
| Configuración | Configuración de empresa |

#### Funciones Principales del Administrador

**1. Crear un Nuevo Usuario**

1. Vaya a **Administración > Gestión Usuarios**
2. Haga clic en **"+ Nuevo Usuario"**
3. Complete el formulario:
   - Nombre completo
   - Usuario (se genera automáticamente)
   - Contraseña (puede generarla automáticamente)
   - Rol (Administrador, Supervisor, Abastecedor, Almacén, Contabilidad, RH)
   - Zona (requerida para Supervisores y Abastecedores)
4. Haga clic en **"Crear Usuario"**

**Ejemplo Práctico:**
> Crear un nuevo abastecedor:
> - Nombre: "Carlos Martínez"
> - Usuario: `cmartinez` (generado automáticamente)
> - Contraseña: Hacer clic en "Generar" → `Xk9#mP2$qL`
> - Rol: "Abastecedor"
> - Zona: "Zona Norte"
> - Guardar y copiar credenciales para entregar al empleado.

**2. Crear una Máquina Nueva**

1. Vaya a **Máquinas**
2. Haga clic en **"+ Nueva Máquina"**
3. Complete:
   - Nombre: Identificador de la máquina
   - Código: Código interno (opcional)
   - Zona: Zona de operación
   - Ubicación: Seleccione o cree una ubicación
4. Guarde la máquina

**Ejemplo Práctico:**
> Crear máquina "MAQ-30":
> - Nombre: "MAQ-30 - Universidad INTEC"
> - Código: "MAQ-30"
> - Tipo: "Mixta"
> - Zona: "Zona Norte"
> - Ubicación: Seleccionar "Universidad INTEC" de la lista
> - Guardar → La máquina aparece en el listado con estado "Operando".

**3. Visualizar Reportes Globales**

1. Vaya a **Administración > Reportes**
2. Seleccione el período (7 días, 30 días, mes actual, etc.)
3. Navegue entre las pestañas:
   - Resumen: KPIs principales
   - Ventas: Análisis por máquina/zona
   - Inventario: Stock y movimientos
   - Combustible: Rendimiento de flota
   - Compras: Análisis de proveedores
   - Caja Chica: Gastos menores
4. Use **"Exportar CSV"** para descargar datos

**Ejemplo Práctico:**
> Ver ventas del mes de enero:
> - Ir a Reportes > Ventas
> - Período: "Este mes"
> - Ver gráfico de ventas diarias → Total: RD$485,000
> - Agrupar por: "Zona" → Zona Norte: RD$210,000, Zona Sur: RD$150,000...
> - Hacer clic en "Exportar CSV" para descargar el detalle.

---

### 3.2 Supervisor

El Supervisor gestiona una zona específica y supervisa a los abastecedores asignados.

#### Módulos Disponibles

| Módulo | Acciones Permitidas |
|--------|---------------------|
| Panel Supervisor | Vista principal con KPIs de zona |
| Máquinas | Ver y editar (solo de su zona) |
| Tareas Hoy | Ver y gestionar tareas |
| Todas las Tareas | Ver, crear, editar tareas |
| Calendario | Ver eventos y planificación |
| Almacén | Ver inventario (solo lectura) |
| Productos | Ver catálogo de productos |
| Gestión Rutas | Ver y editar rutas |
| Abastecedores | Ver y monitorear rendimiento |
| Monitoreo Servicios | Ver estado de servicios |
| Dinero y Productos | Ver movimientos |
| Combustible | Ver y registrar cargas |
| Configuración | Perfil y preferencias |

#### Funciones Principales del Supervisor

**1. Monitorear el Panel de Supervisor**

Al iniciar sesión, verá:
- Progreso de rutas del día
- Estado de máquinas de su zona
- Alertas activas
- Rendimiento de técnicos

**Ejemplo Práctico:**
> Revisar el estado de la mañana:
> - Entrar al Panel Supervisor
> - Ver: "75% completado" - 15 de 20 paradas
> - Máquinas: 22/25 operando, 2 necesitan servicio, 1 vacía
> - Alerta crítica: "MAQ-15 sin producto desde hace 3 horas"
> - Hacer clic en la alerta para ver detalles → Contactar al abastecedor asignado.

**2. Ver Detalles de una Máquina**

1. Vaya a **Máquinas**
2. Use los filtros para encontrar la máquina
3. Haga clic en la tarjeta de la máquina
4. Vea las pestañas:
   - General: Información y estado
   - Inventario: Productos actuales
   - Servicio: Historial de servicios
   - Alertas: Problemas reportados
   - Ventas: Estadísticas de ventas

**Ejemplo Práctico:**
> Verificar stock de MAQ-22:
> - Ir a Máquinas > Buscar "MAQ-22"
> - Hacer clic en la tarjeta → Pestaña "Inventario"
> - Ver: Coca-Cola 500ml: 15 unidades, Agua Cristal: 8 unidades (bajo!)
> - Cambiar estado a "Necesita Servicio" para que el abastecedor la priorice.

**3. Aprobar Reportes de Problemas**

1. Vaya a **Monitoreo Servicios** o al detalle de una máquina
2. Revise los problemas reportados
3. Apruebe o rechace el reporte
4. Agregue notas si es necesario

**Ejemplo Práctico:**
> Aprobar reporte de problema técnico:
> - Ver reporte: "Sistema de refrigeración fallando - MAQ-18"
> - Prioridad: Alta
> - Fotos adjuntas: Verificar el problema
> - Hacer clic en "Aprobar" → Agregar nota: "Solicitar técnico de refrigeración"
> - El sistema notifica al área de mantenimiento.

**4. Monitorear Abastecedores**

1. Vaya a **Operaciones > Abastecedores**
2. Vea el listado de abastecedores de su zona
3. Haga clic en un abastecedor para ver su análisis
4. Revise: Rutas completadas, tiempos, recaudación

**Ejemplo Práctico:**
> Revisar rendimiento de Carlos Martínez:
> - Ir a Abastecedores > Hacer clic en "Carlos Martínez"
> - Ver pestaña "Análisis"
> - Estadísticas de la semana:
>   - Máquinas atendidas: 42
>   - Tiempo promedio por servicio: 12 minutos
>   - Recaudación total: RD$145,000
>   - Productos abastecidos: 580 unidades

---

### 3.3 Abastecedor

El Abastecedor es el operador de campo que realiza los servicios a las máquinas.

#### Módulos Disponibles

| Módulo | Acciones Permitidas |
|--------|---------------------|
| Mi Ruta | Ver ruta asignada del día |
| Servicio Activo | Ejecutar servicio en máquina |
| Mi Vehículo | Ver inventario del vehículo |
| Mi Rendimiento | Ver estadísticas personales |
| Tareas Hoy | Ver tareas asignadas |
| Calendario | Ver eventos |
| Configuración | Perfil personal |

#### Funciones Principales del Abastecedor

**1. Ver Mi Ruta del Día**

Al iniciar sesión o ir a **Mi Trabajo > Mi Ruta**:
- Ve las paradas programadas
- Estado de cada parada (pendiente, completada)
- Información de cada máquina
- Navegación a la ubicación

**Ejemplo Práctico:**
> Iniciar jornada laboral:
> - Entrar al sistema → Ir a "Mi Ruta"
> - Ver: 8 paradas programadas para hoy
> - Primera parada: "MAQ-05 - Plaza Las Américas"
> - Hora estimada: 8:30 AM
> - Hacer clic en el icono de navegación → Se abre Google Maps con la dirección.

**2. Iniciar y Completar un Servicio**

1. Llegue a la máquina y haga clic en **"Iniciar Servicio"**
2. El sistema comienza a cronometrar el servicio
3. Complete el checklist de mantenimiento:
   - ✓ Limpiar exterior de la máquina
   - ✓ Verificar temperatura
   - ✓ Revisar display/pantalla
   - ✓ Revisar receptor de monedas
   - ✓ Acomodar productos visibles
   - ✓ Revisar fechas de caducidad
4. Registre productos abastecidos
5. Registre efectivo recolectado
6. Finalice el servicio

**Ejemplo Práctico:**
> Servicio completo en MAQ-05:
> 1. Hacer clic en "Iniciar Servicio" → Cronómetro inicia: 00:00
> 2. Completar checklist (marcar cada item)
> 3. Cargar productos:
>    - Seleccionar "Coca-Cola 500ml" → Cantidad: 20
>    - Seleccionar "Agua Cristal 600ml" → Cantidad: 15
>    - Hacer clic en "Confirmar carga"
> 4. Recolectar efectivo:
>    - Efectivo recolectado: RD$4,500
>    - Efectivo esperado: RD$4,450 (diferencia: +RD$50)
> 5. Hacer clic en "Finalizar Servicio" → Duración: 14 minutos
> 6. Firmar digitalmente si se requiere → Servicio completado.

**3. Reportar un Problema**

Durante o después del servicio:

1. Haga clic en **"Reportar Problema"**
2. Seleccione el tipo de problema:
   - Mecánico
   - Refrigeración
   - Vandalismo
   - Falla eléctrica
   - Otro
3. Describa el problema
4. Tome una foto (opcional pero recomendado)
5. Seleccione la prioridad
6. Envíe el reporte

**Ejemplo Práctico:**
> Reportar problema de refrigeración:
> - Hacer clic en "Reportar Problema"
> - Tipo: "Refrigeración"
> - Descripción: "La máquina no está enfriando correctamente, temperatura actual 18°C"
> - Prioridad: "Alta"
> - Adjuntar foto del termómetro
> - Enviar → El supervisor recibe la notificación.

**4. Ver Inventario de Mi Vehículo**

1. Vaya a **Mi Trabajo > Mi Vehículo**
2. Vea todos los productos cargados
3. Verifique lotes y fechas de vencimiento
4. Vea las cargas y descargas del día

**Ejemplo Práctico:**
> Revisar productos disponibles:
> - Ir a "Mi Vehículo"
> - Ver resumen: 12 productos, 485 unidades totales
> - Productos por vencer (7 días): 2 lotes
> - Expandir "Coca-Cola 500ml":
>   - Lote L2024-001: 80 unidades (vence 15/02/2026)
>   - Lote L2024-002: 45 unidades (vence 28/02/2026)

**5. Registrar Carga de Combustible**

Durante la ruta, si necesita cargar combustible:

1. Haga clic en el icono de combustible
2. Ingrese los datos:
   - Litros cargados
   - Precio por litro
   - Lectura del odómetro
   - Estación de servicio
3. Guarde el registro

**Ejemplo Práctico:**
> Registrar carga de gasolina:
> - Abrir formulario de combustible
> - Litros: 45
> - Precio por litro: RD$290
> - Total: RD$13,050 (calculado automáticamente)
> - Odómetro: 85,420 km
> - Estación: "Shell - Av. Lincoln"
> - Tipo: "Gasolina Regular"
> - Guardar → El sistema calcula el rendimiento km/L.

**6. Solicitar Vacaciones**

1. Vaya a **Configuración** o **Mi Perfil**
2. Haga clic en **"Solicitar Vacaciones"**
3. Complete el formulario:
   - Fecha de inicio
   - Fecha de fin
   - Motivo o comentarios
4. Envíe la solicitud

**Ejemplo Práctico:**
> Solicitar vacaciones de Semana Santa:
> - Ir a Configuración > Solicitar Vacaciones
> - Fecha inicio: 14/04/2026
> - Fecha fin: 18/04/2026
> - Motivo: "Vacaciones de Semana Santa"
> - Enviar → El supervisor recibe la solicitud para aprobación.

**Estados de Solicitud:**
- **Pendiente**: Esperando aprobación del supervisor
- **Aprobada**: Vacaciones autorizadas
- **Rechazada**: Solicitud no aprobada (ver motivo)

**7. Ver Mis Tareas**

1. Vaya a **Mi Trabajo > Tareas Hoy**
2. Vea las tareas asignadas para el día
3. Marque tareas como completadas
4. Agregue notas si es necesario

**Tipos de Tareas:**
- Tareas de mantenimiento
- Revisiones especiales
- Recolecciones programadas
- Capacitaciones

**Ejemplo Práctico:**
> Completar tarea de revisión especial:
> - Ver tarea: "Revisar temperatura de MAQ-12"
> - Prioridad: Alta
> - Fecha límite: Hoy 2:00 PM
> - Ir a la máquina y realizar la revisión
> - Marcar como completada → Agregar nota: "Temperatura normal: 4°C"

**8. Consultar Mi Rendimiento**

Acceda a estadísticas de su desempeño:

1. Vaya a **Mi Trabajo > Mi Rendimiento** (si disponible)
2. Vea métricas personales:
   - Máquinas atendidas en el período
   - Tiempo promedio por servicio
   - Efectivo recolectado
   - Productos abastecidos
   - Comparación con períodos anteriores

**Ejemplo Práctico:**
> Revisar rendimiento de la semana:
> - Esta semana: 35 máquinas atendidas
> - Tiempo promedio: 14 minutos/servicio
> - Efectivo recolectado: RD$52,000
> - Productos cargados: 420 unidades
> - Comparación: +8% vs semana anterior

---

### 3.4 Almacén

El personal de Almacén gestiona el inventario central, productos y despachos.

#### Módulos Disponibles

| Módulo | Acciones Permitidas |
|--------|---------------------|
| Panel Almacén | Vista principal con KPIs de inventario |
| Almacén | Gestión completa de inventario |
| Productos | Crear, editar, eliminar productos |
| Compras | Crear órdenes, recibir mercancía |
| Tareas | Gestionar tareas de almacén |
| Calendario | Ver eventos |
| Reportes | Reportes de inventario |
| Configuración | Perfil personal |

#### Funciones Principales de Almacén

**1. Registrar Entrada de Productos (Compra)**

1. Vaya a **Operaciones > Almacén**
2. Haga clic en **"+ Entrada"**
3. Complete el formulario:
   - Producto: Seleccione de la lista
   - Cantidad: Unidades recibidas
   - Costo unitario: Precio de compra
   - Proveedor: Seleccione el proveedor
   - Número de lote: Identificador del lote
   - Fecha de vencimiento: Fecha de caducidad
4. Guarde la entrada

**Ejemplo Práctico:**
> Registrar recepción de Coca-Cola:
> - Ir a Almacén > "+ Entrada"
> - Producto: "Coca-Cola 500ml"
> - Cantidad: 500 unidades
> - Costo unitario: RD$28.50
> - Proveedor: "Distribuidora Nacional"
> - Lote: "L2026-0115"
> - Vencimiento: "15/07/2026"
> - Guardar → El inventario se actualiza automáticamente.

**2. Despachar Productos a Vehículo**

1. Vaya a **Almacén**
2. Haga clic en **"Despachar a Vehículo"**
3. Seleccione el vehículo destino
4. Agregue productos:
   - Seleccione producto
   - Ingrese cantidad
   - Repita para cada producto
5. Confirme el despacho

**Ejemplo Práctico:**
> Despachar productos al vehículo de Carlos:
> - Hacer clic en "Despachar a Vehículo"
> - Vehículo: "Camioneta Toyota - A-12345"
> - Agregar productos:
>   - Coca-Cola 500ml: 100 unidades
>   - Pepsi 500ml: 80 unidades
>   - Agua Cristal 600ml: 120 unidades
>   - Doritos Original: 50 unidades
> - Agregar nota: "Despacho matutino ruta Zona Norte"
> - Confirmar → Los productos se descuentan del almacén y se cargan al vehículo.

**3. Realizar Ajuste de Inventario**

Cuando el conteo físico difiere del sistema:

1. Vaya a **Almacén > Ajustes**
2. Haga clic en **"Nuevo Ajuste"**
3. Seleccione el producto
4. Ingrese el conteo físico real
5. Seleccione el motivo:
   - Conteo físico
   - Merma
   - Caducidad
   - Daño
6. Agregue notas explicativas
7. Confirme el ajuste

**Ejemplo Práctico:**
> Ajustar inventario por diferencia en conteo:
> - Producto: "Snickers 52g"
> - Stock en sistema: 150 unidades
> - Conteo físico: 142 unidades
> - Motivo: "Conteo físico"
> - Notas: "Diferencia detectada en auditoría mensual"
> - Confirmar → El sistema registra la diferencia de -8 unidades.

**4. Gestionar Productos**

1. Vaya a **Operaciones > Productos**
2. Para crear: Haga clic en **"+ Nuevo Producto"**
3. Complete:
   - Nombre del producto
   - Código SKU (opcional)
   - Categoría (Bebidas Frías, Snacks, etc.)
   - Precio de venta
   - Precio de costo (opcional)
4. Active o desactive productos según disponibilidad

**Ejemplo Práctico:**
> Crear nuevo producto "Monster Energy 473ml":
> - Hacer clic en "+ Nuevo Producto"
> - Nombre: "Monster Energy 473ml"
> - Código: "MNST-473"
> - Categoría: "Bebidas Frías"
> - Precio venta: RD$150.00
> - Precio costo: RD$95.00
> - Estado: Activo
> - Guardar → El producto está disponible para inventario y ventas.

**5. Ver Kardex de Producto**

Para ver el historial de movimientos de un producto:

1. Vaya a **Productos**
2. Encuentre el producto
3. Haga clic en el icono de historial
4. Vea todos los movimientos:
   - Entradas (compras)
   - Salidas (despachos, ventas)
   - Ajustes

**Ejemplo Práctico:**
> Ver historial de Coca-Cola 500ml:
> - Ir a Productos > Buscar "Coca-Cola"
> - Hacer clic en icono de historial
> - Ver movimientos:
>   - 10/01: Entrada +500 (Lote L2026-0110)
>   - 11/01: Salida -100 (Vehículo Carlos)
>   - 12/01: Salida -80 (Vehículo María)
>   - 13/01: Entrada +300 (Lote L2026-0113)
>   - Balance actual: 620 unidades

---

### 3.5 Contabilidad

El personal de Contabilidad gestiona las finanzas, recaudaciones y caja chica.

#### Módulos Disponibles

| Módulo | Acciones Permitidas |
|--------|---------------------|
| Panel Contabilidad | Vista principal con KPIs financieros |
| Contabilidad | Análisis de ventas y gastos |
| Caja Chica | Gestión y aprobación de gastos |
| Dinero y Productos | Recaudaciones y transferencias |
| Tareas | Gestionar tareas contables |
| Calendario | Ver eventos |
| Reportes | Reportes financieros |
| Configuración | Perfil personal |

#### Funciones Principales de Contabilidad

**1. Ver Resumen Financiero**

1. Vaya a **Panel Contabilidad** o **Finanzas > Contabilidad**
2. Seleccione el período a analizar
3. Vea los KPIs principales:
   - Ingresos totales
   - Gastos totales
   - Utilidad neta
   - Margen de ganancia

**Ejemplo Práctico:**
> Revisar resultados del mes de enero:
> - Ir a Contabilidad
> - Período: "Este mes"
> - Ver resumen:
>   - Ingresos: RD$1,250,000
>   - Gastos: RD$780,000
>   - Utilidad: RD$470,000
>   - Margen: 37.6%
> - Gráfico de tendencia: +12% vs mes anterior

**2. Analizar Ventas por Máquina**

1. En **Contabilidad**, vaya a la pestaña **"Ventas"**
2. Vea la tabla de ventas por máquina
3. Ordene por columnas (hoy, semana, mes)
4. Identifique máquinas con mejor/peor rendimiento

**Ejemplo Práctico:**
> Identificar máquinas de bajo rendimiento:
> - Ir a Contabilidad > Ventas
> - Ordenar por "Mes" descendente
> - Top 3: MAQ-15 (RD$85,000), MAQ-08 (RD$72,000), MAQ-22 (RD$68,000)
> - Bottom 3: MAQ-29 (RD$12,000), MAQ-31 (RD$15,000), MAQ-03 (RD$18,000)
> - Exportar a CSV para análisis detallado.

**3. Gestionar Caja Chica**

1. Vaya a **Finanzas > Caja Chica**
2. Vea el saldo disponible
3. Para registrar un gasto:
   - Haga clic en **"+ Nuevo Gasto"**
   - Complete: Categoría, descripción, monto, solicitante
   - Adjunte comprobante si aplica
4. Para aprobar gastos pendientes:
   - Revise la lista de gastos pendientes
   - Haga clic en **"Aprobar"** o **"Rechazar"**

**Ejemplo Práctico:**
> Aprobar solicitud de caja chica:
> - Ir a Caja Chica > Pestaña "Gastos"
> - Ver solicitud pendiente:
>   - Descripción: "Compra de herramientas para reparación"
>   - Monto: RD$1,800
>   - Solicitante: Carlos Martínez
>   - Categoría: "Herramientas"
> - Revisar comprobante adjunto
> - Hacer clic en "Aprobar" → El gasto se registra y el saldo se actualiza.

**4. Reponer Fondo de Caja Chica**

Cuando el saldo está bajo:

1. Vaya a **Caja Chica**
2. Haga clic en **"Reponer Fondo"**
3. Ingrese el monto a reponer
4. Seleccione quién autoriza
5. Confirme la reposición

**Ejemplo Práctico:**
> Reponer caja chica:
> - Saldo actual: RD$450 (por debajo del umbral de RD$1,000)
> - Hacer clic en "Reponer Fondo"
> - Monto a reponer: RD$4,550 (para llegar al máximo de RD$5,000)
> - Autorizado por: "Ana Rivera"
> - Confirmar → Nuevo saldo: RD$5,000

**5. Revisar Corte de Caja**

1. En **Contabilidad**, vaya a **"Corte de Caja"**
2. Seleccione el período
3. Vea el detalle:
   - Total recolectado vs esperado
   - Diferencias por abastecedor
   - Diferencias por máquina
4. Exporte el reporte para conciliación

**Ejemplo Práctico:**
> Revisar corte de caja semanal:
> - Ir a Contabilidad > Corte de Caja
> - Período: "Esta semana"
> - Ver resumen:
>   - Total esperado: RD$245,000
>   - Total recolectado: RD$243,500
>   - Diferencia: -RD$1,500 (0.6%)
> - Detalle por abastecedor:
>   - Carlos M.: +RD$200
>   - María L.: -RD$1,700 ← Revisar
>   - José P.: +RD$0
> - Exportar reporte para seguimiento.

---

### 3.6 Recursos Humanos

El personal de RH gestiona empleados, asistencia, nómina y documentación.

#### Módulos Disponibles

| Módulo | Acciones Permitidas |
|--------|---------------------|
| Recursos Humanos | Gestión completa de empleados |
| Mis Tareas | Tareas de RH |
| Tareas Hoy | Ver tareas del día |
| Calendario | Programación y eventos |
| Reportes | Reportes de RH |
| Configuración | Perfil personal |

#### Pestañas del Módulo RH

- **Empleados**: Listado y gestión de personal
- **Asistencia**: Control de entrada/salida
- **Nómina**: Procesamiento de pagos
- **Vacaciones**: Solicitudes y aprobaciones
- **Evaluaciones**: Evaluaciones de desempeño
- **Documentos**: Expedientes de empleados

#### Funciones Principales de RH

**1. Registrar Nuevo Empleado**

1. Vaya a **Administración > Recursos Humanos**
2. Pestaña **"Empleados"** > **"+ Nuevo Empleado"**
3. Complete la información:
   - Nombre completo
   - Usuario y contraseña
   - Correo electrónico
   - Teléfono
   - Rol asignado
4. Guarde el registro

**Ejemplo Práctico:**
> Registrar nueva empleada de almacén:
> - Hacer clic en "+ Nuevo Empleado"
> - Nombre: "Laura García"
> - Usuario: "lgarcia"
> - Contraseña: "Almacen2026!"
> - Email: "lgarcia@dispensax.com"
> - Teléfono: "809-555-1234"
> - Rol: "Almacén"
> - Guardar → El empleado puede iniciar sesión inmediatamente.

**2. Registrar Asistencia**

1. Vaya a **RH > Asistencia**
2. Haga clic en **"+ Registrar Asistencia"**
3. Seleccione:
   - Empleado
   - Fecha
   - Hora de entrada
   - Hora de salida (si aplica)
   - Estado (Presente, Ausente, Tardanza, etc.)
4. Agregue notas si es necesario
5. Guarde el registro

**Ejemplo Práctico:**
> Registrar asistencia del día:
> - Hacer clic en "+ Registrar Asistencia"
> - Empleado: "Carlos Martínez"
> - Fecha: "15/01/2026"
> - Entrada: "07:55"
> - Estado: "Presente"
> - Notas: (vacío)
> - Guardar → Al final del día, editar para agregar salida: "17:10"
> - Horas trabajadas: 9.25 horas (calculado automáticamente)

**3. Procesar Nómina**

1. Vaya a **RH > Nómina**
2. Haga clic en **"+ Nueva Nómina"**
3. Complete:
   - Empleado
   - Período (ej: "Enero 2026 - 1ra Quincena")
   - Salario base
   - Bonificaciones
   - Deducciones
4. El sistema calcula el salario neto automáticamente
5. Guarde y procese cuando esté listo

**Ejemplo Práctico:**
> Procesar nómina de Carlos Martínez:
> - Hacer clic en "+ Nueva Nómina"
> - Empleado: "Carlos Martínez"
> - Período: "Enero 2026 - 2da Quincena"
> - Salario base: RD$22,000
> - Bonificaciones: RD$3,500 (bono por rendimiento)
> - Deducciones: RD$1,980 (AFP, SFS)
> - Salario neto: RD$23,520 (calculado)
> - Guardar → Estado: "Pendiente"
> - Hacer clic en "Procesar" → Estado: "Procesado"
> - Hacer clic en "Marcar como Pagado" cuando se realice el pago.

**4. Gestionar Solicitudes de Vacaciones**

1. Vaya a **RH > Vacaciones**
2. Vea las solicitudes pendientes
3. Revise cada solicitud:
   - Empleado solicitante
   - Fechas solicitadas
   - Días correspondientes
   - Motivo
4. Apruebe o rechace la solicitud

**Ejemplo Práctico:**
> Aprobar solicitud de vacaciones:
> - Ver solicitud pendiente:
>   - Empleado: "María López"
>   - Fechas: 01/02/2026 - 07/02/2026
>   - Días: 7
>   - Motivo: "Vacaciones familiares"
> - Verificar que no hay conflictos de programación
> - Hacer clic en "Aprobar" → La empleada recibe notificación.

**5. Crear Evaluación de Desempeño**

1. Vaya a **RH > Evaluaciones**
2. Haga clic en **"+ Nueva Evaluación"**
3. Seleccione el empleado
4. Califique cada área (1-5 estrellas):
   - Productividad
   - Calidad
   - Puntualidad
   - Trabajo en equipo
5. Agregue comentarios
6. Guarde la evaluación

**Ejemplo Práctico:**
> Evaluar desempeño trimestral:
> - Hacer clic en "+ Nueva Evaluación"
> - Empleado: "José Pérez"
> - Período: "Q4 2025"
> - Calificaciones:
>   - Productividad: 4/5
>   - Calidad: 5/5
>   - Puntualidad: 3/5
>   - Trabajo en equipo: 4/5
> - Calificación general: 4/5 (promedio)
> - Comentarios: "Excelente calidad de trabajo. Debe mejorar puntualidad."
> - Guardar → La evaluación queda registrada en el expediente.

**6. Gestionar Documentos de Empleados**

1. Vaya a **RH > Documentos**
2. Para agregar documento:
   - Haga clic en **"+ Nuevo Documento"**
   - Seleccione empleado
   - Tipo (Cédula, Contrato, Licencia, etc.)
   - Nombre del documento
   - Fecha de vencimiento (si aplica)
3. Reciba alertas de documentos por vencer

**Ejemplo Práctico:**
> Agregar licencia de conducir:
> - Hacer clic en "+ Nuevo Documento"
> - Empleado: "Carlos Martínez"
> - Tipo: "Licencia"
> - Nombre: "Licencia de Conducir - Categoría 2"
> - Vencimiento: "15/08/2026"
> - Guardar → El sistema alertará 30 días antes del vencimiento.

---

## 4. Guía por Módulo

### 4.1 Dashboard (Administrador)

El Dashboard muestra un resumen ejecutivo de todas las operaciones.

**Componentes:**

| Sección | Descripción |
|---------|-------------|
| Tarjetas de KPIs | Máquinas activas, alertas, tareas, recaudación |
| Calendario Semanal | Vista de tareas y eventos por día |
| Resumen por Módulo | Rutas, almacén, contabilidad, caja chica, compras, combustible, RH |
| Panel de Tareas | Lista de tareas del día con acciones rápidas |

**Acciones Rápidas:**
- Hacer clic en una zona para ver sus máquinas
- Hacer clic en una tarea para marcarla como completada
- Usar el calendario para ver tareas de otros días

### 4.2 Máquinas

Gestión completa del parque de máquinas expendedoras.

**Estados de Máquina:**
- 🟢 **Operando**: Funcionando normalmente
- 🟡 **Necesita Servicio**: Requiere atención pronto
- 🔴 **Vacía**: Sin productos
- ⚫ **Fuera de Línea**: No operativa
- 🔵 **Mantenimiento**: En reparación

**Vistas Disponibles:**
- Cuadrícula: Tarjetas visuales por zona
- Lista: Tabla detallada con filtros

**Información de Máquina:**
- General: Datos básicos y ubicación
- Inventario: Productos actuales con lotes
- Servicio: Historial de servicios
- Alertas: Problemas reportados
- Ventas: Estadísticas de ventas

### 4.3 Almacén

Gestión del inventario central con trazabilidad de lotes.

**Pestañas:**
- **Inventario**: Stock actual por producto
- **Lotes**: Gestión de lotes con fechas de vencimiento
- **Movimientos**: Historial completo de entradas/salidas
- **Stock Bajo**: Productos que necesitan reposición

**Tipos de Movimiento:**
- Entrada (Compra)
- Entrada (Devolución)
- Salida (Abastecedor)
- Salida (Máquina)
- Salida (Merma/Caducidad/Daño)
- Ajuste de Inventario
- Transferencia

**Sistema FEFO:**
El sistema automáticamente selecciona los lotes con fecha de vencimiento más próxima para las salidas.

### 4.4 Productos

Catálogo de productos disponibles para venta.

**Categorías:**
- Bebidas Frías
- Bebidas Calientes
- Snacks
- Dulces
- Otros

**Información de Producto:**
- Nombre y código SKU
- Categoría
- Precio de venta (RD$)
- Precio de costo (opcional)
- Estado (Activo/Inactivo)

**Kardex:**
Historial completo de movimientos de inventario por producto.

### 4.5 Gestión de Rutas

Planificación y seguimiento de rutas de abastecimiento.

**Estados de Ruta:**
- **Programada**: Lista para ejecutar
- **En Progreso**: Actualmente en ejecución
- **Completada**: Finalizada exitosamente
- **Cancelada**: No ejecutada

**Información de Ruta:**
- Fecha de ejecución
- Abastecedor asignado
- Supervisor responsable
- Lista de paradas (máquinas)
- Duración estimada/real

**Paradas de Ruta:**
Cada parada incluye:
- Máquina a visitar
- Orden en la ruta
- Hora estimada de llegada
- Estado de completado

### 4.6 Combustible

Gestión de flota vehicular y consumo de combustible.

**Pestañas:**
- **Vehículos**: Flota registrada
- **Registros**: Historial de cargas
- **Análisis**: Rendimiento y costos

**Información de Vehículo:**
- Placa, marca, modelo, año
- Tipo de vehículo
- Tipo de combustible
- Capacidad del tanque
- Rendimiento esperado (km/L)
- Usuario asignado

**Registro de Combustible:**
- Fecha y hora
- Litros cargados
- Precio por litro
- Total pagado
- Lectura de odómetro
- Estación de servicio
- Rendimiento calculado

### 4.7 Contabilidad

Análisis financiero completo del negocio.

**Pestañas:**
- **Resumen**: KPIs principales
- **Ventas**: Análisis por máquina
- **Gastos**: Detalle de egresos
- **Corte de Caja**: Conciliación de efectivo

**KPIs Principales:**
- Ingresos totales
- Gastos totales
- Utilidad neta
- Margen de ganancia
- Número de transacciones
- Ticket promedio

**Filtros:**
- Período (semana, mes, trimestre, año)
- Usuario/Abastecedor
- Zona

### 4.8 Caja Chica

Gestión de gastos menores operativos.

**Categorías de Gasto:**
- Compra Rápida
- Herramientas
- Reparaciones
- Combustible
- Viáticos

**Estados de Gasto:**
- **Pendiente**: Esperando aprobación
- **Aprobado**: Autorizado para pago
- **Pagado**: Ya desembolsado
- **Rechazado**: No autorizado

**Funciones:**
- Inicializar fondo
- Registrar gastos
- Aprobar/rechazar
- Reponer fondo
- Ver historial

### 4.9 Compras

Gestión de proveedores y órdenes de compra.

**Pestañas:**
- **Proveedores**: Directorio de proveedores
- **Órdenes**: Órdenes de compra

**Estados de Orden:**
- **Borrador**: En preparación
- **Enviada**: Enviada al proveedor
- **Parcial**: Recibida parcialmente
- **Completada**: Totalmente recibida
- **Cancelada**: No ejecutada

**Flujo de Compra:**
1. Crear orden de compra
2. Agregar productos y cantidades
3. Enviar al proveedor
4. Registrar recepción (con lotes)
5. Cerrar orden

### 4.10 Recursos Humanos

Gestión integral del capital humano.

**Pestañas:**
- **Empleados**: Directorio de personal
- **Asistencia**: Control de horarios
- **Nómina**: Procesamiento de pagos
- **Vacaciones**: Solicitudes y aprobaciones
- **Evaluaciones**: Desempeño del personal
- **Documentos**: Expedientes digitales

**Tipos de Asistencia:**
- Presente
- Ausente
- Tardanza
- Vacaciones
- Enfermedad
- Permiso

**Estados de Nómina:**
- Pendiente
- Procesado
- Pagado

### 4.11 Reportes

Centro de reportes y análisis.

**Tipos de Reportes:**
- **Resumen General**: Vista ejecutiva
- **Ventas**: Por máquina, zona, período
- **Inventario**: Stock, movimientos, mermas
- **Combustible**: Rendimiento, costos
- **Compras**: Por proveedor, producto
- **Caja Chica**: Gastos por categoría
- **Productos**: Análisis de rotación

**Funcionalidades:**
- Filtrar por período
- Filtrar por zona/máquina
- Exportar a CSV
- Gráficos interactivos

### 4.12 Configuración

Preferencias del sistema y perfil de usuario.

**Pestañas:**
- **Perfil**: Datos personales
- **Notificaciones**: Preferencias de alertas
- **Apariencia**: Tema claro/oscuro
- **Seguridad**: Cambio de contraseña
- **Empresa**: (Solo Admin) Datos de la empresa

### 4.13 Dinero y Productos

Control transversal de efectivo, productos y mermas del negocio.

**Pestañas:**
- **Efectivo**: Movimientos de dinero en efectivo
- **Transferencias**: Movimientos de productos entre ubicaciones
- **Mermas**: Pérdidas de inventario por diversos motivos

#### Tipos de Movimientos de Efectivo

| Tipo | Descripción | Icono |
|------|-------------|-------|
| Recolección Máquina | Dinero recogido de una máquina | 🛒 |
| Entrega Oficina | Entrega de efectivo a la oficina central | 🏢 |
| Depósito Bancario | Depósito del efectivo en banco | 💵 |
| Ajuste Positivo | Corrección hacia arriba (sobrante) | ↗️ |
| Ajuste Negativo | Corrección hacia abajo (faltante) | ↘️ |

#### Estados de Movimientos

- **Pendiente**: Movimiento registrado pero no procesado
- **Entregado**: Efectivo entregado en oficina
- **Depositado**: Efectivo depositado en banco
- **Conciliado**: Verificado y cerrado

#### Registrar Movimiento de Efectivo

1. Vaya a **Operaciones > Dinero y Productos**
2. Haga clic en **"+ Nuevo Movimiento"**
3. Complete el formulario:
   - Tipo de movimiento
   - Monto (RD$)
   - Monto esperado (opcional, para verificar diferencias)
   - Usuario responsable
   - Notas adicionales
4. Haga clic en **"Guardar"**

**Ejemplo Práctico:**
> Registrar recolección de efectivo:
> - Tipo: "Recolección Máquina"
> - Monto: RD$5,500.00
> - Monto esperado: RD$5,450.00
> - Usuario: "Carlos Martínez"
> - Notas: "Diferencia de RD$50 a favor"
> - Guardar → El sistema calcula automáticamente la diferencia.

#### Tipos de Mermas

| Tipo | Descripción |
|------|-------------|
| Caducidad | Producto vencido |
| Daño | Producto dañado físicamente |
| Robo | Producto sustraído |
| Pérdida | Producto extraviado sin explicación |
| Error de Conteo | Discrepancia en inventario |
| Otro | Cualquier otra causa |

#### Registrar Merma

1. En la pestaña **Mermas**, haga clic en **"+ Nueva Merma"**
2. Seleccione:
   - Tipo de merma
   - Producto afectado
   - Cantidad perdida
   - Usuario que reporta
   - Razón o descripción
3. Haga clic en **"Registrar"**

**Ejemplo Práctico:**
> Registrar productos caducados:
> - Tipo: "Caducidad"
> - Producto: "Coca-Cola 500ml"
> - Cantidad: 12 unidades
> - Usuario: "Juan Pérez"
> - Razón: "Lote #2024-1215 vencido el 05/01/2026"
> - Registrar → El inventario se ajusta automáticamente.

#### Resumen y KPIs

El módulo muestra un resumen con:
- Total efectivo recolectado
- Total pendiente de depósito
- Total de mermas del período
- Conciliación diaria (cuadre)

### 4.14 Monitoreo de Servicios

Seguimiento en tiempo real de los servicios activos en las máquinas.

**Información Mostrada por Servicio:**
- Máquina siendo atendida
- Abastecedor responsable
- Tiempo transcurrido del servicio
- Progreso del checklist
- Productos cargados
- Efectivo recolectado
- Problemas reportados

#### Funcionalidades

**Ver Servicios Activos:**
1. Vaya a **Operaciones > Monitoreo Servicios**
2. Vea las tarjetas de cada servicio activo
3. El contador de servicios activos se muestra en la esquina superior

**Actualizar Vista:**
- Los datos se actualizan automáticamente cada 30 segundos
- Use el botón **"Actualizar"** para refrescar manualmente

**Ver Detalle de Servicio:**
1. Haga clic en la tarjeta del servicio
2. Se abre un diálogo con información completa:
   - Línea de tiempo de acciones
   - Lista de productos cargados
   - Efectivo recolectado
   - Estado del checklist (cada ítem)
   - Problemas reportados
   - Firma del responsable (si aplica)

**Ejemplo Práctico:**
> Monitorear servicio de Carlos en MAQ-15:
> - Ver tarjeta: Duración 23 min, Checklist 80%, RD$3,200 recolectado
> - Hacer clic para ver detalle
> - Línea de tiempo:
>   - 09:15 - Servicio iniciado
>   - 09:18 - Productos cargados: 24 unidades
>   - 09:25 - Efectivo recolectado: RD$3,200
>   - 09:35 - Problema reportado: "Display con pixels muertos"
> - El supervisor puede contactar al abastecedor si necesita más información.

### 4.15 Gestión de Abastecedores

Panel de supervisión para monitorear el rendimiento y actividad de los abastecedores.

**Pestañas:**
- **Activos**: Abastecedores trabajando hoy
- **Historial**: Registro de actividades pasadas
- **Estadísticas**: Métricas de rendimiento

#### Vista de Abastecedor Activo

Para cada abastecedor se muestra:
- Estado actual (En ruta, En servicio, Disponible)
- Ruta del día (si tiene asignada)
- Progreso de paradas (completadas/total)
- Máquinas atendidas hoy
- Efectivo recolectado hoy
- Productos cargados hoy
- Tiempo promedio por servicio

#### Filtros Disponibles

- **Búsqueda**: Por nombre del abastecedor
- **Estado**: Todos, En ruta, En servicio, Disponible
- **Período**: Hoy, Esta semana, Este mes

**Ejemplo Práctico:**
> Revisar rendimiento del equipo:
> - Filtro: "Hoy"
> - Ver listado de 5 abastecedores activos
> - Carlos Martínez: 8/10 paradas, RD$12,500, 145 productos
> - María Gómez: 6/8 paradas, RD$8,200, 98 productos
> - Hacer clic en "Carlos" para ver análisis detallado:
>   - Tiempo promedio por máquina: 18 min
>   - Eficiencia: 92%
>   - Sin problemas reportados

### 4.16 Calendario

Calendario interactivo para gestión de eventos y tareas.

**Tipos de Eventos:**
| Tipo | Color | Descripción |
|------|-------|-------------|
| Tarea | Azul | Tareas asignadas |
| Mantenimiento | Naranja | Mantenimiento programado |
| Abastecimiento | Verde | Rutas de abastecimiento |
| Recolección | Púrpura | Recolección de efectivo |
| Revisión | Cian | Revisiones programadas |
| Otro | Gris | Eventos varios |

#### Funcionalidades

**Navegar el Calendario:**
- Use las flechas < > para cambiar de mes
- Haga clic en **"Hoy"** para volver a la fecha actual
- Cambie entre vista de **Mes** o **Semana**

**Crear Evento:**
1. Haga clic en el día deseado
2. Haga clic en **"+ Agregar Evento"**
3. Complete el formulario:
   - Título del evento
   - Tipo de evento
   - Descripción (opcional)
   - Fecha de inicio
   - Fecha de fin (opcional)
   - Todo el día (checkbox)
   - Color personalizado
   - Usuario asignado (opcional)
4. Haga clic en **"Crear Evento"**

**Editar Evento:**
1. Haga clic en el evento en el calendario
2. Seleccione **"Editar"**
3. Modifique los campos necesarios
4. Guarde los cambios

**Eliminar Evento:**
1. Haga clic en el evento
2. Seleccione **"Eliminar"**
3. Confirme la eliminación

**Ejemplo Práctico:**
> Programar mantenimiento preventivo:
> - Hacer clic en el 15 de enero
> - "+ Agregar Evento"
> - Título: "Mantenimiento Zona Norte"
> - Tipo: "Mantenimiento"
> - Descripción: "Revisión trimestral de todas las máquinas"
> - Todo el día: ✓
> - Color: Naranja
> - Crear → El evento aparece en el calendario.

#### Integración con Tareas

El calendario muestra automáticamente:
- Eventos creados manualmente
- Tareas con fecha de vencimiento
- Rutas programadas

### 4.17 Mi Vehículo (Abastecedor)

Panel personal del abastecedor para ver el inventario de su vehículo asignado.

**Información del Vehículo:**
- Placa del vehículo
- Marca y modelo
- Estado de asignación

**KPIs del Inventario:**
- Productos diferentes en vehículo
- Unidades totales cargadas
- Cargas recibidas hoy (entrantes)
- Descargas realizadas hoy (salientes)
- Productos próximos a vencer (7 días)

#### Inventario por Producto

Muestra cada producto cargado con:
- Nombre del producto
- SKU (código)
- Cantidad total
- Detalle por lote:
  - Número de lote
  - Cantidad del lote
  - Fecha de carga
  - Fecha de vencimiento
  - Días restantes hasta vencimiento

**Indicadores de Vencimiento:**
- 🔴 Rojo: Vence en menos de 3 días
- 🟡 Amarillo: Vence en 3-7 días
- 🟢 Verde: Más de 7 días para vencer

#### Historial de Transferencias

Muestra las transferencias del día actual:
- **Entrantes** (↓): Productos recibidos del almacén
- **Salientes** (↑): Productos entregados a máquinas

**Ejemplo Práctico:**
> Verificar inventario antes de iniciar ruta:
> - Entrar a "Mi Vehículo"
> - Ver: 8 productos, 156 unidades totales
> - Alerta: "2 lotes por vencer"
>   - Coca-Cola Lote #2024-0105: 12 unidades, vence en 3 días
>   - Pepsi Lote #2024-0108: 8 unidades, vence en 5 días
> - Priorizar estos productos en las máquinas de hoy.

### 4.18 Panel de Almacén

Vista rápida del estado del inventario para usuarios con rol Almacén.

**Tarjetas de Resumen:**
- Total de productos en almacén
- Unidades totales en stock
- Productos bajo mínimo (alerta)
- Lotes por vencer en 30 días (alerta)

#### Productos con Stock Bajo

Lista de productos que han alcanzado o están por debajo del nivel mínimo de stock:
- Nombre del producto
- Stock actual vs. mínimo
- Barra de progreso visual
- Indicador de nivel crítico (rojo)

**Ejemplo:**
> Stock bajo detectado:
> - Coca-Cola 500ml: 45/50 (90%) - Advertencia
> - Pepsi 350ml: 12/30 (40%) - Crítico
> - Agua Cristal: 0/20 (0%) - Sin stock

#### Lotes Próximos a Vencer

Lista de lotes ordenados por fecha de vencimiento:
- Producto y número de lote
- Cantidad disponible
- Días restantes para vencer
- Indicador de urgencia

**Ejemplo:**
> Lotes por vencer:
> - Coca-Cola #2024-1201: 24 unidades, vence en 5 días 🔴
> - Pepsi #2024-1210: 36 unidades, vence en 14 días 🟡
> - Agua #2025-0115: 50 unidades, vence en 30 días 🟢

#### Órdenes de Compra Pendientes

Lista de órdenes de compra enviadas a proveedores:
- Proveedor
- Fecha de orden
- Estado (Enviada, En tránsito)
- Productos pendientes de recibir

#### Movimientos Recientes

Últimos 10 movimientos de inventario:
- Tipo de movimiento (Entrada/Salida)
- Producto afectado
- Cantidad
- Fecha y hora
- Usuario responsable

**Accesos Rápidos:**
- **Ver Almacén Completo**: Ir al módulo de almacén
- **Compras**: Ir al módulo de compras

### 4.19 Panel de Contabilidad

Vista rápida financiera para usuarios con rol Contabilidad.

**Tarjetas de Resumen:**
- Ventas del mes actual (RD$)
- Efectivo recolectado (RD$)
- Pendiente de depósito (RD$)
- Saldo de caja chica (RD$)

#### Máquinas Top del Mes

Lista de las 5 máquinas con mayores ventas:
- Nombre de la máquina
- Zona
- Total de ventas (RD$)
- Porcentaje del total

**Ejemplo:**
> Top ventas enero:
> 1. MAQ-05 Plaza Las Américas: RD$45,000 (18%)
> 2. MAQ-12 Universidad INTEC: RD$38,000 (15%)
> 3. MAQ-08 Supermercado Nacional: RD$32,000 (13%)
> 4. MAQ-03 Hospital HOMS: RD$28,000 (11%)
> 5. MAQ-15 Aeropuerto: RD$25,000 (10%)

#### Depósitos Recientes

Últimos 5 depósitos bancarios:
- Fecha del depósito
- Monto depositado (RD$)
- Banco/Cuenta
- Estado (Verificado/Pendiente)

#### Gastos de Caja Chica Pendientes

Lista de gastos esperando aprobación:
- Fecha de solicitud
- Categoría del gasto
- Monto solicitado
- Solicitante
- Acciones: Aprobar / Rechazar

**Accesos Rápidos:**
- **Contabilidad Completa**: Ir al módulo de contabilidad
- **Caja Chica**: Ir al módulo de caja chica

### 4.20 Detalle de Máquina

Vista completa de información y operaciones de una máquina específica.

**Pestañas Disponibles:**

#### Pestaña General
- Nombre y código de la máquina
- Tipo de máquina (Bebidas, Snacks, Mixta)
- Estado actual (Operando, Fuera de Servicio, Mantenimiento)
- Zona asignada
- Ubicación (dirección, coordenadas)
- Fecha de instalación
- Último servicio realizado
- Próximo servicio programado

#### Pestaña Inventario
Lista de productos actualmente en la máquina:
- Nombre del producto
- Cantidad disponible
- Capacidad máxima
- Porcentaje de llenado (barra visual)
- Indicador de stock bajo

**Colores de Indicador:**
- 🟢 Verde: Stock >50%
- 🟡 Amarillo: Stock 20-50%
- 🔴 Rojo: Stock <20%

#### Pestaña Servicio
Historial de servicios realizados:
- Fecha y hora del servicio
- Abastecedor que realizó el servicio
- Duración del servicio
- Productos cargados
- Efectivo recolectado
- Checklist completado
- Notas del servicio

#### Pestaña Alertas
Problemas y alertas activas de la máquina:
- Tipo de alerta (Técnica, Stock, Operacional)
- Fecha de reporte
- Descripción del problema
- Prioridad (Alta, Media, Baja)
- Estado (Pendiente, En Atención, Resuelto)
- Fotos adjuntas (si aplica)

#### Pestaña Ventas
Estadísticas de ventas de la máquina:
- Gráfico de ventas diarias/semanales/mensuales
- Total de ventas del período
- Productos más vendidos
- Horarios de mayor venta
- Comparación con períodos anteriores

**Ejemplo Práctico:**
> Ver detalle de MAQ-22:
> - Hacer clic en la tarjeta de MAQ-22
> - General: Estado "Operando", Zona Norte, último servicio hace 2 días
> - Inventario: 75% lleno, Coca-Cola: 8/12, Pepsi: 5/10 (bajo!)
> - Alertas: 1 alerta activa "Display con falla"
>   - Prioridad: Media
>   - Reportado por: Carlos Martínez
>   - Fecha: 08/01/2026
> - Ventas: RD$4,500 esta semana, +15% vs semana anterior

### 4.21 Gestión de Ubicaciones

Administración de los puntos físicos donde se instalan las máquinas.

**Información de Ubicación:**
- Nombre del lugar (ej: "Plaza Las Américas")
- Dirección completa
- Coordenadas GPS (latitud/longitud)
- Tipo de ubicación (Centro Comercial, Hospital, Universidad, etc.)
- Contacto del lugar
- Notas adicionales

#### Crear Nueva Ubicación

1. Vaya a **Máquinas > Ubicaciones**
2. Haga clic en **"+ Nueva Ubicación"**
3. Complete los datos requeridos
4. Guarde la ubicación

**Ejemplo Práctico:**
> Agregar nueva ubicación:
> - Nombre: "Centro Comercial Sambil"
> - Dirección: "Av. John F. Kennedy, Santo Domingo"
> - Tipo: "Centro Comercial"
> - Contacto: "Sr. García - 809-555-1234"
> - Guardar → Ahora puede asignar máquinas a esta ubicación.

### 4.22 Gestión de Paradas de Ruta

Configuración de las visitas programadas en cada ruta.

**Información de Parada:**
- Máquina a visitar
- Orden en la ruta (secuencia)
- Hora estimada de llegada
- Tiempo estimado de servicio
- Notas especiales

#### Estados de Parada

| Estado | Descripción | Color |
|--------|-------------|-------|
| Pendiente | Aún no visitada | Gris |
| En Progreso | Servicio en curso | Azul |
| Completada | Servicio terminado | Verde |
| Omitida | Saltada por alguna razón | Amarillo |

#### Funcionalidades

**Agregar Parada a Ruta:**
1. Abra la ruta en edición
2. Haga clic en **"+ Agregar Parada"**
3. Seleccione la máquina
4. Defina el orden y hora estimada
5. Guarde los cambios

**Reordenar Paradas:**
- Arrastre y suelte las paradas para cambiar el orden
- El sistema recalcula las horas estimadas automáticamente

---

## Anexo A: Matriz de Permisos por Rol

Esta tabla muestra los permisos de cada rol en el sistema. Las acciones posibles son:
- **V**: Ver
- **C**: Crear
- **E**: Editar
- **D**: Eliminar
- **A**: Aprobar
- **X**: Exportar

### Recursos Operativos

| Recurso | Admin | Supervisor | Abastecedor | Almacén | Contabilidad | RH |
|---------|-------|------------|-------------|---------|--------------|-----|
| Máquinas | VCED | VE | V | - | V | - |
| Ubicaciones | VCED | V | V | - | V | - |
| Rutas | VCED | VE | V | - | - | - |
| Paradas de Ruta | VCED | VCED | VE | - | - | - |
| Productos | VCED | V | V | VCED | V | - |
| Almacén | VCED | V | - | VCED | V | - |
| Movimientos Almacén | VCED | V | - | VCE | V | - |

### Recursos de Personal

| Recurso | Admin | Supervisor | Abastecedor | Almacén | Contabilidad | RH |
|---------|-------|------------|-------------|---------|--------------|-----|
| Empleados | VCED | V | - | - | V | VCED |
| Usuarios | VCED | - | - | - | - | VCE |
| Proveedores | VCED | V | - | VCED | V | - |

### Recursos Financieros

| Recurso | Admin | Supervisor | Abastecedor | Almacén | Contabilidad | RH |
|---------|-------|------------|-------------|---------|--------------|-----|
| Recolección Efectivo | VCEDA | V | VC | - | VCEA | - |
| Reportes Problemas | VCEDA | VCEA | VC | - | V | - |
| Caja Chica | VCED | V | - | - | VCED | - |
| Aprobación Caja Chica | VA | V | - | - | VA | - |
| Contabilidad | VCEDX | - | - | - | VCEDX | - |
| Compras | VCEDA | V | - | VCEDA | V | - |

### Recursos de Combustible y Vehículos

| Recurso | Admin | Supervisor | Abastecedor | Almacén | Contabilidad | RH |
|---------|-------|------------|-------------|---------|--------------|-----|
| Combustible | VCED | VCE | - | - | V | - |
| Vehículos | VCED | VE | - | - | V | - |

### Recursos de RRHH

| Recurso | Admin | Supervisor | Abastecedor | Almacén | Contabilidad | RH |
|---------|-------|------------|-------------|---------|--------------|-----|
| Asistencia | VCEDA | VE | - | - | - | VCEDA |
| Nómina | VCEDA | V | - | - | V | VCEDA |
| Vacaciones | VCEDA | VE | VC | VC | VC | VCEDA |
| Evaluaciones | VCED | VE | - | - | - | VCED |
| Documentos | VCED | VE | - | - | - | VCED |
| Perfiles Empleado | VCED | VE | - | - | - | VCED |

### Recursos Generales

| Recurso | Admin | Supervisor | Abastecedor | Almacén | Contabilidad | RH |
|---------|-------|------------|-------------|---------|--------------|-----|
| Tareas | VCED | VCE | VE | VCED | VCED | VCED |
| Servicios | VCED | V | VCE | - | - | - |
| Reportes | VX | V | - | VX | VX | V |
| Configuración | VE | V | V | V | V | V |

**Nota:** Esta matriz refleja la configuración definida en el sistema. Las acciones específicas disponibles pueden variar según el contexto y la zona asignada al usuario.

**Leyenda:**
- V = Ver (view)
- C = Crear (create)
- E = Editar (edit)
- D = Eliminar (delete)
- A = Aprobar (approve)
- X = Exportar (export)
- "-" = Sin acceso

### Restricciones Especiales por Rol

**Supervisor:**
- Solo puede ver/editar máquinas de su zona asignada
- No puede crear ni eliminar máquinas, rutas o usuarios
- Puede aprobar reportes de problemas de su zona

**Abastecedor:**
- Solo ve su propia ruta y vehículo asignado
- Solo puede crear recolecciones de efectivo (no editar/eliminar)
- Puede solicitar vacaciones (no aprobar)

**Almacén:**
- Sin acceso a módulos financieros (excepto compras)
- Control total sobre inventario y proveedores

**Contabilidad:**
- Sin acceso a operaciones de campo
- Control total sobre finanzas y caja chica

**RH:**
- Sin acceso a operaciones ni finanzas
- Control total sobre personal y nómina

---

## 5. Preguntas Frecuentes

### Acceso y Seguridad

**P: ¿Qué hago si olvidé mi contraseña?**
R: Use la opción "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión. Recibirá un enlace por correo para restablecerla.

**P: ¿Por qué no puedo ver ciertos módulos?**
R: Los módulos visibles dependen de su rol. Cada rol tiene acceso a funciones específicas según sus responsabilidades.

**P: ¿Cómo cambio mi contraseña?**
R: Vaya a Configuración > Seguridad > Cambiar Contraseña. Necesitará ingresar su contraseña actual.

### Operaciones

**P: ¿Qué significa FEFO?**
R: First Expired, First Out (Primero en Vencer, Primero en Salir). El sistema selecciona automáticamente los lotes más próximos a vencer.

**P: ¿Por qué no puedo despachar productos a un abastecedor?**
R: Verifique que el abastecedor tenga un vehículo asignado y que haya stock disponible del producto en el almacén.

**P: ¿Cómo reporto un problema en una máquina?**
R: Durante un servicio activo, use el botón "Reportar Problema". Seleccione el tipo, describa el problema y adjunte una foto si es posible.

### Finanzas

**P: ¿Por qué hay diferencia entre efectivo esperado y recolectado?**
R: Las diferencias pueden deberse a devoluciones, promociones, o discrepancias en el registro. El supervisor debe investigar diferencias significativas.

**P: ¿Cómo apruebo un gasto de caja chica?**
R: Vaya a Caja Chica > Gastos Pendientes. Revise el detalle y comprobante, luego haga clic en Aprobar o Rechazar.

### Soporte

**P: ¿A quién contacto si tengo un problema técnico?**
R: Contacte a su supervisor inmediato o al administrador del sistema.

**P: ¿Los datos se guardan automáticamente?**
R: Sí, una vez que hace clic en "Guardar" o "Confirmar", los datos se almacenan inmediatamente.

---

## Glosario

| Término | Definición |
|---------|------------|
| **Abastecedor** | Personal de campo que realiza servicios a las máquinas |
| **FEFO** | First Expired, First Out - método de gestión de inventario |
| **Kardex** | Historial de movimientos de un producto |
| **Lote** | Grupo de productos con mismo origen y fecha de vencimiento |
| **Parada** | Punto de visita en una ruta (máquina) |
| **RD$** | Peso Dominicano |
| **SKU** | Stock Keeping Unit - código único de producto |
| **Zona** | Área geográfica de operación |

---

## Información de Contacto

**Sistema:** Dispensax v2.0  
**Desarrollado para:** Gestión de Máquinas Expendedoras  
**Zona Horaria:** América/Santo_Domingo (GMT-4)

---

*Este manual está sujeto a actualizaciones según evolucione el sistema. Última actualización: Enero 2026.*
