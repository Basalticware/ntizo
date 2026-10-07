import { useTranslation } from "react-i18next";
import { BadgeCheck, ShieldCheck, Smartphone } from "lucide-react";

/**
 * "Reserve com confiança.": three things the platform does, on the soft blue
 * panel, with a phone beside them.
 *
 * **The third item is the one the mockup got wrong.** It said "Pagamento
 * protegido — pague pela plataforma, com segurança", which reads as money
 * held until the job is done. Ntizo holds nothing: the customer pays the
 * provider by M-Pesa, and the request to pay only arrives once the provider
 * has confirmed the time. That is what it says.
 *
 * The phone is cropped from the mockup, low resolution, with the screen's
 * "o seu dinheiro está protegido" painted out for the same reason. It goes
 * below `xl`, where the three items need the width.
 */
export function TrustBand() {
  const { t } = useTranslation("landing"); // t:TrustBand
  const items = [
    { Icon: BadgeCheck, title: t("home.trustPriceTitle"), body: t("home.trustPriceBody") },
    { Icon: ShieldCheck, title: t("home.trustVerifiedTitle"), body: t("home.trustVerifiedBody") },
    { Icon: Smartphone, title: t("home.trustPaymentTitle"), body: t("home.trustPaymentBody") },
  ];

  return (
    <section className="public-inset pt-10">
      <div className="grid overflow-hidden rounded-[14px] bg-[var(--color-blue-softer)] xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="px-6 py-7 sm:px-8">
          <h2 className="text-[24px] leading-tight font-extrabold md:text-[26px] tracking-[-0.01em] text-[var(--color-headline)]">
            {t("home.trustTitle")}
          </h2>
          <p className="mt-1.5 text-[15px] text-[var(--color-muted-foreground)]">
            {t("home.trustBody")}
          </p>
          <ul className="mt-6 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {items.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-card)] shadow-[0_1px_3px_rgba(30,60,120,.08)]">
                  <Icon
                    className="h-[22px] w-[22px] text-[var(--color-primary)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
                <span>
                  <b className="block text-[15px] font-bold text-[var(--color-headline)]">{title}</b>
                  <span className="mt-0.5 block text-[14px] leading-snug text-[var(--color-muted-foreground)]">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <img
          src="/images/home-trust.jpg"
          alt=""
          aria-hidden="true"
          className="hidden h-full min-h-[176px] w-full object-cover xl:block"
        />
      </div>
    </section>
  );
}
