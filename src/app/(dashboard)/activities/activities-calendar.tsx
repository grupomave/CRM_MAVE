"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarActivity {
  id: string;
  type: string;
  subject: string;
  due_date: string | null;
  done: boolean;
  deal_id: string | null;
  deal_title: string | null;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ActivitiesCalendar({ activities }: { activities: CalendarActivity[] }) {
  const [month, setMonth] = useState(() => new Date());

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const withDate = activities.filter((a) => a.due_date);
  const byDay = new Map<string, CalendarActivity[]>();
  for (const a of withDate) {
    const key = a.due_date!.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(a);
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-semibold capitalize text-foreground">
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-muted p-2 text-center font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayActivities = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-24 flex-col gap-1 bg-card p-1.5",
                !inMonth && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "self-end text-[11px]",
                  isToday(day)
                    ? "flex size-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayActivities.slice(0, 3).map((a) => {
                  const overdue = !a.done && new Date(a.due_date!) < now && !isSameDay(day, now);
                  const content = (
                    <span
                      className={cn(
                        "block truncate rounded px-1 py-0.5 text-[10px]",
                        a.done
                          ? "bg-muted text-muted-foreground line-through"
                          : overdue
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/10 text-primary",
                      )}
                      title={a.subject}
                    >
                      {a.subject}
                    </span>
                  );
                  return a.deal_id ? (
                    <Link key={a.id} href={`/deals/${a.deal_id}`}>
                      {content}
                    </Link>
                  ) : (
                    <div key={a.id}>{content}</div>
                  );
                })}
                {dayActivities.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayActivities.length - 3} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
