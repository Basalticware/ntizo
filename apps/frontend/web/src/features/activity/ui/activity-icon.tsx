import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Eye,
  EyeOff,
  Gavel,
  Send,
  ShieldCheck,
  Star,
  Store,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import type { ActivityType } from "@ntizo/shared";

/**
 * One glyph per kind of thing that gets recorded — the same ten the type
 * picker offers and the badge names, so a row, an option and a label all
 * say the kind the same way.
 */
const ICONS: Record<ActivityType, LucideIcon> = {
  "user.registered": UserPlus,
  "provider.created": Store,
  "provider.status.decided": Gavel,
  "provider.invite.sent": Send,
  "provider.invite.accepted": UserCheck,
  "service.created": Briefcase,
  "service.published": Eye,
  "service.unpublished": EyeOff,
  "review.created": Star,
  "user.role.changed": ShieldCheck,
};

export type ActivityTone = "success" | "info" | "violet" | "warning" | "danger" | "neutral";

/**
 * The colour of each kind, from the mockup's timeline: people arriving are
 * violet, decisions and things going live green, invitations and edits blue,
 * a service taken down amber, a review red as the mockup draws its star.
 */
const TONES: Record<ActivityType, ActivityTone> = {
  "user.registered": "violet",
  "provider.created": "violet",
  "provider.status.decided": "success",
  "provider.invite.sent": "info",
  "provider.invite.accepted": "success",
  "service.created": "info",
  "service.published": "success",
  "service.unpublished": "warning",
  "review.created": "danger",
  "user.role.changed": "info",
};

const BOX: Record<ActivityTone, string> = {
  success: "bg-[color-mix(in_srgb,var(--color-ok-bg)_55%,var(--color-card))] text-[var(--color-success)]",
  info: "bg-[var(--color-blue-softer)] text-[var(--color-primary)]",
  violet: "bg-[color-mix(in_srgb,var(--color-violet-bg)_75%,var(--color-card))] text-[var(--color-violet-fg)]",
  warning: "bg-[color-mix(in_srgb,var(--color-warn-bg)_60%,var(--color-card))] text-[var(--color-warning)]",
  danger: "bg-[color-mix(in_srgb,var(--color-bad-bg)_60%,var(--color-card))] text-[var(--color-destructive)]",
  neutral: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

/** The glyph for a wire type. A type this list does not know draws the generic activity mark rather than nothing. */
export function activityIcon(type: string): LucideIcon {
  return ICONS[type as ActivityType] ?? Activity;
}

/** The tone for a wire type; an unknown one is neutral. */
export function activityTone(type: string): ActivityTone {
  return TONES[type as ActivityType] ?? "neutral";
}

/**
 * The glyph in its coloured 38px tile, as the mockup's timeline leads each
 * event. Not a monogram: an event is not a person, and the actor — where
 * the feed has one — sits beside it.
 */
export function ActivityKindIcon({ type }: { type: string }) {
  const Icon = activityIcon(type);
  return (
    <span
      aria-hidden="true"
      className={cn("grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px]", BOX[activityTone(type)])}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
