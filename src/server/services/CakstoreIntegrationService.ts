import { config } from '../config.js';

export interface CakstoreOrderItem {
  itemId?: string;
  name?: string;
  variantName?: string;
  quantity?: number;
  price?: number;
  currency_code?: string;
}

export interface CakstoreOrder {
  id: string;
  orderNumber?: string;
  status: 'PENDING' | 'CHECKING' | 'STOCK_CONFIRMED' | 'PAID' | 'COMPLETED' | 'OUT_OF_STOCK' | 'CANCELLED' | string;
  items?: CakstoreOrderItem[];
  totalPrice?: number;
  currencyCode?: string;
  confirmationUrl?: string;
  name?: string;
  createdAt?: string;
}

export class CakstoreIntegrationService {
  public static getBaseUrl(): string {
    const raw = config.cakstore.apiUrl || 'https://store.cakwe.id';
    return raw.replace(/\/+$/, '');
  }

  private static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (config.cakstore.apiKey) {
      headers['x-api-key'] = config.cakstore.apiKey;
      headers['X-API-Key'] = config.cakstore.apiKey;
    }
    return headers;
  }

  public static cleanOrderId(rawId: string): string {
    let clean = rawId.trim();
    if (clean.toLowerCase().startsWith('order_')) {
      clean = clean.substring(6);
    }
    return clean;
  }

  public static async getOrder(orderId: string): Promise<CakstoreOrder | null> {
    const cleanId = this.cleanOrderId(orderId);
    if (!cleanId) return null;

    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/orders/${encodeURIComponent(cleanId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as Record<string, any>;
      const data = (json.data || json) as Record<string, any>;

      const itemsList: CakstoreOrderItem[] = [];
      if (Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
          const pName = item.product_name_snapshot || item.name || '';
          const iName = item.item_name_snapshot || item.variantName || item.itemId || '';
          const displayName = pName && iName ? `${pName} — ${iName}` : (pName || iName || 'Item Digital');
          itemsList.push({
            itemId: item.item_id || item.itemId || item.id,
            name: displayName,
            price: item.price_snapshot || item.price || item.subtotal,
            quantity: item.quantity || 1,
          });
        }
      } else if (data.item_name) {
        itemsList.push({
          name: data.item_name,
          price: data.item_price || data.total_amount,
          quantity: 1,
        });
      }

      const finalTotal = data.total_amount ?? data.totalPrice ?? data.total ?? data.item_price ?? data.price ?? 0;
      const currency = data.currency_code || data.currencyCode || 'IDR';
      const confirmUrl = data.confirmationUrl || data.paymentUrl || `${baseUrl}/order-confirmation?orderId=${encodeURIComponent(cleanId)}`;

      return {
        id: (data.id || data.orderId || cleanId) as string,
        orderNumber: (data.orderNumber || data.id || cleanId) as string,
        status: (data.status || 'PENDING') as string,
        items: itemsList,
        totalPrice: Number(finalTotal),
        currencyCode: currency,
        confirmationUrl: confirmUrl,
        name: (data.customer_name || data.name || data.customerName) as string | undefined,
        createdAt: data.created_at || data.createdAt,
      };
    } catch (err) {
      console.warn(`[CakstoreIntegrationService] Error fetching order ${cleanId}:`, err);
      return null;
    }
  }

  public static async cancelOrder(orderId: string, reason = 'Cancelled via Telegram'): Promise<{ success: boolean; message?: string }> {
    const cleanId = this.cleanOrderId(orderId);
    if (!cleanId) return { success: false, message: 'Invalid order ID' };

    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/orders/${encodeURIComponent(cleanId)}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          status: 'CANCELLED',
          reason,
        }),
      });

      if (response.ok) {
        return { success: true };
      }

      const json = (await response.json().catch(() => ({}))) as Record<string, any>;
      return { success: false, message: (json.message || `Failed to cancel order (Status ${response.status})`) as string };
    } catch (err) {
      console.warn(`[CakstoreIntegrationService] Error cancelling order ${cleanId}:`, err);
      return { success: false, message: 'Network or Cakstore server error' };
    }
  }

  public static formatOrderMessage(order: CakstoreOrder): string {
    const itemsText = order.items && order.items.length > 0
      ? order.items.map((i) => i.name || i.variantName || 'Item Digital').join(', ')
      : 'Produk Digital Cakstore';

    const formattedPrice = order.totalPrice !== undefined
      ? `${order.currencyCode || 'IDR'} ${order.totalPrice.toLocaleString('id-ID')}`
      : 'IDR 0';

    const statusUpper = (order.status || '').toUpperCase();
    const cleanId = this.cleanOrderId(order.id);
    const link = order.confirmationUrl || `${this.getBaseUrl()}/order-confirmation?orderId=${cleanId}`;

    // 1. Stock Confirmed / Ready for Payment
    if (statusUpper === 'STOCK_CONFIRMED' || statusUpper === 'WAITING_PAYMENT') {
      return `✅ <b>STOK TERSEDIA & DIKONFIRMASI!</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID Transaksi:</b> <code>${cleanId}</code>\n📊 <b>Status:</b> <b>Siap Dibayar</b> <i>/ Ready for Payment</i>\n🛍️ <b>Item:</b> <b>${itemsText}</b>\n💵 <b>Total:</b> <b>${formattedPrice}</b>\n━━━━━━━━━━━━━━━━━━━━\nStok pesanan Anda telah dikonfirmasi oleh Admin. Silakan lanjutkan pembayaran melalui tautan resmi berikut:\n🔗 <a href="${link}"><b>Klik Di Sini untuk Melanjutkan Pembayaran</b></a>\n━━━━━━━━━━━━━━━━━━━━\n<i>Batas waktu konfirmasi pembayaran adalah 5-10 menit setelah link dibuka.</i>`;
    }

    // 2. Completed / Order Finished
    if (statusUpper === 'COMPLETED' || statusUpper === 'SUCCESS' || statusUpper === 'DELIVERED') {
      return `🎉 <b>PESANAN SELESAI / ORDER COMPLETED</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID Transaksi:</b> <code>${cleanId}</code>\n🛍️ <b>Item:</b> <b>${itemsText}</b>\n━━━━━━━━━━━━━━━━━━━━\nPesanan Anda telah berhasil diselesaikan. Detail produk / akun telah dikirimkan.\n<b>Terima kasih telah berbelanja di Cakstore!</b>\n━━━━━━━━━━━━━━━━━━━━\n<i>Cakstore Team</i>`;
    }

    // 3. Out of Stock / Cancelled
    if (statusUpper === 'OUT_OF_STOCK' || statusUpper === 'CANCELLED' || statusUpper === 'EXPIRED') {
      return `⚠️ <b>STOK HABIS / OUT OF STOCK</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID Transaksi:</b> <code>${cleanId}</code>\n━━━━━━━━━━━━━━━━━━━━\nMohon maaf, produk pada pesanan ini saat ini sedang habis atau pesanan telah dibatalkan.\n━━━━━━━━━━━━━━━━━━━━\n<i>Cakstore Team</i>`;
    }

    // 4. Default Checking by Admin / Pending
    return `📦 <b>Detail Pesanan / Order Detail</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID Transaksi:</b> <code>${cleanId}</code>\n📊 <b>Status:</b> <b>Sedang Dicek Admin</b> <i>(Checking by Admin)</i>\n🛍️ <b>Item:</b> <b>${itemsText}</b>\n💵 <b>Total:</b> <b>${formattedPrice}</b>\n━━━━━━━━━━━━━━━━━━━━\nPesanan Anda telah kami terima dan sedang diverifikasi oleh admin. Mohon tunggu informasi selanjutnya.\n<i>Your order has been received and is being verified by admin. Please wait for the next update.</i>\n\nKlik tombol di bawah untuk membatalkan pesanan.`;
  }

  public static getOrderButtons(order: CakstoreOrder): { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> } {
    const statusUpper = (order.status || '').toUpperCase();
    const cleanId = this.cleanOrderId(order.id);
    const link = order.confirmationUrl || `${this.getBaseUrl()}/order-confirmation?orderId=${cleanId}`;

    if (statusUpper === 'STOCK_CONFIRMED' || statusUpper === 'WAITING_PAYMENT') {
      return {
        inline_keyboard: [
          [
            { text: '💳 Bayar Sekarang', url: link },
            { text: '❌ Batalkan Pesanan', callback_data: `cancel_order:${cleanId}` },
          ],
        ],
      };
    }

    if (statusUpper === 'COMPLETED' || statusUpper === 'SUCCESS' || statusUpper === 'DELIVERED') {
      return {
        inline_keyboard: [
          [
            { text: '🛒 Belanja Lagi', url: this.getBaseUrl() },
          ],
        ],
      };
    }

    if (statusUpper === 'OUT_OF_STOCK' || statusUpper === 'CANCELLED' || statusUpper === 'EXPIRED') {
      return {
        inline_keyboard: [
          [
            { text: '🛒 Lihat Produk Lain', url: this.getBaseUrl() },
          ],
        ],
      };
    }

    // Default pending/checking
    return {
      inline_keyboard: [
        [
          { text: '❌ Batalkan Pesanan', callback_data: `cancel_order:${cleanId}` },
        ],
      ],
    };
  }

  public static async notifyDeepLink(payload: {
    telegramUserId: string;
    telegramChatId: string;
    username?: string | null;
    parameter: string;
    timestamp: string;
  }): Promise<boolean> {
    if (!config.cakstore.apiUrl) {
      return false;
    }

    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/telegram/webhook`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          event: 'telegram_deep_link',
          data: payload,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
