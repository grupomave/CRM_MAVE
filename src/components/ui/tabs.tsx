"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

// Duas aparências:
// - "pill" (padrão): segmentado, para alternar visões (Kanban/Lista, filtros)
// - "underline": abas de conteúdo de uma página (detalhe do negócio, Configurações)
function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: "pill" | "underline" }) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        "group/tabs scrollbar-thin inline-flex max-w-full items-center overflow-x-auto overflow-y-hidden",
        variant === "pill" && "h-9 gap-1 rounded-md bg-muted p-1",
        variant === "underline" && "h-10 w-full gap-4 border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        // pill
        "group-data-[variant=pill]/tabs:rounded-sm group-data-[variant=pill]/tabs:px-3 group-data-[variant=pill]/tabs:py-1 group-data-[variant=pill]/tabs:data-[state=active]:bg-card group-data-[variant=pill]/tabs:data-[state=active]:text-foreground group-data-[variant=pill]/tabs:data-[state=active]:shadow-xs",
        // underline
        "group-data-[variant=underline]/tabs:-mb-px group-data-[variant=underline]/tabs:h-10 group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent group-data-[variant=underline]/tabs:px-0.5 group-data-[variant=underline]/tabs:data-[state=active]:border-primary group-data-[variant=underline]/tabs:data-[state=active]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
