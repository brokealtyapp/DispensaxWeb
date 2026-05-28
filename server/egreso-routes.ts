import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";
import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from "./auth";
import {
  egresosCategorias,
  egresosFijos,
  egresosRegistros,
  bankAccounts as bankAccountsTable,
  bankTransactions as bankTransactionsTable,
  insertEgresoCategoriaSchema,
  insertEgresoFijoSchema,
  insertEgresoRegistroSchema,
} from "@shared/schema";
import { z } from "zod";
import {
  avanzarProximaFecha,
  calcEstadoFijo,
  calcMontoMensual,
  calcMontoAnual,
  calcTasaDiaria,
  CATEGORIAS_DEFAULT,
  type Frecuencia,
} from "./egreso-helpers";

const ROLES_EGRESOS = ["admin", "contabilidad"];

async function seedCategoriasDefault(tenantId: string) {
  const existing = await db
    .select({ id: egresosCategorias.id })
    .from(egresosCategorias)
    .where(eq(egresosCategorias.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(egresosCategorias).values(
    CATEGORIAS_DEFAULT.map((c) => ({
      tenantId,
      nombre: c.nombre,
      color: c.color,
      icono: c.icono,
      isDefault: true,
      isActive: true,
    }))
  );
}

export function registerEgresoRoutes(app: Express) {
  // ============================
  // CATEGORÍAS
  // ============================

  app.get(
    "/api/egresos/categorias",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        await seedCategoriasDefault(tenantId);

        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

        const categorias = await db
          .select()
          .from(egresosCategorias)
          .where(
            and(
              eq(egresosCategorias.tenantId, tenantId),
              eq(egresosCategorias.isActive, true)
            )
          )
          .orderBy(egresosCategorias.nombre);

        const gastosMes = await db
          .select({
            categoriaId: egresosRegistros.categoriaId,
            total: sql<string>`COALESCE(SUM(CASE WHEN ${egresosRegistros.moneda} = 'USD' THEN ${egresosRegistros.monto}::numeric * 60 ELSE ${egresosRegistros.monto}::numeric END), 0)`,
          })
          .from(egresosRegistros)
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              gte(egresosRegistros.fecha, inicioMes),
              lte(egresosRegistros.fecha, finMes)
            )
          )
          .groupBy(egresosRegistros.categoriaId);

        const gastoMap = new Map(gastosMes.map((g) => [g.categoriaId, parseFloat(g.total)]));

        res.json(
          categorias.map((c) => ({
            ...c,
            gastoDelMes: gastoMap.get(c.id) ?? 0,
          }))
        );
      } catch (e) {
        console.error("GET /api/egresos/categorias:", e);
        res.status(500).json({ error: "Error al obtener categorías" });
      }
    }
  );

  app.post(
    "/api/egresos/categorias",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const data = insertEgresoCategoriaSchema.parse({ ...req.body, tenantId });
        const [created] = await db.insert(egresosCategorias).values(data).returning();
        res.status(201).json(created);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/egresos/categorias:", e);
        res.status(500).json({ error: "Error al crear categoría" });
      }
    }
  );

  app.put(
    "/api/egresos/categorias/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const schema = z.object({
          nombre: z.string().min(1).optional(),
          color: z.string().optional(),
          icono: z.string().optional(),
          presupuestoMensual: z.string().optional().nullable(),
          isActive: z.boolean().optional(),
        });
        const data = schema.parse(req.body);

        const [updated] = await db
          .update(egresosCategorias)
          .set(data)
          .where(
            and(eq(egresosCategorias.id, id), eq(egresosCategorias.tenantId, tenantId))
          )
          .returning();

        if (!updated) return res.status(404).json({ error: "Categoría no encontrada" });
        res.json(updated);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PUT /api/egresos/categorias/:id:", e);
        res.status(500).json({ error: "Error al actualizar categoría" });
      }
    }
  );

  app.delete(
    "/api/egresos/categorias/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        await db
          .update(egresosCategorias)
          .set({ isActive: false })
          .where(
            and(eq(egresosCategorias.id, id), eq(egresosCategorias.tenantId, tenantId))
          );
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/egresos/categorias/:id:", e);
        res.status(500).json({ error: "Error al eliminar categoría" });
      }
    }
  );

  // ============================
  // GASTOS FIJOS
  // ============================

  app.get(
    "/api/egresos/fijos",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { soloActivos } = req.query;

        const conditions: any[] = [eq(egresosFijos.tenantId, tenantId)];
        if (soloActivos === "true") conditions.push(eq(egresosFijos.isActive, true));

        const fijos = await db
          .select({
            fijo: egresosFijos,
            categoriaNombre: egresosCategorias.nombre,
            categoriaColor: egresosCategorias.color,
            categoriaIcono: egresosCategorias.icono,
          })
          .from(egresosFijos)
          .leftJoin(egresosCategorias, eq(egresosFijos.categoriaId, egresosCategorias.id))
          .where(and(...conditions))
          .orderBy(egresosFijos.nombre);

        const result = fijos.map(({ fijo, categoriaNombre, categoriaColor, categoriaIcono }) => ({
          ...fijo,
          estado: calcEstadoFijo(
            fijo.proximaFecha,
            fijo.alertDiasPrevios ?? 3,
            parseFloat(fijo.totalPagadoCiclo ?? "0"),
            parseFloat(fijo.monto),
            fijo.isActive ?? true
          ),
          categoriaNombre,
          categoriaColor,
          categoriaIcono,
        }));

        res.json(result);
      } catch (e) {
        console.error("GET /api/egresos/fijos:", e);
        res.status(500).json({ error: "Error al obtener gastos fijos" });
      }
    }
  );

  app.post(
    "/api/egresos/fijos",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const data = insertEgresoFijoSchema.parse({
          ...req.body,
          tenantId,
          fechaInicio: new Date(req.body.fechaInicio),
          fechaFin: req.body.fechaFin ? new Date(req.body.fechaFin) : null,
          proximaFecha: new Date(req.body.fechaInicio),
        });

        const [created] = await db.insert(egresosFijos).values(data).returning();
        res.status(201).json(created);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/egresos/fijos:", e);
        res.status(500).json({ error: "Error al crear gasto fijo" });
      }
    }
  );

  app.put(
    "/api/egresos/fijos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const schema = z.object({
          nombre: z.string().min(1).optional(),
          categoriaId: z.string().nullable().optional(),
          monto: z.string().optional(),
          moneda: z.enum(["DOP", "USD"]).optional(),
          frecuencia: z.string().optional(),
          diaDelMes: z.number().nullable().optional(),
          fechaInicio: z.string().optional(),
          fechaFin: z.string().nullable().optional(),
          proximaFecha: z.string().nullable().optional(),
          cuentaBancariaId: z.string().nullable().optional(),
          metodoPago: z.string().optional(),
          alertDiasPrevios: z.number().optional(),
          notas: z.string().nullable().optional(),
        });
        const body = schema.parse(req.body);
        const updateData: any = { ...body, updatedAt: new Date() };
        if (body.fechaInicio) updateData.fechaInicio = new Date(body.fechaInicio);
        if (body.fechaFin) updateData.fechaFin = new Date(body.fechaFin);
        if (body.proximaFecha) updateData.proximaFecha = new Date(body.proximaFecha);

        const [updated] = await db
          .update(egresosFijos)
          .set(updateData)
          .where(and(eq(egresosFijos.id, id), eq(egresosFijos.tenantId, tenantId)))
          .returning();

        if (!updated) return res.status(404).json({ error: "Gasto fijo no encontrado" });
        res.json(updated);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PUT /api/egresos/fijos/:id:", e);
        res.status(500).json({ error: "Error al actualizar gasto fijo" });
      }
    }
  );

  app.delete(
    "/api/egresos/fijos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        await db
          .update(egresosFijos)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(egresosFijos.id, id), eq(egresosFijos.tenantId, tenantId)));
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/egresos/fijos/:id:", e);
        res.status(500).json({ error: "Error al eliminar gasto fijo" });
      }
    }
  );

  app.patch(
    "/api/egresos/fijos/:id/toggle",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const fijo = await db
          .select()
          .from(egresosFijos)
          .where(and(eq(egresosFijos.id, id), eq(egresosFijos.tenantId, tenantId)))
          .limit(1);

        if (!fijo.length) return res.status(404).json({ error: "Gasto fijo no encontrado" });

        const [updated] = await db
          .update(egresosFijos)
          .set({ isActive: !fijo[0].isActive, updatedAt: new Date() })
          .where(eq(egresosFijos.id, id))
          .returning();

        res.json(updated);
      } catch (e) {
        console.error("PATCH /api/egresos/fijos/:id/toggle:", e);
        res.status(500).json({ error: "Error al cambiar estado" });
      }
    }
  );

  app.post(
    "/api/egresos/fijos/:id/registrar-pago",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const schema = z.object({
          monto: z.string().min(1),
          metodoPago: z.string().default("transferencia"),
          cuentaBancariaId: z.string().nullable().optional(),
          notas: z.string().optional(),
          fecha: z.string().optional(),
        });
        const body = schema.parse(req.body);

        const [fijo] = await db
          .select()
          .from(egresosFijos)
          .where(and(eq(egresosFijos.id, id), eq(egresosFijos.tenantId, tenantId)))
          .limit(1);

        if (!fijo) return res.status(404).json({ error: "Gasto fijo no encontrado" });

        const montoPago = parseFloat(body.monto);
        const montoTotal = parseFloat(fijo.monto);
        const totalAcumulado = parseFloat(fijo.totalPagadoCiclo ?? "0") + montoPago;
        const esParcial = totalAcumulado < montoTotal;
        const fechaPago = body.fecha ? new Date(body.fecha) : new Date();
        const ciclofecha = fijo.proximaFecha
          ? fijo.proximaFecha.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        await db.insert(egresosRegistros).values({
          tenantId,
          fijoId: id,
          categoriaId: fijo.categoriaId,
          monto: body.monto,
          moneda: fijo.moneda ?? "DOP",
          fecha: fechaPago,
          metodoPago: body.metodoPago,
          cuentaBancariaId: body.cuentaBancariaId ?? null,
          descripcion: `Pago ${esParcial ? "parcial " : ""}de "${fijo.nombre}"`,
          notas: body.notas ?? null,
          esParcial,
          ciclofecha,
          createdBy: userId ?? null,
        });

        let nuevaProximaFecha = fijo.proximaFecha;
        let nuevoTotalPagado = totalAcumulado.toString();

        if (!esParcial) {
          nuevaProximaFecha = fijo.proximaFecha
            ? avanzarProximaFecha(fijo.proximaFecha, fijo.frecuencia as Frecuencia)
            : avanzarProximaFecha(new Date(), fijo.frecuencia as Frecuencia);
          nuevoTotalPagado = "0";
        }

        await db
          .update(egresosFijos)
          .set({
            totalPagadoCiclo: nuevoTotalPagado,
            proximaFecha: nuevaProximaFecha,
            updatedAt: new Date(),
          })
          .where(eq(egresosFijos.id, id));

        if (body.cuentaBancariaId) {
          const [cuenta] = await db
            .select()
            .from(bankAccountsTable)
            .where(
              and(
                eq(bankAccountsTable.id, body.cuentaBancariaId),
                eq(bankAccountsTable.tenantId, tenantId)
              )
            )
            .limit(1);

          if (cuenta) {
            await db.insert(bankTransactionsTable).values({
              tenantId,
              bankAccountId: body.cuentaBancariaId,
              type: "salida",
              amount: body.monto,
              description: `Pago${esParcial ? " parcial" : ""}: ${fijo.nombre}`,
              date: fechaPago,
              status: "processed",
              source: "egresos",
              createdBy: userId ?? null,
            });

            const nuevoSaldo =
              parseFloat(cuenta.balance ?? "0") - montoPago;
            await db
              .update(bankAccountsTable)
              .set({ balance: nuevoSaldo.toString(), updatedAt: new Date() })
              .where(eq(bankAccountsTable.id, body.cuentaBancariaId));
          }
        }

        res.json({ ok: true, esParcial, totalPagadoCiclo: nuevoTotalPagado });
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/egresos/fijos/:id/registrar-pago:", e);
        res.status(500).json({ error: "Error al registrar pago" });
      }
    }
  );

  app.get(
    "/api/egresos/fijos/:id/abonos",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const abonos = await db
          .select()
          .from(egresosRegistros)
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              eq(egresosRegistros.fijoId, id)
            )
          )
          .orderBy(desc(egresosRegistros.fecha))
          .limit(20);

        res.json(abonos);
      } catch (e) {
        console.error("GET /api/egresos/fijos/:id/abonos:", e);
        res.status(500).json({ error: "Error al obtener abonos" });
      }
    }
  );

  // ============================
  // ALERTAS DE VENCIMIENTO
  // ============================

  app.get(
    "/api/egresos/alertas-vencimiento",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const fijos = await db
          .select({
            fijo: egresosFijos,
            categoriaNombre: egresosCategorias.nombre,
            categoriaColor: egresosCategorias.color,
          })
          .from(egresosFijos)
          .leftJoin(egresosCategorias, eq(egresosFijos.categoriaId, egresosCategorias.id))
          .where(
            and(eq(egresosFijos.tenantId, tenantId), eq(egresosFijos.isActive, true))
          );

        const alertas = fijos
          .map(({ fijo, categoriaNombre, categoriaColor }) => ({
            ...fijo,
            estado: calcEstadoFijo(
              fijo.proximaFecha,
              fijo.alertDiasPrevios ?? 3,
              parseFloat(fijo.totalPagadoCiclo ?? "0"),
              parseFloat(fijo.monto),
              true
            ),
            categoriaNombre,
            categoriaColor,
          }))
          .filter((f) => f.estado === "vencido" || f.estado === "alerta")
          .sort((a, b) => {
            if (!a.proximaFecha) return 1;
            if (!b.proximaFecha) return -1;
            return new Date(a.proximaFecha).getTime() - new Date(b.proximaFecha).getTime();
          });

        res.json(alertas);
      } catch (e) {
        console.error("GET /api/egresos/alertas-vencimiento:", e);
        res.status(500).json({ error: "Error al obtener alertas" });
      }
    }
  );

  // ============================
  // REGISTROS (VARIABLES + HISTORIAL)
  // ============================

  app.get(
    "/api/egresos/registros",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const {
          desde,
          hasta,
          categoriaId,
          moneda,
          fijoId,
          search,
          page = "1",
          pageSize = "25",
        } = req.query as Record<string, string>;

        const pageNum = Math.max(1, parseInt(page));
        const size = Math.min(100, Math.max(1, parseInt(pageSize)));
        const offset = (pageNum - 1) * size;

        const conditions: any[] = [eq(egresosRegistros.tenantId, tenantId)];
        if (desde) conditions.push(gte(egresosRegistros.fecha, new Date(desde)));
        if (hasta) {
          const hastaFin = new Date(hasta);
          hastaFin.setHours(23, 59, 59, 999);
          conditions.push(lte(egresosRegistros.fecha, hastaFin));
        }
        if (categoriaId) conditions.push(eq(egresosRegistros.categoriaId, categoriaId));
        if (moneda) conditions.push(eq(egresosRegistros.moneda, moneda));
        if (fijoId) conditions.push(eq(egresosRegistros.fijoId, fijoId));
        if (search) conditions.push(ilike(egresosRegistros.descripcion, `%${search}%`));

        const [{ total }] = await db
          .select({ total: sql<number>`COUNT(*)::int` })
          .from(egresosRegistros)
          .where(and(...conditions));

        const rows = await db
          .select({
            registro: egresosRegistros,
            categoriaNombre: egresosCategorias.nombre,
            categoriaColor: egresosCategorias.color,
            fijoNombre: egresosFijos.nombre,
          })
          .from(egresosRegistros)
          .leftJoin(egresosCategorias, eq(egresosRegistros.categoriaId, egresosCategorias.id))
          .leftJoin(egresosFijos, eq(egresosRegistros.fijoId, egresosFijos.id))
          .where(and(...conditions))
          .orderBy(desc(egresosRegistros.fecha))
          .limit(size)
          .offset(offset);

        res.json({
          data: rows.map(({ registro, categoriaNombre, categoriaColor, fijoNombre }) => ({
            ...registro,
            categoriaNombre,
            categoriaColor,
            fijoNombre,
          })),
          total,
          page: pageNum,
          pageSize: size,
          totalPages: Math.ceil(total / size),
        });
      } catch (e) {
        console.error("GET /api/egresos/registros:", e);
        res.status(500).json({ error: "Error al obtener registros" });
      }
    }
  );

  app.post(
    "/api/egresos/registros",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const data = insertEgresoRegistroSchema.parse({
          ...req.body,
          tenantId,
          createdBy: userId,
          fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
        });

        const [created] = await db.insert(egresosRegistros).values(data).returning();

        if (data.cuentaBancariaId) {
          const [cuenta] = await db
            .select()
            .from(bankAccountsTable)
            .where(
              and(
                eq(bankAccountsTable.id, data.cuentaBancariaId),
                eq(bankAccountsTable.tenantId, tenantId)
              )
            )
            .limit(1);

          if (cuenta) {
            await db.insert(bankTransactionsTable).values({
              tenantId,
              bankAccountId: data.cuentaBancariaId,
              type: "salida",
              amount: data.monto,
              description: data.descripcion,
              date: data.fecha as Date,
              status: "processed",
              source: "egresos",
              createdBy: userId ?? null,
            });

            const nuevoSaldo =
              parseFloat(cuenta.balance ?? "0") - parseFloat(data.monto);
            await db
              .update(bankAccountsTable)
              .set({ balance: nuevoSaldo.toString(), updatedAt: new Date() })
              .where(eq(bankAccountsTable.id, data.cuentaBancariaId));
          }
        }

        res.status(201).json(created);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/egresos/registros:", e);
        res.status(500).json({ error: "Error al crear registro" });
      }
    }
  );

  app.put(
    "/api/egresos/registros/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const schema = z.object({
          categoriaId: z.string().nullable().optional(),
          monto: z.string().optional(),
          moneda: z.enum(["DOP", "USD"]).optional(),
          fecha: z.string().optional(),
          metodoPago: z.string().optional(),
          descripcion: z.string().optional(),
          notas: z.string().nullable().optional(),
        });
        const body = schema.parse(req.body);
        const updateData: any = { ...body };
        if (body.fecha) updateData.fecha = new Date(body.fecha);

        const [updated] = await db
          .update(egresosRegistros)
          .set(updateData)
          .where(
            and(eq(egresosRegistros.id, id), eq(egresosRegistros.tenantId, tenantId))
          )
          .returning();

        if (!updated) return res.status(404).json({ error: "Registro no encontrado" });
        res.json(updated);
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PUT /api/egresos/registros/:id:", e);
        res.status(500).json({ error: "Error al actualizar registro" });
      }
    }
  );

  app.delete(
    "/api/egresos/registros/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        await db
          .delete(egresosRegistros)
          .where(
            and(eq(egresosRegistros.id, id), eq(egresosRegistros.tenantId, tenantId))
          );
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/egresos/registros/:id:", e);
        res.status(500).json({ error: "Error al eliminar registro" });
      }
    }
  );

  // ============================
  // DASHBOARD
  // ============================

  app.get(
    "/api/egresos/dashboard",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        await seedCategoriasDefault(tenantId);

        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
        const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
        const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

        const toFloat = (v: string | null) => parseFloat(v ?? "0");

        const [totalMesRow] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CASE WHEN ${egresosRegistros.moneda}='USD' THEN ${egresosRegistros.monto}::numeric*60 ELSE ${egresosRegistros.monto}::numeric END),0)`,
          })
          .from(egresosRegistros)
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              gte(egresosRegistros.fecha, inicioMes),
              lte(egresosRegistros.fecha, finMes)
            )
          );

        const [totalAntRow] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CASE WHEN ${egresosRegistros.moneda}='USD' THEN ${egresosRegistros.monto}::numeric*60 ELSE ${egresosRegistros.monto}::numeric END),0)`,
          })
          .from(egresosRegistros)
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              gte(egresosRegistros.fecha, inicioMesAnt),
              lte(egresosRegistros.fecha, finMesAnt)
            )
          );

        const [totalAnioRow] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CASE WHEN ${egresosRegistros.moneda}='USD' THEN ${egresosRegistros.monto}::numeric*60 ELSE ${egresosRegistros.monto}::numeric END),0)`,
          })
          .from(egresosRegistros)
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              gte(egresosRegistros.fecha, inicioAnio)
            )
          );

        const fijosActivos = await db
          .select({ id: egresosFijos.id, monto: egresosFijos.monto, frecuencia: egresosFijos.frecuencia })
          .from(egresosFijos)
          .where(and(eq(egresosFijos.tenantId, tenantId), eq(egresosFijos.isActive, true)));

        const gastosActivosMensual = fijosActivos.reduce(
          (sum, f) => sum + calcMontoMensual(toFloat(f.monto), f.frecuencia as Frecuencia),
          0
        );

        const porCategoria = await db
          .select({
            categoriaId: egresosRegistros.categoriaId,
            nombre: egresosCategorias.nombre,
            color: egresosCategorias.color,
            total: sql<string>`COALESCE(SUM(CASE WHEN ${egresosRegistros.moneda}='USD' THEN ${egresosRegistros.monto}::numeric*60 ELSE ${egresosRegistros.monto}::numeric END),0)`,
          })
          .from(egresosRegistros)
          .leftJoin(egresosCategorias, eq(egresosRegistros.categoriaId, egresosCategorias.id))
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              gte(egresosRegistros.fecha, inicioMes),
              lte(egresosRegistros.fecha, finMes)
            )
          )
          .groupBy(egresosRegistros.categoriaId, egresosCategorias.nombre, egresosCategorias.color)
          .orderBy(sql`4 DESC`)
          .limit(10);

        const tendencia: { mes: string; total: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
          const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          const [row] = await db
            .select({
              total: sql<string>`COALESCE(SUM(CASE WHEN ${egresosRegistros.moneda}='USD' THEN ${egresosRegistros.monto}::numeric*60 ELSE ${egresosRegistros.monto}::numeric END),0)`,
            })
            .from(egresosRegistros)
            .where(
              and(
                eq(egresosRegistros.tenantId, tenantId),
                gte(egresosRegistros.fecha, d),
                lte(egresosRegistros.fecha, fin)
              )
            );
          const label = d.toLocaleDateString("es-DO", { month: "short", year: "2-digit" });
          tendencia.push({ mes: label, total: toFloat(row.total) });
        }

        const totalMes = toFloat(totalMesRow.total);
        const totalAnt = toFloat(totalAntRow.total);
        const variacion = totalAnt > 0 ? ((totalMes - totalAnt) / totalAnt) * 100 : 0;

        res.json({
          totalMes,
          totalMesAnterior: totalAnt,
          variacionPct: Math.round(variacion * 10) / 10,
          totalAnio: toFloat(totalAnioRow.total),
          tasaDiaria: calcTasaDiaria(totalMes),
          gastoFijosActivosMensual: Math.round(gastosActivosMensual * 100) / 100,
          gastoPorCategoria: porCategoria.map((c) => ({
            categoriaId: c.categoriaId,
            nombre: c.nombre ?? "Sin categoría",
            color: c.color ?? "#9ca3af",
            total: toFloat(c.total),
          })),
          tendencia,
        });
      } catch (e) {
        console.error("GET /api/egresos/dashboard:", e);
        res.status(500).json({ error: "Error al obtener dashboard" });
      }
    }
  );

  // ============================
  // POR MONEDA
  // ============================

  app.get(
    "/api/egresos/por-moneda",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

        const rows = await db
          .select({
            moneda: egresosRegistros.moneda,
            totalMes: sql<string>`COALESCE(SUM(${egresosRegistros.monto}::numeric), 0)`,
            cantidad: sql<number>`COUNT(*)::int`,
          })
          .from(egresosRegistros)
          .where(
            and(
              eq(egresosRegistros.tenantId, tenantId),
              gte(egresosRegistros.fecha, inicioMes),
              lte(egresosRegistros.fecha, finMes)
            )
          )
          .groupBy(egresosRegistros.moneda);

        res.json(
          rows.map((r) => ({
            moneda: r.moneda,
            totalMes: parseFloat(r.totalMes),
            cantidad: r.cantidad,
          }))
        );
      } catch (e) {
        console.error("GET /api/egresos/por-moneda:", e);
        res.status(500).json({ error: "Error al obtener totales por moneda" });
      }
    }
  );

  // ============================
  // CUENTAS BANCARIAS (para selects)
  // ============================

  app.get(
    "/api/egresos/cuentas-bancarias",
    authenticateJWT,
    authorizeRoles(...ROLES_EGRESOS),
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
          .where(
            and(
              eq(bankAccountsTable.tenantId, tenantId),
              eq(bankAccountsTable.isActive, true)
            )
          )
          .orderBy(bankAccountsTable.name);

        res.json(cuentas);
      } catch (e) {
        console.error("GET /api/egresos/cuentas-bancarias:", e);
        res.status(500).json({ error: "Error al obtener cuentas" });
      }
    }
  );
}
