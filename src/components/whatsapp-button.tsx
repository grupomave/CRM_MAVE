"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// prompt.md seção 3.7: link simples wa.me — o próprio protocolo já resolve
// abrir o WhatsApp Web/Desktop no PC ou o app no celular, sem lib extra.
function toWhatsAppUrl(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

export function WhatsAppButton({
  phone,
  contactId,
  dealId,
  className,
}: {
  phone: string | null | undefined;
  contactId?: string;
  dealId?: string;
  className?: string;
}) {
  const url = phone ? toWhatsAppUrl(phone) : null;
  if (!url) return null;

  async function logClick() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("whatsapp_click_logs").insert({
      contact_id: contactId ?? null,
      deal_id: dealId ?? null,
      clicked_by: user.id,
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      title="Abrir WhatsApp"
      onClick={logClick}
      asChild
    >
      <a href={url} target="_blank" rel="noreferrer noopener">
        <MessageCircle className="size-4 text-success" />
      </a>
    </Button>
  );
}
