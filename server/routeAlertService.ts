import { isEmailConfigured } from "./email";
import nodemailer from "nodemailer";
import { db } from "./db";
import { and, eq, inArray } from "drizzle-orm";
import { users as usersTable, routes } from "@shared/schema";
import { computeRouteSlaStatus, computeRouteElapsedMinutes } from "./routeUtils";
import { storage } from "./storage";

export { computeRouteSlaStatus, computeRouteElapsedMinutes };

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface RouteAlertEmailParams {
  recipients: string[];
  routeDate: string;
  supplierName: string;
  stageName: string;
  slaStatus: "proximo_vencer" | "vencido";
  slaHours: number;
  elapsedMinutes: number;
}

async function sendRouteAlertEmail(params: RouteAlertEmailParams): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.log(`[SLA-Rutas] SMTP no configurado. Alerta para ruta ${params.routeDate} / ${params.supplierName}`);
    return false;
  }
  const toAddresses = params.recipients.join(", ");
  if (!toAddresses) return false;

  const statusLabel = params.slaStatus === "vencido" ? "Vencida" : "Próxima a vencer";
  const elapsedH = (params.elapsedMinutes / 60).toFixed(1);
  const subject = `[Dispensax] Alerta SLA Ruta – ${params.routeDate} / ${params.supplierName} – ${statusLabel}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #E84545 0%, #d63939 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Dispensax</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Alerta de SLA – Gestión de Rutas</p>
      </div>
      <div style="background: #fff8f8; border: 1px solid #fca5a5; border-top: none; padding: 24px;">
        <h2 style="color: #b91c1c; margin-top: 0;">SLA de Ruta ${statusLabel}</h2>
        <p>Una ruta ha ${params.slaStatus === "vencido" ? "superado" : "alcanzado el umbral de"} el tiempo SLA configurado para la etapa actual.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #666; width: 40%;">Fecha de ruta:</td><td style="padding: 6px 0;"><strong>${params.routeDate}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Abastecedor:</td><td style="padding: 6px 0;"><strong>${params.supplierName}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Etapa actual:</td><td style="padding: 6px 0;"><strong>${params.stageName}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Tiempo transcurrido:</td><td style="padding: 6px 0;"><strong>${elapsedH} h</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">SLA configurado:</td><td style="padding: 6px 0;"><strong>${params.slaHours} h</strong></td></tr>
        </table>
        <p style="color: #991b1b; font-weight: bold;">Por favor, revise esta ruta a la brevedad posible.</p>
      </div>
      <div style="background: #f5f5f5; padding: 16px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Dispensax. Todos los derechos reservados.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: toAddresses,
      subject,
      html,
      text: `Alerta SLA Ruta ${statusLabel}\n\nRuta: ${params.routeDate} / ${params.supplierName}\nEtapa: ${params.stageName}\nTiempo transcurrido: ${elapsedH} h\nSLA configurado: ${params.slaHours} h\n\nPor favor, revise esta ruta a la brevedad posible.\n\nDispensax`,
    });
    console.log(`[SLA-Rutas] Alerta enviada para ruta ${params.routeDate} / ${params.supplierName} → ${toAddresses}`);
    return true;
  } catch (error) {
    console.error(`[SLA-Rutas] Error enviando alerta:`, error);
    return false;
  }
}

async function resolveRecipientEmails(tenantId: string, recipientIds: string[]): Promise<string[]> {
  const emails: string[] = [];

  if (recipientIds.includes("all_admins")) {
    const rows = await db.select({ email: usersTable.email })
      .from(usersTable)
      .where(and(eq(usersTable.tenantId, tenantId), eq(usersTable.role, "admin")));
    rows.forEach(r => r.email && emails.push(r.email));
  }

  if (recipientIds.includes("all_supervisors")) {
    const rows = await db.select({ email: usersTable.email })
      .from(usersTable)
      .where(and(eq(usersTable.tenantId, tenantId), eq(usersTable.role, "supervisor")));
    rows.forEach(r => r.email && emails.push(r.email));
  }

  const specificIds = recipientIds.filter(id => id !== "all_admins" && id !== "all_supervisors");
  if (specificIds.length > 0) {
    const rows = await db.select({ email: usersTable.email })
      .from(usersTable)
      .where(and(eq(usersTable.tenantId, tenantId), inArray(usersTable.id, specificIds)));
    rows.forEach(r => r.email && emails.push(r.email));
  }

  return Array.from(new Set(emails));
}

export async function checkAndSendRouteAlerts(tenantId: string): Promise<void> {
  try {
    const alertConfig = await storage.getRouteModuleAlertConfig(tenantId);
    const globalExpiry = alertConfig?.globalAlertOnExpiry ?? true;

    const stages = await storage.getRouteStages(tenantId);
    const stageMap = new Map(stages.map(s => [s.id, s]));

    const routesResult = await storage.getRoutes(undefined, undefined, undefined, tenantId, 1, 200);
    const activeRoutes = routesResult.data.filter(
      (r: { status: string; currentStageId?: string | null; currentStageEnteredAt?: Date | null }) =>
        r.status !== "completada" && r.status !== "cancelada" && r.currentStageId && r.currentStageEnteredAt
    );

    if (activeRoutes.length === 0) return;

    const recipientJson = alertConfig?.alertRecipientsJson ?? '["all_admins"]';
    let recipientIds: string[] = [];
    try {
      recipientIds = JSON.parse(recipientJson);
    } catch {
      recipientIds = ["all_admins"];
    }

    const resolvedEmails = await resolveRecipientEmails(tenantId, recipientIds);
    if (resolvedEmails.length === 0) return;

    for (const route of activeRoutes) {
      const stage = route.currentStageId ? stageMap.get(route.currentStageId) : undefined;
      if (!stage) continue;

      const slaHours = stage.slaHours ? Number(stage.slaHours) : null;
      const thresholdPct = stage.slaAlertThresholdPct ?? 80;
      const enteredAt = route.currentStageEnteredAt ? new Date(route.currentStageEnteredAt) : null;
      if (!enteredAt || !slaHours) continue;

      const slaStatus = computeRouteSlaStatus(enteredAt, slaHours, thresholdPct);

      // warning: solo si la etapa tiene alertOnSlaWarning habilitado
      const shouldAlertWarning = slaStatus === "proximo_vencer" && stage.alertOnSlaWarning;
      // expiry: si la etapa tiene alertOnSlaExpired O el flag global está activo
      const shouldAlertExpired = slaStatus === "vencido" && (stage.alertOnSlaExpired || globalExpiry);

      if (!shouldAlertWarning && !shouldAlertExpired) continue;

      // Solo enviar si la ruta acaba de ENTRAR en este estado (transición)
      const lastAlertedStatus = (route as import("@shared/schema").Route).lastAlertedSlaStatus;
      if (lastAlertedStatus === slaStatus) continue;

      const now = new Date();

      const supplierName = route.supplier?.fullName || route.supplier?.username || "Sin abastecedor";
      const routeDate = new Date(route.date).toLocaleDateString("es-DO", { timeZone: "America/Santo_Domingo" });
      const elapsedMinutes = computeRouteElapsedMinutes(enteredAt);

      await sendRouteAlertEmail({
        recipients: resolvedEmails,
        routeDate,
        supplierName,
        stageName: stage.name,
        slaStatus: slaStatus as "proximo_vencer" | "vencido",
        slaHours,
        elapsedMinutes,
      });

      await db.update(routes).set({
        lastAlertSentAt: now,
        lastAlertedSlaStatus: slaStatus,
      }).where(eq(routes.id, route.id));
    }
  } catch (error) {
    console.error("[SLA-Rutas] Error en checkAndSendRouteAlerts:", error);
  }
}
