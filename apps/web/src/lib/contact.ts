// Direct contact with the host / fragrance supplier, through WhatsApp's click-to-chat link.
// The number is public on purpose: it's the site's contact.

export const WHATSAPP_NUMBER = "5491168300606"; // international format, no "+" or spaces (what wa.me expects)

/** https://wa.me/<number>?text=<message>: opens a chat with the message typed in, on phone or web. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
