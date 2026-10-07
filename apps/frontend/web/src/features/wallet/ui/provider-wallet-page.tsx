import { useTranslation } from "react-i18next";
import { useActiveProvider } from "@/features/provider/viewmodel/use-active-provider";
import { usePageHeader } from "@/shared/lib/page-header";
import { WalletPanel } from "./wallet-panel";

/**
 * The workspace's money, in the provider's own zone.
 *
 * The same panel the administrator sees, because it is the same wallet. What
 * differs is only which workspace it is asked about, and that comes from the
 * zone the person is standing in — and, here, the mockup's heading: the
 * eyebrow and the promise banner beside the title.
 */
export function ProviderWalletPage() {
  const { t } = useTranslation("provider");
  const { activeProvider } = useActiveProvider();

  usePageHeader(t("nav.wallet"), t("walletSubtitle"), { ownHeading: true });

  if (!activeProvider) return null;

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <section className="flex flex-wrap items-start justify-between gap-6 pb-6 lg:min-h-[215px] lg:flex-nowrap lg:pb-0">
        <div className="min-w-0 lg:pt-[37px]">
          <p className="m-0 text-[13.5px] font-semibold tracking-[0.07em] text-[var(--color-muted-foreground)] uppercase">
            {t("walletEyebrow")}
          </p>
          <h1 className="font-display mt-2 text-[34px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[48px]">
            {t("nav.wallet")}
          </h1>
          <p className="mt-3 max-w-[540px] text-base leading-[1.45] text-[var(--color-muted-foreground)] md:text-lg">
            {t("walletSubtitle")}
          </p>
        </div>
        <WalletPromise title={t("walletPromiseTitle")} body={t("walletPromiseBody")} />
      </section>

      <WalletPanel providerId={activeProvider.id} />
    </div>
  );
}

/**
 * The banner on the right of the heading — the wallet drawing and the
 * platform's promise about payments, on the sky-blue ground, with the
 * mockup's three loose squares around it.
 */
function WalletPromise({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative mt-[22px] hidden h-[169px] w-[592px] shrink-0 xl:block">
      <span aria-hidden="true" className="absolute top-[39px] -left-[49px] h-[47px] w-12 rounded-[9px] bg-[var(--color-info-bg)] dark:bg-[var(--color-blue-soft)]" />
      <div className="absolute inset-0 flex items-center gap-[35px] rounded-[14px] bg-[var(--color-info-bg)] pl-[69px] dark:bg-[var(--color-blue-softer)]">
        <img src="/console/wallet.png" alt="" className="h-[135px] w-[150px]" />
        <div>
          <h2 className="m-0 text-[22.5px] leading-[30px] font-bold whitespace-pre-line text-[var(--color-headline)] dark:text-[var(--color-headline)]">
            {title}
          </h2>
          <p className="mt-2 text-[17px] leading-[1.45] whitespace-pre-line text-[var(--color-muted-foreground)] dark:text-[var(--color-muted-foreground)]">
            {body}
          </p>
        </div>
      </div>
      <span aria-hidden="true" className="absolute top-[87px] left-0 h-12 w-[47px] rounded-[9px] bg-[var(--color-info-bg)] shadow-[0_0_0_3px_var(--color-background)] dark:bg-[var(--color-blue-soft)]" />
      <span aria-hidden="true" className="absolute top-[131px] left-[557px] h-[35px] w-9 rounded-[9px] bg-[var(--color-info-bg)] shadow-[0_0_0_3px_var(--color-background)] dark:bg-[var(--color-blue-soft)]" />
    </div>
  );
}
