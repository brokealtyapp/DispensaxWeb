# Dispensax - Flujos Operativos

## Guía de Operaciones Diarias por Rol

**Versión:** 1.0  
**Sistema:** Dispensax  
**Fecha:** Enero 2026

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Flujos del Administrador](#2-flujos-del-administrador)
   - [2.1 Apertura del Día](#21-apertura-del-día)
   - [2.2 Gestión de Incidencias Escaladas](#22-gestión-de-incidencias-escaladas)
   - [2.3 Configuración de Rutas Semanales](#23-configuración-de-rutas-semanales)
   - [2.4 Cierre Contable del Día](#24-cierre-contable-del-día)
   - [2.5 Cierre Contable Mensual](#25-cierre-contable-mensual)
   - [2.6 Onboarding de Nuevo Empleado](#26-onboarding-de-nuevo-empleado)
3. [Flujos del Supervisor de Zona](#3-flujos-del-supervisor-de-zona)
   - [3.1 Monitoreo Matutino](#31-monitoreo-matutino)
   - [3.2 Seguimiento de Servicios en Tiempo Real](#32-seguimiento-de-servicios-en-tiempo-real)
   - [3.3 Aprobación de Reportes de Problemas](#33-aprobación-de-reportes-de-problemas)
   - [3.4 Análisis de Rendimiento de Zona](#34-análisis-de-rendimiento-de-zona)
   - [3.5 Gestión de Vacaciones del Equipo](#35-gestión-de-vacaciones-del-equipo)
4. [Flujos del Abastecedor](#4-flujos-del-abastecedor)
   - [4.1 Inicio de Jornada](#41-inicio-de-jornada)
   - [4.2 Carga del Vehículo en Almacén](#42-carga-del-vehículo-en-almacén)
   - [4.3 Ejecución de Ruta - Servicio Completo](#43-ejecución-de-ruta---servicio-completo)
   - [4.4 Reporte de Problemas en Campo](#44-reporte-de-problemas-en-campo)
   - [4.5 Carga de Combustible](#45-carga-de-combustible)
   - [4.6 Cierre de Jornada](#46-cierre-de-jornada)
5. [Flujos del Personal de Almacén](#5-flujos-del-personal-de-almacén)
   - [5.1 Apertura del Almacén](#51-apertura-del-almacén)
   - [5.2 Recepción de Mercancía](#52-recepción-de-mercancía)
   - [5.3 Despacho a Vehículos (FEFO)](#53-despacho-a-vehículos-fefo)
   - [5.4 Recepción de Devoluciones](#54-recepción-de-devoluciones)
   - [5.5 Registro de Mermas](#55-registro-de-mermas)
   - [5.6 Inventario Físico](#56-inventario-físico)
6. [Flujos de Contabilidad](#6-flujos-de-contabilidad)
   - [6.1 Conciliación de Efectivo Diario](#61-conciliación-de-efectivo-diario)
   - [6.2 Gestión de Caja Chica](#62-gestión-de-caja-chica)
   - [6.3 Registro de Gastos Operativos](#63-registro-de-gastos-operativos)
   - [6.4 Cierre Contable Mensual](#64-cierre-contable-mensual)
   - [6.5 Generación de Reportes Financieros](#65-generación-de-reportes-financieros)
7. [Flujos de Recursos Humanos](#7-flujos-de-recursos-humanos)
   - [7.1 Control de Asistencia Diaria](#71-control-de-asistencia-diaria)
   - [7.2 Procesamiento de Nómina Quincenal](#72-procesamiento-de-nómina-quincenal)
   - [7.3 Gestión de Solicitudes de Vacaciones](#73-gestión-de-solicitudes-de-vacaciones)
   - [7.4 Evaluación de Desempeño](#74-evaluación-de-desempeño)
   - [7.5 Gestión Documental de Empleados](#75-gestión-documental-de-empleados)
8. [Flujos de Escenarios Especiales](#8-flujos-de-escenarios-especiales)
   - [8.1 Máquina Averiada](#81-máquina-averiada)
   - [8.2 Faltante de Efectivo](#82-faltante-de-efectivo)
   - [8.3 Producto Próximo a Caducar](#83-producto-próximo-a-caducar)
   - [8.4 Vandalismo o Robo](#84-vandalismo-o-robo)
   - [8.5 Abastecedor Ausente](#85-abastecedor-ausente)
   - [8.6 Stock Crítico en Almacén](#86-stock-crítico-en-almacén)
9. [Diagrama de Flujo General del Negocio](#9-diagrama-de-flujo-general-del-negocio)

---

## 1. Introducción

Este documento describe los flujos operativos diarios de Dispensax, simulando la operación real del negocio de máquinas expendedoras. Cada flujo está diseñado para el rol específico que lo ejecuta y detalla los pasos exactos a seguir en el sistema.

**Horario de Operación Típico:**
- **Almacén:** 5:00 AM - 6:00 PM
- **Abastecedores:** 6:00 AM - 4:00 PM
- **Supervisores:** 7:00 AM - 5:00 PM
- **Administración:** 8:00 AM - 6:00 PM
- **Contabilidad/RRHH:** 8:00 AM - 5:00 PM

**Zona Horaria:** América/Santo_Domingo (GMT-4)

---

## 2. Flujos del Administrador

El Administrador tiene visibilidad completa del sistema y es responsable de la toma de decisiones estratégicas, configuración del sistema y resolución de escalamientos.

### 2.1 Apertura del Día

**Momento:** 8:00 AM - 8:30 AM  
**Objetivo:** Obtener panorama general de operaciones y detectar anomalías

```
FLUJO: APERTURA DEL DÍA - ADMINISTRADOR
═══════════════════════════════════════

[8:00 AM] Iniciar sesión en Dispensax
    │
    ▼
[Dashboard Principal]
    │
    ├─► Revisar tarjeta "Alertas Activas"
    │   ├─ ¿Hay alertas críticas (rojas)?
    │   │   └─► SÍ: Hacer clic → Ver detalle → Tomar acción inmediata
    │   └─ ¿Hay alertas de advertencia (amarillas)?
    │       └─► Anotar para seguimiento durante el día
    │
    ├─► Revisar tarjeta "Máquinas Fuera de Servicio"
    │   ├─ ¿Hay máquinas sin operar >24 horas?
    │   │   └─► SÍ: Verificar motivo → Asignar prioridad de reparación
    │   └─► NO: Continuar
    │
    ├─► Revisar "Ventas de Ayer"
    │   ├─ Comparar con promedio semanal
    │   │   └─► ¿Desviación >15%? Investigar causas
    │   └─ Revisar máquinas top y bottom performers
    │
    ├─► Revisar "Efectivo Pendiente de Depositar"
    │   └─► ¿Monto >RD$100,000? Coordinar depósito urgente
    │
    └─► Ir a "Monitoreo de Servicios"
        └─ Verificar que abastecedores hayan iniciado rutas
            └─► ¿Alguno no ha iniciado a las 8:00?
                └─► Contactar supervisor de zona
```

**Resultado Esperado:** Conocimiento del estado actual de operaciones y acciones prioritarias identificadas.

---

### 2.2 Gestión de Incidencias Escaladas

**Momento:** Según se presenten  
**Objetivo:** Resolver problemas que superan autoridad de supervisores

```
FLUJO: GESTIÓN DE INCIDENCIAS ESCALADAS
═══════════════════════════════════════

[Notificación de incidencia escalada]
    │
    ▼
[Ir a módulo correspondiente según tipo]
    │
    ├─► TIPO: Problema técnico mayor
    │   │   (Ejemplo: Refrigeración fallando en múltiples máquinas)
    │   │
    │   ├─ Ir a Dashboard > Alertas
    │   ├─ Filtrar por tipo "Refrigeración"
    │   ├─ Evaluar extensión del problema
    │   ├─ Decisión:
    │   │   ├─► Reparación interna: Asignar técnico
    │   │   └─► Servicio externo: Contactar proveedor
    │   └─ Registrar en notas de la máquina afectada
    │
    ├─► TIPO: Faltante de efectivo significativo
    │   │   (Ejemplo: Diferencia >RD$5,000)
    │   │
    │   ├─ Ir a Dinero y Productos > Efectivo
    │   ├─ Revisar historial del abastecedor
    │   ├─ Comparar con recolecciones anteriores
    │   ├─ Solicitar explicación escrita
    │   ├─ Decisión:
    │   │   ├─► Error de conteo: Ajustar y documentar
    │   │   ├─► Robo sospechado: Escalar a RRHH/Legal
    │   │   └─► Falla de máquina: Programar revisión técnica
    │   └─ Actualizar estado en sistema
    │
    ├─► TIPO: Conflicto con ubicación/cliente
    │   │   (Ejemplo: Plaza solicita retiro de máquina)
    │   │
    │   ├─ Revisar historial de la ubicación
    │   ├─ Analizar rentabilidad de la máquina
    │   ├─ Decisión:
    │   │   ├─► Negociar: Contactar administración del lugar
    │   │   ├─► Reubicar: Buscar nueva ubicación
    │   │   └─► Retirar: Programar retiro y actualizar sistema
    │   └─ Actualizar estado de ubicación
    │
    └─► TIPO: Problema de personal
        │   (Ejemplo: Ausencia prolongada, conflicto)
        │
        ├─ Coordinar con RRHH
        ├─ Revisar rutas afectadas
        ├─ Reasignar temporalmente si es necesario
        └─ Documentar en expediente del empleado
```

---

### 2.3 Configuración de Rutas Semanales

**Momento:** Viernes 3:00 PM - 4:00 PM  
**Objetivo:** Planificar rutas de la próxima semana

```
FLUJO: CONFIGURACIÓN DE RUTAS SEMANALES
════════════════════════════════════════

[Viernes 3:00 PM]
    │
    ▼
[Analizar datos de la semana actual]
    │
    ├─► Ir a Reportes > Rendimiento de Rutas
    │   ├─ Identificar rutas con tiempos excesivos
    │   ├─ Identificar máquinas con alta frecuencia de servicio
    │   └─ Identificar máquinas con baja rotación
    │
    ▼
[Ir a Operaciones > Rutas]
    │
    ├─► Revisar cada ruta activa
    │   │
    │   ├─ ¿Ruta balanceada en cantidad de máquinas?
    │   │   └─► NO: Redistribuir máquinas entre rutas
    │   │
    │   ├─ ¿Secuencia geográfica óptima?
    │   │   └─► NO: Reordenar paradas para minimizar km
    │   │
    │   └─ ¿Hay máquinas nuevas por asignar?
    │       └─► SÍ: Agregar a ruta más cercana geográficamente
    │
    ├─► Para cada ruta modificada:
    │   ├─ Editar paradas (agregar/quitar/reordenar)
    │   ├─ Verificar horas estimadas
    │   ├─ Asignar abastecedor responsable
    │   └─ Guardar cambios
    │
    ▼
[Validar asignaciones]
    │
    ├─ Verificar que todos los abastecedores tienen ruta
    ├─ Verificar que todas las máquinas activas están en alguna ruta
    ├─ Verificar que no hay conflictos de horario
    │
    ▼
[Comunicar cambios]
    │
    └─ Los abastecedores verán sus rutas actualizadas el lunes
```

---

### 2.4 Cierre Contable del Día

**Momento:** 5:30 PM - 6:00 PM  
**Objetivo:** Validar que las operaciones del día estén correctamente registradas

```
FLUJO: CIERRE CONTABLE DEL DÍA
══════════════════════════════

[5:30 PM]
    │
    ▼
[Ir a Dinero y Productos]
    │
    ├─► Pestaña "Efectivo"
    │   ├─ Verificar que todos los movimientos del día tienen estado
    │   ├─ Identificar movimientos "pendiente"
    │   │   └─► Contactar responsable para completar
    │   └─ Verificar totales:
    │       ├─ Total recolectado
    │       ├─ Total entregado a oficina
    │       └─ Total depositado (si aplica)
    │
    ├─► Pestaña "Conciliación"
    │   ├─ Revisar diferencias del día
    │   ├─ ¿Hay diferencias sin explicar?
    │   │   └─► SÍ: Solicitar justificación
    │   └─ Aprobar conciliación si todo está correcto
    │
    ▼
[Ir a Panel de Contabilidad]
    │
    ├─ Verificar que gastos de caja chica están registrados
    ├─ Verificar registro de combustible del día
    │
    ▼
[Generar reporte diario]
    │
    ├─ Ir a Reportes > Reporte Diario
    ├─ Seleccionar fecha de hoy
    ├─ Exportar PDF
    └─ Archivar para auditoría
```

---

### 2.5 Cierre Contable Mensual

**Momento:** Último día hábil del mes  
**Objetivo:** Consolidar información financiera del mes

```
FLUJO: CIERRE CONTABLE MENSUAL
══════════════════════════════

[Último día del mes - 2:00 PM]
    │
    ▼
[Verificar que todos los días del mes están cerrados]
    │
    ├─► ¿Hay días con movimientos pendientes?
    │   └─► SÍ: Completar antes de continuar
    │
    ▼
[Ir a Contabilidad > Reportes]
    │
    ├─► Generar reporte de ventas mensual
    │   ├─ Total vendido por máquina
    │   ├─ Total vendido por producto
    │   ├─ Comparativo con mes anterior
    │   └─ Exportar Excel
    │
    ├─► Generar reporte de gastos mensual
    │   ├─ Combustible
    │   ├─ Mantenimiento
    │   ├─ Caja chica
    │   ├─ Compras de inventario
    │   └─ Exportar Excel
    │
    ├─► Generar reporte de inventario
    │   ├─ Stock inicial del mes
    │   ├─ Compras del mes
    │   ├─ Ventas del mes
    │   ├─ Mermas del mes
    │   ├─ Stock final
    │   └─ Exportar Excel
    │
    ▼
[Consolidar información]
    │
    ├─ Crear carpeta del mes en archivo
    ├─ Guardar todos los reportes
    ├─ Preparar resumen ejecutivo
    │
    ▼
[Preparar próximo mes]
    │
    ├─ Revisar metas para el nuevo mes
    ├─ Ajustar presupuestos si es necesario
    └─ Comunicar objetivos a supervisores
```

---

### 2.6 Onboarding de Nuevo Empleado

**Momento:** Cuando se contrata personal nuevo  
**Objetivo:** Configurar acceso y asignaciones del nuevo empleado

```
FLUJO: ONBOARDING DE NUEVO EMPLEADO
════════════════════════════════════

[Día de ingreso del empleado]
    │
    ▼
[RRHH ha creado el registro del empleado]
    │
    ├─► Ir a Configuración > Usuarios
    │   ├─ Hacer clic en "+ Nuevo Usuario"
    │   ├─ Vincular con empleado existente
    │   ├─ Asignar nombre de usuario
    │   ├─ Generar contraseña temporal
    │   ├─ Seleccionar rol apropiado:
    │   │   ├─ abastecedor
    │   │   ├─ supervisor
    │   │   ├─ almacen
    │   │   ├─ contabilidad
    │   │   └─ rh
    │   └─ Guardar usuario
    │
    ├─► Si es ABASTECEDOR:
    │   │
    │   ├─ Ir a Combustible > Vehículos
    │   │   └─ Asignar vehículo disponible
    │   │
    │   ├─ Ir a Operaciones > Rutas
    │   │   └─ Asignar ruta o crear nueva
    │   │
    │   └─ Ir a Configuración > Zonas
    │       └─ Asignar zona de operación
    │
    ├─► Si es SUPERVISOR:
    │   │
    │   ├─ Ir a Configuración > Zonas
    │   │   └─ Asignar zona(s) a supervisar
    │   │
    │   └─ Comunicar abastecedores bajo su cargo
    │
    ▼
[Entregar credenciales al empleado]
    │
    ├─ Usuario: ________
    ├─ Contraseña temporal: ________
    ├─ Instruir cambio de contraseña en primer inicio
    │
    ▼
[Capacitación según rol]
    │
    └─ Referir a MANUAL_USUARIO.md sección correspondiente
```

---

## 3. Flujos del Supervisor de Zona

El Supervisor es responsable de monitorear y optimizar las operaciones de su zona geográfica asignada.

### 3.1 Monitoreo Matutino

**Momento:** 7:00 AM - 7:30 AM  
**Objetivo:** Verificar que las operaciones del día inicien correctamente

```
FLUJO: MONITOREO MATUTINO - SUPERVISOR
══════════════════════════════════════

[7:00 AM] Iniciar sesión en Dispensax
    │
    ▼
[Dashboard de Supervisor]
    │
    ├─► Revisar "Mis Abastecedores"
    │   │
    │   ├─ Verificar quién está programado hoy
    │   ├─ ¿Todos han marcado asistencia?
    │   │   └─► NO: Contactar al ausente
    │   │
    │   └─ Verificar vehículos asignados
    │       └─► ¿Algún vehículo con problema reportado?
    │           └─► SÍ: Coordinar vehículo de respaldo
    │
    ├─► Revisar "Máquinas de Mi Zona"
    │   │
    │   ├─ Identificar máquinas con alertas activas
    │   ├─ Priorizar: Rojas > Amarillas > Verdes
    │   │
    │   └─ Para alertas rojas:
    │       └─ Comunicar al abastecedor para atención prioritaria
    │
    ├─► Revisar "Rutas del Día"
    │   │
    │   ├─ Verificar que todas las rutas tienen asignado
    │   ├─ Estimar hora de finalización de cada ruta
    │   │
    │   └─ ¿Hay ruta sin asignar?
    │       └─► SÍ: Reasignar o escalar a Admin
    │
    └─► Comunicar prioridades del día
        │
        └─ Enviar mensaje/llamar a abastecedores con instrucciones especiales
```

---

### 3.2 Seguimiento de Servicios en Tiempo Real

**Momento:** Durante el día (9:00 AM - 3:00 PM)  
**Objetivo:** Monitorear progreso de abastecedores y detectar anomalías

```
FLUJO: SEGUIMIENTO EN TIEMPO REAL
═════════════════════════════════

[Cada 30-60 minutos durante el día]
    │
    ▼
[Ir a Monitoreo de Servicios]
    │
    ├─► Revisar servicios activos
    │   │
    │   ├─ Para cada servicio activo:
    │   │   │
    │   │   ├─ Verificar duración
    │   │   │   └─► ¿Más de 25 minutos?
    │   │   │       └─► Posible problema → Hacer clic para ver detalle
    │   │   │
    │   │   ├─ Verificar progreso de checklist
    │   │   │   └─► ¿Checklist <50% después de 10 min?
    │   │   │       └─► Posible distracción → Monitorear
    │   │   │
    │   │   └─ Verificar productos cargados vs. esperados
    │   │       └─► ¿Carga inusualmente baja?
    │   │           └─► Posible problema de stock en vehículo
    │   │
    │   └─ Hacer clic en "Actualizar" para refrescar datos
    │
    ├─► Identificar abastecedores sin actividad
    │   │
    │   └─► ¿Abastecedor sin servicio activo por >1 hora?
    │       ├─► Verificar si está en tránsito (normal)
    │       ├─► Verificar si está en almuerzo (programado)
    │       └─► Si ninguno aplica: Contactar para verificar
    │
    └─► Registrar observaciones
        │
        └─ Anotar cualquier anomalía para revisión posterior
```

---

### 3.3 Aprobación de Reportes de Problemas

**Momento:** Según se reporten  
**Objetivo:** Validar y escalar problemas reportados por abastecedores

```
FLUJO: APROBACIÓN DE REPORTES DE PROBLEMAS
══════════════════════════════════════════

[Notificación de nuevo reporte]
    │
    ▼
[Ir a la máquina reportada o a Monitoreo de Servicios]
    │
    ├─► Revisar detalle del reporte
    │   │
    │   ├─ Tipo de problema
    │   ├─ Descripción del abastecedor
    │   ├─ Fotos adjuntas (si las hay)
    │   ├─ Prioridad asignada
    │   └─ Momento del reporte
    │
    ├─► Evaluar el reporte
    │   │
    │   ├─► ¿El reporte es válido y bien documentado?
    │   │   │
    │   │   ├─► SÍ: Continuar a decisión
    │   │   │
    │   │   └─► NO: Solicitar más información al abastecedor
    │   │       ├─ Agregar nota: "Por favor proporcionar..."
    │   │       └─ Dejar estado "Pendiente"
    │   │
    │   └─► Decisión según tipo de problema:
    │       │
    │       ├─► MECÁNICO MENOR (ej: atasco de producto)
    │       │   ├─ Aprobar reporte
    │       │   ├─ Agregar nota: "Abastecedor puede intentar resolver"
    │       │   └─ Prioridad: Media
    │       │
    │       ├─► MECÁNICO MAYOR (ej: motor de dispensado dañado)
    │       │   ├─ Aprobar reporte
    │       │   ├─ Cambiar estado máquina a "Fuera de Servicio"
    │       │   ├─ Agregar nota: "Requiere técnico especializado"
    │       │   └─ Escalar a Administrador
    │       │
    │       ├─► REFRIGERACIÓN
    │       │   ├─ Aprobar reporte con prioridad ALTA
    │       │   ├─ Verificar temperatura actual
    │       │   ├─ Si >10°C: Ordenar retirar productos perecederos
    │       │   └─ Escalar a Administrador para servicio técnico
    │       │
    │       ├─► VANDALISMO
    │       │   ├─ Aprobar reporte con prioridad ALTA
    │       │   ├─ Solicitar fotos adicionales
    │       │   ├─ Documentar para seguro
    │       │   └─ Escalar a Administrador
    │       │
    │       └─► ELÉCTRICO
    │           ├─ Aprobar reporte
    │           ├─ Cambiar estado máquina a "Fuera de Servicio"
    │           ├─ Coordinar con ubicación para verificar suministro
    │           └─ Programar visita técnica
    │
    └─► Actualizar estado del reporte
        │
        ├─ Cambiar a "Aprobado" o "En Proceso"
        ├─ Asignar responsable de seguimiento
        └─ Definir fecha límite de resolución
```

---

### 3.4 Análisis de Rendimiento de Zona

**Momento:** Viernes 4:00 PM  
**Objetivo:** Evaluar desempeño semanal de la zona

```
FLUJO: ANÁLISIS DE RENDIMIENTO DE ZONA
══════════════════════════════════════

[Viernes 4:00 PM]
    │
    ▼
[Ir a Gestión de Abastecedores]
    │
    ├─► Para cada abastecedor de la zona:
    │   │
    │   ├─ Hacer clic en el abastecedor
    │   ├─ Ir a pestaña "Análisis"
    │   │
    │   ├─ Revisar métricas de la semana:
    │   │   │
    │   │   ├─ Máquinas atendidas
    │   │   │   └─► ¿Cumple con objetivo? (ej: 8/día)
    │   │   │
    │   │   ├─ Tiempo promedio por servicio
    │   │   │   └─► ¿Dentro de rango? (10-20 min ideal)
    │   │   │
    │   │   ├─ Efectivo recolectado
    │   │   │   └─► ¿Consistente con semanas anteriores?
    │   │   │
    │   │   ├─ Diferencias de efectivo
    │   │   │   └─► ¿Patrón de faltantes?
    │   │   │
    │   │   └─ Problemas reportados
    │   │       └─► ¿Reportes de calidad?
    │   │
    │   └─ Identificar áreas de mejora
    │
    ├─► Revisar rendimiento de máquinas de la zona
    │   │
    │   ├─ Ir a Máquinas > Filtrar por zona
    │   │
    │   ├─ Identificar:
    │   │   ├─ Top 5 máquinas más rentables
    │   │   ├─ Bottom 5 máquinas menos rentables
    │   │   └─ Máquinas con problemas recurrentes
    │   │
    │   └─ Evaluar si requieren cambios:
    │       ├─ Ajuste de productos
    │       ├─ Cambio de ubicación
    │       └─ Mantenimiento preventivo
    │
    └─► Preparar informe semanal
        │
        ├─ Resumen de métricas clave
        ├─ Logros de la semana
        ├─ Problemas identificados
        ├─ Recomendaciones
        └─ Enviar a Administrador
```

---

### 3.5 Gestión de Vacaciones del Equipo

**Momento:** Cuando se reciben solicitudes  
**Objetivo:** Aprobar/rechazar vacaciones manteniendo operación

```
FLUJO: GESTIÓN DE VACACIONES
════════════════════════════

[Notificación de solicitud de vacaciones]
    │
    ▼
[Ir a RRHH > Vacaciones]
    │
    ├─► Revisar solicitud:
    │   ├─ Empleado solicitante
    │   ├─ Fechas solicitadas
    │   ├─ Días disponibles del empleado
    │   └─ Motivo
    │
    ├─► Evaluar impacto operativo:
    │   │
    │   ├─ ¿Hay otros ausentes en esas fechas?
    │   │   └─► SÍ: Verificar cobertura suficiente
    │   │
    │   ├─ ¿Es temporada alta? (ej: Navidad, Semana Santa)
    │   │   └─► SÍ: Considerar necesidad operativa
    │   │
    │   └─ ¿Se puede cubrir la ruta?
    │       ├─► SÍ: Identificar quién cubrirá
    │       └─► NO: Considerar rechazo o fechas alternativas
    │
    ├─► Decisión:
    │   │
    │   ├─► APROBAR:
    │   │   ├─ Hacer clic en "Aprobar"
    │   │   ├─ Agregar nota si es necesario
    │   │   ├─ Notificar al empleado
    │   │   └─ Planificar cobertura de ruta
    │   │
    │   └─► RECHAZAR:
    │       ├─ Hacer clic en "Rechazar"
    │       ├─ Agregar motivo claro
    │       ├─ Sugerir fechas alternativas si es posible
    │       └─ Notificar al empleado
    │
    └─► Si se aprueba, actualizar rutas:
        │
        ├─ Ir a Operaciones > Rutas
        ├─ Reasignar temporalmente la ruta del ausente
        └─ Comunicar al abastecedor que cubrirá
```

---

## 4. Flujos del Abastecedor

El Abastecedor es el operador de campo que ejecuta los servicios a las máquinas expendedoras.

### 4.1 Inicio de Jornada

**Momento:** 6:00 AM  
**Objetivo:** Prepararse para la ruta del día

```
FLUJO: INICIO DE JORNADA - ABASTECEDOR
══════════════════════════════════════

[6:00 AM] Llegar al almacén
    │
    ▼
[Marcar asistencia]
    │
    ├─ Si hay sistema biométrico: Marcar entrada
    └─ Si es manual: Firmar hoja de asistencia
    │
    ▼
[Iniciar sesión en Dispensax (móvil o tablet)]
    │
    ├─► Ir a "Mi Ruta"
    │   │
    │   ├─ Ver paradas programadas para hoy
    │   ├─ Revisar cantidad de máquinas a visitar
    │   ├─ Identificar máquinas con alertas
    │   │   └─► Máquinas con alertas = Prioridad
    │   │
    │   └─ Planificar orden de visitas
    │
    ├─► Ir a "Mi Vehículo"
    │   │
    │   ├─ Verificar inventario actual del vehículo
    │   ├─ Identificar productos con poco stock
    │   ├─ Verificar productos próximos a vencer
    │   │   └─► Priorizar estos productos para carga
    │   │
    │   └─ Preparar lista de productos a cargar
    │
    └─► Revisar "Tareas Especiales"
        │
        └─ ¿Hay tareas adicionales asignadas?
            └─► SÍ: Anotar para ejecutar durante la ruta
```

---

### 4.2 Carga del Vehículo en Almacén

**Momento:** 6:15 AM - 7:00 AM  
**Objetivo:** Cargar productos suficientes para la ruta del día

```
FLUJO: CARGA DEL VEHÍCULO
═════════════════════════

[En el almacén]
    │
    ▼
[Coordinar con personal de almacén]
    │
    ├─► Entregar lista de productos necesarios
    │   │
    │   ├─ Cantidad estimada según ruta
    │   ├─ Productos específicos con alertas de bajo stock
    │   └─ Productos próximos a vencer en el vehículo (rotar primero)
    │
    ├─► Personal de almacén prepara el despacho
    │   │
    │   ├─ Selecciona productos siguiendo FEFO
    │   │   (Primero en Expirar, Primero en Salir)
    │   ├─ Prepara documentación de despacho
    │   └─ Notifica cuando está listo
    │
    ▼
[Recibir productos]
    │
    ├─► Verificar físicamente:
    │   │
    │   ├─ Cantidad correcta de cada producto
    │   ├─ Productos en buen estado (no dañados)
    │   ├─ Fechas de vencimiento visibles
    │   └─ Lotes correctamente identificados
    │
    ├─► Si hay discrepancia:
    │   │
    │   └─ Notificar al personal de almacén
    │       └─ Ajustar antes de confirmar
    │
    ▼
[Confirmar recepción en sistema]
    │
    ├─ El sistema actualiza inventario del vehículo
    ├─ Se genera registro de la transferencia
    │
    ▼
[Verificar vehículo]
    │
    ├─ Nivel de combustible
    │   └─► ¿Menos de 1/4 tanque? Planificar carga
    ├─ Estado general del vehículo
    └─ Herramientas necesarias
    │
    ▼
[Iniciar ruta]
    │
    └─ Salir del almacén hacia primera parada
```

---

### 4.3 Ejecución de Ruta - Servicio Completo

**Momento:** 7:00 AM - 3:00 PM  
**Objetivo:** Atender todas las máquinas de la ruta

```
FLUJO: SERVICIO COMPLETO A UNA MÁQUINA
══════════════════════════════════════

[Llegar a la ubicación de la máquina]
    │
    ▼
[PASO 1: Iniciar Servicio]
    │
    ├─ En "Mi Ruta", seleccionar la máquina
    ├─ Hacer clic en "Iniciar Servicio"
    ├─ El cronómetro comienza
    └─ El supervisor puede ver que el servicio está activo
    │
    ▼
[PASO 2: Inspección Visual]
    │
    ├─ Revisar exterior de la máquina:
    │   ├─ ¿Daños visibles?
    │   ├─ ¿Grafiti o vandalismo?
    │   └─ ¿Pantalla funcionando?
    │
    └─► Si hay daños:
        └─ Tomar fotos antes de continuar
    │
    ▼
[PASO 3: Completar Checklist de Mantenimiento]
    │
    ├─ En la app, ir al checklist y marcar cada item:
    │
    │   ☐ Limpiar exterior de la máquina
    │       └─ Usar paño y limpiador
    │
    │   ☐ Verificar temperatura
    │       └─ Debe estar entre 2°C y 8°C
    │       └─► Si está fuera de rango: Reportar problema
    │
    │   ☐ Revisar display/pantalla
    │       └─ Verificar que muestra precios correctos
    │
    │   ☐ Revisar receptor de monedas/billetes
    │       └─ Limpiar si es necesario
    │
    │   ☐ Acomodar productos visibles
    │       └─ Mover productos al frente
    │
    │   ☐ Revisar fechas de caducidad
    │       └─► Productos vencidos: Retirar inmediatamente
    │
    └─ Marcar cada item como completado en la app
    │
    ▼
[PASO 4: Recolectar Efectivo]
    │
    ├─ Abrir compartimento de efectivo
    ├─ Contar el dinero cuidadosamente
    ├─ En la app, hacer clic en "Registrar Efectivo"
    │
    ├─► Ingresar datos:
    │   ├─ Monto recolectado: RD$_____
    │   ├─ El sistema muestra el "esperado"
    │   └─ Si hay diferencia significativa, agregar nota
    │
    └─ Confirmar recolección
        └─ Guardar efectivo en bolsa de seguridad
    │
    ▼
[PASO 5: Abastecer Productos]
    │
    ├─ Revisar qué productos necesita la máquina
    │   └─ El sistema sugiere basado en historial
    │
    ├─ Para cada producto a cargar:
    │   │
    │   ├─ Tomar producto del vehículo
    │   ├─ Verificar fecha de vencimiento
    │   │   └─► SIEMPRE cargar el más próximo a vencer primero
    │   │
    │   ├─ Colocar en la máquina
    │   │   └─ Productos más viejos al frente
    │   │
    │   └─ Registrar en la app:
    │       ├─ Seleccionar producto
    │       ├─ Ingresar cantidad cargada
    │       └─ Confirmar
    │
    └─ Repetir para todos los productos necesarios
    │
    ▼
[PASO 6: Verificación Final]
    │
    ├─ Verificar que la máquina dispensa correctamente
    │   └─ Probar con un producto si es posible
    │
    ├─ Verificar que la pantalla muestra productos
    ├─ Cerrar y asegurar la máquina
    │
    ▼
[PASO 7: Finalizar Servicio]
    │
    ├─ En la app, revisar resumen del servicio:
    │   ├─ Checklist completado
    │   ├─ Efectivo recolectado
    │   ├─ Productos cargados
    │   └─ Tiempo total del servicio
    │
    ├─ Hacer clic en "Finalizar Servicio"
    │
    ├─► Si se requiere firma:
    │   └─ Firmar digitalmente en la pantalla
    │
    └─ Servicio completado → Pasar a la siguiente máquina
    │
    ▼
[Repetir para cada máquina de la ruta]
```

**Tiempos Objetivo:**
- Servicio estándar: 12-15 minutos
- Servicio con reabastecimiento completo: 18-22 minutos
- Servicio con problema reportado: 25-30 minutos

---

### 4.4 Reporte de Problemas en Campo

**Momento:** Cuando se detecta un problema  
**Objetivo:** Documentar problemas para seguimiento

```
FLUJO: REPORTE DE PROBLEMA
══════════════════════════

[Durante el servicio - Problema detectado]
    │
    ▼
[Evaluar tipo de problema]
    │
    ├─► ¿Es algo que puedo resolver?
    │   │
    │   ├─► SÍ: Resolver y continuar
    │   │   └─ Ejemplos:
    │   │       ├─ Producto atascado → Desatascar
    │   │       ├─ Suciedad → Limpiar
    │   │       └─ Producto mal colocado → Reacomodar
    │   │
    │   └─► NO: Continuar con reporte
    │
    ▼
[Documentar el problema]
    │
    ├─► Tomar fotografías
    │   │
    │   ├─ Foto general mostrando el problema
    │   ├─ Foto de cerca del detalle
    │   └─ Foto del código/número de la máquina
    │
    ▼
[Crear reporte en la app]
    │
    ├─ Hacer clic en "Reportar Problema"
    │
    ├─► Seleccionar tipo:
    │   ├─ Mecánico
    │   ├─ Refrigeración
    │   ├─ Eléctrico
    │   ├─ Vandalismo
    │   └─ Otro
    │
    ├─► Escribir descripción clara:
    │   │
    │   │   ✓ BUENA descripción:
    │   │   "El motor del dispensador de la fila 3 hace ruido
    │   │    pero no empuja el producto. Intenté reiniciar
    │   │    sin éxito. Temperatura normal."
    │   │
    │   │   ✗ MALA descripción:
    │   │   "No funciona"
    │   │
    │   └─ Incluir:
    │       ├─ Qué está pasando
    │       ├─ Qué intentaste hacer
    │       └─ Detalles relevantes
    │
    ├─► Seleccionar prioridad:
    │   ├─ Alta: Máquina no puede vender
    │   ├─ Media: Funciona parcialmente
    │   └─ Baja: Problema menor, puede esperar
    │
    ├─► Adjuntar fotos
    │
    └─ Enviar reporte
        └─ El supervisor recibe notificación
    │
    ▼
[Continuar o pausar]
    │
    ├─► Si la máquina puede seguir operando:
    │   └─ Completar servicio y continuar ruta
    │
    └─► Si la máquina NO puede operar:
        ├─ Cambiar estado a "Fuera de Servicio"
        ├─ Poner letrero de "Temporalmente Fuera de Servicio"
        └─ Continuar con siguiente máquina
```

---

### 4.5 Carga de Combustible

**Momento:** Cuando el tanque está bajo  
**Objetivo:** Mantener vehículo con combustible suficiente

```
FLUJO: CARGA DE COMBUSTIBLE
═══════════════════════════

[Indicador de combustible bajo]
    │
    ▼
[Ir a estación de servicio autorizada]
    │
    ├─ Usar estaciones de la lista aprobada
    └─ Preferir estaciones con facturación electrónica
    │
    ▼
[Antes de cargar]
    │
    ├─► Anotar lectura del odómetro: _______ km
    │
    ▼
[Cargar combustible]
    │
    ├─ Solicitar tipo de combustible autorizado
    ├─ Solicitar tanque lleno o monto autorizado
    ├─ Solicitar factura con crédito fiscal
    │
    ▼
[Registrar en el sistema]
    │
    ├─ Ir a sección de combustible en la app
    ├─ Hacer clic en "Registrar Carga"
    │
    ├─► Ingresar datos:
    │   ├─ Litros cargados: _____
    │   ├─ Precio por litro: RD$_____
    │   ├─ Total (calculado automáticamente)
    │   ├─ Lectura odómetro: _____ km
    │   ├─ Estación: (seleccionar de lista)
    │   └─ Número de factura: _____
    │
    └─ Guardar registro
        │
        └─ El sistema calcula rendimiento km/L
    │
    ▼
[Guardar comprobante]
    │
    └─ Guardar factura para entregar en oficina
```

---

### 4.6 Cierre de Jornada

**Momento:** 3:00 PM - 4:00 PM  
**Objetivo:** Entregar efectivo, inventario sobrante y reportar el día

```
FLUJO: CIERRE DE JORNADA - ABASTECEDOR
══════════════════════════════════════

[Regresar al almacén/oficina]
    │
    ▼
[PASO 1: Cuadrar Efectivo]
    │
    ├─► Contar todo el efectivo recolectado
    │   │
    │   ├─ Separar por denominación
    │   ├─ Sumar total
    │   └─ Comparar con lo registrado en el sistema
    │
    ├─► En el sistema:
    │   ├─ Ir a "Mi Trabajo" > "Efectivo del Día"
    │   ├─ Verificar que suma coincide
    │   │
    │   └─► Si hay diferencia:
    │       ├─ Recontar
    │       └─ Si persiste, reportar a supervisor
    │
    └─► Entregar efectivo a responsable:
        ├─ Persona de contabilidad o supervisor
        ├─ Firmar recibo de entrega
        └─ El sistema actualiza estado a "Entregado"
    │
    ▼
[PASO 2: Devolver Productos Sobrantes]
    │
    ├─► Si hay productos que deben volver al almacén:
    │   │
    │   ├─ Productos dañados durante la ruta
    │   ├─ Productos retirados por vencimiento
    │   ├─ Productos no utilizados en exceso
    │   │
    │   └─ Entregar a personal de almacén
    │       ├─ Almacén registra la devolución
    │       └─ Se actualiza inventario del vehículo
    │
    └─► Si todo el producto se usó:
        └─ Verificar que inventario del vehículo está correcto
    │
    ▼
[PASO 3: Entregar Documentos]
    │
    ├─ Facturas de combustible
    ├─ Comprobantes de gastos (si los hay)
    └─ Cualquier documento recibido
    │
    ▼
[PASO 4: Reportar Novedades]
    │
    ├─► ¿Hubo incidentes durante el día?
    │   └─► SÍ: Informar verbalmente al supervisor
    │       └─ Confirmar que los reportes en sistema están completos
    │
    ├─► ¿El vehículo tuvo algún problema?
    │   └─► SÍ: Reportar para mantenimiento
    │
    └─► ¿Quedaron máquinas sin atender?
        └─► SÍ: Explicar motivo y coordinar para mañana
    │
    ▼
[PASO 5: Verificar Próximo Día]
    │
    ├─ Revisar ruta de mañana
    ├─ Identificar productos que necesitará
    └─ Comunicar a almacén para preparación
    │
    ▼
[Marcar salida]
    │
    └─ Registrar hora de salida
        └─ Fin de jornada
```

---

## 5. Flujos del Personal de Almacén

El personal de almacén gestiona el inventario central, recepciones y despachos.

### 5.1 Apertura del Almacén

**Momento:** 5:00 AM  
**Objetivo:** Preparar almacén para operaciones del día

```
FLUJO: APERTURA DEL ALMACÉN
═══════════════════════════

[5:00 AM] Llegar al almacén
    │
    ▼
[Verificaciones de seguridad]
    │
    ├─ Verificar que no hay signos de intrusión
    ├─ Encender luces y equipos de refrigeración
    ├─ Verificar temperatura de cámaras frías
    │   └─► ¿Temperatura correcta? (2-8°C)
    │       └─► NO: Reportar inmediatamente
    │
    ▼
[Iniciar sesión en Dispensax]
    │
    ├─► Ir a Panel de Almacén
    │   │
    │   ├─ Revisar alertas de stock bajo
    │   ├─ Revisar productos próximos a vencer
    │   └─ Revisar despachos programados para hoy
    │
    ▼
[Preparar despachos del día]
    │
    ├─► Ver lista de vehículos que cargarán hoy
    │   │
    │   ├─ Para cada vehículo:
    │   │   ├─ Revisar productos solicitados
    │   │   ├─ Verificar disponibilidad
    │   │   └─ Pre-preparar si es posible
    │   │
    │   └─► ¿Hay productos insuficientes?
    │       └─► SÍ: Notificar para compra urgente
    │
    ▼
[Verificar entregas esperadas]
    │
    ├─ ¿Hay proveedores que entregarán hoy?
    ├─ Preparar área de recepción
    └─ Tener documentos listos
```

---

### 5.2 Recepción de Mercancía

**Momento:** Cuando llega proveedor  
**Objetivo:** Registrar correctamente la entrada de productos

```
FLUJO: RECEPCIÓN DE MERCANCÍA
═════════════════════════════

[Llega camión del proveedor]
    │
    ▼
[Verificar documentación]
    │
    ├─ Factura del proveedor
    ├─ Orden de compra (si existe en sistema)
    ├─ Certificados de calidad (si aplica)
    │
    ▼
[Inspección de productos]
    │
    ├─► Para cada tipo de producto:
    │   │
    │   ├─ Contar cantidad recibida
    │   │   └─► ¿Coincide con factura?
    │   │
    │   ├─ Verificar estado físico
    │   │   └─► ¿Productos dañados?
    │   │       └─► SÍ: Separar y documentar
    │   │
    │   ├─ Verificar fechas de vencimiento
    │   │   └─► ¿Fechas aceptables? (mínimo 30 días)
    │   │       └─► NO: Rechazar lote
    │   │
    │   ├─ Verificar temperatura (productos refrigerados)
    │   │   └─► ¿Dentro de rango?
    │   │       └─► NO: Rechazar
    │   │
    │   └─ Registrar número de lote
    │
    ▼
[Registrar en sistema]
    │
    ├─ Ir a Almacén > "+ Entrada"
    │
    ├─► Para cada producto recibido:
    │   │
    │   ├─ Seleccionar producto
    │   ├─ Ingresar cantidad
    │   ├─ Ingresar costo unitario (de factura)
    │   ├─ Seleccionar proveedor
    │   ├─ Ingresar número de lote
    │   ├─ Ingresar fecha de vencimiento
    │   └─ Guardar
    │
    └─ El sistema actualiza:
        ├─ Stock disponible
        ├─ Costo promedio ponderado
        └─ Kardex del producto
    │
    ▼
[Almacenar productos]
    │
    ├─ Ubicar en estantería correspondiente
    ├─ IMPORTANTE: Productos nuevos ATRÁS
    │   └─ Los más próximos a vencer siempre al frente
    ├─ Etiquetar si es necesario
    │
    ▼
[Finalizar recepción]
    │
    ├─ Firmar copia de factura del proveedor
    ├─ Entregar factura a contabilidad
    └─ Archivar documentación
```

---

### 5.3 Despacho a Vehículos (FEFO)

**Momento:** 6:00 AM - 7:00 AM  
**Objetivo:** Cargar vehículos siguiendo reglas FEFO

```
FLUJO: DESPACHO A VEHÍCULOS
═══════════════════════════

[Abastecedor solicita carga]
    │
    ▼
[Revisar solicitud]
    │
    ├─ Verificar productos solicitados
    ├─ Verificar cantidades
    │
    ▼
[Preparar productos - REGLA FEFO]
    │
    │   ╔══════════════════════════════════════╗
    │   ║  FEFO = First Expire, First Out      ║
    │   ║  Primero en Vencer, Primero en Salir ║
    │   ╚══════════════════════════════════════╝
    │
    ├─► Para cada producto solicitado:
    │   │
    │   ├─ Ir a la ubicación del producto
    │   │
    │   ├─ Verificar lotes disponibles
    │   │   └─ El sistema muestra lotes ordenados por vencimiento
    │   │
    │   ├─ SIEMPRE tomar del lote más próximo a vencer
    │   │   └─► Ejemplo:
    │   │       ├─ Lote A: Vence 15/02 → TOMAR PRIMERO
    │   │       ├─ Lote B: Vence 28/02
    │   │       └─ Lote C: Vence 15/03
    │   │
    │   ├─ Contar cantidad solicitada
    │   │
    │   └─ Colocar en área de despacho
    │
    ▼
[Registrar despacho en sistema]
    │
    ├─ Ir a Almacén > "Despachar a Vehículo"
    │
    ├─► Seleccionar vehículo destino
    │
    ├─► Para cada producto:
    │   ├─ Seleccionar producto
    │   ├─ Seleccionar lote (el sistema sugiere FEFO)
    │   ├─ Ingresar cantidad
    │   └─ Agregar
    │
    ├─► Agregar notas si es necesario
    │   └─ Ej: "Incluye productos de promoción"
    │
    └─ Confirmar despacho
        │
        └─ El sistema:
            ├─ Descuenta del inventario de almacén
            ├─ Suma al inventario del vehículo
            ├─ Registra el movimiento en Kardex
            └─ Mantiene trazabilidad del lote
    │
    ▼
[Entrega física al abastecedor]
    │
    ├─ Abastecedor verifica productos
    ├─ Ambos confirman cantidades
    └─ Abastecedor carga vehículo
```

---

### 5.4 Recepción de Devoluciones

**Momento:** Cuando abastecedor regresa con productos  
**Objetivo:** Registrar productos devueltos correctamente

```
FLUJO: RECEPCIÓN DE DEVOLUCIONES
════════════════════════════════

[Abastecedor entrega productos]
    │
    ▼
[Clasificar productos devueltos]
    │
    ├─► Productos en buen estado (sobrantes)
    │   └─ Pueden volver a stock
    │
    ├─► Productos dañados
    │   └─ Deben registrarse como merma
    │
    └─► Productos vencidos o próximos a vencer
        └─ Evaluar: ¿Pueden venderse?
            ├─► SÍ (>7 días): Volver a stock
            └─► NO (<7 días): Registrar como merma
    │
    ▼
[Para productos que vuelven a stock]
    │
    ├─ Ir a Almacén > "Devolución de Vehículo"
    │
    ├─► Seleccionar vehículo origen
    │
    ├─► Para cada producto:
    │   ├─ Seleccionar producto
    │   ├─ Ingresar cantidad
    │   ├─ Verificar lote (el que salió originalmente)
    │   └─ Agregar
    │
    └─ Confirmar devolución
        │
        └─ El sistema:
            ├─ Suma al inventario de almacén
            ├─ Descuenta del inventario del vehículo
            └─ Registra movimiento
    │
    ▼
[Para productos dañados/vencidos]
    │
    └─ Seguir flujo 5.5 Registro de Mermas
    │
    ▼
[Almacenar productos devueltos]
    │
    ├─ Ubicar en estantería según FEFO
    │   └─ Si vence pronto: Al frente para salir primero
    └─ Verificar que etiquetas son legibles
```

---

### 5.5 Registro de Mermas

**Momento:** Cuando se detectan productos dañados/vencidos  
**Objetivo:** Documentar pérdidas de inventario

```
FLUJO: REGISTRO DE MERMAS
═════════════════════════

[Producto identificado como merma]
    │
    ▼
[Clasificar tipo de merma]
    │
    ├─► CADUCIDAD
    │   └─ Producto venció o está a punto de vencer
    │
    ├─► DAÑO
    │   └─ Empaque roto, aplastado, mojado
    │
    ├─► ROBO
    │   └─ Faltante sin explicación
    │
    ├─► PÉRDIDA
    │   └─ Extraviado durante transporte/almacenamiento
    │
    └─► ERROR DE CONTEO
        └─ Diferencia encontrada en inventario físico
    │
    ▼
[Documentar la merma]
    │
    ├─ Tomar foto del producto (si aplica)
    ├─ Anotar cantidad afectada
    └─ Identificar lote y fecha de vencimiento
    │
    ▼
[Registrar en sistema]
    │
    ├─ Ir a Dinero y Productos > Mermas
    ├─ Hacer clic en "Registrar Merma"
    │
    ├─► Ingresar datos:
    │   ├─ Producto afectado
    │   ├─ Cantidad perdida
    │   ├─ Tipo de merma (caducidad, daño, etc.)
    │   ├─ Motivo detallado
    │   ├─ Lote afectado
    │   └─ Adjuntar foto (si la hay)
    │
    └─ Guardar
        │
        └─ El sistema:
            ├─ Descuenta del inventario
            ├─ Registra costo de la pérdida
            └─ Genera alerta si merma es significativa
    │
    ▼
[Disposición del producto]
    │
    ├─► Productos vencidos: Destruir según normativa
    ├─► Productos dañados: Destruir o reciclar
    └─► Documentar destrucción si es requerido
```

---

### 5.6 Inventario Físico

**Momento:** Semanal o mensual  
**Objetivo:** Verificar que sistema coincide con existencias físicas

```
FLUJO: INVENTARIO FÍSICO
════════════════════════

[Día programado para inventario]
    │
    ▼
[Preparación]
    │
    ├─ Imprimir lista de productos con stock teórico
    ├─ Preparar hojas de conteo
    ├─ Organizar equipo de conteo (si hay más personas)
    │
    ▼
[Conteo físico]
    │
    ├─► Para cada producto en almacén:
    │   │
    │   ├─ Contar unidades físicas
    │   ├─ Verificar por lotes (si aplica)
    │   ├─ Anotar cantidad contada
    │   └─ Verificar fechas de vencimiento
    │
    └─ Completar conteo de todo el almacén
    │
    ▼
[Comparar con sistema]
    │
    ├─► Para cada producto:
    │   │
    │   ├─ Comparar: Conteo físico vs. Stock en sistema
    │   │
    │   └─► ¿Hay diferencia?
    │       │
    │       ├─► NO: Producto OK ✓
    │       │
    │       └─► SÍ: Investigar
    │           ├─ Recontar para confirmar
    │           ├─ Buscar en otras ubicaciones
    │           ├─ Revisar movimientos recientes
    │           └─ Documentar hallazgo
    │
    ▼
[Registrar ajustes en sistema]
    │
    ├─► Para productos con diferencias:
    │   │
    │   ├─ Ir a Almacén > Ajustes > "Nuevo Ajuste"
    │   │
    │   ├─ Seleccionar producto
    │   ├─ Ingresar conteo físico real
    │   ├─ Seleccionar motivo:
    │   │   ├─ "Conteo físico"
    │   │   ├─ "Merma encontrada"
    │   │   └─ "Error de registro anterior"
    │   ├─ Agregar notas explicativas
    │   └─ Confirmar ajuste
    │   │
    │   └─ El sistema ajusta el stock
    │
    ▼
[Generar reporte de inventario]
    │
    ├─ Ir a Reportes > Inventario
    ├─ Generar reporte con fecha actual
    ├─ Incluir diferencias encontradas
    ├─ Exportar para archivo
    │
    └─ Entregar a administración
```

---

## 6. Flujos de Contabilidad

El área de Contabilidad gestiona el control financiero y la conciliación de efectivo.

### 6.1 Conciliación de Efectivo Diario

**Momento:** 5:00 PM - 6:00 PM  
**Objetivo:** Verificar que el efectivo recibido coincide con lo registrado

```
FLUJO: CONCILIACIÓN DE EFECTIVO DIARIO
══════════════════════════════════════

[5:00 PM - Después de que abastecedores entregan efectivo]
    │
    ▼
[Recibir efectivo de abastecedores]
    │
    ├─► Para cada abastecedor:
    │   │
    │   ├─ Contar efectivo entregado
    │   ├─ Comparar con recibo de entrega
    │   ├─ Firmar recibo de recepción
    │   │
    │   └─ En el sistema:
    │       ├─ Ir a Dinero y Productos > Efectivo
    │       ├─ Buscar movimiento del abastecedor
    │       └─ Cambiar estado a "Recibido en oficina"
    │
    ▼
[Consolidar efectivo del día]
    │
    ├─ Sumar todo el efectivo recibido
    ├─ Separar para:
    │   ├─ Depósito bancario (monto grande)
    │   ├─ Fondo de caja chica (reponer si necesario)
    │   └─ Efectivo en caja (mínimo operativo)
    │
    ▼
[Conciliar en sistema]
    │
    ├─ Ir a Dinero y Productos > Conciliación
    │
    ├─► Verificar:
    │   │
    │   ├─ Total recolectado en sistema
    │   ├─ Total recibido físicamente
    │   │
    │   └─► ¿Coinciden?
    │       │
    │       ├─► SÍ: Aprobar conciliación
    │       │
    │       └─► NO: Investigar diferencia
    │           ├─ Revisar cada movimiento
    │           ├─ Identificar dónde está la diferencia
    │           ├─ Solicitar explicación al responsable
    │           └─ Registrar ajuste con justificación
    │
    ▼
[Preparar depósito bancario]
    │
    ├─ Contar efectivo para depósito
    ├─ Preparar boleta de depósito
    ├─ Registrar en sistema:
    │   ├─ Ir a Dinero y Productos > Efectivo
    │   ├─ Crear movimiento "Depósito bancario"
    │   ├─ Ingresar monto
    │   └─ Estado: "Programado"
    │
    └─ Guardar efectivo en caja fuerte para depósito mañana
    │
    ▼
[Al día siguiente - Realizar depósito]
    │
    ├─ Ir al banco con efectivo y boleta
    ├─ Realizar depósito
    ├─ Obtener comprobante
    │
    └─ En sistema:
        ├─ Buscar movimiento del depósito
        ├─ Cambiar estado a "Depositado"
        ├─ Ingresar número de referencia bancaria
        └─ Adjuntar foto del comprobante (si es posible)
```

---

### 6.2 Gestión de Caja Chica

**Momento:** Según se requiera  
**Objetivo:** Administrar fondos para gastos menores

```
FLUJO: GESTIÓN DE CAJA CHICA
════════════════════════════

[Solicitud de gasto de caja chica]
    │
    ▼
[Evaluar solicitud]
    │
    ├─► ¿El gasto está autorizado?
    │   │
    │   ├─ Verificar tipo de gasto permitido:
    │   │   ├─ Suministros de limpieza
    │   │   ├─ Herramientas menores
    │   │   ├─ Gastos de emergencia
    │   │   └─ Otros gastos operativos menores
    │   │
    │   └─► ¿Monto dentro del límite?
    │       ├─► SÍ: Aprobar
    │       └─► NO: Escalar para autorización superior
    │
    ▼
[Entregar efectivo]
    │
    ├─ Entregar monto solicitado
    ├─ Registrar en vale de caja chica:
    │   ├─ Fecha
    │   ├─ Monto
    │   ├─ Concepto
    │   ├─ Solicitante
    │   └─ Firma
    │
    ▼
[Solicitante realiza la compra]
    │
    └─ Debe traer factura o recibo
    │
    ▼
[Registrar en sistema]
    │
    ├─ Ir a Contabilidad > Caja Chica
    ├─ Hacer clic en "+ Nuevo Gasto"
    │
    ├─► Ingresar datos:
    │   ├─ Fecha del gasto
    │   ├─ Categoría
    │   ├─ Monto
    │   ├─ Descripción
    │   ├─ Número de factura/recibo
    │   ├─ Proveedor
    │   └─ Responsable
    │
    └─ Guardar
        └─ El sistema actualiza saldo de caja chica
    │
    ▼
[Reposición de caja chica]
    │
    ├─► ¿Saldo bajo el mínimo?
    │   │
    │   └─► SÍ:
    │       ├─ Generar solicitud de reposición
    │       ├─ Adjuntar comprobantes de gastos
    │       ├─ Enviar para aprobación
    │       │
    │       └─ Una vez aprobado:
    │           ├─ Retirar efectivo de caja principal
    │           ├─ Reponer caja chica
    │           └─ Registrar reposición en sistema
```

---

### 6.3 Registro de Gastos Operativos

**Momento:** Diario  
**Objetivo:** Registrar todos los gastos del negocio

```
FLUJO: REGISTRO DE GASTOS OPERATIVOS
════════════════════════════════════

[Recepción de factura/comprobante]
    │
    ▼
[Clasificar tipo de gasto]
    │
    ├─► COMBUSTIBLE
    │   │
    │   ├─ Verificar que está registrado en módulo de Combustible
    │   └─ Si no está, solicitar al abastecedor que lo registre
    │
    ├─► COMPRA DE INVENTARIO
    │   │
    │   ├─ Verificar que está registrado en módulo de Compras
    │   └─ Conciliar factura con orden de compra
    │
    ├─► MANTENIMIENTO DE VEHÍCULOS
    │   │
    │   ├─ Registrar en Contabilidad > Gastos
    │   ├─ Categoría: "Mantenimiento Vehículos"
    │   └─ Asociar al vehículo correspondiente
    │
    ├─► MANTENIMIENTO DE MÁQUINAS
    │   │
    │   ├─ Registrar en Contabilidad > Gastos
    │   ├─ Categoría: "Mantenimiento Máquinas"
    │   └─ Asociar a la máquina correspondiente
    │
    ├─► SERVICIOS (luz, agua, teléfono, internet)
    │   │
    │   ├─ Registrar en Contabilidad > Gastos
    │   └─ Categoría: "Servicios"
    │
    └─► OTROS GASTOS
        │
        ├─ Registrar en Contabilidad > Gastos
        └─ Seleccionar categoría apropiada
    │
    ▼
[Registrar en sistema]
    │
    ├─ Ir a Contabilidad > Gastos
    ├─ Hacer clic en "+ Nuevo Gasto"
    │
    ├─► Ingresar:
    │   ├─ Fecha
    │   ├─ Categoría
    │   ├─ Subcategoría (si aplica)
    │   ├─ Monto
    │   ├─ Descripción
    │   ├─ Número de factura
    │   ├─ Proveedor
    │   └─ Método de pago
    │
    └─ Guardar
    │
    ▼
[Archivar comprobante]
    │
    ├─ Escanear o fotografiar factura
    ├─ Guardar en carpeta del mes
    └─ Organizar por categoría
```

---

### 6.4 Cierre Contable Mensual

**Momento:** Primeros días del mes siguiente  
**Objetivo:** Consolidar información financiera del mes

```
FLUJO: CIERRE CONTABLE MENSUAL
══════════════════════════════

[Día 1-3 del nuevo mes]
    │
    ▼
[Verificar que todos los registros están completos]
    │
    ├─► Efectivo:
    │   ├─ Todas las recolecciones registradas
    │   ├─ Todos los depósitos realizados
    │   └─ Diferencias explicadas
    │
    ├─► Gastos:
    │   ├─ Todas las facturas registradas
    │   ├─ Comprobantes archivados
    │   └─ Categorías correctas
    │
    ├─► Inventario:
    │   ├─ Compras registradas
    │   ├─ Mermas documentadas
    │   └─ Ajustes realizados
    │
    └─► Caja chica:
        ├─ Todos los gastos registrados
        └─ Saldo cuadrado
    │
    ▼
[Generar reportes del mes]
    │
    ├─► Ir a Contabilidad > Reportes
    │
    ├─► Generar:
    │   │
    │   ├─ Reporte de Ingresos (ventas por máquina)
    │   │
    │   ├─ Reporte de Egresos (gastos por categoría)
    │   │
    │   ├─ Reporte de Inventario:
    │   │   ├─ Stock inicial
    │   │   ├─ Compras
    │   │   ├─ Consumo
    │   │   ├─ Mermas
    │   │   └─ Stock final
    │   │
    │   ├─ Reporte de Combustible
    │   │
    │   └─ Estado de Resultados Simplificado:
    │       ├─ Ingresos totales
    │       ├─ (-) Costo de productos vendidos
    │       ├─ (-) Gastos operativos
    │       └─ (=) Utilidad del mes
    │
    └─ Exportar todos los reportes
    │
    ▼
[Preparar resumen ejecutivo]
    │
    ├─ Comparar con mes anterior
    ├─ Identificar tendencias
    ├─ Destacar variaciones significativas
    │
    └─ Presentar a Administración
```

---

### 6.5 Generación de Reportes Financieros

**Momento:** Según se requiera  
**Objetivo:** Proporcionar información para toma de decisiones

```
FLUJO: GENERACIÓN DE REPORTES
═════════════════════════════

[Solicitud de reporte]
    │
    ▼
[Identificar tipo de reporte necesario]
    │
    ├─► REPORTE DE VENTAS
    │   │
    │   ├─ Ir a Contabilidad > Reportes > Ventas
    │   ├─ Seleccionar período
    │   ├─ Filtrar por:
    │   │   ├─ Máquina específica
    │   │   ├─ Zona
    │   │   ├─ Producto
    │   │   └─ Abastecedor
    │   └─ Exportar Excel/PDF
    │
    ├─► REPORTE DE GASTOS
    │   │
    │   ├─ Ir a Contabilidad > Reportes > Gastos
    │   ├─ Seleccionar período
    │   ├─ Agrupar por categoría
    │   └─ Exportar
    │
    ├─► REPORTE DE RENTABILIDAD POR MÁQUINA
    │   │
    │   ├─ Ir a Contabilidad > Reportes > Rentabilidad
    │   ├─ Seleccionar período
    │   ├─ Ver:
    │   │   ├─ Ingresos por máquina
    │   │   ├─ Costos asociados
    │   │   └─ Margen
    │   └─ Exportar
    │
    └─► REPORTE DE MERMAS
        │
        ├─ Ir a Dinero y Productos > Mermas
        ├─ Exportar reporte del período
        └─ Analizar por tipo y producto
    │
    ▼
[Analizar resultados]
    │
    ├─ Identificar anomalías
    ├─ Comparar con períodos anteriores
    └─ Preparar conclusiones
```

---

## 7. Flujos de Recursos Humanos

RRHH gestiona todo lo relacionado con el personal de la empresa.

### 7.1 Control de Asistencia Diaria

**Momento:** Inicio y fin de cada jornada  
**Objetivo:** Registrar puntualidad y asistencia del personal

```
FLUJO: CONTROL DE ASISTENCIA
════════════════════════════

[Inicio del día laboral]
    │
    ▼
[Empleados marcan entrada]
    │
    ├─► Método de marcaje:
    │   ├─ Biométrico (huella/facial)
    │   ├─ Tarjeta de proximidad
    │   └─ Manual (firma en hoja)
    │
    └─ El sistema registra:
        ├─ Hora de entrada
        ├─ Tipo de marcaje
        └─ Ubicación (si aplica)
    │
    ▼
[Monitoreo durante el día]
    │
    ├─ Ir a RRHH > Asistencia
    │
    ├─► Verificar:
    │   │
    │   ├─ ¿Quién no ha marcado entrada?
    │   │   └─► Contactar para verificar
    │   │
    │   ├─ ¿Hay llegadas tardías?
    │   │   └─► Documentar para seguimiento
    │   │
    │   └─ ¿Hay ausencias programadas? (vacaciones, permisos)
    │       └─► Verificar que están registradas
    │
    ▼
[Fin del día laboral]
    │
    ├─ Empleados marcan salida
    │
    └─ El sistema calcula:
        ├─ Horas trabajadas
        ├─ Horas extra (si aplica)
        └─ Puntualidad del día
    │
    ▼
[Revisión diaria (opcional)]
    │
    ├─ Verificar marcajes incompletos
    ├─ Solicitar justificación de ausencias
    └─ Registrar incidencias en el sistema
```

---

### 7.2 Procesamiento de Nómina Quincenal

**Momento:** Día 14 y último día del mes  
**Objetivo:** Calcular y procesar pagos al personal

```
FLUJO: PROCESAMIENTO DE NÓMINA
══════════════════════════════

[2 días antes del pago]
    │
    ▼
[Recopilar información del período]
    │
    ├─► Ir a RRHH > Asistencia
    │   │
    │   ├─ Exportar reporte del período
    │   ├─ Verificar:
    │   │   ├─ Días trabajados por empleado
    │   │   ├─ Horas extra
    │   │   ├─ Ausencias justificadas
    │   │   ├─ Ausencias injustificadas
    │   │   └─ Llegadas tardías
    │   │
    │   └─ Resolver cualquier inconsistencia
    │
    ▼
[Calcular conceptos variables]
    │
    ├─► Para cada empleado:
    │   │
    │   ├─ Horas extra:
    │   │   └─ Cantidad × tarifa × factor (1.35 o 2.0)
    │   │
    │   ├─ Comisiones (si aplica):
    │   │   └─ Según metas cumplidas
    │   │
    │   ├─ Bonificaciones especiales:
    │   │   └─ Rendimiento, antigüedad, etc.
    │   │
    │   └─ Descuentos:
    │       ├─ Ausencias injustificadas
    │       ├─ Préstamos
    │       └─ Adelantos
    │
    ▼
[Generar nómina en sistema]
    │
    ├─ Ir a RRHH > Nómina > "Nueva Nómina"
    │
    ├─► Configurar:
    │   ├─ Período de pago
    │   ├─ Fecha de pago
    │   └─ Tipo (quincenal/mensual)
    │
    ├─► El sistema calcula automáticamente:
    │   ├─ Salario base proporcional
    │   ├─ Deducciones de ley (TSS, ISR)
    │   └─ Aportes patronales
    │
    ├─► Agregar conceptos variables:
    │   ├─ Horas extra
    │   ├─ Comisiones
    │   ├─ Bonos
    │   └─ Descuentos
    │
    └─ Generar vista previa
    │
    ▼
[Revisar y aprobar]
    │
    ├─ Verificar cada línea de la nómina
    ├─ Comparar con nómina anterior
    ├─ Identificar variaciones significativas
    │
    ├─► ¿Todo correcto?
    │   ├─► SÍ: Aprobar nómina
    │   └─► NO: Corregir y recalcular
    │
    └─ Enviar para autorización superior
    │
    ▼
[Ejecutar pagos]
    │
    ├─► Generar archivos para banco (si aplica)
    │   └─ Transferencias electrónicas
    │
    ├─► Preparar efectivo (si pago en efectivo)
    │
    └─► El día de pago:
        ├─ Realizar transferencias
        ├─ Entregar efectivo con recibo
        └─ Marcar nómina como "Pagada" en sistema
    │
    ▼
[Documentar]
    │
    ├─ Generar comprobantes de pago
    ├─ Archivar nómina firmada
    └─ Actualizar expedientes de empleados
```

---

### 7.3 Gestión de Solicitudes de Vacaciones

**Momento:** Cuando empleados solicitan  
**Objetivo:** Procesar vacaciones manteniendo operación

```
FLUJO: GESTIÓN DE VACACIONES
════════════════════════════

[Empleado solicita vacaciones]
    │
    ├─► El empleado en su perfil:
    │   ├─ Ingresa fechas solicitadas
    │   ├─ Agrega comentarios
    │   └─ Envía solicitud
    │
    └─ RRHH recibe notificación
    │
    ▼
[Revisar solicitud]
    │
    ├─ Ir a RRHH > Vacaciones
    ├─ Abrir solicitud pendiente
    │
    ├─► Verificar:
    │   │
    │   ├─ Días disponibles del empleado
    │   │   └─► ¿Tiene suficientes días?
    │   │
    │   ├─ Antigüedad mínima requerida
    │   │
    │   └─ Historial de vacaciones
    │       └─► ¿Cuándo fue su última vacación?
    │
    ▼
[Consultar con supervisor de zona]
    │
    ├─► Si es personal operativo:
    │   │
    │   ├─ Contactar supervisor del empleado
    │   ├─ Verificar impacto en operación
    │   │   └─► ¿Hay cobertura suficiente?
    │   │
    │   └─ Obtener visto bueno
    │
    ▼
[Tomar decisión]
    │
    ├─► APROBAR:
    │   │
    │   ├─ Hacer clic en "Aprobar" en el sistema
    │   ├─ El sistema:
    │   │   ├─ Notifica al empleado
    │   │   ├─ Descuenta días del balance
    │   │   └─ Bloquea esas fechas en calendario
    │   │
    │   └─ Coordinar cobertura con supervisor
    │
    └─► RECHAZAR:
        │
        ├─ Hacer clic en "Rechazar"
        ├─ Ingresar motivo claro
        ├─ Sugerir fechas alternativas
        └─ El sistema notifica al empleado
    │
    ▼
[Durante las vacaciones]
    │
    ├─ El sistema marca automáticamente:
    │   └─ Asistencia como "Vacaciones"
    │
    └─ Al regresar el empleado:
        └─ Verificar que se reincorporó correctamente
```

---

### 7.4 Evaluación de Desempeño

**Momento:** Trimestral o semestral  
**Objetivo:** Medir y documentar rendimiento del personal

```
FLUJO: EVALUACIÓN DE DESEMPEÑO
══════════════════════════════

[Período de evaluación]
    │
    ▼
[Preparar evaluaciones]
    │
    ├─ Ir a RRHH > Evaluaciones
    ├─ Hacer clic en "Nueva Evaluación"
    │
    ├─► Configurar:
    │   ├─ Período a evaluar
    │   ├─ Tipo de evaluación
    │   └─ Empleados a evaluar
    │
    └─ Generar formularios
    │
    ▼
[Recopilar datos de desempeño]
    │
    ├─► Para ABASTECEDORES:
    │   │
    │   ├─ Ir a Gestión de Abastecedores
    │   ├─ Exportar métricas del período:
    │   │   ├─ Máquinas atendidas
    │   │   ├─ Tiempo promedio de servicio
    │   │   ├─ Efectivo recolectado
    │   │   ├─ Diferencias de efectivo
    │   │   ├─ Problemas reportados (calidad)
    │   │   └─ Cumplimiento de checklist
    │   │
    │   └─ Incorporar a la evaluación
    │
    ├─► Para PERSONAL DE ALMACÉN:
    │   │
    │   ├─ Revisar precisión de inventario
    │   ├─ Tiempos de despacho
    │   └─ Incidencias reportadas
    │
    └─► Para SUPERVISORES:
        │
        ├─ Rendimiento de su zona
        ├─ Resolución de problemas
        └─ Gestión de personal a cargo
    │
    ▼
[Completar evaluación]
    │
    ├─► Para cada empleado:
    │   │
    │   ├─ Revisar datos objetivos
    │   │
    │   ├─ Calificar competencias:
    │   │   ├─ Puntualidad
    │   │   ├─ Responsabilidad
    │   │   ├─ Trabajo en equipo
    │   │   ├─ Iniciativa
    │   │   └─ Calidad del trabajo
    │   │
    │   ├─ Agregar comentarios
    │   │
    │   └─ Definir:
    │       ├─ Fortalezas
    │       ├─ Áreas de mejora
    │       └─ Objetivos próximo período
    │
    └─ Guardar evaluación
    │
    ▼
[Retroalimentación al empleado]
    │
    ├─ Programar reunión con el empleado
    ├─ Revisar resultados juntos
    ├─ Escuchar perspectiva del empleado
    ├─ Acordar plan de mejora
    │
    └─ Empleado firma evaluación
        └─ Archivar en expediente
```

---

### 7.5 Gestión Documental de Empleados

**Momento:** Según se requiera  
**Objetivo:** Mantener expedientes completos y actualizados

```
FLUJO: GESTIÓN DOCUMENTAL
═════════════════════════

[Nuevo documento del empleado]
    │
    ▼
[Clasificar documento]
    │
    ├─► DOCUMENTOS DE INGRESO:
    │   ├─ Cédula de identidad
    │   ├─ Currículum vitae
    │   ├─ Contrato de trabajo
    │   ├─ Exámenes médicos
    │   └─ Referencias laborales
    │
    ├─► DOCUMENTOS RECURRENTES:
    │   ├─ Recibos de nómina
    │   ├─ Constancias de trabajo
    │   ├─ Amonestaciones
    │   └─ Reconocimientos
    │
    └─► DOCUMENTOS DE SALIDA:
        ├─ Carta de renuncia
        ├─ Liquidación
        └─ Carta de recomendación
    │
    ▼
[Digitalizar documento]
    │
    ├─ Escanear documento físico
    ├─ Nombrar archivo descriptivamente:
    │   └─ [Apellido]_[TipoDoc]_[Fecha].pdf
    │
    ▼
[Subir al sistema]
    │
    ├─ Ir a RRHH > Empleados
    ├─ Buscar empleado
    ├─ Ir a pestaña "Documentos"
    │
    ├─► Hacer clic en "+ Subir Documento"
    │   ├─ Seleccionar tipo de documento
    │   ├─ Adjuntar archivo
    │   ├─ Agregar descripción
    │   └─ Definir fecha de vencimiento (si aplica)
    │
    └─ Guardar
    │
    ▼
[Archivar físico]
    │
    ├─ Colocar en expediente del empleado
    └─ Mantener en orden cronológico
```

---

## 8. Flujos de Escenarios Especiales

Situaciones fuera de lo común que requieren procedimientos específicos.

### 8.1 Máquina Averiada

**Escenario:** Una máquina deja de funcionar completamente

```
FLUJO: MÁQUINA AVERIADA
═══════════════════════

[Detección de avería]
    │
    ├─► Por abastecedor durante servicio
    ├─► Por alerta del sistema
    └─► Por reporte de ubicación/cliente
    │
    ▼
[Evaluación inicial]
    │
    ├─► Abastecedor (si está presente):
    │   │
    │   ├─ Intentar diagnóstico básico:
    │   │   ├─ ¿Hay energía eléctrica?
    │   │   ├─ ¿Pantalla enciende?
    │   │   ├─ ¿Refrigeración funciona?
    │   │   └─ ¿Acepta pagos?
    │   │
    │   ├─ Intentar solución simple:
    │   │   ├─ Reiniciar máquina
    │   │   ├─ Verificar conexiones
    │   │   └─ Limpiar sensores
    │   │
    │   └─► ¿Se resolvió?
    │       ├─► SÍ: Documentar y continuar
    │       └─► NO: Continuar flujo
    │
    ▼
[Reportar problema]
    │
    ├─ Abastecedor crea reporte detallado
    ├─ Incluir fotos del problema
    ├─ Marcar prioridad ALTA
    │
    ▼
[Acciones inmediatas]
    │
    ├─► Cambiar estado de máquina a "Fuera de Servicio"
    │
    ├─► Si hay productos perecederos en riesgo:
    │   └─ Retirar y registrar como merma potencial
    │
    ├─► Colocar aviso visible:
    │   └─ "Máquina Temporalmente Fuera de Servicio"
    │
    └─► Notificar a administración de la ubicación
    │
    ▼
[Supervisor/Admin evalúa]
    │
    ├─► Revisar reporte
    ├─► Determinar tipo de reparación:
    │   │
    │   ├─► Reparación interna:
    │   │   ├─ Asignar técnico interno
    │   │   ├─ Definir fecha de visita
    │   │   └─ Preparar repuestos necesarios
    │   │
    │   └─► Servicio externo:
    │       ├─ Contactar proveedor de servicio
    │       ├─ Solicitar cotización
    │       ├─ Aprobar y programar visita
    │       └─ Registrar orden de servicio
    │
    ▼
[Seguimiento]
    │
    ├─ Monitorear avance de reparación
    ├─ Actualizar estado en sistema
    │
    └─► Una vez reparada:
        ├─ Técnico confirma funcionamiento
        ├─ Cambiar estado a "Operativa"
        ├─ Programar servicio de reabastecimiento
        └─ Cerrar reporte de problema
```

---

### 8.2 Faltante de Efectivo

**Escenario:** Diferencia significativa entre efectivo esperado y recolectado

```
FLUJO: FALTANTE DE EFECTIVO
═══════════════════════════

[Detección de faltante]
    │
    ├─► Durante servicio: Abastecedor detecta
    └─► Durante conciliación: Contabilidad detecta
    │
    ▼
[Documentación inicial]
    │
    ├─ Registrar monto esperado vs. recolectado
    ├─ Calcular diferencia exacta
    │
    ├─► ¿Diferencia < RD$500?
    │   └─► Posible error de conteo
    │       ├─ Recontar
    │       ├─ Si persiste, documentar como "Diferencia menor"
    │       └─ Monitorear patrón
    │
    └─► ¿Diferencia > RD$500?
        └─► Continuar investigación
    │
    ▼
[Investigación inmediata]
    │
    ├─► Verificar máquina:
    │   ├─ ¿Signos de manipulación?
    │   ├─ ¿Contador de la máquina coincide?
    │   └─ ¿Hay fallas en el sistema de pago?
    │
    ├─► Verificar historial:
    │   ├─ ¿Faltantes anteriores en esta máquina?
    │   ├─ ¿Faltantes anteriores con este abastecedor?
    │   └─ ¿Patrón sospechoso?
    │
    └─► Solicitar explicación escrita del abastecedor
    │
    ▼
[Análisis de causas]
    │
    ├─► CAUSA: Falla de máquina
    │   │
    │   ├─ Documentar el problema técnico
    │   ├─ Programar revisión técnica
    │   └─ Ajustar diferencia sin penalizar empleado
    │
    ├─► CAUSA: Error de conteo
    │   │
    │   ├─ Revisar procedimiento de conteo
    │   ├─ Reforzar capacitación
    │   └─ Ajustar diferencia con nota
    │
    ├─► CAUSA: Robo externo
    │   │
    │   ├─ Documentar evidencia
    │   ├─ Reportar a seguridad de ubicación
    │   ├─ Considerar reporte policial
    │   └─ Procesar como merma/pérdida
    │
    └─► CAUSA SOSPECHOSA: Posible robo interno
        │
        ├─ Escalar a Administrador y RRHH
        ├─ Iniciar investigación formal
        ├─ Revisar cámaras de seguridad (si existen)
        ├─ Entrevistar al empleado
        │
        └─► Según resultado:
            ├─ Exoneración: Documentar y cerrar
            ├─ Responsabilidad confirmada: Proceso disciplinario
            └─ Inconcluso: Aumentar supervisión
    │
    ▼
[Cierre del caso]
    │
    ├─ Registrar resolución en sistema
    ├─ Ajustar inventario/caja si es necesario
    └─ Archivar documentación
```

---

### 8.3 Producto Próximo a Caducar

**Escenario:** Productos cerca de su fecha de vencimiento

```
FLUJO: PRODUCTO PRÓXIMO A CADUCAR
═════════════════════════════════

[Detección]
    │
    ├─► Alerta del sistema (automática)
    ├─► Durante revisión de inventario
    └─► Durante servicio en máquina
    │
    ▼
[Evaluación]
    │
    ├─► Verificar fecha exacta de vencimiento
    │
    ├─► Clasificar según tiempo restante:
    │   │
    │   ├─► > 15 días: Monitorear, priorizar rotación
    │   │
    │   ├─► 7-15 días: Acción preventiva
    │   │   ├─ Reasignar a máquinas de alta rotación
    │   │   └─ Considerar promoción
    │   │
    │   ├─► 3-7 días: Acción urgente
    │   │   ├─ Retirar de máquinas de baja rotación
    │   │   ├─ Concentrar en máquinas de muy alta rotación
    │   │   └─ Considerar venta interna/donación
    │   │
    │   └─► < 3 días: Retirar
    │       └─ Procesar como merma
    │
    ▼
[Acciones según ubicación del producto]
    │
    ├─► EN ALMACÉN:
    │   │
    │   ├─ Mover al frente del estante
    │   ├─ Etiquetar como "Prioritario"
    │   ├─ Despachar primero a vehículos
    │   │
    │   └─► Si no se puede vender a tiempo:
    │       └─ Registrar merma por caducidad
    │
    ├─► EN VEHÍCULO:
    │   │
    │   ├─ Abastecedor debe cargar primero en máquinas
    │   ├─ Priorizar máquinas de alta rotación
    │   │
    │   └─► Al final del día si queda:
    │       ├─ Devolver al almacén
    │       └─ Almacén decide: vender mañana o merma
    │
    └─► EN MÁQUINA:
        │
        ├─► Si > 3 días: Dejar, rotación normal
        │
        └─► Si < 3 días:
            ├─ Retirar en próximo servicio
            └─ Registrar como merma
    │
    ▼
[Registro de merma (si aplica)]
    │
    ├─ Ir a Dinero y Productos > Mermas
    ├─ Registrar:
    │   ├─ Producto
    │   ├─ Cantidad
    │   ├─ Tipo: "Caducidad"
    │   ├─ Lote afectado
    │   └─ Ubicación donde estaba
    │
    └─ Disponer del producto según normativa
```

---

### 8.4 Vandalismo o Robo

**Escenario:** Máquina dañada intencionalmente o robada

```
FLUJO: VANDALISMO O ROBO
════════════════════════

[Descubrimiento del incidente]
    │
    ▼
[Acciones inmediatas - NO TOCAR NADA]
    │
    ├─► Evaluar seguridad personal
    │   └─ Si hay peligro, alejarse
    │
    ├─► Documentar visualmente:
    │   ├─ Tomar fotos desde múltiples ángulos
    │   ├─ Fotografiar daños específicos
    │   ├─ Capturar entorno (cámaras, testigos potenciales)
    │   └─ Anotar hora exacta de descubrimiento
    │
    └─► Notificar inmediatamente:
        ├─ Llamar a supervisor
        └─ Supervisor notifica a Administrador
    │
    ▼
[Reporte formal en sistema]
    │
    ├─ Crear reporte de problema
    ├─ Tipo: "Vandalismo"
    ├─ Prioridad: ALTA
    ├─ Descripción detallada:
    │   ├─ Qué fue dañado/robado
    │   ├─ Estimación de daños
    │   └─ Productos perdidos
    ├─ Adjuntar todas las fotos
    │
    └─ Cambiar estado máquina a "Fuera de Servicio"
    │
    ▼
[Notificar a terceros]
    │
    ├─► Administración de la ubicación:
    │   ├─ Informar del incidente
    │   ├─ Solicitar grabaciones de seguridad
    │   └─ Coordinar medidas adicionales
    │
    ├─► Si hay robo significativo:
    │   │
    │   ├─ Considerar denuncia policial
    │   ├─ Obtener número de caso
    │   └─ Documentar para seguro
    │
    └─► Compañía de seguros (si aplica):
        ├─ Notificar siniestro
        └─ Preparar documentación requerida
    │
    ▼
[Inventario de pérdidas]
    │
    ├─► Productos perdidos/dañados:
    │   ├─ Listar cada producto afectado
    │   ├─ Registrar como merma tipo "Robo"
    │   └─ Calcular valor total
    │
    ├─► Efectivo robado:
    │   ├─ Estimar basado en última recolección
    │   └─ Registrar en ajuste de efectivo
    │
    └─► Daños a la máquina:
        ├─ Documentar cada daño
        └─ Solicitar cotización de reparación
    │
    ▼
[Decisión sobre la máquina]
    │
    ├─► Reparable:
    │   ├─ Programar reparación
    │   ├─ Evaluar reforzar seguridad
    │   └─ Reinstalar cuando esté lista
    │
    ├─► Daño total:
    │   ├─ Procesar pérdida con seguro
    │   ├─ Retirar máquina de ubicación
    │   └─ Evaluar reemplazo
    │
    └─► Ubicación de alto riesgo:
        └─ Considerar no reinstalar
```

---

### 8.5 Abastecedor Ausente

**Escenario:** Abastecedor no se presenta a trabajar sin aviso previo

```
FLUJO: ABASTECEDOR AUSENTE
══════════════════════════

[7:00 AM - Abastecedor no marca entrada]
    │
    ▼
[Intento de contacto]
    │
    ├─ Llamar al celular del abastecedor
    ├─ Enviar mensaje de texto/WhatsApp
    ├─ Esperar 15 minutos para respuesta
    │
    ├─► ¿Responde?
    │   │
    │   ├─► SÍ - Problema temporal:
    │   │   ├─ "Llegará tarde" → Esperar
    │   │   ├─ "Está enfermo" → Activar cobertura
    │   │   └─ "Emergencia" → Activar cobertura
    │   │
    │   └─► NO - Sin respuesta:
    │       └─ Continuar flujo
    │
    ▼
[Activar plan de cobertura]
    │
    ├─► Opción 1: Redistribuir ruta
    │   │
    │   ├─ Identificar abastecedores disponibles
    │   ├─ Dividir paradas entre varios
    │   │   └─ Priorizar máquinas críticas
    │   ├─ Notificar cambios a cada abastecedor
    │   │
    │   └─ En sistema:
    │       └─ Reasignar paradas temporalmente
    │
    ├─► Opción 2: Cobertura completa
    │   │
    │   ├─ Si hay abastecedor de respaldo:
    │   │   ├─ Asignar ruta completa
    │   │   └─ Preparar vehículo de respaldo
    │   │
    │   └─ Si no hay respaldo:
    │       ├─ Supervisor cubre la ruta
    │       └─ O administrador autoriza horas extra
    │
    └─► Opción 3: Posponer (último recurso)
        │
        ├─ Solo si no hay alternativa
        ├─ Priorizar máquinas críticas para mañana
        └─ Notificar a ubicaciones afectadas
    │
    ▼
[Seguimiento del ausente]
    │
    ├─ Continuar intentos de contacto
    ├─ Contactar familiares si es necesario
    │
    ├─► Al hacer contacto:
    │   ├─ Documentar motivo de ausencia
    │   ├─ Obtener comprobante (médico, etc.)
    │   └─ Coordinar fecha de regreso
    │
    └─► Si no hay contacto después de 24-48 horas:
        └─ RRHH inicia proceso de abandono laboral
    │
    ▼
[Documentación]
    │
    ├─ Registrar ausencia en sistema de asistencia
    ├─ Documentar acciones tomadas
    └─ Actualizar expediente según resultado
```

---

### 8.6 Stock Crítico en Almacén

**Escenario:** Producto esencial con inventario muy bajo

```
FLUJO: STOCK CRÍTICO
════════════════════

[Alerta de stock bajo]
    │
    ├─► Sistema detecta automáticamente:
    │   └─ Producto bajo nivel mínimo configurado
    │
    └─► O detección manual durante operación
    │
    ▼
[Evaluar criticidad]
    │
    ├─► ¿Es producto de alta rotación?
    │   └─► SÍ: Acción urgente
    │
    ├─► ¿Hay sustitutos disponibles?
    │   └─► SÍ: Usar temporalmente
    │
    └─► ¿Cuántos días de stock quedan?
        ├─► < 2 días: CRÍTICO
        ├─► 2-5 días: URGENTE
        └─► > 5 días: Planificar
    │
    ▼
[Acción inmediata - CRÍTICO/URGENTE]
    │
    ├─► Contactar proveedor principal:
    │   │
    │   ├─ Verificar disponibilidad
    │   ├─ Solicitar entrega urgente
    │   ├─ Confirmar fecha y hora
    │   │
    │   └─► ¿Puede entregar a tiempo?
    │       ├─► SÍ: Crear orden de compra urgente
    │       └─► NO: Contactar proveedor alternativo
    │
    ├─► Si ningún proveedor puede:
    │   │
    │   └─ Buscar opciones alternativas:
    │       ├─ Compra en supermercado (emergencia)
    │       ├─ Préstamo de otra sucursal (si existe)
    │       └─ Producto sustituto similar
    │
    ▼
[Comunicar a operaciones]
    │
    ├─► Notificar a supervisores:
    │   ├─ Producto afectado
    │   ├─ Fecha estimada de reposición
    │   └─ Instrucciones especiales
    │
    ├─► Instrucciones a abastecedores:
    │   ├─ Racionar producto
    │   ├─ Priorizar máquinas de alta rotación
    │   └─ Ofrecer alternativas a ubicaciones
    │
    └─► Actualizar sistema:
        └─ Agregar nota de "Stock limitado"
    │
    ▼
[Crear orden de compra]
    │
    ├─ Ir a Operaciones > Compras
    ├─ Nueva orden de compra
    ├─ Marcar como "Urgente"
    ├─ Especificar fecha requerida
    │
    └─ Aprobar y enviar a proveedor
    │
    ▼
[Seguimiento]
    │
    ├─ Confirmar recepción de orden por proveedor
    ├─ Rastrear envío
    ├─ Preparar para recepción
    │
    └─► Al recibir:
        ├─ Seguir flujo normal de recepción
        ├─ Notificar a operaciones
        └─ Cerrar alerta de stock crítico
```

---

## 9. Diagrama de Flujo General del Negocio

### Flujo de Productos

```
╔═══════════════╗      ╔═══════════════╗      ╔═══════════════╗      ╔═══════════════╗
║   PROVEEDOR   ║ ──►  ║    ALMACÉN    ║ ──►  ║   VEHÍCULO    ║ ──►  ║   MÁQUINA     ║
╚═══════════════╝      ╚═══════════════╝      ╚═══════════════╝      ╚═══════════════╝
     Factura           Stock Central         Stock Móvil          Stock en Punto
     Lotes             FEFO Estricto         Por Lotes            de Venta
                                                                        │
                                                                        ▼
                                                                  ╔═══════════════╗
                                                                  ║    CLIENTE    ║
                                                                  ╚═══════════════╝
```

### Flujo de Efectivo

```
╔═══════════════╗      ╔═══════════════╗      ╔═══════════════╗      ╔═══════════════╗
║    CLIENTE    ║ ──►  ║   MÁQUINA     ║ ──►  ║  ABASTECEDOR  ║ ──►  ║   OFICINA     ║
╚═══════════════╝      ╚═══════════════╝      ╚═══════════════╝      ╚═══════════════╝
     Pago                Acumulación          Recolección           Consolidación
                                              Diaria                      │
                                                                         ▼
                                                                  ╔═══════════════╗
                                                                  ║    BANCO      ║
                                                                  ╚═══════════════╝
                                                                      Depósito
```

### Flujo de Información

```
                            ╔═══════════════════╗
                            ║   ADMINISTRADOR   ║
                            ╚═══════════════════╝
                                    ▲ ▲ ▲
                     ┌──────────────┘ │ └──────────────┐
                     │                │                │
              ╔══════╧══════╗  ╔══════╧══════╗  ╔══════╧══════╗
              ║ SUPERVISORES ║  ║ CONTABILIDAD ║  ║    RRHH     ║
              ╚══════╤══════╝  ╚═════════════╝  ╚═════════════╝
                     │
         ┌───────────┼───────────┐
         │           │           │
  ╔══════╧══════╗ ╔══╧══╗ ╔══════╧══════╗
  ║ABASTECEDORES║ ║ALMAC║ ║   MÁQUINAS  ║
  ╚═════════════╝ ╚═════╝ ╚═════════════╝
```

---

## Información de Contacto

**Sistema:** Dispensax v2.0  
**Documento:** Flujos Operativos  
**Zona Horaria:** América/Santo_Domingo (GMT-4)

---

*Este documento está sujeto a actualizaciones según evolucionen los procesos operativos. Última actualización: Enero 2026.*
