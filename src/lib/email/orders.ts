import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface OrderItemEmailData {
  product: string;
  quantity: number;
  unit: string;
  supplierName: string;
}

interface SendOrderEmailParams {
  to: string;
  orderId: string;
  organizationName: string;
  items: OrderItemEmailData[];
}

export async function sendOrderEmail({
  to,
  // orderId,
  organizationName,
  items,
}: SendOrderEmailParams) {
  // const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  // In the future, we might want to link to a supplier view of the order
  // For now, maybe just link to the dashboard or no link
  // const _orderUrl = `${siteUrl}/orders/${orderId}`;

  // Group items by supplier for the email body
  const itemsBySupplier = items.reduce(
    (acc, item) => {
      if (!acc[item.supplierName]) {
        acc[item.supplierName] = [];
      }
      acc[item.supplierName]?.push(item);
      return acc;
    },
    {} as Record<string, OrderItemEmailData[]>
  );

  const { data, error } = await resend.emails.send({
    from: 'Pedidos <orders@resend.dev>', // Change to your domain in production
    to: [to],
    subject: `Nuevo pedido de ${organizationName}`,
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
              Nuevo Pedido
            </h1>
            <p style="margin: 0 0 16px 0;">
              Hola, <strong>${organizationName}</strong> ha realizado un nuevo pedido.
            </p>
            
            <div style="background-color: white; border-radius: 6px; padding: 16px; border: 1px solid #e2e8f0;">
              ${Object.entries(itemsBySupplier)
                .map(
                  ([supplier, supplierItems]) => `
                <div style="margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
                  <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 16px;">${supplier}</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    ${supplierItems
                      .map(
                        item => `
                      <li style="margin-bottom: 4px;">
                        <strong>${item.quantity} ${item.unit}</strong> de ${item.product}
                      </li>
                    `
                      )
                      .join('')}
                  </ul>
                </div>
              `
                )
                .join('')}
            </div>

            <p style="margin: 24px 0 0 0; font-size: 14px; color: #64748b;">
              Este es un mensaje automático enviado desde Pedidos AI.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error('Error sending order email:', error);
    return null;
  }

  return data;
}
