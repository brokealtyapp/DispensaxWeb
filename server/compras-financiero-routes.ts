import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, ilike, or, inArray } from "drizzle-orm";
import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from "./auth";
import {
  supplierInvoices,
  supplierInvoiceItems,
  supplierPayments,
  supplierPaymentAllocations,
  recurringSupplierPayments,
  supplierDebitNotes,
  supplierDebitNoteItems,
  suppliers as suppliersTable,
  bankAccounts as bankAccountsTable,
  bankTransactions as bankTransactionsTable,
  users,
  purchaseOrders,
  purchaseOrderItems,
} from "@shared/schema";
import { z } from "zod";
import { avanzarProximaFecha, calcEstadoFijo, type Frecuencia } from "./egreso-helpers";

const ROLES_CF = ["admin", "contabilidad"];
const ROLES_ADMIN = ["admin"];
// Estados editables (contenido) y estado desde el que se puede eliminar
const MUTABLE_STATUSES = ["borrador", "recibida"];
const DELETABLE_STATUS = "borrador";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDecimal(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

async function recalcInvoiceStatus(
  tx: typeof db,
  invoiceId: string,
  tenantId: string
): Promise<void> {
  const [inv] = await tx
    .select({
      totalAmount: supplierInvoices.totalAmount,
      paidAmount: supplierInvoices.paidAmount,
      dueDate: supplierInvoices.dueDate,
      status: supplierInvoices.status,
    })
    .from(supplierInvoices)
    .where(and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.tenantId, tenantId)));
  if (!inv) return;
  if (inv.status === "anulada") return; // nunca recalcular factura anulada

  const total = parseDecimal(inv.totalAmount);
  const paid = parseDecimal(inv.paidAmount);
  let status: string;
  if (paid >= total) {
    status = "pagada";
  } else if (paid > 0) {
    status = "parcial";
  } else if (inv.dueDate && new Date() > new Date(inv.dueDate)) {
    status = "vencida";
  } else if (inv.status === "aprobada") {
    status = "aprobada";
  } else if (inv.status === "recibida") {
    status = "recibida";
  } else {
    status = "pendiente";
  }

  await tx
    .update(supplierInvoices)
    .set({ status, updatedAt: new Date() })
    .where(eq(supplierInvoices.id, invoiceId));
}

// ─── Invoice body schema ──────────────────────────────────────────────────────
const invoiceBodySchema = z.object({
  supplierId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  invoiceNumber: z.string().min(1, "Número de factura requerido"),
  description: z.string().min(1, "Descripción requerida"),
  subtotal: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  withholdingAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0.01, "Monto total requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  ncfType: z.string().optional().nullable(),
  ncfNumber: z.string().optional().nullable(),
  issueDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional().nullable(),
  status: z.enum(["borrador", "recibida", "aprobada", "pendiente", "parcial", "pagada", "vencida", "anulada"]).default("borrador"),
  attachmentUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().min(0.001),
    unitPrice: z.coerce.number().min(0),
    amount: z.coerce.number().min(0),
  })).optional().default([]),
});

// ─── Payment body schema ──────────────────────────────────────────────────────
// Un pago puede tener:
// 1. invoiceId directo + amount (pago simple a una sola factura)
// 2. allocations[] (pago distribuido entre múltiples facturas)
// Si se proveen allocations, no se requiere invoiceId
const paymentBodySchema = z.object({
  supplierId: z.string().optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  paymentDate: z.string().or(z.date()),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Modo 1: pago a una sola factura
  invoiceId: z.string().optional().nullable(),
  // Modo 2: distribución multi-factura
  allocations: z.array(z.object({
    invoiceId: z.string().min(1, "Factura requerida"),
    allocatedAmount: z.coerce.number().min(0.01, "Monto de asignación requerido"),
  })).optional().default([]),
});

// ─── Recurring payment body schema ───────────────────────────────────────────
const recurringBodySchema = z.object({
  supplierId: z.string().optional().nullable(),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  frecuencia: z.enum(["diario", "semanal", "quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual"]).default("mensual"),
  proximaFecha: z.string().or(z.date()).optional().nullable(),
  alertDiasPrevios: z.coerce.number().min(0).max(60).default(5),
  bankAccountId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

// ─── Debit note body schema ───────────────────────────────────────────────────
const debitNoteBodySchema = z.object({
  invoiceId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  noteNumber: z.string().min(1, "Número de nota requerido"),
  reason: z.enum(["devolucion", "descuento", "correccion_error", "ajuste_precio"], {
    errorMap: () => ({ message: "Seleccione un motivo válido" }),
  }),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  date: z.string().or(z.date()),
  status: z.enum(["pendiente", "aplicada", "anulada"]).default("pendiente"),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.coerce.number().min(0.01),
  })).optional().default([]),
});

