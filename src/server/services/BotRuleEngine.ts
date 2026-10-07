import type { IConversation } from '../../shared/types.js';
import { DeepLinkService } from './DeepLinkService.js';
import { CakstoreIntegrationService } from './CakstoreIntegrationService.js';

export interface BotRuleResult {
  shouldReply: boolean;
  replyText?: string;
  switchToHuman?: boolean;
  deepLinkParam?: string;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };
}

export class BotRuleEngine {
  public static async processIncoming(conversation: IConversation, rawText: string): Promise<BotRuleResult> {
    const text = rawText.trim();
    const lowerText = text.toLowerCase();

    // If conversation is already in HUMAN mode, NEVER send automatic bot responses
    if (conversation.mode === 'HUMAN') {
      return { shouldReply: false };
    }

    // 1. Check for /start command with or without deep link parameter
    const startParse = DeepLinkService.parseStartCommand(text);
    if (startParse.isStart) {
      if (startParse.parameter) {
        const cleanParam = CakstoreIntegrationService.cleanOrderId(startParse.parameter);
        const order = await CakstoreIntegrationService.getOrder(cleanParam);

        if (order) {
          return {
            shouldReply: true,
            replyText: CakstoreIntegrationService.formatOrderMessage(order),
            deepLinkParam: cleanParam,
            replyMarkup: CakstoreIntegrationService.getOrderButtons(order),
          };
        }

        const fallbackOrder = {
          id: cleanParam,
          status: 'CHECKING',
        };

        return {
          shouldReply: true,
          replyText: `Detail Pesanan / Order Detail\n----------------------------------------\nID Transaksi: ${cleanParam}\nStatus: Sedang Dicek Admin (Checking by Admin)\nItem: Produk Digital Cakstore\n----------------------------------------\nPesanan Anda telah kami terima dan sedang diverifikasi oleh admin. Mohon tunggu informasi selanjutnya.\nYour order has been received and is being verified by admin. Please wait for the next update.\n\nKlik tombol di bawah untuk membatalkan pesanan.`,
          deepLinkParam: cleanParam,
          replyMarkup: CakstoreIntegrationService.getOrderButtons(fallbackOrder),
        };
      }

      return {
        shouldReply: true,
        replyText: `Halo! Selamat datang di Cakstore Support.\n\nApakah kamu butuh bantuan? Silakan jelaskan keluhan kamu di sini atau kirimkan ID Transaksi pesanan kamu.`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '🌐 Buka Cakstore', url: 'https://store.cakwe.id' },
            ],
          ],
        },
      };
    }

    // 2. Check for order cancellation command: BATAL / CANCEL
    if (lowerText.startsWith('batal') || lowerText.startsWith('cancel')) {
      const match = text.match(/^(?:batal|cancel)\s+([A-Za-z0-9_-]+)/i);
      let targetOrderId: string | null = match ? match[1].trim() : null;

      if (!targetOrderId && conversation.latest_deep_link) {
        targetOrderId = CakstoreIntegrationService.cleanOrderId(conversation.latest_deep_link);
      }

      if (targetOrderId) {
        const cleanId = CakstoreIntegrationService.cleanOrderId(targetOrderId);
        await CakstoreIntegrationService.cancelOrder(cleanId);

        return {
          shouldReply: true,
          replyText: `PESANAN DIBATALKAN / ORDER CANCELLED\n----------------------------------------\nID Transaksi: ${cleanId}\nStatus: Dibatalkan oleh Pembeli\n\nPesanan Anda telah berhasil dibatalkan.\nTerima kasih telah menggunakan layanan Cakstore!\n----------------------------------------\nCakstore Team`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '🛒 Belanja Lagi', url: 'https://store.cakwe.id' },
              ],
            ],
          },
        };
      }

      return {
        shouldReply: true,
        replyText: `Silakan sertakan ID Transaksi yang ingin Anda batalkan.\nContoh: BATAL CKS-1791293697-20261006MSPL3W`,
      };
    }

    // 3. Check for standalone order ID query (e.g. CKS-1791293697-20261006MSPL3W)
    const cksMatch = text.match(/\b(CKS-[A-Za-z0-9_-]+)\b/i);
    if (cksMatch) {
      const orderId = cksMatch[1];
      const order = await CakstoreIntegrationService.getOrder(orderId);
      if (order) {
        return {
          shouldReply: true,
          replyText: CakstoreIntegrationService.formatOrderMessage(order),
          replyMarkup: CakstoreIntegrationService.getOrderButtons(order),
        };
      }
      const fallbackOrder = {
        id: orderId,
        status: 'CHECKING',
      };
      return {
        shouldReply: true,
        replyText: `Detail Pesanan / Order Detail\n----------------------------------------\nID Transaksi: ${orderId}\nStatus: Sedang Dicek Admin (Checking by Admin)\nItem: Produk Digital Cakstore\n----------------------------------------\nPesanan Anda telah kami terima dan sedang diverifikasi oleh admin. Mohon tunggu informasi selanjutnya.\n\nKlik tombol di bawah untuk membatalkan pesanan.`,
        replyMarkup: CakstoreIntegrationService.getOrderButtons(fallbackOrder),
      };
    }

    // 4. Check for human handover trigger
    if (
      lowerText === '/admin' ||
      lowerText === 'admin' ||
      lowerText === 'human' ||
      lowerText === '/human' ||
      lowerText.includes('talk to admin') ||
      lowerText.includes('hubungi admin') ||
      lowerText.includes('bicara dengan admin') ||
      lowerText.includes('talk to human')
    ) {
      return {
        shouldReply: true,
        replyText: `Baik, kami akan menghubungkanmu dengan tim admin Cakstore. Mohon tunggu sebentar ya, admin kami akan segera membalas pesan kamu di sini.`,
        switchToHuman: true,
      };
    }

    // 5. Check for /help command
    if (lowerText === '/help' || lowerText === 'help' || lowerText === 'bantuan') {
      return {
        shouldReply: true,
        replyText: `Cakstore Support Assistant:\n- Tuliskan keluhan atau pertanyaan kamu langsung di sini.\n- Kirim ID pesanan (misal: CKS-123...) untuk cek status.\n- Klik tombol batalkan untuk membatalkan pesanan.\n- Ketik /admin untuk berbicara langsung dengan customer service.\n- Ketik /start untuk memulai ulang assistant.`,
      };
    }

    // 6. If conversation is CLOSED
    if (conversation.mode === 'CLOSED') {
      return {
        shouldReply: true,
        replyText: `Sesi percakapan ini telah ditutup. Ketik /start untuk memulai percakapan baru atau /admin untuk menghubungi admin.`,
      };
    }

    // 7. Default BOT mode reply
    return {
      shouldReply: true,
      replyText: `Apakah kamu butuh bantuan? Jelaskan keluhan kamu disini. Ketik /admin jika ingin terhubung dengan admin.`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '💬 Hubungi Admin', callback_data: 'talk_admin' },
            { text: '🌐 Buka Cakstore', url: 'https://store.cakwe.id' },
          ],
        ],
      },
    };
  }
}
