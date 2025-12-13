import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  invitationToken: string;
  role: 'admin' | 'member';
}

export async function sendInvitationEmail({
  to,
  inviterName,
  organizationName,
  invitationToken,
  role,
}: SendInvitationEmailParams) {
  const siteUrl =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://pedidos-ai.vercel.app';
  const inviteUrl = `${siteUrl}/invite/${invitationToken}`;
  const roleText = role === 'admin' ? 'administrador' : 'miembro';

  const result = await resend.emails.send({
    from: 'Pedidos <onboarding@resend.dev>', // Change to your domain in production
    to: [to],
    subject: `Has sido invitado a unirte a ${organizationName} en Pedidos`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
            <h1 style="color: #1e40af; margin: 0 0 16px 0; font-size: 24px;">
              Has sido invitado a Pedidos
            </h1>
            <p style="margin: 0 0 16px 0;">
              <strong>${inviterName}</strong> te ha invitado a unirte a <strong>${organizationName}</strong> como <strong>${roleText}</strong>.
            </p>
            <p style="margin: 0 0 24px 0;">
              Pedidos es una aplicación para gestionar pedidos a proveedores de manera eficiente.
            </p>
            <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              Aceptar invitación
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
            O copia y pega este enlace en tu navegador:
          </p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all; margin: 0 0 24px 0;">
            ${inviteUrl}
          </p>

          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Si no esperabas esta invitación, puedes ignorar este mensaje.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
            Esta invitación expira en 48 horas.
          </p>
        </body>
      </html>
    `,
  });

  if (result.error) {
    console.error('Error sending invitation email:', result.error);
    // Don't throw - email failure shouldn't block invitation creation
    // The invitation link will be shown in the UI as fallback
  }

  return result;
}
