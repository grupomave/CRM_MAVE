"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// Avisa com antecedência e mantém o alerta por um tempo depois do horário
// (compromissos abertos no navegador ou criados em cima da hora ainda disparam).
const ALERT_MINUTES_BEFORE = 15;
const GRACE_MINUTES_AFTER = 30;
const POLL_INTERVAL_MS = 30_000;
const DISMISSED_KEY = "mave-crm-dismissed-appointments";

const TYPE_LABEL: Record<string, string> = {
  meeting: "Reunião",
  call: "Ligação",
};

interface UpcomingActivity {
  id: string;
  type: string;
  subject: string;
  due_date: string;
  deal_id: string | null;
  deal_title: string | null;
}

function loadDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // sessionStorage indisponível (aba privada, etc.) — segue sem persistir.
  }
}

export function AppointmentAlert({ userId }: { userId: string }) {
  const [queue, setQueue] = useState<UpcomingActivity[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    dismissedRef.current = loadDismissed();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkUpcoming() {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + ALERT_MINUTES_BEFORE * 60_000);
      const windowStart = new Date(now.getTime() - GRACE_MINUTES_AFTER * 60_000);

      const { data } = await supabase
        .from("activities")
        .select("id, type, subject, due_date, deal_id, deals ( title )")
        .eq("owner_id", userId)
        .eq("done", false)
        .in("type", ["meeting", "call"])
        .gte("due_date", windowStart.toISOString())
        .lte("due_date", windowEnd.toISOString())
        .order("due_date", { ascending: true });

      if (!isMounted || !data) return;

      const fresh = (data as unknown as Array<{
        id: string;
        type: string;
        subject: string;
        due_date: string;
        deal_id: string | null;
        deals: { title: string } | null;
      }>)
        .filter((a) => !dismissedRef.current.has(a.id))
        .map((a) => ({
          id: a.id,
          type: a.type,
          subject: a.subject,
          due_date: a.due_date,
          deal_id: a.deal_id,
          deal_title: a.deals?.title ?? null,
        }));

      if (fresh.length === 0) return;

      setQueue((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const toAdd = fresh.filter((a) => !existingIds.has(a.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }

    checkUpcoming();
    const interval = setInterval(checkUpcoming, POLL_INTERVAL_MS);

    const channel = supabase
      .channel(`appointment-alert-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
          filter: `owner_id=eq.${userId}`,
        },
        () => checkUpcoming(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const current = queue[0];

  function dismiss() {
    if (!current) return;
    dismissedRef.current.add(current.id);
    saveDismissed(dismissedRef.current);
    setQueue((prev) => prev.slice(1));
  }

  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent>
        {current && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" />
                {TYPE_LABEL[current.type] ?? "Compromisso"} próximo
              </DialogTitle>
              <DialogDescription>
                {new Date(current.due_date).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm font-medium text-foreground">{current.subject}</p>
            {current.deal_title && (
              <p className="text-sm text-muted-foreground">Negócio: {current.deal_title}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={dismiss}>
                Dispensar
              </Button>
              {current.deal_id && (
                <Button asChild onClick={dismiss}>
                  <Link href={`/deals/${current.deal_id}`}>Ver negócio</Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
