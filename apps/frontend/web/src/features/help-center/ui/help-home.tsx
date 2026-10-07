import { useTranslation } from "react-i18next";
import { MessageSquarePlus, Inbox } from "lucide-react";
import { POPULAR_QUESTION_IDS } from "@/features/help-center/domain/faq";
import { useFaqEntries, HelpFaq } from "@/features/help-center/ui/help-faq";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";
import { HelpSearchField } from "@/features/help-center/ui/help-search-field";
import { HelpSignInPrompt } from "@/features/help-center/ui/help-sign-in-prompt";

/**
 * What the panel opens on.
 *
 * The FAQ is above the fold for everyone, signed in or not — most people
 * arrive with a question, not a case. Typing in the box replaces the rest of
 * this screen with the results, rather than navigating: a search that costs
 * a screen transition discourages the second query.
 */
export function HelpHome({ signedIn, unreadCount }: { signedIn: boolean; unreadCount: number }) {
  const { t } = useTranslation("help");
  const help = useHelpCenter();
  const entries = useFaqEntries();
  const popular = POPULAR_QUESTION_IDS.map((id) => entries.find((entry) => entry.id === id)).filter(
    (entry): entry is NonNullable<typeof entry> => entry !== undefined,
  );

  return (
    <div className="grid gap-5 p-5">
      <HelpSearchField />

      {help.query.trim() ? (
        <HelpFaq query={help.query} onAskUs={() => help.composeNew()} />
      ) : (
        <>
          {signedIn ? (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => help.composeNew()} className={CARD}>
                <MessageSquarePlus aria-hidden="true" className="h-5 w-5 text-[var(--color-primary)]" />
                <span className="text-[15px] font-semibold text-[var(--color-headline)]">{t("actionMessage")}</span>
                <span className="text-[13px] text-[var(--color-muted-foreground)]">{t("actionMessageBody")}</span>
              </button>
              <button type="button" onClick={() => help.go("requests")} className={CARD}>
                <span className="flex items-center gap-2">
                  <Inbox aria-hidden="true" className="h-5 w-5 text-[var(--color-primary)]" />
                  {unreadCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-alert)] px-1 text-[12px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <span className="text-[15px] font-semibold text-[var(--color-headline)]">{t("actionRequests")}</span>
                <span className="text-[13px] text-[var(--color-muted-foreground)]">{t("actionRequestsBody")}</span>
              </button>
            </div>
          ) : (
            <HelpSignInPrompt />
          )}

          <section className="grid gap-2">
            <h3 className="text-[15px] font-bold text-[var(--color-headline)]">{t("popularTitle")}</h3>
            <ul className="grid list-none gap-1.5 p-0">
              {popular.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      help.setQuery(entry.question);
                      help.go("faq");
                    }}
                    className="w-full rounded-[10px] border border-[var(--color-border)] px-4 py-3 text-left text-[15px] text-[var(--color-ink-2)] hover:border-[var(--color-blue-line)] hover:bg-[var(--color-blue-softer)]"
                  >
                    {entry.question}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => help.go("faq")} className="justify-self-start text-sm font-semibold text-[var(--color-primary)] hover:underline">
              {t("browseAll")}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

const CARD =
  "grid gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left hover:border-[var(--color-blue-line)] hover:bg-[var(--color-blue-softer)]";
