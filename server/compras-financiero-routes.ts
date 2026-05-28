import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, ilike, or } from "drizzle-orm";
import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from "./auth";
import {
  supplierInvoices,
  supplierInvoiceItems,
  supplierPayments,
  recurringSupplierPayments,
  supplierDebitNotes,
  suppliers as suppliersTable,
  bankAccounts as bankAccountsTable,
  bankTransactions as bankTransactionsTable,
  users,
  insertSupplierInvoiceSchema,
  insertSupplierInvoiceItemSchema,
  insertSupplierPaymentSchema,
  insertRecurringSupplierPaymentSchema,
  insertSupplierDebitNoteSchema,
} from "@shared/schema";
import { z } from "zod";
import { avanzarProximaFecha, calcEstadoFijo, type Frecuencia } from "./egreso-helpers";

const ROLES_CF = ["admin", "contabilidad"];

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
    .select({ totalAmount: supplierInvoices.totalAmount, paidAmount: supplierInvoices.paidAmount, dueDate: supplierInvoices.dueDate })
    .from(supplierInvoices)
    .where(and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.tenantId, tenantId)));
  if (!inv) return;

  const total = parseDecimal(inv.totalAmount);
  const paid = parseDecimal(inv.paidAmount);
  let status: string;
  if (paid >= total) {
    status = "pagada";
  } else if (paid > 0) {
    status = "parcial";
  } else if (inv.dueDate && new Date() > new Date(inv.dueDate)) {
    status = "vencida";
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
  taxAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0.01, "Monto total requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  issueDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().min(0.001),
    unitPrice: z.coerce.number().min(0),
    amount: z.coerce.number().min(0),
  })).optional().default([]),
});

// ─── Payment body schema ──────────────────────────────────────────────────────
const paymentBodySchema = z.object({
  invoiceId: z.string().min(1),
  bankAccountId: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  paymentDate: z.string().or(z.date()),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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
  reason: z.string().min(1, "Motivo requerido"),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  date: z.string().or(z.date()),
  status: z.enum(["pendiente", "aplicada", "anulada"]).default("pendiente"),
  notes: z.string().optional().nullable(),
});

export function registerComprasFinancieroRoutes(app: Express) {
  // ─── FACTURAS ──────────────────────────────────────────────────────────────

  // GET /api/compras-fin/facturas
  app.get(
    "/api/compras-fin/facturas",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { status, supplierId, desde, hasta, search } = req.query as Record<string, string>;

        const conditions: ReturnType<typeof and>[] = [
          eq(supplierInvoices.tenantId, tenantId) as any,
        ];
        if (status && status !== "all") conditions.push(eq(supplierInvoices.status, status) as any);
        if (supplierId) conditions.push(eq(supplierInvoices.supplierId, supplierId) as any);
        if (desde) conditions.push(gte(supplierInvoices.issueDate, new Date(desde)) as any);
        if (hasta) conditions.push(lte(supplierInvoices.issueDate, new Date(hasta)) as any);
        if (search) {
          conditions.push(
            or(
              ilike(supplierInvoices.invoiceNumber, `%${search}%`),
              ilike(supplierInvoices.description, `%${search}%`)
            ) as any
          );
        }

        const rows = await db
          .select({
            id: supplierInvoices.id,
            tenantId: supplierInvoices.tenantId,
            supplierId: supplierInvoices.supplierId,
            orderId: supplierInvoices.orderId,
            invoiceNumber: supplierInvoices.invoiceNumber,
            description: supplierInvoices.description,
            subtotal: supplierInvoices.subtotal,
            taxAmount: supplierInvoices.taxAmount,
            totalAmount: supplierInvoices.totalAmount,
            paidAmount: supplierInvoices.paidAmount,
            currency: supplierInvoices.currency,
            issueDate: supplierInvoices.issueDate,
            dueDate: supplierInvoices.dueDate,
            status: supplierInvoices.status,
            notes: supplierInvoices.notes,
            createdAt: supplierInvoices.createdAt,
            supplierName: suppliersTable.name,
          })
          .from(supplierInvoices)
          .leftJoin(suppliersTable, eq(supplierInvoices.supplierId, suppliersTable.id))
          .where(and(...conditions))
          .orderBy(desc(supplierInvoices.createdAt))
          .limit(200);

        res.json(rows);
      } catch (e) {
        console.error("GET /api/compras-fin/facturas:", e);
        res.status(500).json({ error: "Error al obtener facturas" });
      }
    }
  );

  // GET /api/compras-fin/facturas/stats
  app.get(
    "/api/compras-fin/facturas/stats",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const rows = await db
          .select({
            status: supplierInvoices.status,
            totalAmount: supplierInvoices.totalAmount,
            paidAmount: supplierInvoices.paidAmount,
          })
          .from(supplierInvoices)
          .where(eq(supplierInvoices.tenantId, tenantId));

        const stats = {
          totalFacturas: rows.length,
          totalMonto: rows.reduce((s, r) => s + parseDecimal(r.totalAmount), 0),
          totalPagado: rows.reduce((s, r) => s + parseDecimal(r.paidAmount), 0),
          totalPendiente: rows.filter(r => r.status === "pendiente" || r.status === "parcial").reduce((s, r) => s + (parseDecimal(r.totalAmount) - parseDecimal(r.paidAmount)), 0),
          porStatus: {
            pendiente: rows.filter(r => r.status === "pendiente").length,
            parcial: rows.filter(r => r.status === "parcial").length,
            pagada: rows.filter(r => r.status === "pagada").length,
            vencida: rows.filter(r => r.status === "vencida").length,
            anulada: rows.filter(r => r.status === "anulada").length,
          },
        };
        res.json(stats);
      } catch (e) {
        console.error("GET /api/compras-fin/facturas/stats:", e);
        res.status(500).json({ error: "Error al obtener estadísticas" });
      }
    }
  );

  // GET /api/compras-fin/facturas/:id
  app.get(
    "/api/compras-fin/facturas/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
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
            taxAmount: supplierInvoices.taxAmount,
            totalAmount: supplierInvoices.totalAmount,
            paidAmount: supplierInvoices.paidAmount,
            currency: supplierInvoices.currency,
            issueDate: supplierInvoices.issueDate,
            dueDate: supplierInvoices.dueDate,
            status: supplierInvoices.status,
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

        const payments = await db
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

        res.json({ ...inv, items, payments });
      } catch (e) {
        console.error("GET /api/compras-fin/facturas/:id:", e);
        res.status(500).json({ error: "Error al obtener factura" });
      }
    }
  );

  // POST /api/compras-fin/facturas
  app.post(
    "/api/compras-fin/facturas",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = invoiceBodySchema.parse(req.body);

        // Validar supplier
        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
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
              subtotal: String(data.subtotal),
              taxAmount: String(data.taxAmount),
              totalAmount: String(data.totalAmount),
              paidAmount: "0",
              currency: data.currency,
              issueDate: new Date(data.issueDate),
              dueDate: data.dueDate ? new Date(data.dueDate) : null,
              status: "pendiente",
              notes: data.notes ?? null,
              createdBy: userId ?? null,
            })
            .returning();

          if (data.items.length > 0) {
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
        console.error("POST /api/compras-fin/facturas:", e);
        res.status(500).json({ error: "Error al crear factura" });
      }
    }
  );

  // PATCH /api/compras-fin/facturas/:id
  app.patch(
    "/api/compras-fin/facturas/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: supplierInvoices.id, status: supplierInvoices.status })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Factura no encontrada" });
        if (existing.status === "anulada") return res.status(400).json({ error: "No se puede editar una factura anulada" });

        const data = invoiceBodySchema.partial().parse(req.body);
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
        if (data.taxAmount !== undefined) updateValues.taxAmount = String(data.taxAmount);
        if (data.totalAmount !== undefined) updateValues.totalAmount = String(data.totalAmount);
        if (data.currency !== undefined) updateValues.currency = data.currency;
        if (data.issueDate !== undefined) updateValues.issueDate = new Date(data.issueDate);
        if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate ? new Date(data.dueDate) : null;
        if (data.notes !== undefined) updateValues.notes = data.notes ?? null;

        const [updated] = await db
          .update(supplierInvoices)
          .set(updateValues)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PATCH /api/compras-fin/facturas/:id:", e);
        res.status(500).json({ error: "Error al actualizar factura" });
      }
    }
  );

  // PATCH /api/compras-fin/facturas/:id/anular
  app.patch(
    "/api/compras-fin/facturas/:id/anular",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [inv] = await db.select({ id: supplierInvoices.id }).from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!inv) return res.status(404).json({ error: "Factura no encontrada" });

        await db.update(supplierInvoices)
          .set({ status: "anulada", updatedAt: new Date() })
          .where(eq(supplierInvoices.id, id));

        res.json({ ok: true });
      } catch (e) {
        console.error("PATCH /api/compras-fin/facturas/:id/anular:", e);
        res.status(500).json({ error: "Error al anular factura" });
      }
    }
  );

  // DELETE /api/compras-fin/facturas/:id
  app.delete(
    "/api/compras-fin/facturas/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [inv] = await db.select({ id: supplierInvoices.id, paidAmount: supplierInvoices.paidAmount })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.tenantId, tenantId)));
        if (!inv) return res.status(404).json({ error: "Factura no encontrada" });
        if (parseDecimal(inv.paidAmount) > 0) {
          return res.status(400).json({ error: "No se puede eliminar una factura con pagos registrados" });
        }

        await db.transaction(async (tx) => {
          await tx.delete(supplierInvoiceItems).where(eq(supplierInvoiceItems.invoiceId, id));
          await tx.delete(supplierInvoices).where(eq(supplierInvoices.id, id));
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/compras-fin/facturas/:id:", e);
        res.status(500).json({ error: "Error al eliminar factura" });
      }
    }
  );

  // ─── PAGOS ─────────────────────────────────────────────────────────────────

  // GET /api/compras-fin/pagos
  app.get(
    "/api/compras-fin/pagos",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { invoiceId, desde, hasta } = req.query as Record<string, string>;

        const conditions: any[] = [eq(supplierPayments.tenantId, tenantId)];
        if (invoiceId) conditions.push(eq(supplierPayments.invoiceId, invoiceId));
        if (desde) conditions.push(gte(supplierPayments.paymentDate, new Date(desde)));
        if (hasta) conditions.push(lte(supplierPayments.paymentDate, new Date(hasta)));

        const rows = await db
          .select({
            id: supplierPayments.id,
            tenantId: supplierPayments.tenantId,
            invoiceId: supplierPayments.invoiceId,
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
          .leftJoin(suppliersTable, eq(supplierInvoices.supplierId, suppliersTable.id))
          .leftJoin(bankAccountsTable, eq(supplierPayments.bankAccountId, bankAccountsTable.id))
          .where(and(...conditions))
          .orderBy(desc(supplierPayments.paymentDate))
          .limit(200);

        res.json(rows);
      } catch (e) {
        console.error("GET /api/compras-fin/pagos:", e);
        res.status(500).json({ error: "Error al obtener pagos" });
      }
    }
  );

  // POST /api/compras-fin/pagos
  app.post(
    "/api/compras-fin/pagos",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = paymentBodySchema.parse(req.body);

        // Validar factura
        const [inv] = await db.select({ id: supplierInvoices.id, totalAmount: supplierInvoices.totalAmount, paidAmount: supplierInvoices.paidAmount, status: supplierInvoices.status })
          .from(supplierInvoices)
          .where(and(eq(supplierInvoices.id, data.invoiceId), eq(supplierInvoices.tenantId, tenantId)));
        if (!inv) return res.status(400).json({ error: "Factura no válida para este tenant" });
        if (inv.status === "anulada") return res.status(400).json({ error: "No se puede registrar un pago en una factura anulada" });

        // Validar cuenta bancaria
        if (data.bankAccountId) {
          const [acct] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, data.bankAccountId), eq(bankAccountsTable.tenantId, tenantId)));
          if (!acct) return res.status(400).json({ error: "Cuenta bancaria no válida para este tenant" });
        }

        const paymentDate = new Date(data.paymentDate);

        const payment = await db.transaction(async (tx) => {
          const [pago] = await tx
            .insert(supplierPayments)
            .values({
              tenantId,
              invoiceId: data.invoiceId,
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
            .where(eq(supplierInvoices.id, data.invoiceId));

          // Recalcular status de la factura
          const total = parseDecimal(inv.totalAmount);
          let newStatus: string;
          if (newPaidAmount >= total) {
            newStatus = "pagada";
          } else if (newPaidAmount > 0) {
            newStatus = "parcial";
          } else {
            newStatus = "pendiente";
          }
          await tx
            .update(supplierInvoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(supplierInvoices.id, data.invoiceId));

          // Integración bancaria: debitar de cuenta
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
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/compras-fin/pagos:", e);
        res.status(500).json({ error: "Error al registrar pago" });
      }
    }
  );

  // DELETE /api/compras-fin/pagos/:id
  app.delete(
    "/api/compras-fin/pagos/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [pago] = await db.select().from(supplierPayments)
          .where(and(eq(supplierPayments.id, id), eq(supplierPayments.tenantId, tenantId)));
        if (!pago) return res.status(404).json({ error: "Pago no encontrado" });

        await db.transaction(async (tx) => {
          // Revertir monto pagado en factura
          const [inv] = await tx.select({ paidAmount: supplierInvoices.paidAmount, totalAmount: supplierInvoices.totalAmount, dueDate: supplierInvoices.dueDate })
            .from(supplierInvoices)
            .where(eq(supplierInvoices.id, pago.invoiceId));
          if (inv) {
            const newPaid = Math.max(0, parseDecimal(inv.paidAmount) - parseDecimal(pago.amount));
            const total = parseDecimal(inv.totalAmount);
            let newStatus: string;
            if (newPaid >= total) newStatus = "pagada";
            else if (newPaid > 0) newStatus = "parcial";
            else if (inv.dueDate && new Date() > new Date(inv.dueDate)) newStatus = "vencida";
            else newStatus = "pendiente";
            await tx.update(supplierInvoices)
              .set({ paidAmount: String(newPaid), status: newStatus, updatedAt: new Date() })
              .where(eq(supplierInvoices.id, pago.invoiceId));
          }
          // Revertir movimiento bancario si aplica
          if (pago.bankAccountId) {
            const [cuenta] = await tx.select({ balance: bankAccountsTable.balance }).from(bankAccountsTable)
              .where(eq(bankAccountsTable.id, pago.bankAccountId));
            if (cuenta) {
              const saldoRevertido = parseDecimal(cuenta.balance) + parseDecimal(pago.amount);
              await tx.update(bankAccountsTable)
                .set({ balance: String(saldoRevertido), updatedAt: new Date() })
                .where(eq(bankAccountsTable.id, pago.bankAccountId));
            }
          }
          await tx.delete(supplierPayments).where(eq(supplierPayments.id, id));
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/compras-fin/pagos/:id:", e);
        res.status(500).json({ error: "Error al eliminar pago" });
      }
    }
  );

  // ─── PAGOS RECURRENTES ─────────────────────────────────────────────────────

  // GET /api/compras-fin/recurrentes
  app.get(
    "/api/compras-fin/recurrentes",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
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

        // Agregar estado calculado
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
        console.error("GET /api/compras-fin/recurrentes:", e);
        res.status(500).json({ error: "Error al obtener pagos recurrentes" });
      }
    }
  );

  // POST /api/compras-fin/recurrentes
  app.post(
    "/api/compras-fin/recurrentes",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
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
            proximaFecha: data.proximaFecha ? new Date(data.proximaFecha) : null,
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
        console.error("POST /api/compras-fin/recurrentes:", e);
        res.status(500).json({ error: "Error al crear pago recurrente" });
      }
    }
  );

  // PATCH /api/compras-fin/recurrentes/:id
  app.patch(
    "/api/compras-fin/recurrentes/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
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
        if (data.proximaFecha !== undefined) updateValues.proximaFecha = data.proximaFecha ? new Date(data.proximaFecha) : null;
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
        console.error("PATCH /api/compras-fin/recurrentes/:id:", e);
        res.status(500).json({ error: "Error al actualizar pago recurrente" });
      }
    }
  );

  // POST /api/compras-fin/recurrentes/:id/registrar-pago
  app.post(
    "/api/compras-fin/recurrentes/:id/registrar-pago",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [rec] = await db.select().from(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));
        if (!rec) return res.status(404).json({ error: "Pago recurrente no encontrado" });
        if (!rec.isActive) return res.status(400).json({ error: "Pago recurrente inactivo" });

        const { bankAccountId, reference, notas } = req.body;
        const efectivoBankAccountId = bankAccountId || rec.bankAccountId;

        if (efectivoBankAccountId) {
          const [acct] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
            .where(and(eq(bankAccountsTable.id, efectivoBankAccountId), eq(bankAccountsTable.tenantId, tenantId)));
          if (!acct) return res.status(400).json({ error: "Cuenta bancaria no válida para este tenant" });
        }

        const paymentDate = new Date();
        const monto = parseDecimal(rec.amount);

        await db.transaction(async (tx) => {
          if (efectivoBankAccountId) {
            const [cuenta] = await tx.select({ balance: bankAccountsTable.balance }).from(bankAccountsTable)
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
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("POST /api/compras-fin/recurrentes/:id/registrar-pago:", e);
        res.status(500).json({ error: "Error al registrar pago recurrente" });
      }
    }
  );

  // DELETE /api/compras-fin/recurrentes/:id
  app.delete(
    "/api/compras-fin/recurrentes/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: recurringSupplierPayments.id })
          .from(recurringSupplierPayments)
          .where(and(eq(recurringSupplierPayments.id, id), eq(recurringSupplierPayments.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Pago recurrente no encontrado" });

        await db.delete(recurringSupplierPayments).where(eq(recurringSupplierPayments.id, id));
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/compras-fin/recurrentes/:id:", e);
        res.status(500).json({ error: "Error al eliminar pago recurrente" });
      }
    }
  );

  // ─── NOTAS DE DÉBITO ───────────────────────────────────────────────────────

  // GET /api/compras-fin/notas-debito
  app.get(
    "/api/compras-fin/notas-debito",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });

        const { status, supplierId, desde, hasta } = req.query as Record<string, string>;
        const conditions: any[] = [eq(supplierDebitNotes.tenantId, tenantId)];
        if (status && status !== "all") conditions.push(eq(supplierDebitNotes.status, status));
        if (supplierId) conditions.push(eq(supplierDebitNotes.supplierId, supplierId));
        if (desde) conditions.push(gte(supplierDebitNotes.date, new Date(desde)));
        if (hasta) conditions.push(lte(supplierDebitNotes.date, new Date(hasta)));

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
        console.error("GET /api/compras-fin/notas-debito:", e);
        res.status(500).json({ error: "Error al obtener notas de débito" });
      }
    }
  );

  // POST /api/compras-fin/notas-debito
  app.post(
    "/api/compras-fin/notas-debito",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId, userId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const data = debitNoteBodySchema.parse(req.body);

        if (data.invoiceId) {
          const [inv] = await db.select({ id: supplierInvoices.id }).from(supplierInvoices)
            .where(and(eq(supplierInvoices.id, data.invoiceId), eq(supplierInvoices.tenantId, tenantId)));
          if (!inv) return res.status(400).json({ error: "Factura no válida para este tenant" });
        }
        if (data.supplierId) {
          const [sup] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
            .where(and(eq(suppliersTable.id, data.supplierId), eq(suppliersTable.tenantId, tenantId)));
          if (!sup) return res.status(400).json({ error: "Proveedor no válido para este tenant" });
        }

        const [nota] = await db
          .insert(supplierDebitNotes)
          .values({
            tenantId,
            invoiceId: data.invoiceId ?? null,
            supplierId: data.supplierId ?? null,
            noteNumber: data.noteNumber,
            reason: data.reason,
            amount: String(data.amount),
            currency: data.currency,
            date: new Date(data.date),
            status: data.status,
            notes: data.notes ?? null,
            createdBy: userId ?? null,
          })
          .returning();

        res.status(201).json(nota);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("POST /api/compras-fin/notas-debito:", e);
        res.status(500).json({ error: "Error al crear nota de débito" });
      }
    }
  );

  // PATCH /api/compras-fin/notas-debito/:id
  app.patch(
    "/api/compras-fin/notas-debito/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: supplierDebitNotes.id })
          .from(supplierDebitNotes)
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Nota de débito no encontrada" });

        const data = debitNoteBodySchema.partial().parse(req.body);
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
        if (data.date !== undefined) updateValues.date = new Date(data.date);
        if (data.status !== undefined) updateValues.status = data.status;
        if (data.notes !== undefined) updateValues.notes = data.notes ?? null;

        const [updated] = await db
          .update(supplierDebitNotes)
          .set(updateValues)
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)))
          .returning();

        res.json(updated);
      } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
        console.error("PATCH /api/compras-fin/notas-debito/:id:", e);
        res.status(500).json({ error: "Error al actualizar nota de débito" });
      }
    }
  );

  // DELETE /api/compras-fin/notas-debito/:id
  app.delete(
    "/api/compras-fin/notas-debito/:id",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
        if (!tenantId) return res.status(400).json({ error: "Tenant requerido" });
        const { id } = req.params;

        const [existing] = await db.select({ id: supplierDebitNotes.id })
          .from(supplierDebitNotes)
          .where(and(eq(supplierDebitNotes.id, id), eq(supplierDebitNotes.tenantId, tenantId)));
        if (!existing) return res.status(404).json({ error: "Nota de débito no encontrada" });

        await db.delete(supplierDebitNotes).where(eq(supplierDebitNotes.id, id));
        res.json({ ok: true });
      } catch (e) {
        console.error("DELETE /api/compras-fin/notas-debito/:id:", e);
        res.status(500).json({ error: "Error al eliminar nota de débito" });
      }
    }
  );

  // ─── Proveedores (para selects) ───────────────────────────────────────────
  app.get(
    "/api/compras-fin/proveedores",
    authenticateJWT,
    authorizeRoles(...ROLES_CF),
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req as AuthenticatedRequest;
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
}
