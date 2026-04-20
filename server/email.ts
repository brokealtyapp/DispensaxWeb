import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName: string
): Promise<boolean> {
  const resetUrl = `${process.env.APP_URL || "http://localhost:5000"}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: email,
    subject: "Restablecer contraseña - Dispensax",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #E84545 0%, #d63939 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Dispensax</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Sistema de Gestión de Máquinas Expendedoras</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          <h2 style="color: #333; margin-top: 0;">Hola${userName ? ` ${userName}` : ''},</h2>
          
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
          
          <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #E84545; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Este enlace expirará en <strong>1 hora</strong> por razones de seguridad.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña permanecerá sin cambios.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; margin-bottom: 0;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${resetUrl}" style="color: #E84545; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Dispensax. Todos los derechos reservados.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
Hola${userName ? ` ${userName}` : ''},

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Dispensax.

Para crear una nueva contraseña, visita el siguiente enlace:
${resetUrl}

Este enlace expirará en 1 hora por razones de seguridad.

Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña permanecerá sin cambios.

Saludos,
El equipo de Dispensax
    `,
  };

  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.log("SMTP not configured. Password reset email would be sent to:", email);
      console.log("Reset URL:", resetUrl);
      return true;
    }
    
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

interface ContractEmailParams {
  email: string;
  contactName?: string | null;
  establishmentName: string;
  contractDate?: Date | null;
  agreementType?: string | null;
  commissionTerms?: string | null;
  conditions?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  viewerInviteToken?: string | null;
}

export async function sendContractNotificationEmail(params: ContractEmailParams): Promise<boolean> {
  const baseUrl = process.env.APP_URL || "http://localhost:5000";
  const viewerUrl = params.viewerInviteToken ? `${baseUrl}/invite/${params.viewerInviteToken}` : null;

  const fmt = (d?: Date | null) => (d ? new Date(d).toLocaleDateString("es-DO", { timeZone: "America/Santo_Domingo" }) : "—");
  const agreementLabel: Record<string, string> = {
    comision: "Comisión",
    renta_fija: "Renta Fija",
    comodato: "Comodato",
    mixto: "Mixto",
  };

  const viewerBlockHtml = viewerUrl
    ? `
      <div style="background: #f3e8ff; border: 1px solid #c4b5fd; padding: 18px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin: 0 0 8px 0; color: #6d28d9;">Acceso al panel del propietario</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px;">
          Como parte de este contrato, puede acceder a un panel exclusivo donde verá las ventas y comisiones de sus máquinas en tiempo real.
        </p>
        <a href="${viewerUrl}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Activar mi acceso
        </a>
      </div>`
    : "";
  const viewerBlockText = viewerUrl
    ? `\n\nACCESO AL PANEL DEL PROPIETARIO:\nActive su acceso para ver ventas y comisiones en tiempo real:\n${viewerUrl}\n`
    : "";

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: params.email,
    subject: `Contrato registrado - ${params.establishmentName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #E84545 0%, #d63939 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Dispensax</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          <h2 style="margin-top: 0;">Hola${params.contactName ? ` ${params.contactName}` : ""},</h2>
          <p>Le confirmamos que se ha registrado un contrato para <strong>${params.establishmentName}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666;">Tipo de acuerdo:</td><td style="padding: 8px 0;"><strong>${agreementLabel[params.agreementType || "comision"] || params.agreementType || "—"}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Fecha del contrato:</td><td style="padding: 8px 0;"><strong>${fmt(params.contractDate)}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Vigencia:</td><td style="padding: 8px 0;"><strong>${fmt(params.startDate)} - ${fmt(params.endDate)}</strong></td></tr>
            ${params.commissionTerms ? `<tr><td style="padding: 8px 0; color: #666; vertical-align: top;">Términos:</td><td style="padding: 8px 0;">${params.commissionTerms}</td></tr>` : ""}
            ${params.conditions ? `<tr><td style="padding: 8px 0; color: #666; vertical-align: top;">Condiciones:</td><td style="padding: 8px 0;">${params.conditions}</td></tr>` : ""}
          </table>
          ${viewerBlockHtml}
          <p style="color: #666; font-size: 14px;">Si tiene alguna pregunta, no dude en contactarnos.</p>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="color: #999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Dispensax</p>
        </div>
      </body>
      </html>
    `,
    text: `Hola${params.contactName ? ` ${params.contactName}` : ""},\n\nSe ha registrado un contrato para ${params.establishmentName}.\nTipo: ${agreementLabel[params.agreementType || "comision"] || params.agreementType || "—"}\nFecha: ${fmt(params.contractDate)}\nVigencia: ${fmt(params.startDate)} - ${fmt(params.endDate)}\n${params.commissionTerms ? `Términos: ${params.commissionTerms}\n` : ""}${params.conditions ? `Condiciones: ${params.conditions}\n` : ""}${viewerBlockText}\nDispensax`,
  };

  try {
    if (!isEmailConfigured()) {
      console.log("SMTP not configured. Contract email would be sent to:", params.email);
      if (viewerUrl) console.log("Viewer invite URL:", viewerUrl);
      return true;
    }
    await transporter.sendMail(mailOptions);
    console.log("Contract email sent to:", params.email);
    return true;
  } catch (error) {
    console.error("Error sending contract email:", error);
    return false;
  }
}