export function registerComprasFinancieroRoutes(app: Express) {
  // ─── PROVEEDORES (helper para el módulo) ───────────────────────────────────

  // GET /api/purchases/fin/proveedores
  app.get(
    "/api/purchases/fin/proveedores",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const rows = await db
          .select({ id: suppliersTable.id, name: suppliersTable.name })
          .from(suppliersTable)
          .where(and(eq(suppliersTable.tenantId, tenantId), eq(suppliersTable.isActive, true)))
          .orderBy(suppliersTable.name);
        res.json(rows);
      } catch (e) {
        res.status(500).json({ error: "Error al obtener proveedores" });
      }
    }
  );

  // ─── FACTURAS ──────────────────────────────────────────────────────────────

  // GET /api/purchases/fin/facturas
  app.get(
    "/api/purchases/fin/facturas",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { status, supplierId, desde, hasta, search } = req.query as Record<string, string>;

        const conditions: any[] = [eq(supplierInvoices.tenantId, tenantId)];
        if (status && status !== "all") conditions.push(eq(supplierInvoices.status, status));
        if (supplierId) conditions.push(eq(supplierInvoices.supplierId, supplierId));
        if (desde) conditions.push(gte(supplierInvoices.issueDate, new Date(desde)));
        if (hasta) conditions.push(lte(supplierInvoices.issueDate, new Date(hasta)));
        if (search) {
          conditions.push(
            or(
              ilike(supplierInvoices.invoiceNumber, `%${search}%`),
              ilike(supplierInvoices.description, `%${search}%`)
            )
          );
        }

        const { limit: limitQ, offset: offsetQ } = req.query as Record<string, string>;
        const pageLimit = Math.min(parseInt(limitQ ?? "100", 10) || 100, 500);
        const pageOffset = parseInt(offsetQ ?? "0", 10) || 0;

        const rows = await db
          .select({
            id: supplierInvoices.id,
            tenantId: supplierInvoices.tenantId,
            supplierId: supplierInvoices.supplierId,
            orderId: supplierInvoices.orderId,
            invoiceNumber: supplierInvoices.invoiceNumber,
            description: supplierInvoices.description,
            subtotal: supplierInvoices.subtotal,
            discountAmount: supplierInvoices.discountAmount,
            taxAmount: supplierInvoices.taxAmount,
            withholdingAmount: supplierInvoices.withholdingAmount,
            totalAmount: supplierInvoices.totalAmount,
            paidAmount: supplierInvoices.paidAmount,
            currency: supplierInvoices.currency,
            ncfType: supplierInvoices.ncfType,
            ncfNumber: supplierInvoices.ncfNumber,
            issueDate: supplierInvoices.issueDate,
            dueDate: supplierInvoices.dueDate,
            status: supplierInvoices.status,
            attachmentUrl: supplierInvoices.attachmentUrl,
            notes: supplierInvoices.notes,
            createdAt: supplierInvoices.createdAt,
            supplierName: suppliersTable.name,
          })
          .from(supplierInvoices)
          .leftJoin(suppliersTable, eq(supplierInvoices.supplierId, suppliersTable.id))
          .where(and(...conditions))
          .orderBy(desc(supplierInvoices.createdAt))
          .limit(pageLimit)
          .offset(pageOffset);

        const withBalance = rows.map(r => ({
          ...r,
          balanceAmount: String(parseDecimal(r.totalAmount) - parseDecimal(r.paidAmount)),
        }));

        res.json(withBalance);
      } catch (e) {
        console.error("GET /api/purchases/fin/facturas:", e);
        res.status(500).json({ error: "Error al obtener facturas" });
      }
    }
  );

  // GET /api/purchases/fin/facturas/stats
  app.get(
    "/api/purchases/fin/facturas/stats",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const rows = await db
          .select({
            status: supplierInvoices.status,
            totalAmount: supplierInvoices.totalAmount,
            paidAmount: supplierInvoices.paidAmount,
          })
          .from(supplierInvoices)
          .where(and(
            eq(supplierInvoices.tenantId, tenantId),
            sql`${supplierInvoices.status} != 'anulada'`
          ));

        const stats = {
          totalFacturas: rows.length,
          totalMonto: rows.reduce((s, r) => s + parseDecimal(r.totalAmount), 0),
          totalPagado: rows.reduce((s, r) => s + parseDecimal(r.paidAmount), 0),
          totalPendiente: rows
            .filter(r => r.status !== "pagada")
            .reduce((s, r) => s + (parseDecimal(r.totalAmount) - parseDecimal(r.paidAmount)), 0),
          porStatus: {
            borrador: rows.filter(r => r.status === "borrador").length,
            recibida: rows.filter(r => r.status === "recibida").length,
            aprobada: rows.filter(r => r.status === "aprobada").length,
            pendiente: rows.filter(r => r.status === "pendiente").length,
            parcial: rows.filter(r => r.status === "parcial").length,
            pagada: rows.filter(r => r.status === "pagada").length,
            vencida: rows.filter(r => r.status === "vencida").length,
          },
        };
        res.json(stats);
      } catch (e) {
        console.error("GET /api/purchases/fin/facturas/stats:", e);
        res.status(500).json({ error: "Error al obtener estadísticas" });
      }
    }
  );

  // GET /api/purchases/fin/facturas/:id
  app.get(
    "/api/purchases/fin/facturas/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { id } = req.params;
        const [inv] = await db
          .select({
            id: supplierInvoices.id,
            tenantId: supplierInvoices.tenantId,
            supplierId: supplierInvoices.supplierId,
            orderId: supplierInvoices.orderId,
            invoiceNumber: supplierInvoices.invoiceNumber,
            description: supplierInvoices.description,
            subtotal: supplierInvoices.subtotal,
            discountAmount: supplierInvoices.discountAmount,
            taxAmount: supplierInvoices.taxAmount,
            withholdingAmount: supplierInvoices.withholdingAmount,
            totalAmount: supplierInvoices.totalAmount,
            paidAmount: supplierInvoices.paidAmount,
            currency: supplierInvoices.currency,
            ncfType: supplierInvoices.ncfType,
            ncfNumber: supplierInvoices.ncfNumber,
            issueDate: supplierInvoices.issueDate,
            dueDate: supplierInvoices.dueDate,
            status: supplierInvoices.status,
            attachmentUrl: supplierInvoices.attachmentUrl,
            notes: supplierInvoices.notes,
            createdAt: supplierInvoices.createdAt,
            supplierName: suppliersTable.name,
          })
          .from(supplierInvoices)
          .leftJoin(suppliersTable, eq(supplierInvoices.supplierId, suppliersTable.id))
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));

        if (!inv) return res.status(404).json({ error: "Factura no encontrada" });

        const items = await db
          .select()
          .from(supplierInvoiceItems)
          .where(and(eq(supplierInvoiceItems.invoiceId, id), eq(supplierInvoiceItems.tenantId, tenantId)));

        // Pagos directos a esta factura
        const directPayments = await db
          .select({
            id: supplierPayments.id,
            amount: supplierPayments.amount,
            currency: supplierPayments.currency,
            paymentDate: supplierPayments.paymentDate,
            reference: supplierPayments.reference,
            notes: supplierPayments.notes,
            bankAccountName: bankAccountsTable.name,
          })
          .from(supplierPayments)
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(eq(supplierPayments.invoiceId, id), eq(supplierPayments.tenantId, tenantId)))
          .orderBy(desc(supplierPayments.paymentDate));

        // Pagos multi-factura asignados a esta factura vía allocations
        const allocatedPayments = await db
          .select({
            id: supplierPaymentAllocations.id,
            paymentId: supplierPaymentAllocations.paymentId,
            allocatedAmount: supplierPaymentAllocations.allocatedAmount,
            paymentDate: supplierPayments.paymentDate,
            reference: supplierPayments.reference,
            bankAccountName: bankAccountsTable.name,
          })
          .from(supplierPaymentAllocations)
          .leftJoin(supplierPayments, eq(supplierPaymentAllocations.paymentId, supplierPayments.id))
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(
            eq(supplierPaymentAllocations.invoiceId, id),
            eq(supplierPaymentAllocations.tenantId, tenantId)
          ))
          .orderBy(desc(supplierPayments.paymentDate));

        res.json({ ...inv, items, payments: directPayments, allocatedPayments });
      } catch (e) {
        console.error("GET /api/purchases/fin/facturas/:id:", e);
        res.status(500).json({ error: "Error al obtener factura" });
      }
    }
  );

  // GET /api/purchases/fin/facturas/:id/pagos
  app.get(
    "/api/purchases/fin/facturas/:id/pagos",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        // Verify invoice belongs to tenant
        const [inv] = await db.select({ id: supplierInvoices.id })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!inv) return res.status(404).json({ error: "Factura no encontrada" });

        // Pagos directos (invoiceId = id)
        const directPayments = await db
          .select({
            id: supplierPayments.id,
            invoiceId: supplierPayments.invoiceId,
            amount: supplierPayments.amount,
            currency: supplierPayments.currency,
            paymentDate: supplierPayments.paymentDate,
            reference: supplierPayments.reference,
            bankAccountName: bankAccountsTable.name,
          })
          .from(supplierPayments)
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(
            eq(supplierPayments.invoiceId, id),
            eq(supplierPayments.tenantId, tenantId)
          ))
          .orderBy(desc(supplierPayments.paymentDate));

        // Pagos por allocation
        const allocatedPayments = await db
          .select({
            id: supplierPayments.id,
            allocatedAmount: supplierPaymentAllocations.allocatedAmount,
            currency: supplierPayments.currency,
            paymentDate: supplierPayments.paymentDate,
            reference: supplierPayments.reference,
            bankAccountName: bankAccountsTable.name,
          })
          .from(supplierPaymentAllocations)
          .innerJoin(supplierPayments, eq(supplierPaymentAllocations.paymentId, supplierPayments.id))
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(
            eq(supplierPaymentAllocations.invoiceId, id),
            eq(supplierPaymentAllocations.tenantId, tenantId)
          ))
          .orderBy(desc(supplierPayments.paymentDate));

        res.json({ directPayments, allocatedPayments });
      } catch (e) {
        console.error("GET /api/purchases/fin/facturas/:id/pagos:", e);
        res.status(500).json({ error: "Error al obtener pagos de la factura" });
      }
    }
  );

  // POST /api/purchases/fin/facturas
  app.post(
    "/api/purchases/fin/facturas",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;

        const userId = (req as AuthenticatedRequest).user?.userId;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = invoiceBodySchema.parse(req.body);

        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }

        // Computar subtotal y total desde los ítems cuando se provean
        let computedSubtotal = data.subtotal;
        let computedTotal = data.totalAmount;
        if (data.items && data.items.length > 0) {
          computedSubtotal = data.items.reduce((s, i) => s + i.amount, 0);
          computedTotal = computedSubtotal
            - (data.discountAmount ?? 0)
            + (data.taxAmount ?? 0)
            - (data.withholdingAmount ?? 0);
          if (computedTotal <= 0) computedTotal = computedSubtotal;
        }

        const invoice = await db.transaction(async (tx) => {
          const [inv] = await tx
            .insert(supplierInvoices)
            .values({
              tenantId,
              supplierId: data.supplierId ?? null,
              orderId: data.orderId ?? null,
              invoiceNumber: data.invoiceNumber,
              description: data.description,
              subtotal: String(computedSubtotal),
              discountAmount: String(data.discountAmount),
              taxAmount: String(data.taxAmount),
              withholdingAmount: String(data.withholdingAmount),
              totalAmount: String(computedTotal),
              paidAmount: "0",
              currency: data.currency,
              ncfType: data.ncfType ?? null,
              ncfNumber: data.ncfNumber ?? null,
              issueDate: new Date(data.issueDate as string),
              dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
              status: data.status ?? "borrador",
              attachmentUrl: data.attachmentUrl ?? null,
              notes: data.notes ?? null,
              createdBy: userId ?? null,
            })
            .returning();

          if (data.items && data.items.length > 0) {
            await tx.insert(supplierInvoiceItems).values(
              data.items.map(item => ({
                invoiceId: inv.id,
                tenantId,
                description: item.description,
                quantity: String(item.quantity),
                unitPrice: String(item.unitPrice),
                amount: String(item.amount),
              }))
            );
          }

          return inv;
        });

        res.status(201).json(invoice);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/purchases/fin/facturas:", e);
        res.status(500).json({ error: "Error al crear factura" });
      }
    }
  );

  // PATCH /api/purchases/fin/facturas/:id
  app.patch(
    "/api/purchases/fin/facturas/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db
          .select({ id: supplierInvoices.id, status: supplierInvoices.status, paidAmount: supplierInvoices.paidAmount })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Factura no encontrada" });
        if (!MUTABLE_STATUSES.includes(existing.status)) {
          return res.status(400).json({ error: `Solo se pueden editar facturas en estado borrador o recibida. Estado actual: ${existing.status}` });
        }

        const data = invoiceBodySchema.omit({ status: true }).partial().parse(req.body);
        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }

        const updateValues: Record<string, any> = { updatedAt: new Date() };
        if (data.supplierId !== undefined) updateValues.supplierId = data.supplierId ?? null;
        if (data.orderId !== undefined) updateValues.orderId = data.orderId ?? null;
        if (data.invoiceNumber !== undefined) updateValues.invoiceNumber = data.invoiceNumber;
        if (data.description !== undefined) updateValues.description = data.description;
        if (data.subtotal !== undefined) updateValues.subtotal = String(data.subtotal);
        if (data.discountAmount !== undefined) updateValues.discountAmount = String(data.discountAmount);
        if (data.taxAmount !== undefined) updateValues.taxAmount = String(data.taxAmount);
        if (data.withholdingAmount !== undefined) updateValues.withholdingAmount = String(data.withholdingAmount);
        if (data.totalAmount !== undefined) updateValues.totalAmount = String(data.totalAmount);
        if (data.currency !== undefined) updateValues.currency = data.currency;
        if (data.ncfType !== undefined) updateValues.ncfType = data.ncfType ?? null;
        if (data.ncfNumber !== undefined) updateValues.ncfNumber = data.ncfNumber ?? null;
        if (data.issueDate !== undefined) updateValues.issueDate = new Date(data.issueDate as string);
        if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate ? new Date(data.dueDate as string) : null;
        if (data.status !== undefined) updateValues.status = data.status;
        if (data.attachmentUrl !== undefined) updateValues.attachmentUrl = data.attachmentUrl ?? null;
        if (data.notes !== undefined) updateValues.notes = data.notes ?? null;

        const [updated] = await db
          .update(supplierInvoices)
          .set(updateValues)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PATCH /api/purchases/fin/facturas/:id:", e);
        res.status(500).json({ error: "Error al actualizar factura" });
      }
    }
  );

  // PATCH /api/purchases/fin/facturas/:id/anular
  app.patch(
    "/api/purchases/fin/facturas/:id/anular",
    authenticateJWT,
    authorizeRoles(...ROLES_ADMIN),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db
          .select({ id: supplierInvoices.id, paidAmount: supplierInvoices.paidAmount })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Factura no encontrada" });
        if (parseDecimal(existing.paidAmount) > 0) {
          return res.status(400).json({ error: "No se puede anular una factura con pagos registrados" });
        }

        const [updated] = await db
          .update(supplierInvoices)
          .set({ status: "anulada", updatedAt: new Date() })
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        console.error("PATCH /api/purchases/fin/facturas/:id/anular:", e);
        res.status(500).json({ error: "Error al anular factura" });
      }
    }
  );

  // PATCH /api/purchases/fin/facturas/:id/status — solo admin puede cambiar estado
  app.patch(
    "/api/purchases/fin/facturas/:id/status",
    authenticateJWT,
    authorizeRoles(...ROLES_ADMIN),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;
        const { status } = z.object({
          status: z.enum(["borrador", "recibida", "aprobada", "pendiente", "parcial", "pagada", "vencida", "anulada"]),
        }).parse(req.body);

        const [existing] = await db
          .select({ id: supplierInvoices.id, paidAmount: supplierInvoices.paidAmount })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Factura no encontrada" });

        if (status === "anulada" && parseDecimal(existing.paidAmount) > 0) {
          return res.status(400).json({ error: "No se puede anular una factura con pagos" });
        }

        const [updated] = await db
          .update(supplierInvoices)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PATCH /api/purchases/fin/facturas/:id/status:", e);
        res.status(500).json({ error: "Error al cambiar estado" });
      }
    }
  );

  // DELETE /api/purchases/fin/facturas/:id
  app.delete(
    "/api/purchases/fin/facturas/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db
          .select({ id: supplierInvoices.id, status: supplierInvoices.status, paidAmount: supplierInvoices.paidAmount })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Factura no encontrada" });
        if (existing.status !== DELETABLE_STATUS) {
          return res.status(400).json({ error: `Solo se pueden eliminar facturas en estado borrador. Estado actual: ${existing.status}` });
        }

        // Verificar que no tenga allocations
        const allocs = await db.select({ id: supplierPaymentAllocations.id })
          .from(supplierPaymentAllocations)
          .where(and(eq(supplierPaymentAllocations.invoiceId, id), eq(supplierPaymentAllocations.tenantId, tenantId)));
        if (allocs.length > 0) {
          return res.status(400).json({ error: "No se puede eliminar una factura con pagos asignados" });
        }

        await db.transaction(async (tx) => {
          await tx.delete(supplierInvoiceItems).where(eq(supplierInvoiceItems.invoiceId, id));
          await tx.delete(supplierDebitNotes).where(eq(supplierDebitNotes.invoiceId, id));
          await tx.delete(supplierInvoices).where(eq(supplierInvoices.id, id));
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/purchases/fin/facturas/:id:", e);
        res.status(500).json({ error: "Error al eliminar factura" });
      }
    }
  );

  // ─── PAGOS ─────────────────────────────────────────────────────────────────

  // GET /api/purchases/fin/pagos
  app.get(
    "/api/purchases/fin/pagos",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { invoiceId, supplierId, desde, hasta, bankAccountId: bankFilter, limit: limitQ, offset: offsetQ } = req.query as Record<string, string>;
        const pageLimit = Math.min(parseInt(limitQ ?? "100", 10) || 100, 500);
        const pageOffset = parseInt(offsetQ ?? "0", 10) || 0;

        const conditions: any[] = [eq(supplierPayments.tenantId, tenantId)];
        if (invoiceId) conditions.push(eq(supplierPayments.invoiceId, invoiceId));
        if (supplierId) conditions.push(eq(supplierPayments.supplierId, supplierId));
        if (bankFilter) conditions.push(eq(supplierPayments.bankAccountId, bankFilter));
        if (desde) conditions.push(gte(supplierPayments.paymentDate, new Date(desde)));
        if (hasta) conditions.push(lte(supplierPayments.paymentDate, new Date(hasta)));

        const rows = await db
          .select({
            id: supplierPayments.id,
            tenantId: supplierPayments.tenantId,
            supplierId: supplierPayments.supplierId,
            invoiceId: supplierPayments.invoiceId,
            recurringId: supplierPayments.recurringId,
            bankAccountId: supplierPayments.bankAccountId,
            amount: supplierPayments.amount,
            currency: supplierPayments.currency,
            paymentDate: supplierPayments.paymentDate,
            reference: supplierPayments.reference,
            notes: supplierPayments.notes,
            createdAt: supplierPayments.createdAt,
            invoiceNumber: supplierInvoices.invoiceNumber,
            supplierName: suppliersTable.name,
            bankAccountName: bankAccountsTable.name,
          })
          .from(supplierPayments)
          .leftJoin(supplierInvoices, eq(supplierPayments.invoiceId, supplierInvoices.id))
          .leftJoin(suppliersTable, eq(supplierPayments.supplierId, suppliersTable.id))
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(...conditions))
          .orderBy(desc(supplierPayments.paymentDate))
          .limit(pageLimit)
          .offset(pageOffset);

        // Enriquecer con allocations para pagos multi-factura
        const paymentIds = rows.filter(r => !r.invoiceId).map(r => r.id);
        let allAllocations: any[] = [];
        if (paymentIds.length > 0) {
          allAllocations = await db
            .select({
              paymentId: supplierPaymentAllocations.paymentId,
              invoiceId: supplierPaymentAllocations.invoiceId,
              allocatedAmount: supplierPaymentAllocations.allocatedAmount,
              invoiceNumber: supplierInvoices.invoiceNumber,
            })
            .from(supplierPaymentAllocations)
            .leftJoin(supplierInvoices, eq(supplierPaymentAllocations.invoiceId, supplierInvoices.id))
            .where(inArray(supplierPaymentAllocations.paymentId, paymentIds));
        }

        const rowsWithAllocations = rows.map(r => ({
          ...r,
          allocations: allAllocations.filter(a => a.paymentId === r.id),
        }));

        res.json(rowsWithAllocations);
      } catch (e) {
        console.error("GET /api/purchases/fin/pagos:", e);
        res.status(500).json({ error: "Error al obtener pagos" });
      }
    }
  );

  // POST /api/purchases/fin/pagos
  app.post(
    "/api/purchases/fin/pagos",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;

        const userId = (req as AuthenticatedRequest).user?.userId;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = paymentBodySchema.parse(req.body);

        // Determinar si es pago simple o multi-factura
        let isMulti = data.allocations && data.allocations.length > 0;
        const isSingle = !isMulti && !!data.invoiceId;

        // ── Auto-distribución: sin allocations ni invoiceId pero con supplierId ──
        // Distribuye automáticamente entre facturas pendientes del proveedor,
        // ordenadas por dueDate ASC (oldest-due-first), hasta agotar el monto.
        if (!isMulti && !isSingle) {
          if (!data.supplierId) {
            return res.status(400).json({ error: "Se requiere invoiceId, allocations, o supplierId para distribución automática" });
          }
          const pendingInvoices = await db
            .select({
              id: supplierInvoices.id,
              totalAmount: supplierInvoices.totalAmount,
              paidAmount: supplierInvoices.paidAmount,
              dueDate: supplierInvoices.dueDate,
            })
            .from(supplierInvoices)
            .where(and(
              eq(supplierInvoices.tenantId, tenantId),
              eq(supplierInvoices.supplierId, data.supplierId),
              inArray(supplierInvoices.status, ["recibida", "aprobada", "pendiente", "parcial", "vencida"])
            ))
            .orderBy(supplierInvoices.dueDate, supplierInvoices.issueDate);

          if (pendingInvoices.length === 0) {
            return res.status(400).json({ error: "No hay facturas pendientes para este proveedor" });
          }

          let remaining = data.amount;
          const autoAllocs: { invoiceId: string; allocatedAmount: number }[] = [];
          for (const inv of pendingInvoices) {
            if (remaining <= 0.001) break;
            const balance = parseDecimal(inv.totalAmount) - parseDecimal(inv.paidAmount);
            if (balance <= 0.001) continue;
            const apply = Math.min(remaining, balance);
            autoAllocs.push({ invoiceId: inv.id, allocatedAmount: apply });
            remaining -= apply;
          }

          if (autoAllocs.length === 0) {
            return res.status(400).json({ error: "No hay saldo pendiente en facturas del proveedor" });
          }

          data.allocations = autoAllocs;
          isMulti = true;
        }

        // Validar supplier si se especifica
        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }

        // Validar cuenta bancaria
        if (data.bankAccountId) {
          const [acct] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, data.bankAccountId), eq(bankAccountsTable.tenantId, tenantId)));
          if (!acct) return res.status(400).json({ error: "Cuenta bancaria no válida para este tenant" });
        }

        if (isSingle) {
          // ── Pago simple: a una sola factura ───────────────────────────────
          const [inv] = await db
            .select({
              id: supplierInvoices.id,
              totalAmount: supplierInvoices.totalAmount,
              paidAmount: supplierInvoices.paidAmount,
              status: supplierInvoices.status,
              supplierId: supplierInvoices.supplierId,
            })
            .from(supplierInvoices)
            .where(and(eq(supplierInvoices.id, data.invoiceId!), eq(supplierInvoices.tenantId, tenantId)));

          if (!inv) return res.status(400).json({ error: "Factura no válida para este tenant" });
          if (inv.status === "anulada") return res.status(400).json({ error: "No se puede pagar una factura anulada" });

          // ✅ Validar sobrepago
          const balanceRestante = parseDecimal(inv.totalAmount) - parseDecimal(inv.paidAmount);
          if (data.amount > balanceRestante + 0.001) {
            return res.status(400).json({
              error: `El monto pagado (${data.amount}) excede el saldo pendiente de la factura (${balanceRestante.toFixed(2)})`
            });
          }

          const paymentDate = new Date(data.paymentDate as string);

          const payment = await db.transaction(async (tx) => {
            const [pago] = await tx
              .insert(supplierPayments)
              .values({
                tenantId,
                supplierId: data.supplierId ?? inv.supplierId ?? null,
                invoiceId: data.invoiceId!,
                bankAccountId: data.bankAccountId ?? null,
                amount: String(data.amount),
                currency: data.currency,
                paymentDate,
                reference: data.reference ?? null,
                notes: data.notes ?? null,
                createdBy: userId ?? null,
              })
              .returning();

            // Actualizar monto pagado en factura
            const newPaidAmount = parseDecimal(inv.paidAmount) + data.amount;
            await tx
              .update(supplierInvoices)
              .set({ paidAmount: String(newPaidAmount), updatedAt: new Date() })
              .where(eq(supplierInvoices.id, data.invoiceId!));

            // Recalcular status
            await recalcInvoiceStatus(tx, data.invoiceId!, tenantId);

            // Integración bancaria
            if (data.bankAccountId) {
              const [cuenta] = await tx
                .select({ balance: bankAccountsTable.balance })
                .from(bankAccountsTable)
                .where(eq(bankAccountsTable.id, data.bankAccountId));
              if (cuenta) {
                const nuevoSaldo = parseDecimal(cuenta.balance) - data.amount;
                await tx
                  .update(bankAccountsTable)
                  .set({ balance: String(nuevoSaldo), updatedAt: new Date() })
                  .where(eq(bankAccountsTable.id, data.bankAccountId));
                await tx.insert(bankTransactionsTable).values({
                  tenantId,
                  bankAccountId: data.bankAccountId,
                  type: "salida",
                  amount: String(data.amount),
                  description: `Pago factura proveedor: ${data.reference ?? pago.id}`,
                  date: paymentDate,
                  createdBy: userId ?? null,
                });
              }
            }

            return pago;
          });

          res.status(201).json(payment);

        } else {
          // ── Pago multi-factura con allocations ────────────────────────────
          const allocations = data.allocations!;

          // Validar suma de allocations = monto total del pago
          const totalAllocated = allocations.reduce((s, a) => s + a.allocatedAmount, 0);
          if (Math.abs(totalAllocated - data.amount) > 0.01) {
            return res.status(400).json({
              error: `La suma de asignaciones (${totalAllocated.toFixed(2)}) no coincide con el monto total del pago (${data.amount})`
            });
          }

          // Validar cada factura y que no haya sobrepago
          const invoiceIds = allocations.map(a => a.invoiceId);
          const facturas = await db
            .select({
              id: supplierInvoices.id,
              totalAmount: supplierInvoices.totalAmount,
              paidAmount: supplierInvoices.paidAmount,
              status: supplierInvoices.status,
              supplierId: supplierInvoices.supplierId,
            })
            .from(supplierInvoices)
            .where(and(
              inArray(supplierInvoices.id, invoiceIds),
              eq(supplierInvoices.tenantId, tenantId)
            ));

          if (facturas.length !== invoiceIds.length) {
            return res.status(400).json({ error: "Una o más facturas no son válidas para este tenant" });
          }

          // ✅ Validar que todas las facturas pertenezcan al mismo proveedor
          const supplierIdsInFacturas = [...new Set(facturas.map(f => f.supplierId).filter(Boolean))];
          if (supplierIdsInFacturas.length > 1) {
            return res.status(400).json({ error: "Las facturas de un pago multi-factura deben pertenecer al mismo proveedor" });
          }
          if (data.supplierId && supplierIdsInFacturas.length > 0 && supplierIdsInFacturas[0] !== data.supplierId) {
            return res.status(400).json({ error: "El proveedor del pago no coincide con el proveedor de las facturas seleccionadas" });
          }

          for (const alloc of allocations) {
            const factura = facturas.find(f => f.id === alloc.invoiceId);
            if (!factura) continue;
            if (factura.status === "anulada") {
              return res.status(400).json({ error: `La factura no puede estar anulada` });
            }
            const balance = parseDecimal(factura.totalAmount) - parseDecimal(factura.paidAmount);
            if (alloc.allocatedAmount > balance + 0.001) {
              return res.status(400).json({
                error: `El monto asignado (${alloc.allocatedAmount}) excede el saldo pendiente de una factura (${balance.toFixed(2)})`
              });
            }
          }

          const paymentDate = new Date(data.paymentDate as string);

          const payment = await db.transaction(async (tx) => {
            const [pago] = await tx
              .insert(supplierPayments)
              .values({
                tenantId,
                supplierId: data.supplierId ?? null,
                invoiceId: null,
                bankAccountId: data.bankAccountId ?? null,
                amount: String(data.amount),
                currency: data.currency,
                paymentDate,
                reference: data.reference ?? null,
                notes: data.notes ?? null,
                createdBy: userId ?? null,
              })
              .returning();

            // Crear allocations y actualizar cada factura
            for (const alloc of allocations) {
              await tx.insert(supplierPaymentAllocations).values({
                tenantId,
                paymentId: pago.id,
                invoiceId: alloc.invoiceId,
                allocatedAmount: String(alloc.allocatedAmount),
              });

              const factura = facturas.find(f => f.id === alloc.invoiceId)!;
              const newPaid = parseDecimal(factura.paidAmount) + alloc.allocatedAmount;
              await tx
                .update(supplierInvoices)
                .set({ paidAmount: String(newPaid), updatedAt: new Date() })
                .where(eq(supplierInvoices.id, alloc.invoiceId));

              await recalcInvoiceStatus(tx, alloc.invoiceId, tenantId);
            }

            // Integración bancaria
            if (data.bankAccountId) {
              const [cuenta] = await tx
                .select({ balance: bankAccountsTable.balance })
                .from(bankAccountsTable)
                .where(eq(bankAccountsTable.id, data.bankAccountId));
              if (cuenta) {
                const nuevoSaldo = parseDecimal(cuenta.balance) - data.amount;
                await tx
                  .update(bankAccountsTable)
                  .set({ balance: String(nuevoSaldo), updatedAt: new Date() })
                  .where(eq(bankAccountsTable.id, data.bankAccountId));
                await tx.insert(bankTransactionsTable).values({
                  tenantId,
                  bankAccountId: data.bankAccountId,
                  type: "salida",
                  amount: String(data.amount),
                  description: `Pago multi-factura proveedor: ${data.reference ?? pago.id}`,
                  date: paymentDate,
                  createdBy: userId ?? null,
                });
              }
            }

            return pago;
          });

          res.status(201).json(payment);
        }
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/purchases/fin/pagos:", e);
        res.status(500).json({ error: "Error al registrar pago" });
      }
    }
  );

  // DELETE /api/purchases/fin/pagos/:id
  app.delete(
    "/api/purchases/fin/pagos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [pago] = await db.select().from(supplierPayments)
          .where(and(eq(supplierPayments.id, id), eq(supplierPayments.tenantId, tenantId)));
        if (!pago) return res.status(404).json({ error: "Pago no encontrado" });

        await db.transaction(async (tx) => {
          // Solo revertir balances si el pago NO fue ya anulado por PATCH /cancel.
          // Si cancelledAt != null, los balances ya fueron revertidos; solo borramos el registro.
          if (pago.cancelledAt === null) {
            if (pago.invoiceId) {
              const [inv] = await tx
                .select({ paidAmount: supplierInvoices.paidAmount, totalAmount: supplierInvoices.totalAmount })
                .from(supplierInvoices)
                .where(eq(supplierInvoices.id, pago.invoiceId));
              if (inv) {
                const newPaid = Math.max(0, parseDecimal(inv.paidAmount) - parseDecimal(pago.amount));
                await tx.update(supplierInvoices)
                  .set({ paidAmount: String(newPaid), updatedAt: new Date() })
                  .where(eq(supplierInvoices.id, pago.invoiceId));
                await recalcInvoiceStatus(tx, pago.invoiceId, tenantId);
              }
            } else {
              const allocs = await tx
                .select()
                .from(supplierPaymentAllocations)
                .where(eq(supplierPaymentAllocations.paymentId, id));
              for (const alloc of allocs) {
                const [inv] = await tx
                  .select({ paidAmount: supplierInvoices.paidAmount })
                  .from(supplierInvoices)
                  .where(eq(supplierInvoices.id, alloc.invoiceId));
                if (inv) {
                  const newPaid = Math.max(0, parseDecimal(inv.paidAmount) - parseDecimal(alloc.allocatedAmount));
                  await tx.update(supplierInvoices)
                    .set({ paidAmount: String(newPaid), updatedAt: new Date() })
                    .where(eq(supplierInvoices.id, alloc.invoiceId));
                  await recalcInvoiceStatus(tx, alloc.invoiceId, tenantId);
                }
              }
            }
            if (pago.bankAccountId) {
              const [cuenta] = await tx
                .select({ balance: bankAccountsTable.balance })
                .from(bankAccountsTable)
                .where(eq(bankAccountsTable.id, pago.bankAccountId));
              if (cuenta) {
                const saldoRevertido = parseDecimal(cuenta.balance) + parseDecimal(pago.amount);
                await tx.update(bankAccountsTable)
                  .set({ balance: String(saldoRevertido), updatedAt: new Date() })
                  .where(eq(bankAccountsTable.id, pago.bankAccountId));
              }
            }
          }
          // Eliminar allocations (si existen) y el pago
          await tx.delete(supplierPaymentAllocations)
            .where(eq(supplierPaymentAllocations.paymentId, id));
          await tx.delete(supplierPayments).where(eq(supplierPayments.id, id));
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/purchases/fin/pagos/:id:", e);
        res.status(500).json({ error: "Error al eliminar pago" });
      }
    }
  );

  // PATCH /api/purchases/fin/pagos/:id/cancel — anula el pago sin borrarlo
  app.patch(
    "/api/purchases/fin/pagos/:id/cancel",
    authenticateJWT,
    authorizeRoles(...ROLES_ADMIN),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [pago] = await db.select().from(supplierPayments)
          .where(and(eq(supplierPayments.id, id), eq(supplierPayments.tenantId, tenantId)));
        if (!pago) return res.status(404).json({ error: "Pago no encontrado" });
        if (pago.cancelledAt !== null) {
          return res.status(409).json({ error: "El pago ya está anulado" });
        }

        const { userId } = req as AuthenticatedRequest;
        const now = new Date();

        await db.transaction(async (tx) => {
          // Marcar el pago como anulado dentro de la misma transacción (idempotencia)
          await tx.update(supplierPayments)
            .set({ cancelledAt: now, cancelledBy: userId ?? null })
            .where(eq(supplierPayments.id, id));

          if (pago.invoiceId) {
            const [inv] = await tx
              .select({ paidAmount: supplierInvoices.paidAmount })
              .from(supplierInvoices)
              .where(eq(supplierInvoices.id, pago.invoiceId));
            if (inv) {
              const newPaid = Math.max(0, parseDecimal(inv.paidAmount) - parseDecimal(pago.amount));
              await tx.update(supplierInvoices)
                .set({ paidAmount: String(newPaid), updatedAt: now })
                .where(eq(supplierInvoices.id, pago.invoiceId));
              await recalcInvoiceStatus(tx, pago.invoiceId, tenantId);
            }
          } else {
            const allocs = await tx.select().from(supplierPaymentAllocations)
              .where(eq(supplierPaymentAllocations.paymentId, id));
            for (const alloc of allocs) {
              const [inv] = await tx
                .select({ paidAmount: supplierInvoices.paidAmount })
                .from(supplierInvoices)
                .where(eq(supplierInvoices.id, alloc.invoiceId));
              if (inv) {
                const newPaid = Math.max(0, parseDecimal(inv.paidAmount) - parseDecimal(alloc.allocatedAmount));
                await tx.update(supplierInvoices)
                  .set({ paidAmount: String(newPaid), updatedAt: now })
                  .where(eq(supplierInvoices.id, alloc.invoiceId));
                await recalcInvoiceStatus(tx, alloc.invoiceId, tenantId);
              }
            }
          }
          if (pago.bankAccountId) {
            const [cuenta] = await tx
              .select({ balance: bankAccountsTable.balance })
              .from(bankAccountsTable)
              .where(eq(bankAccountsTable.id, pago.bankAccountId));
            if (cuenta) {
              const saldoRevertido = parseDecimal(cuenta.balance) + parseDecimal(pago.amount);
              await tx.update(bankAccountsTable)
                .set({ balance: String(saldoRevertido), updatedAt: now })
                .where(eq(bankAccountsTable.id, pago.bankAccountId));
            }
          }
        });

        res.json({ ok: true, message: "Pago anulado exitosamente" });
      } catch (e) {
        console.error("PATCH /api/purchases/fin/pagos/:id/cancel:", e);
        res.status(500).json({ error: "Error al anular pago" });
      }
    }
  );

  // GET /api/purchases/fin/pagos/:id
  app.get(
    "/api/purchases/fin/pagos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [pago] = await db
          .select({
            id: supplierPayments.id,
            tenantId: supplierPayments.tenantId,
            supplierId: supplierPayments.supplierId,
            invoiceId: supplierPayments.invoiceId,
            recurringId: supplierPayments.recurringId,
            bankAccountId: supplierPayments.bankAccountId,
            amount: supplierPayments.amount,
            currency: supplierPayments.currency,
            paymentDate: supplierPayments.paymentDate,
            reference: supplierPayments.reference,
            notes: supplierPayments.notes,
            createdAt: supplierPayments.createdAt,
            invoiceNumber: supplierInvoices.invoiceNumber,
            supplierName: suppliersTable.name,
            bankAccountName: bankAccountsTable.name,
          })
          .from(supplierPayments)
          .leftJoin(supplierInvoices, eq(supplierPayments.invoiceId, supplierInvoices.id))
          .leftJoin(suppliersTable, eq(supplierPayments.supplierId, suppliersTable.id))
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(eq(supplierPayments.id, id), eq(supplierPayments.tenantId, tenantId)));

        if (!pago) return res.status(404).json({ error: "Pago no encontrado" });

        // Enriquecer con allocations si es pago multi-factura
        let allocations: any[] = [];
        if (!pago.invoiceId) {
          allocations = await db
            .select({
              invoiceId: supplierPaymentAllocations.invoiceId,
              allocatedAmount: supplierPaymentAllocations.allocatedAmount,
              invoiceNumber: supplierInvoices.invoiceNumber,
            })
            .from(supplierPaymentAllocations)
            .leftJoin(supplierInvoices, eq(supplierPaymentAllocations.invoiceId, supplierInvoices.id))
            .where(and(eq(supplierPaymentAllocations.paymentId, id), eq(supplierPaymentAllocations.tenantId, tenantId)));
        }

        res.json({ ...pago, allocations });
      } catch (e) {
        console.error("GET /api/purchases/fin/pagos/:id:", e);
        res.status(500).json({ error: "Error al obtener pago" });
      }
    }
  );

  // ─── PAGOS RECURRENTES ─────────────────────────────────────────────────────

  // GET /api/purchases/fin/recurrentes
  app.get(
    "/api/purchases/fin/recurrentes",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const rows = await db
          .select({
            id: recurringSupplierPayments.id,
            tenantId: recurringSupplierPayments.tenantId,
            supplierId: recurringSupplierPayments.supplierId,
            description: recurringSupplierPayments.description,
            amount: recurringSupplierPayments.amount,
            currency: recurringSupplierPayments.currency,
            frecuencia: recurringSupplierPayments.frecuencia,
            proximaFecha: recurringSupplierPayments.proximaFecha,
            alertDiasPrevios: recurringSupplierPayments.alertDiasPrevios,
            bankAccountId: recurringSupplierPayments.bankAccountId,
            isActive: recurringSupplierPayments.isActive,
            notes: recurringSupplierPayments.notes,
            createdAt: recurringSupplierPayments.createdAt,
            supplierName: suppliersTable.name,
            bankAccountName: bankAccountsTable.name,
          })
          .from(recurringSupplierPayments)
          .leftJoin(suppliersTable, eq(recurringSupplierPayments.supplierId, suppliersTable.id))
          .leftJoin(bankAccountsTable, eq(recurringSupplierPayments.bankAccountId, bankAccountsTable.id))
          .where(eq(recurringSupplierPayments.tenantId, tenantId))
          .orderBy(desc(recurringSupplierPayments.createdAt));

        const withStatus = rows.map(r => ({
          ...r,
          estado: calcEstadoFijo(
            r.proximaFecha ?? undefined,
            r.alertDiasPrevios ?? 5,
            0,
            parseDecimal(r.amount),
            r.isActive ?? true,
          ),
        }));

        res.json(withStatus);
      } catch (e) {
        console.error("GET /api/purchases/fin/recurrentes:", e);
        res.status(500).json({ error: "Error al obtener pagos recurrentes" });
      }
    }
  );

  // POST /api/purchases/fin/recurrentes
  app.post(
    "/api/purchases/fin/recurrentes",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;

        const userId = (req as AuthenticatedRequest).user?.userId;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = recurringBodySchema.parse(req.body);

        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }
        if (data.bankAccountId) {
          const [acct] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, data.bankAccountId), eq(bankAccountsTable.tenantId, tenantId)));
          if (!acct) return res.status(400).json({ error: "Cuenta bancaria no válida para este tenant" });
        }

        const [rec] = await db
          .insert(recurringSupplierPayments)
          .values({
            tenantId,
            supplierId: data.supplierId ?? null,
            description: data.description,
            amount: String(data.amount),
            currency: data.currency,
            frecuencia: data.frecuencia,
            proximaFecha: data.proximaFecha ? new Date(data.proximaFecha as string) : null,
            alertDiasPrevios: data.alertDiasPrevios,
            bankAccountId: data.bankAccountId ?? null,
            isActive: data.isActive,
            notes: data.notes ?? null,
            createdBy: userId ?? null,
          })
          .returning();

        res.status(201).json(rec);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/purchases/fin/recurrentes:", e);
        res.status(500).json({ error: "Error al crear pago recurrente" });
      }
    }
  );

  // PATCH /api/purchases/fin/recurrentes/:id
  app.patch(
    "/api/purchases/fin/recurrentes/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: recurringSupplierPayments.id })
          .from(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Pago recurrente no encontrado" });

        const data = recurringBodySchema.partial().parse(req.body);
        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }
        if (data.bankAccountId) {
          const [acct] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, data.bankAccountId), eq(bankAccountsTable.tenantId, tenantId)));
          if (!acct) return res.status(400).json({ error: "Cuenta bancaria no válida para este tenant" });
        }

        const updateValues: Record<string, any> = { updatedAt: new Date() };
        if (data.supplierId !== undefined) updateValues.supplierId = data.supplierId ?? null;
        if (data.description !== undefined) updateValues.description = data.description;
        if (data.amount !== undefined) updateValues.amount = String(data.amount);
        if (data.currency !== undefined) updateValues.currency = data.currency;
        if (data.frecuencia !== undefined) updateValues.frecuencia = data.frecuencia;
        if (data.proximaFecha !== undefined) updateValues.proximaFecha = data.proximaFecha ? new Date(data.proximaFecha as string) : null;
        if (data.alertDiasPrevios !== undefined) updateValues.alertDiasPrevios = data.alertDiasPrevios;
        if (data.bankAccountId !== undefined) updateValues.bankAccountId = data.bankAccountId ?? null;
        if (data.isActive !== undefined) updateValues.isActive = data.isActive;
        if (data.notes !== undefined) updateValues.notes = data.notes ?? null;

        const [updated] = await db
          .update(recurringSupplierPayments)
          .set(updateValues)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PATCH /api/purchases/fin/recurrentes/:id:", e);
        res.status(500).json({ error: "Error al actualizar pago recurrente" });
      }
    }
  );

  // PATCH /api/purchases/fin/recurrentes/:id/toggle
  app.patch(
    "/api/purchases/fin/recurrentes/:id/toggle",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db
          .select({ id: recurringSupplierPayments.id, isActive: recurringSupplierPayments.isActive })
          .from(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Pago recurrente no encontrado" });

        const [updated] = await db
          .update(recurringSupplierPayments)
          .set({ isActive: !existing.isActive, updatedAt: new Date() })
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        console.error("PATCH /api/purchases/fin/recurrentes/:id/toggle:", e);
        res.status(500).json({ error: "Error al cambiar estado del pago recurrente" });
      }
    }
  );

  // DELETE /api/purchases/fin/recurrentes/:id
  app.delete(
    "/api/purchases/fin/recurrentes/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: recurringSupplierPayments.id })
          .from(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Pago recurrente no encontrado" });

        await db.delete(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));

        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/purchases/fin/recurrentes/:id:", e);
        res.status(500).json({ error: "Error al eliminar pago recurrente" });
      }
    }
  );

  // POST /api/purchases/fin/recurrentes/:id/registrar-pago
  app.post(
    "/api/purchases/fin/recurrentes/:id/registrar-pago",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;

        const userId = (req as AuthenticatedRequest).user?.userId;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [rec] = await db.select().from(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));
        if (!rec) return res.status(404).json({ error: "Pago recurrente no encontrado" });
        if (!rec.isActive) return res.status(400).json({ error: "Pago recurrente inactivo" });

        const { bankAccountId: overrideBankAccountId, reference, notes } = req.body;
        const efectivoBankAccountId = overrideBankAccountId || rec.bankAccountId;

        if (efectivoBankAccountId) {
          const [acct] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, efectivoBankAccountId), eq(bankAccountsTable.tenantId, tenantId)));
          if (!acct) return res.status(400).json({ error: "Cuenta bancaria no válida para este tenant" });
        }

        const paymentDate = new Date();
        const monto = parseDecimal(rec.amount);

        const payment = await db.transaction(async (tx) => {
          // ✅ Crear registro de pago en la historia
          const [pago] = await tx.insert(supplierPayments).values({
            tenantId,
            supplierId: rec.supplierId ?? null,
            invoiceId: null,
            recurringId: id,
            bankAccountId: efectivoBankAccountId ?? null,
            amount: String(monto),
            currency: rec.currency ?? "DOP",
            paymentDate,
            reference: reference ?? null,
            notes: notes ?? `Pago recurrente: ${rec.description}`,
            createdBy: userId ?? null,
          }).returning();

          // Debitar cuenta bancaria y crear transacción
          if (efectivoBankAccountId) {
            const [cuenta] = await tx.select({ balance: bankAccountsTable.balance })
              .from(bankAccountsTable)
              .where(eq(bankAccountsTable.id, efectivoBankAccountId));
            if (cuenta) {
              const nuevoSaldo = parseDecimal(cuenta.balance) - monto;
              await tx.update(bankAccountsTable)
                .set({ balance: String(nuevoSaldo), updatedAt: new Date() })
                .where(eq(bankAccountsTable.id, efectivoBankAccountId));
              await tx.insert(bankTransactionsTable).values({
                tenantId,
                bankAccountId: efectivoBankAccountId,
                type: "salida",
                amount: String(monto),
                description: `Pago recurrente: ${rec.description}`,
                date: paymentDate,
                createdBy: userId ?? null,
              });
            }
          }

          // Avanzar la próxima fecha
          const nextDate = avanzarProximaFecha(
            rec.proximaFecha ? new Date(rec.proximaFecha) : new Date(),
            rec.frecuencia as Frecuencia
          );
          await tx.update(recurringSupplierPayments)
            .set({ proximaFecha: nextDate, updatedAt: new Date() })
            .where(eq(recurringSupplierPayments.id, id));

          return pago;
        });

        res.json({ ok: true, payment });
      } catch (e) {
        console.error("POST /api/purchases/fin/recurrentes/:id/registrar-pago:", e);
        res.status(500).json({ error: "Error al registrar pago recurrente" });
      }
    }
  );

  // ─── NOTAS DE DÉBITO ────────────────────────────────────────────────────────

  // GET /api/purchases/fin/notas-debito
  app.get(
    "/api/purchases/fin/notas-debito",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { status, supplierId } = req.query as Record<string, string>;
        const conditions: any[] = [eq(supplierDebitNotes.tenantId, tenantId)];
        if (status && status !== "all") conditions.push(eq(supplierDebitNotes.status, status));
        if (supplierId) conditions.push(eq(supplierDebitNotes.supplierId, supplierId));

        const rows = await db
          .select({
            id: supplierDebitNotes.id,
            tenantId: supplierDebitNotes.tenantId,
            invoiceId: supplierDebitNotes.invoiceId,
            supplierId: supplierDebitNotes.supplierId,
            noteNumber: supplierDebitNotes.noteNumber,
            reason: supplierDebitNotes.reason,
            amount: supplierDebitNotes.amount,
            currency: supplierDebitNotes.currency,
            date: supplierDebitNotes.date,
            status: supplierDebitNotes.status,
            notes: supplierDebitNotes.notes,
            createdAt: supplierDebitNotes.createdAt,
            supplierName: suppliersTable.name,
            invoiceNumber: supplierInvoices.invoiceNumber,
          })
          .from(supplierDebitNotes)
          .leftJoin(suppliersTable, eq(supplierDebitNotes.supplierId, suppliersTable.id))
          .leftJoin(supplierInvoices, eq(supplierDebitNotes.invoiceId, supplierInvoices.id))
          .where(and(...conditions))
          .orderBy(desc(supplierDebitNotes.createdAt))
          .limit(200);

        res.json(rows);
      } catch (e) {
        console.error("GET /api/purchases/fin/notas-debito:", e);
        res.status(500).json({ error: "Error al obtener notas de débito" });
      }
    }
  );

  // GET /api/purchases/fin/notas-debito/:id
  app.get(
    "/api/purchases/fin/notas-debito/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [nota] = await db
          .select({
            id: supplierDebitNotes.id,
            tenantId: supplierDebitNotes.tenantId,
            invoiceId: supplierDebitNotes.invoiceId,
            supplierId: supplierDebitNotes.supplierId,
            noteNumber: supplierDebitNotes.noteNumber,
            reason: supplierDebitNotes.reason,
            amount: supplierDebitNotes.amount,
            currency: supplierDebitNotes.currency,
            date: supplierDebitNotes.date,
            status: supplierDebitNotes.status,
            notes: supplierDebitNotes.notes,
            createdAt: supplierDebitNotes.createdAt,
            supplierName: suppliersTable.name,
            invoiceNumber: supplierInvoices.invoiceNumber,
          })
          .from(supplierDebitNotes)
          .leftJoin(suppliersTable, eq(supplierDebitNotes.supplierId, suppliersTable.id))
          .leftJoin(supplierInvoices, eq(supplierDebitNotes.invoiceId, supplierInvoices.id))
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)));

        if (!nota) return res.status(404).json({ error: "Nota de débito no encontrada" });

        const items = await db
          .select()
          .from(supplierDebitNoteItems)
          .where(and(eq(supplierDebitNoteItems.debitNoteId, id), eq(supplierDebitNoteItems.tenantId, tenantId)));

        res.json({ ...nota, items });
      } catch (e) {
        console.error("GET /api/purchases/fin/notas-debito/:id:", e);
        res.status(500).json({ error: "Error al obtener nota de débito" });
      }
    }
  );

  // POST /api/purchases/fin/notas-debito
  app.post(
    "/api/purchases/fin/notas-debito",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;

        const userId = (req as AuthenticatedRequest).user?.userId;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = debitNoteBodySchema.parse(req.body);

        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }
        if (data.invoiceId) {
          const [inv] = await db.select({ id: supplierInvoices.id }).from(supplierInvoices)
            .where(and(eq(supplierInvoices.id, data.invoiceId), eq(supplierInvoices.tenantId, tenantId)));
          if (!inv) return res.status(400).json({ error: "Factura no válida para este tenant" });
        }

        const nota = await db.transaction(async (tx) => {
          const [n] = await tx.insert(supplierDebitNotes).values({
            tenantId,
            invoiceId: data.invoiceId ?? null,
            supplierId: data.supplierId ?? null,
            noteNumber: data.noteNumber,
            reason: data.reason,
            amount: String(data.amount),
            currency: data.currency,
            date: new Date(data.date as string),
            status: data.status,
            notes: data.notes ?? null,
            createdBy: userId ?? null,
          }).returning();

          if (data.items && data.items.length > 0) {
            await tx.insert(supplierDebitNoteItems).values(
              data.items.map(item => ({
                tenantId,
                debitNoteId: n.id,
                description: item.description,
                amount: String(item.amount),
              }))
            );
          }

          return n;
        });

        res.status(201).json(nota);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/purchases/fin/notas-debito:", e);
        res.status(500).json({ error: "Error al crear nota de débito" });
      }
    }
  );

  // PATCH /api/purchases/fin/notas-debito/:id
  app.patch(
    "/api/purchases/fin/notas-debito/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: supplierDebitNotes.id, status: supplierDebitNotes.status })
          .from(supplierDebitNotes)
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Nota de débito no encontrada" });

        const data = debitNoteBodySchema.partial().parse(req.body);
        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }
        if (data.invoiceId) {
          const [inv] = await db.select({ id: supplierInvoices.id }).from(supplierInvoices)
            .where(and(eq(supplierInvoices.id, data.invoiceId), eq(supplierInvoices.tenantId, tenantId)));
          if (!inv) return res.status(400).json({ error: "Factura no válida para este tenant" });
        }

        const updateValues: Record<string, any> = {};
        if (data.invoiceId !== undefined) updateValues.invoiceId = data.invoiceId ?? null;
        if (data.supplierId !== undefined) updateValues.supplierId = data.supplierId ?? null;
        if (data.noteNumber !== undefined) updateValues.noteNumber = data.noteNumber;
        if (data.reason !== undefined) updateValues.reason = data.reason;
        if (data.amount !== undefined) updateValues.amount = String(data.amount);
        if (data.currency !== undefined) updateValues.currency = data.currency;
        if (data.date !== undefined) updateValues.date = new Date(data.date as string);
        if (data.status !== undefined) updateValues.status = data.status;
        if (data.notes !== undefined) updateValues.notes = data.notes ?? null;

        const [updated] = await db
          .update(supplierDebitNotes)
          .set(updateValues)
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)))
          .returning();

        // Actualizar items si vienen
        if (data.items !== undefined) {
          await db.delete(supplierDebitNoteItems).where(eq(supplierDebitNoteItems.debitNoteId, id));
          if (data.items.length > 0) {
            await db.insert(supplierDebitNoteItems).values(
              data.items.map(item => ({
                tenantId,
                debitNoteId: id,
                description: item.description,
                amount: String(item.amount),
              }))
            );
          }
        }

        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PATCH /api/purchases/fin/notas-debito/:id:", e);
        res.status(500).json({ error: "Error al actualizar nota de débito" });
      }
    }
  );

  // DELETE /api/purchases/fin/notas-debito/:id
  app.delete(
    "/api/purchases/fin/notas-debito/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: supplierDebitNotes.id })
          .from(supplierDebitNotes)
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Nota de débito no encontrada" });

        await db.transaction(async (tx) => {
          await tx.delete(supplierDebitNoteItems).where(eq(supplierDebitNoteItems.debitNoteId, id));
          await tx.delete(supplierDebitNotes).where(eq(supplierDebitNotes.id, id));
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/purchases/fin/notas-debito/:id:", e);
        res.status(500).json({ error: "Error al eliminar nota de débito" });
      }
    }
  );

  // ─── Órdenes de Compra (para vincular a facturas) ──────────────────────────

  // GET /api/purchases/fin/ordenes — lista OC aprobadas/recibidas del tenant
  app.get(
    "/api/purchases/fin/ordenes",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const ordenes = await db
          .select({
            id: purchaseOrders.id,
            orderNumber: purchaseOrders.orderNumber,
            supplierId: purchaseOrders.supplierId,
            status: purchaseOrders.status,
            issueDate: purchaseOrders.issueDate,
            total: purchaseOrders.total,
            notes: purchaseOrders.notes,
          })
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.tenantId, tenantId),
              inArray(purchaseOrders.status, ["aprobada", "recibida_parcial", "recibida"])
            )
          )
          .orderBy(desc(purchaseOrders.issueDate));

        res.json(ordenes);
      } catch (e) {
        console.error("GET /api/purchases/fin/ordenes:", e);
        res.status(500).json({ error: "Error al obtener órdenes de compra" });
      }
    }
  );

  // GET /api/purchases/fin/ordenes/:id/items — ítems de una OC para importar a factura
  app.get(
    "/api/purchases/fin/ordenes/:id/items",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? null;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [orden] = await db
          .select({ id: purchaseOrders.id, supplierId: purchaseOrders.supplierId, total: purchaseOrders.total, subtotal: purchaseOrders.subtotal, taxAmount: purchaseOrders.taxAmount })
          .from(purchaseOrders)
          .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));

        if (!orden) return res.status(404).json({ error: "Orden de compra no encontrada" });

        const items = await db
          .select()
          .from(purchaseOrderItems)
          .where(and(eq(purchaseOrderItems.orderId, id), eq(purchaseOrderItems.tenantId, tenantId)));

        res.json({ orden, items });
      } catch (e) {
        console.error("GET /api/purchases/fin/ordenes/:id/items:", e);
        res.status(500).json({ error: "Error al obtener ítems de la orden" });
      }
    }
  );
}
