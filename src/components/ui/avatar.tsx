"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials } from "@/lib/utils";
import { SimpleTooltip } from "./tooltip";

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-primary-subtle text-caption font-semibold text-primary",
        className,
      )}
      {...props}
    />
  );
}

const USER_AVATAR_SIZES = {
  xs: "size-5 [&_span]:text-micro",
  sm: "size-6 [&_span]:text-micro",
  md: "size-8",
  lg: "size-10 [&_span]:text-sm",
} as const;

// Avatar de pessoa com iniciais + tooltip com o nome completo — usado para
// responsáveis em cards, tabelas e no cabeçalho.
function UserAvatar({
  name,
  src,
  size = "md",
  showTooltip = true,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof USER_AVATAR_SIZES;
  showTooltip?: boolean;
  className?: string;
}) {
  const avatar = (
    <Avatar className={cn(USER_AVATAR_SIZES[size], className)} aria-label={name}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback>{initials(name) || "?"}</AvatarFallback>
    </Avatar>
  );
  return showTooltip ? <SimpleTooltip content={name}>{avatar}</SimpleTooltip> : avatar;
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar };
