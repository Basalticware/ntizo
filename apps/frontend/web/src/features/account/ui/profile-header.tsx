import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@ntizo/frontend-ui";
import { useSession } from "@ntizo/auth-client";
import type { CurrentUserDTO } from "@ntizo/shared";

/** The name to print, in the order the person would recognise themselves by. */
export function profileName(user: CurrentUserDTO): string {
  return user.displayName || user.name || user.email;
}

export function initialsOf(source: string): string {
  return source
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** The initials disc, so reading and editing draw the same face. */
export function ProfileInitials({ name }: { name: string }) {
  return (
    <span className="type-h2 flex h-full w-full items-center justify-center bg-[var(--color-navy-surface)] font-semibold text-[var(--color-navy-on)]">
      {initialsOf(name)}
    </span>
  );
}

/**
 * Who this is: the photo, the name, how to reach them, and since when.
 *
 * One block, shown in both modes. Editing used to draw a second copy of the
 * person — the read-only header, a rule, then a "profile photo" field with
 * its own larger avatar and its own buttons — which is two answers to "who
 * am I looking at?" stacked on top of each other. So the header is the thing
 * that changes: `avatar` takes the editable control, `note` the actions that
 * belong to the photo, and the fields below start straight at the first
 * name.
 */
export function ProfileHeader({
  user,
  avatar,
  note,
  action,
}: {
  user: CurrentUserDTO;
  /** Defaults to the read-only photo. Editing passes the picker. */
  avatar?: ReactNode;
  /** Under the identity: the photo's own actions and any message about it. */
  note?: ReactNode;
  /** At the end of the row: "edit profile", when there is something to open. */
  action?: ReactNode;
}) {
  const { t, i18n } = useTranslation("account");
  // `isPending` as well as the value: the session is fetched only after
  // mount, so reading the value alone paints "not verified" beside a
  // verified number on every first render. See `SecurityPage`.
  const { data: session, isPending: sessionPending } = useSession();

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const name = profileName(user);
  const monthFmt = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
      {avatar ?? (
        <Avatar className="h-[72px] w-[72px]">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="type-h2 bg-[var(--color-navy-surface)] font-semibold text-[var(--color-navy-on)]">
            {initialsOf(name)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="type-h1 text-[var(--color-headline)]">{name}</h1>
        <p className="type-body mt-1 [overflow-wrap:anywhere] text-[var(--color-muted-foreground)]">
          {user.phoneNumber ? (
            <>
              {user.phoneNumber}
              {/* Read from the session, not the read model: whether a number
                  is verified is an auth fact, and copying it into the domain
                  profile would create a second truth that drifts. It reads
                  "not verified" for nearly everyone until an SMS provider
                  exists — which is accurate, and why it sits beside the
                  number rather than standing as a verdict on the whole
                  account. */}
              {sessionPending || session?.user?.phoneNumberVerified ? null : (
                <span className="ml-1.5 text-[var(--color-warning)]">
                  · {t("phoneUnverified")}
                </span>
              )}
              {" · "}
            </>
          ) : null}
          {user.email}
        </p>
        <p className="type-caption mt-1 text-[var(--color-muted-foreground)]">
          {t("statMemberSince")} {monthFmt.format(new Date(user.createdAt))}
        </p>
        {note ? <div className="mt-2.5">{note}</div> : null}
      </div>

      {action}
    </div>
  );
}
