import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ContactRound,
  FileText,
  Headphones,
  House,
  LayoutGrid,
  MessageSquareText,
  Settings,
  Star,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type ConsoleZone = "workspace" | "platform";

/**
 * Where a badge's number comes from. A name, not a number: an item declares
 * that it carries a count and the shell resolves it against the reads it
 * already has in scope (`console-counts.tsx`). A source with no read behind
 * it yet resolves to `undefined` and draws nothing — `flaggedReviews`, until
 * the reviews read exposes a pending count. `bookingRequests` resolves from the
 * bookings stats read the Overview already draws its cards from.
 */
export type ConsoleCountSource =
  | "unreadThreads"
  | "bookingRequests"
  | "quoteRequests"
  | "pendingProviders"
  | "flaggedReviews";

export interface ConsoleNavItem {
  /** Stable identity for tests and React keys. Never shown. */
  key: string;
  /** The sidebar and sheet label, in the zone's namespace. */
  titleKey: string;
  /**
   * The tab-bar label — its own key, never the sidebar string truncated.
   * German's "Verfügbarkeit" does not fit a 97px tab at 10px; "Kalender" does.
   */
  shortKey?: string;
  /** A route template. Workspace URLs carry `$slug`; see `resolveUrl`. */
  url: string;
  icon: LucideIcon;
  /** One of the phone's three tabs. Exactly three per zone; the fourth is always Menu. */
  primary?: true;
  count?: ConsoleCountSource;
}

export interface ConsoleNav {
  zone: ConsoleZone;
  /** The i18n namespace every `titleKey` and `shortKey` resolves in. */
  ns: "provider" | "admin";
  /** Ungrouped, above both groups: the summary of the pair. */
  home: ConsoleNavItem;
  /** What arrives and can be owed. */
  work: readonly ConsoleNavItem[];
  /** What is true. */
  manage: readonly ConsoleNavItem[];
}

export const PRIMARY_TAB_COUNT = 3;

/**
 * The workspace zone: the business, and nothing else. No personal account
 * here — that belongs to the person and lives in the customer zone. No
 * notifications item either: the header bell is that control, and two
 * controls for one destination is one too many.
 */
const WORKSPACE: ConsoleNav = {
  zone: "workspace",
  ns: "provider",
  home: { key: "overview", titleKey: "nav.overview", url: "/provider/$slug/overview", icon: House },
  // The mockups' order: what the provider offers, then when, then the work
  // that arrives against it.
  work: [
    { key: "services", titleKey: "nav.services", shortKey: "navShort.services", url: "/provider/$slug/services", icon: LayoutGrid },
    { key: "availability", titleKey: "nav.availability", shortKey: "navShort.availability", url: "/provider/$slug/availability", icon: CalendarDays },
    { key: "bookings", titleKey: "nav.bookings", shortKey: "navShort.bookings", url: "/provider/$slug/bookings", icon: CalendarPlus, primary: true, count: "bookingRequests" },
    { key: "quotes", titleKey: "nav.quotes", shortKey: "navShort.quotes", url: "/provider/$slug/quotes", icon: FileText, primary: true, count: "quoteRequests" },
    { key: "messages", titleKey: "nav.messages", shortKey: "navShort.messages", url: "/provider/$slug/messages", icon: MessageSquareText, primary: true, count: "unreadThreads" },
  ],
  manage: [
    { key: "wallet", titleKey: "nav.wallet", url: "/provider/$slug/wallet", icon: Wallet },
    { key: "members", titleKey: "nav.members", url: "/provider/$slug/members", icon: Users },
    { key: "notifications", titleKey: "nav.notifications", url: "/provider/$slug/notifications", icon: Bell },
    { key: "activity", titleKey: "nav.activity", url: "/provider/$slug/activity", icon: Activity },
    { key: "settings", titleKey: "nav.settings", url: "/provider/$slug/settings", icon: Settings },
  ],
};

const PLATFORM: ConsoleNav = {
  zone: "platform",
  ns: "admin",
  home: { key: "dashboard", titleKey: "nav.dashboard", url: "/admin/dashboard", icon: House },
  work: [
    // What arrives at the platform, in the order somebody is waiting on it:
    // applications to approve, bookings an administrator has to close, support
    // threads and contact requests owed a reply, reviews to moderate. The three
    // tabs stay Providers, Reviews and Users; the bookings and support reads
    // expose counts now, and re-choosing the tabs is follow-up #203.
    { key: "providers", titleKey: "nav.providers", shortKey: "navShort.providers", url: "/admin/providers", icon: Users, primary: true, count: "pendingProviders" },
    { key: "bookings", titleKey: "nav.bookings", url: "/admin/bookings", icon: CalendarCheck },
    { key: "support", titleKey: "nav.support", url: "/admin/support", icon: Headphones },
    { key: "contact", titleKey: "nav.contact", url: "/admin/contact", icon: ContactRound },
    { key: "reviews", titleKey: "nav.reviews", shortKey: "navShort.reviews", url: "/admin/reviews", icon: Star, primary: true, count: "flaggedReviews" },
  ],
  manage: [
    // Users is the platform's people registry, as Members is the
    // workspace's — a fact you look up, not a queue that arrives. It takes a
    // tab because it is the third thing an admin opens on a phone.
    { key: "users", titleKey: "nav.users", shortKey: "navShort.users", url: "/admin/users", icon: UserRound, primary: true },
    { key: "activity", titleKey: "nav.activity", url: "/admin/activity", icon: BarChart3 },
    { key: "categories", titleKey: "nav.categories", url: "/admin/categories", icon: LayoutGrid },
  ],
};

export function consoleNav(zone: ConsoleZone): ConsoleNav {
  return zone === "workspace" ? WORKSPACE : PLATFORM;
}

/** Home, then Work, then Manage — the order every rendering uses. */
export function allItems(nav: ConsoleNav): ConsoleNavItem[] {
  return [nav.home, ...nav.work, ...nav.manage];
}

/** The phone's tabs, in sidebar order. */
export function primaryItems(nav: ConsoleNav): ConsoleNavItem[] {
  return allItems(nav).filter((item) => item.primary === true);
}

/**
 * A template into a path — or `null` when the template needs a slug and there
 * is none yet, the moment before `useActiveProvider` resolves. A link to
 * `/provider//messages` is worse than no link.
 */
export function resolveUrl(url: string, slug: string | undefined): string | null {
  if (!url.includes("$slug")) return url;
  if (!slug) return null;
  return url.replace("$slug", slug);
}
