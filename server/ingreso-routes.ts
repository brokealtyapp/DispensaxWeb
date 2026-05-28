import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc, or, isNull } from "drizzle-orm";
import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from "./auth";
import {
  ingresosCategorias,
  ingresosFijos,
  ingresosRegistros,
  bankAccounts as bankAccountsTable,
  bankTransactions as bankTransactionsTable,
} from "@shared/schema";
import { avanzarProximaFecha, calcMontoMensual, calcMontoAnual, calcTasaDiaria, type Frecuencia } from "./egreso-helpers";
import { z } from "zod";

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────

const ROLES_INGRESOS = ["admin", "contabilidad"] as const;

const CATEGORIAS_INGRESO_DEFAULT = [
  { nombre: "Ventas de máquinas expendedoras", color: "#E84545", icono: "ShoppingCart" },
  { nombre: "Comisiones de establecimientos",  color: "#8b5cf6", icono: "Building2" },
  { nombre: "Contratos de servicio y mantenimiento", color: "#0ea5e9", icono: "Wrench" },
  { nombre: "Arrendamiento de equipos",         color: "#f59e0b", icono: "Package" },
  { nombre: "Servicios de abastecimiento",      color: "#10b981", icono: "Truck" },
  { nombre: "Otros ingresos",                   color: "#64748b", icono: "MoreHorizontal" },
];

function calcEstadoIngreso(
  proximaFecha: Date | null | undefined,
  alertDiasPrevios: number,
  isActive: boolean,
): "al_dia" | "alerta" | "vencido" | "inactivo" {
  if (!isActive) return "inactivo";
  if (!proximaFecha) return "al_dia";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(proximaFecha);
  vence.setHours(0, 0, 0, 0);
  const diffMs = vence.getTime() - hoy.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return "vencido";
  if (diffDias <= alertDiasPrevios) return "alerta";
  return "al_dia";
}

// ────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ────────────────────────────────────────────────

const categoriaBodySchema = z.object({
  nombre: z.string().min(1),
  color: z.string().optional(),
  icono: z.string().optional(),
  metaMensual: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const fijoBodySchema = z.object({
  nombre: z.string().min(1),
  categoriaId: z.string().nullable().optional(),
  montoEsperado: z.coerce.number().positive("Monto debe ser mayor a 0"),
  moneda: z.string().default("DOP"),
  frecuencia: z.enum(["diario", "semanal", "quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual"]),
  diaDelMes: z.coerce.number().min(1).max(31).nullable().optional(),
  fechaInicio: z.string(),
  fechaFin: z.string().nullable().optional(),
  proximaFecha: z.string().nullable().optional(),
  cuentaBancariaId: z.string().nullable().optional(),
  metodoCobro: z.string().default("transferencia"),
  alertDiasPrevios: z.coerce.number().min(0).default(3),
  notas: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const registroBodySchema = z.object({
  fijoId: z.string().nullable().optional(),
  categoriaId: z.string().nullable().optional(),
  monto: z.coerce.number().positive("Monto debe ser mayor a 0"),
  moneda: z.string().default("DOP"),
  fecha: z.string(),
  metodoCobro: z.string().default("transferencia"),
  cuentaBancariaId: z.string().nullable().optional(),
  descripcion: z.string().min(1),
  notas: z.string().nullable().optional(),
});

const cobrarBodySchema = z.object({
  monto: z.coerce.number().positive("Monto debe ser mayor a 0"),
  fecha: z.string().optional(),
  metodoCobro: z.string().default("transferencia"),
  cuentaBancariaId: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

// ────────────────────────────────────────────────
// REGISTRAR RUTAS
// ────────────────────────────────────────────────

export function registerIngresoRoutes(app: Express) {

  // ============================
  // CATEGORÍAS
  // ============================

  app.get(
    "/api/ingresos/categorias",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        // Seed lazy: si no hay categorías, insertar defaults
        const existentes = await db
          .select({ id: ingresosCategorias.id })
          .from(ingresosCategorias)
          .where(eq(ingresosCategorias.tenantId, tenantId))
          .limit(1);

        if (existentes.length === 0) {
          await db.insert(ingresosCategorias).values(
            CATEGORIAS_INGRESO_DEFAULT.map((c) => ({
              tenantId,
              nombre: c.nombre,
              color: c.color,
              icono: c.icono,
              isDefault: true,
            }))
          );
        }

        // Calcular recaudo del mes actual por categoría
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

        const cats = await db
          .select({
            id: ingresosCategorias.id,
            nombre: ingresosCategorias.nombre,
            color: ingresosCategorias.color,
            icono: ingresosCategorias.icono,
            metaMensual: ingresosCategorias.metaMensual,
            isDefault: ingresosCategorias.isDefault,
            isActive: ingresosCategorias.isActive,
          })
          .from(ingresosCategorias)
          .where(eq(ingresosCategorias.tenantId, tenantId))
          .orderBy(asc(ingresosCategorias.nombre));

        const recaudos = await db
          .select({
            categoriaId: ingresosRegistros.categoriaId,
            total: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)`,
          })
          .from(ingresosRegistros)
          .where(
            and(
              eq(ingresosRegistros.tenantId, tenantId),
              gte(ingresosRegistros.fecha, inicioMes),
              lte(ingresosRegistros.fecha, finMes)
            )
          )
          .groupBy(ingresosRegistros.categoriaId);

        const recaudoMap = new Map(recaudos.map((r) => [r.categoriaId, parseFloat(r.total)]));

        res.json(
          cats.map((c) => ({
            ...c,
            recaudoDelMes: recaudoMap.get(c.id) ?? 0,
          }))
        );
      } catch (e) {
        console.error("GET /api/ingresos/categorias:", e);
        res.status(500).json({ error: "Error al obtener categorías" });
      }
    }
  );

  app.post(
    "/api/ingresos/categorias",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = categoriaBodySchema.parse(req.body);
        const [cat] = await db
          .insert(ingresosCategorias)
          .values({ tenantId, ...data })
          .returning();
        res.status(201).json(cat);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/ingresos/categorias:", e);
        res.status(500).json({ error: "Error al crear categoría" });
      }
    }
  );

  app.put(
    "/api/ingresos/categorias/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = categoriaBodySchema.partial().parse(req.body);
        const [updated] = await db
          .update(ingresosCategorias)
          .set(data)
          .where(and(eq(ingresosCategorias.id, req.params.id), eq(ingresosCategorias.tenantId, tenantId)))
          .returning();
        if (!updated) return res.status(404).json({ error: "Categoría no encontrada" });
        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PUT /api/ingresos/categorias/:id:", e);
        res.status(500).json({ error: "Error al actualizar categoría" });
      }
    }
  );

  app.delete(
    "/api/ingresos/categorias/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        await db
          .delete(ingresosCategorias)
          .where(and(eq(ingresosCategorias.id, req.params.id), eq(ingresosCategorias.tenantId, tenantId)));
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/ingresos/categorias/:id:", e);
        res.status(500).json({ error: "Error al eliminar categoría" });
      }
    }
  );

  // ============================
  // ALERTAS PRÓXIMOS COBROS
  // ============================

  app.get(
    "/api/ingresos/alertas-proximos-cobros",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const fijos = await db
          .select({
            id: ingresosFijos.id,
            nombre: ingresosFijos.nombre,
            montoEsperado: ingresosFijos.montoEsperado,
            moneda: ingresosFijos.moneda,
            proximaFecha: ingresosFijos.proximaFecha,
            alertDiasPrevios: ingresosFijos.alertDiasPrevios,
            isActive: ingresosFijos.isActive,
            categoriaNombre: ingresosCategorias.nombre,
            categoriaColor: ingresosCategorias.color,
            categoriaIcono: ingresosCategorias.icono,
          })
          .from(ingresosFijos)
          .leftJoin(ingresosCategorias, eq(ingresosFijos.categoriaId, ingresosCategorias.id))
          .where(and(eq(ingresosFijos.tenantId, tenantId), eq(ingresosFijos.isActive, true)));

        const alertas = fijos
          .map((f) => ({
            ...f,
            estado: calcEstadoIngreso(f.proximaFecha, f.alertDiasPrevios, f.isActive),
          }))
          .filter((f) => f.estado === "alerta" || f.estado === "vencido")
          .sort((a, b) => {
            const da = a.proximaFecha ? new Date(a.proximaFecha).getTime() : 0;
            const db2 = b.proximaFecha ? new Date(b.proximaFecha).getTime() : 0;
            return da - db2;
          });

        res.json(alertas);
      } catch (e) {
        console.error("GET /api/ingresos/alertas-proximos-cobros:", e);
        res.status(500).json({ error: "Error al obtener alertas" });
      }
    }
  );

  // ============================
  // INGRESOS FIJOS
  // ============================

  app.get(
    "/api/ingresos/fijos",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const fijos = await db
          .select({
            id: ingresosFijos.id,
            nombre: ingresosFijos.nombre,
            montoEsperado: ingresosFijos.montoEsperado,
            moneda: ingresosFijos.moneda,
            frecuencia: ingresosFijos.frecuencia,
            proximaFecha: ingresosFijos.proximaFecha,
            alertDiasPrevios: ingresosFijos.alertDiasPrevios,
            isActive: ingresosFijos.isActive,
            categoriaId: ingresosFijos.categoriaId,
            categoriaNombre: ingresosCategorias.nombre,
            categoriaColor: ingresosCategorias.color,
            categoriaIcono: ingresosCategorias.icono,
            cuentaBancariaId: ingresosFijos.cuentaBancariaId,
            metodoCobro: ingresosFijos.metodoCobro,
            notas: ingresosFijos.notas,
            fechaInicio: ingresosFijos.fechaInicio,
            fechaFin: ingresosFijos.fechaFin,
            diaDelMes: ingresosFijos.diaDelMes,
          })
          .from(ingresosFijos)
          .leftJoin(ingresosCategorias, eq(ingresosFijos.categoriaId, ingresosCategorias.id))
          .where(eq(ingresosFijos.tenantId, tenantId))
          .orderBy(asc(ingresosFijos.nombre));

        res.json(
          fijos.map((f) => ({
            ...f,
            estado: calcEstadoIngreso(f.proximaFecha, f.alertDiasPrevios, f.isActive),
          }))
        );
      } catch (e) {
        console.error("GET /api/ingresos/fijos:", e);
        res.status(500).json({ error: "Error al obtener ingresos fijos" });
      }
    }
  );

  app.post(
    "/api/ingresos/fijos",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = fijoBodySchema.parse(req.body);
        const proximaFecha = data.proximaFecha
          ? new Date(data.proximaFecha)
          : new Date(data.fechaInicio);

        const [fijo] = await db
          .insert(ingresosFijos)
          .values({
            tenantId,
            nombre: data.nombre,
            categoriaId: data.categoriaId ?? null,
            montoEsperado: String(data.montoEsperado),
            moneda: data.moneda,
            frecuencia: data.frecuencia,
            diaDelMes: data.diaDelMes ?? null,
            fechaInicio: new Date(data.fechaInicio),
            fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
            proximaFecha,
            cuentaBancariaId: data.cuentaBancariaId ?? null,
            metodoCobro: data.metodoCobro,
            alertDiasPrevios: data.alertDiasPrevios,
            notas: data.notas ?? null,
            isActive: data.isActive ?? true,
          })
          .returning();
        res.status(201).json(fijo);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/ingresos/fijos:", e);
        res.status(500).json({ error: "Error al crear ingreso fijo" });
      }
    }
  );

  app.put(
    "/api/ingresos/fijos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = fijoBodySchema.parse(req.body);
        const [updated] = await db
          .update(ingresosFijos)
          .set({
            nombre: data.nombre,
            categoriaId: data.categoriaId ?? null,
            montoEsperado: String(data.montoEsperado),
            moneda: data.moneda,
            frecuencia: data.frecuencia,
            diaDelMes: data.diaDelMes ?? null,
            fechaInicio: new Date(data.fechaInicio),
            fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
            proximaFecha: data.proximaFecha ? new Date(data.proximaFecha) : null,
            cuentaBancariaId: data.cuentaBancariaId ?? null,
            metodoCobro: data.metodoCobro,
            alertDiasPrevios: data.alertDiasPrevios,
            notas: data.notas ?? null,
            isActive: data.isActive ?? true,
            updatedAt: new Date(),
          })
          .where(and(eq(ingresosFijos.id, req.params.id), eq(ingresosFijos.tenantId, tenantId)))
          .returning();
        if (!updated) return res.status(404).json({ error: "Ingreso fijo no encontrado" });
        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PUT /api/ingresos/fijos/:id:", e);
        res.status(500).json({ error: "Error al actualizar ingreso fijo" });
      }
    }
  );

  app.delete(
    "/api/ingresos/fijos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        await db
          .delete(ingresosFijos)
          .where(and(eq(ingresosFijos.id, req.params.id), eq(ingresosFijos.tenantId, tenantId)));
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/ingresos/fijos/:id:", e);
        res.status(500).json({ error: "Error al eliminar ingreso fijo" });
      }
    }
  );

  app.patch(
    "/api/ingresos/fijos/:id/toggle",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const [fijo] = await db
          .select({ isActive: ingresosFijos.isActive })
          .from(ingresosFijos)
          .where(and(eq(ingresosFijos.id, req.params.id), eq(ingresosFijos.tenantId, tenantId)));
        if (!fijo) return res.status(404).json({ error: "No encontrado" });
        const [updated] = await db
          .update(ingresosFijos)
          .set({ isActive: !fijo.isActive, updatedAt: new Date() })
          .where(and(eq(ingresosFijos.id, req.params.id), eq(ingresosFijos.tenantId, tenantId)))
          .returning();
        res.json(updated);
      } catch (e) {
        console.error("PATCH /api/ingresos/fijos/:id/toggle:", e);
        res.status(500).json({ error: "Error al cambiar estado" });
      }
    }
  );

  // Registrar cobro: avanza proximaFecha, crea bank_transaction si hay cuenta
  app.post(
    "/api/ingresos/fijos/:id/registrar-cobro",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const data = cobrarBodySchema.parse(req.body);
        const [fijo] = await db
          .select()
          .from(ingresosFijos)
          .where(and(eq(ingresosFijos.id, req.params.id), eq(ingresosFijos.tenantId, tenantId)));
        if (!fijo) return res.status(404).json({ error: "Ingreso fijo no encontrado" });

        const fechaCobro = data.fecha ? new Date(data.fecha) : new Date();
        const nuevaProximaFecha = avanzarProximaFecha(
          fijo.proximaFecha ? new Date(fijo.proximaFecha) : new Date(),
          fijo.frecuencia as Frecuencia
        );

        // Crear registro de cobro
        const [registro] = await db
          .insert(ingresosRegistros)
          .values({
            tenantId,
            fijoId: fijo.id,
            categoriaId: fijo.categoriaId,
            monto: String(data.monto),
            moneda: fijo.moneda,
            fecha: fechaCobro,
            metodoCobro: data.metodoCobro,
            cuentaBancariaId: data.cuentaBancariaId ?? fijo.cuentaBancariaId ?? null,
            descripcion: `Cobro: ${fijo.nombre}`,
            notas: data.notas ?? null,
            createdBy: userId ?? null,
          })
          .returning();

        // Avanzar próxima fecha
        await db
          .update(ingresosFijos)
          .set({ proximaFecha: nuevaProximaFecha, updatedAt: new Date() })
          .where(eq(ingresosFijos.id, fijo.id));

        // Integración bancaria: crear bank_transaction y sumar saldo
        const cuentaId = data.cuentaBancariaId ?? fijo.cuentaBancariaId;
        if (cuentaId) {
          const [cuenta] = await db
            .select({ saldo: bankAccountsTable.balance })
            .from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, cuentaId), eq(bankAccountsTable.tenantId, tenantId)));
          if (cuenta) {
            const nuevoSaldo = parseFloat(cuenta.saldo ?? "0") + data.monto;
            await db
              .update(bankAccountsTable)
              .set({ balance: String(nuevoSaldo), updatedAt: new Date() })
              .where(eq(bankAccountsTable.id, cuentaId));
            await db.insert(bankTransactionsTable).values({
              tenantId,
              bankAccountId: cuentaId,
              type: "entrada",
              amount: String(data.monto),
              description: `Ingreso: ${fijo.nombre}`,
              fecha: fechaCobro,
              createdBy: userId ?? null,
            });
          }
        }

        res.status(201).json({ registro, nuevaProximaFecha });
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/ingresos/fijos/:id/registrar-cobro:", e);
        res.status(500).json({ error: "Error al registrar cobro" });
      }
    }
  );

  app.get(
    "/api/ingresos/fijos/:id/cobros",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const cobros = await db
          .select()
          .from(ingresosRegistros)
          .where(
            and(
              eq(ingresosRegistros.tenantId, tenantId),
              eq(ingresosRegistros.fijoId, req.params.id)
            )
          )
          .orderBy(desc(ingresosRegistros.fecha));
        res.json(cobros);
      } catch (e) {
        console.error("GET /api/ingresos/fijos/:id/cobros:", e);
        res.status(500).json({ error: "Error al obtener cobros" });
      }
    }
  );

  // ============================
  // REGISTROS (ingresos variables)
  // ============================

  app.get(
    "/api/ingresos/registros",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "50"))));
        const offset = (page - 1) * pageSize;

        const { desde, hasta, categoriaId, moneda, fijoId } = req.query as Record<string, string>;

        const conditions = [eq(ingresosRegistros.tenantId, tenantId)];
        if (desde) conditions.push(gte(ingresosRegistros.fecha, new Date(desde)));
        if (hasta) conditions.push(lte(ingresosRegistros.fecha, new Date(hasta + "T23:59:59")));
        if (categoriaId && categoriaId !== "__all__") conditions.push(eq(ingresosRegistros.categoriaId, categoriaId));
        if (moneda && moneda !== "__all__") conditions.push(eq(ingresosRegistros.moneda, moneda));
        if (fijoId) conditions.push(eq(ingresosRegistros.fijoId, fijoId));

        const [{ total }] = await db
          .select({ total: sql<number>`COUNT(*)::int` })
          .from(ingresosRegistros)
          .where(and(...conditions));

        const rows = await db
          .select({
            id: ingresosRegistros.id,
            fijoId: ingresosRegistros.fijoId,
            categoriaId: ingresosRegistros.categoriaId,
            monto: ingresosRegistros.monto,
            moneda: ingresosRegistros.moneda,
            fecha: ingresosRegistros.fecha,
            metodoCobro: ingresosRegistros.metodoCobro,
            descripcion: ingresosRegistros.descripcion,
            notas: ingresosRegistros.notas,
            cuentaBancariaId: ingresosRegistros.cuentaBancariaId,
            createdAt: ingresosRegistros.createdAt,
            categoriaNombre: ingresosCategorias.nombre,
            categoriaColor: ingresosCategorias.color,
            categoriaIcono: ingresosCategorias.icono,
            cuentaNombre: bankAccountsTable.name,
          })
          .from(ingresosRegistros)
          .leftJoin(ingresosCategorias, eq(ingresosRegistros.categoriaId, ingresosCategorias.id))
          .leftJoin(bankAccountsTable, eq(ingresosRegistros.cuentaBancariaId, bankAccountsTable.id))
          .where(and(...conditions))
          .orderBy(desc(ingresosRegistros.fecha))
          .limit(pageSize)
          .offset(offset);

        res.json({ rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
      } catch (e) {
        console.error("GET /api/ingresos/registros:", e);
        res.status(500).json({ error: "Error al obtener registros" });
      }
    }
  );

  app.post(
    "/api/ingresos/registros",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = registroBodySchema.parse(req.body);

        const [registro] = await db
          .insert(ingresosRegistros)
          .values({
            tenantId,
            fijoId: data.fijoId ?? null,
            categoriaId: data.categoriaId ?? null,
            monto: String(data.monto),
            moneda: data.moneda,
            fecha: new Date(data.fecha),
            metodoCobro: data.metodoCobro,
            cuentaBancariaId: data.cuentaBancariaId ?? null,
            descripcion: data.descripcion,
            notas: data.notas ?? null,
            createdBy: userId ?? null,
          })
          .returning();

        // Integración bancaria
        if (data.cuentaBancariaId) {
          const [cuenta] = await db
            .select({ saldo: bankAccountsTable.balance })
            .from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, data.cuentaBancariaId), eq(bankAccountsTable.tenantId, tenantId)));
          if (cuenta) {
            const nuevoSaldo = parseFloat(cuenta.saldo ?? "0") + data.monto;
            await db
              .update(bankAccountsTable)
              .set({ balance: String(nuevoSaldo), updatedAt: new Date() })
              .where(eq(bankAccountsTable.id, data.cuentaBancariaId));
            await db.insert(bankTransactionsTable).values({
              tenantId,
              bankAccountId: data.cuentaBancariaId,
              type: "entrada",
              amount: String(data.monto),
              description: data.descripcion,
              fecha: new Date(data.fecha),
              createdBy: userId ?? null,
            });
          }
        }

        res.status(201).json(registro);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/ingresos/registros:", e);
        res.status(500).json({ error: "Error al crear registro" });
      }
    }
  );

  app.put(
    "/api/ingresos/registros/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = registroBodySchema.parse(req.body);
        const [updated] = await db
          .update(ingresosRegistros)
          .set({
            categoriaId: data.categoriaId ?? null,
            monto: String(data.monto),
            moneda: data.moneda,
            fecha: new Date(data.fecha),
            metodoCobro: data.metodoCobro,
            cuentaBancariaId: data.cuentaBancariaId ?? null,
            descripcion: data.descripcion,
            notas: data.notas ?? null,
          })
          .where(and(eq(ingresosRegistros.id, req.params.id), eq(ingresosRegistros.tenantId, tenantId)))
          .returning();
        if (!updated) return res.status(404).json({ error: "Registro no encontrado" });
        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PUT /api/ingresos/registros/:id:", e);
        res.status(500).json({ error: "Error al actualizar registro" });
      }
    }
  );

  app.delete(
    "/api/ingresos/registros/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        await db
          .delete(ingresosRegistros)
          .where(and(eq(ingresosRegistros.id, req.params.id), eq(ingresosRegistros.tenantId, tenantId)));
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/ingresos/registros/:id:", e);
        res.status(500).json({ error: "Error al eliminar registro" });
      }
    }
  );

  // ============================
  // DASHBOARD
  // ============================

  app.get(
    "/api/ingresos/dashboard",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
        const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
        const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

        // Total mes actual y mes anterior
        const [{ totalMes }] = await db
          .select({ totalMes: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)` })
          .from(ingresosRegistros)
          .where(and(eq(ingresosRegistros.tenantId, tenantId), gte(ingresosRegistros.fecha, inicioMes), lte(ingresosRegistros.fecha, finMes)));

        const [{ totalMesAnterior }] = await db
          .select({ totalMesAnterior: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)` })
          .from(ingresosRegistros)
          .where(and(eq(ingresosRegistros.tenantId, tenantId), gte(ingresosRegistros.fecha, inicioMesAnterior), lte(ingresosRegistros.fecha, finMesAnterior)));

        const [{ totalAnual }] = await db
          .select({ totalAnual: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)` })
          .from(ingresosRegistros)
          .where(and(eq(ingresosRegistros.tenantId, tenantId), gte(ingresosRegistros.fecha, inicioAnio)));

        // Fijos activos y meta mensual normalizada
        const fijosActivos = await db
          .select({
            montoEsperado: ingresosFijos.montoEsperado,
            frecuencia: ingresosFijos.frecuencia,
            proximaFecha: ingresosFijos.proximaFecha,
            alertDiasPrevios: ingresosFijos.alertDiasPrevios,
          })
          .from(ingresosFijos)
          .where(and(eq(ingresosFijos.tenantId, tenantId), eq(ingresosFijos.isActive, true)));

        let metaMensualFijos = 0;
        for (const f of fijosActivos) {
          metaMensualFijos += calcMontoMensual(parseFloat(f.montoEsperado), f.frecuencia as Frecuencia);
        }

        // Recaudo por categoría
        const porCategoria = await db
          .select({
            nombre: ingresosCategorias.nombre,
            color: ingresosCategorias.color,
            total: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)`,
          })
          .from(ingresosRegistros)
          .leftJoin(ingresosCategorias, eq(ingresosRegistros.categoriaId, ingresosCategorias.id))
          .where(and(eq(ingresosRegistros.tenantId, tenantId), gte(ingresosRegistros.fecha, inicioMes), lte(ingresosRegistros.fecha, finMes)))
          .groupBy(ingresosCategorias.nombre, ingresosCategorias.color);

        // Próximos cobros (7 días)
        const enSieteDias = new Date(hoy);
        enSieteDias.setDate(hoy.getDate() + 7);
        const proximos = await db
          .select({
            id: ingresosFijos.id,
            nombre: ingresosFijos.nombre,
            montoEsperado: ingresosFijos.montoEsperado,
            moneda: ingresosFijos.moneda,
            proximaFecha: ingresosFijos.proximaFecha,
            categoriaColor: ingresosCategorias.color,
          })
          .from(ingresosFijos)
          .leftJoin(ingresosCategorias, eq(ingresosFijos.categoriaId, ingresosCategorias.id))
          .where(
            and(
              eq(ingresosFijos.tenantId, tenantId),
              eq(ingresosFijos.isActive, true),
              gte(ingresosFijos.proximaFecha, hoy),
              lte(ingresosFijos.proximaFecha, enSieteDias)
            )
          )
          .orderBy(asc(ingresosFijos.proximaFecha));

        // Tendencia 6 meses
        const tendencia: { mes: string; total: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
          const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          const [{ t }] = await db
            .select({ t: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)` })
            .from(ingresosRegistros)
            .where(and(eq(ingresosRegistros.tenantId, tenantId), gte(ingresosRegistros.fecha, d), lte(ingresosRegistros.fecha, fin)));
          const label = d.toLocaleString("es-DO", { month: "short" });
          tendencia.push({ mes: label, total: parseFloat(t) });
        }

        const totalMesNum = parseFloat(totalMes);
        const totalMesAnteriorNum = parseFloat(totalMesAnterior);
        const variacion =
          totalMesAnteriorNum > 0
            ? ((totalMesNum - totalMesAnteriorNum) / totalMesAnteriorNum) * 100
            : null;

        res.json({
          totalMes: totalMesNum,
          totalMesAnterior: totalMesAnteriorNum,
          totalAnual: parseFloat(totalAnual),
          tasaDiaria: calcTasaDiaria(totalMesNum),
          metaMensualFijos,
          variacionVsMesAnterior: variacion,
          fijosActivos: fijosActivos.length,
          recaudoPorCategoria: porCategoria.map((c) => ({
            nombre: c.nombre ?? "Sin categoría",
            color: c.color ?? "#9ca3af",
            total: parseFloat(c.total),
          })),
          proximosCobros: proximos,
          tendencia,
        });
      } catch (e) {
        console.error("GET /api/ingresos/dashboard:", e);
        res.status(500).json({ error: "Error al obtener dashboard" });
      }
    }
  );

  // ============================
  // POR MONEDA
  // ============================

  app.get(
    "/api/ingresos/por-moneda",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

        const rows = await db
          .select({
            moneda: ingresosRegistros.moneda,
            totalMes: sql<string>`COALESCE(SUM(${ingresosRegistros.monto}::numeric), 0)`,
            cantidad: sql<number>`COUNT(*)::int`,
          })
          .from(ingresosRegistros)
          .where(and(eq(ingresosRegistros.tenantId, tenantId), gte(ingresosRegistros.fecha, inicioMes), lte(ingresosRegistros.fecha, finMes)))
          .groupBy(ingresosRegistros.moneda);

        res.json(rows.map((r) => ({ moneda: r.moneda, totalMes: parseFloat(r.totalMes), cantidad: r.cantidad })));
      } catch (e) {
        console.error("GET /api/ingresos/por-moneda:", e);
        res.status(500).json({ error: "Error al obtener totales por moneda" });
      }
    }
  );

  // ============================
  // CUENTAS BANCARIAS (para selects)
  // ============================

  app.get(
    "/api/ingresos/cuentas-bancarias",
    authenticateJWT,
    authorizeRoles(...ROLES_INGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const cuentas = await db
          .select({
            id: bankAccountsTable.id,
            nombre: bankAccountsTable.name,
            tipo: bankAccountsTable.accountType,
            moneda: bankAccountsTable.currency,
            saldo: bankAccountsTable.balance,
          })
          .from(bankAccountsTable)
          .where(and(eq(bankAccountsTable.tenantId, tenantId), eq(bankAccountsTable.isActive, true)))
          .orderBy(bankAccountsTable.name);

        res.json(cuentas);
      } catch (e) {
        console.error("GET /api/ingresos/cuentas-bancarias:", e);
        res.status(500).json({ error: "Error al obtener cuentas bancarias" });
      }
    }
  );
}
