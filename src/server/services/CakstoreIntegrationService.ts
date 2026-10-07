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
  total?: number;
  currencyCode?: string;
  currency_code?: string;
  confirmationUrl?: string;
  paymentUrl?: string;
  name?: string;
  contactMethod?: string;
  contactValue?: string;
  createdAt?: string;
}

export class CakstoreIntegrationService {
  private static getBaseUrl(): string {
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
      return {
        id: (data.id || data.orderId || cleanId) as string,
        orderNumber: (data.orderNumber || data.id || cleanId) as string,
        status: (data.status || 'PENDING') as string,
        items: (data.items || data.orderItems || []) as CakstoreOrderItem[],
        totalPrice: (data.totalPrice || data.total || data.price) as number | undefined,
        currencyCode: (data.currencyCode || data.currency_code || 'IDR') as string,
        confirmationUrl: (data.confirmationUrl || data.paymentUrl) as string | undefined,
        name: (data.name || data.customerName) as string | undefined,
        createdAt: data.createdAt as string | undefined,
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
      ? order.items.map((i) => i.name || i.variantName || i.itemId || 'Item Digital').join(', ')
      : 'Produk Digital Cakstore';

    const formattedPrice = order.totalPrice
      ? `${order.currencyCode || 'IDR'} ${order.totalPrice.toLocaleString('id-ID')}`
      : 'IDR 0';

    const statusUpper = (order.status || '').toUpperCase();

    // 1. Stock Confirmed / Ready for Payment
    if (statusUpper === 'STOCK_CONFIRMED' || statusUpper === 'WAITING_PAYMENT') {
      const link = order.confirmationUrl || `https://store.cakwe.id/order-confirmation?orderId=${order.id}`;
      return `STOK TERSEDIA & DIKONFIRMASI!\n----------------------------------------\nID Transaksi: ${order.id}\nStatus: Siap Dibayar / Ready for Payment\n🛍️ Item: ${itemsText}\n💵 Total: ${formattedPrice}\n\nStok pesanan Anda telah dikonfirmasi oleh Admin. Silakan lanjutkan pembayaran melalui tautan resmi berikut:\n🔗 ${link}\n----------------------------------------\nBatas waktu konfirmasi pembayaran adalah 5-10 menit setelah link dibuka.\n\nKetik BATAL ${order.id} jika ingin membatalkan.`;
    }

    // 2. Completed / Order Finished
    if (statusUpper === 'COMPLETED' || statusUpper === 'SUCCESS' || statusUpper === 'DELIVERED') {
      return `PESANAN SELESAI / ORDER COMPLETED\n----------------------------------------\nID Transaksi: ${order.id}\n🛍️ Item: ${itemsText}\n\nPesanan Anda telah berhasil diselesaikan. Detail produk / akun telah dikirimkan.\nTerima kasih telah berbelanja di Cakstore!\n----------------------------------------\nCakstore Team`;
    }

    // 3. Out of Stock / Cancelled
    if (statusUpper === 'OUT_OF_STOCK' || statusUpper === 'CANCELLED' || statusUpper === 'EXPIRED') {
      return `STOK HABIS / OUT OF STOCK\n----------------------------------------\nID Transaksi: ${order.id}\n\nMohon maaf, produk pada pesanan ini saat ini sedang habis atau pesanan telah dibatalkan.\n----------------------------------------\nCakstore Team`;
    }

    // 4. Default Checking by Admin / Pending
    return `Detail Pesanan / Order Detail\n----------------------------------------\nID Transaksi: ${order.id}\nStatus: Sedang Dicek Admin (Checking by Admin)\nItem: ${itemsText}\nTotal: ${formattedPrice}\n----------------------------------------\nPesanan Anda telah kami terima dan sedang diverifikasi oleh admin. Mohon tunggu informasi selanjutnya.\nYour order has been received and is being verified by admin. Please wait for the next update.\n\nKlik tombol di bawah untuk membatalkan pesanan.`;
  }

  public static getOrderButtons(order: CakstoreOrder): { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> } {
    const statusUpper = (order.status || '').toUpperCase();
    const cleanId = this.cleanOrderId(order.id);

    if (statusUpper === 'STOCK_CONFIRMED' || statusUpper === 'WAITING_PAYMENT') {
      const link = order.confirmationUrl || `https://store.cakwe.id/order-confirmation?orderId=${cleanId}`;
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
            { text: '🛒 Belanja Lagi', url: 'https://store.cakwe.id' },
          ],
        ],
      };
    }

    if (statusUpper === 'OUT_OF_STOCK' || statusUpper === 'CANCELLED' || statusUpper === 'EXPIRED') {
      return {
        inline_keyboard: [
          [
            { text: '🛒 Lihat Produk Lain', url: 'https://store.cakwe.id' },
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
    } catch (err) {
      return false;
    }
  }
}
