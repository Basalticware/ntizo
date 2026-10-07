import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  Check,
  CircleHelp,
  Eye,
  Info,
  MapPin,
  Save,
  Share2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  Badge,
  Button,
  CitySelect,
  CountrySelect,
  GalleryUpload,
  Input,
  LogoUpload,
  Label,
  Select,
  cn,
} from "@ntizo/frontend-ui";
import { PROVIDER_TYPES, ProviderStatus, ProviderType } from "@ntizo/shared";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { useCities } from "@/features/account/viewmodel/use-cities";
import { providerErrorMessage } from "../viewmodel/error-message";
import { useActiveProvider } from "../viewmodel/use-active-provider";
import { useProviderDetail } from "../viewmodel/use-providers";
import {
  useDeactivateProvider,
  useUpdateProvider,
} from "../viewmodel/use-provider-mutations";
import { useCropStrings } from "../viewmodel/use-crop-strings";
import { useImageUpload } from "../viewmodel/use-image-upload";
import {
  profileCompleteness,
  type ProfileCompleteness,
} from "../domain/profile-completeness";
import { DocumentsSection } from "./documents-section";
import { SettingsNav, type SettingsSection } from "./settings-nav";
import { SettingsSkeleton } from "./settings-skeleton";
import {
  SETTINGS_BOX,
  Section,
  SettingsLayout,
  SettingsSaveBar,
} from "./settings-shell";
import type { ProviderAddress, ProviderDetail } from "../domain/types";

/** Matches the column cap on the mutation input. */
const MAX_PORTFOLIO_IMAGES = 24;

/** Everything the form owns, in one shape so "has it changed" is one comparison. */
interface Draft {
  name: string;
  description: string;
  street: string;
  city: string;
  district: string;
  country: string;
  postalCode: string;
  /** Keys, not URLs — the server composes URLs when it reads them back. */
  logoKey: string | null;
  photoKeys: string[];
}

function draftFrom(detail: ProviderDetail | undefined): Draft {
  const address: ProviderAddress = detail?.address ?? {};
  return {
    name: detail?.name ?? "",
    description: detail?.description ?? "",
    street: address.street ?? "",
    city: address.city ?? "",
    district: address.district ?? "",
    country: address.country ?? "MZ",
    postalCode: address.postalCode ?? "",
    logoKey: detail?.logo?.key ?? null,
    photoKeys: (detail?.photos ?? []).map((p) => p.key),
  };
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  [ProviderStatus.Active]: "success",
  [ProviderStatus.Pending]: "warning",
  [ProviderStatus.Rejected]: "danger",
  [ProviderStatus.Suspended]: "danger",
  [ProviderStatus.Archived]: "info",
};

/** The field box the mockup draws: 38px, 7px corners, a quiet edge. */
const FIELD = "h-[38px] rounded-[7px] px-3 text-[14.5px]";
const LABEL = "text-[13.5px] leading-[18px] font-normal text-[var(--color-headline)]";

export function SettingsPage() {
  const { t, i18n } = useTranslation("provider");
  const { t: ta } = useTranslation("account");
  const { t: tc } = useTranslation("auth");
  const { activeProvider } = useActiveProvider();
  const {
    data: detail,
    isLoading,
    error,
    refetch,
  } = useProviderDetail(activeProvider?.id);
  const updateMut = useUpdateProvider(activeProvider?.id ?? "");
  const deactivateMut = useDeactivateProvider();
  const nav = useNavigate();

  usePageHeader(t("settings"), t("settingsPage.subtitle"));

  const saved = useMemo(() => draftFrom(detail), [detail]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setDraft(saved), [saved]);

  const cityQuery = useCities(draft.country, draft.city);
  const media = useImageUpload(activeProvider?.id);
  const logoCrop = useCropStrings("logo");
  const photoCrop = useCropStrings("photo");

  // Where a just-uploaded key can be shown from. The saved pairs carry their
  // own URL; an image uploaded a second ago is not in `detail` yet, so its URL
  // is remembered here until the next refetch supplies it.
  const [freshUrls, setFreshUrls] = useState<Record<string, string>>({});
  const urlFor = (key: string): string | null =>
    freshUrls[key] ??
    detail?.photos?.find((p) => p.key === key)?.url ??
    (detail?.logo?.key === key ? detail.logo.url : null);

  // What the save bar reads. Comparing the whole shape rather than tracking a
  // flag per field means a value edited and put back does not count as a
  // change — which is what "unsaved changes" should mean.
  const changed = useMemo(() => {
    const keys = Object.keys(saved) as Array<keyof Draft>;
    return new Set(
      keys.filter((k) => {
        const a = saved[k];
        const b = draft[k];
        // `photoKeys` is an array: `!==` compares references and would report
        // every render as a change, leaving the save bar permanently lit.
        if (Array.isArray(a) && Array.isArray(b)) {
          return a.length !== b.length || a.some((v, i) => v !== b[i]);
        }
        return a !== b;
      }),
    );
  }, [saved, draft]);
  const dirty = changed.size > 0;

  if (!activeProvider) return null;
  // The whole page, in outline. Same containers as the real thing — they are
  // literally the same components — so nothing moves when the data lands.
  if (isLoading) return <SettingsSkeleton />;
  if (error) {
    return (
      <p className="type-body text-[var(--color-destructive)]">
        {providerErrorMessage(t, error)}
      </p>
    );
  }

  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
  const providerType = (detail?.type ?? ProviderType.Individual) as ProviderType;
  const completeness = profileCompleteness({
    type: providerType,
    name: detail?.name ?? "",
    description: detail?.description,
    address: detail?.address,
    logo: detail?.logo,
    photos: detail?.photos,
    documents: detail?.documents,
  });
  // The public page only answers for a workspace customers can see.
  const publicSlug = detail?.status === ProviderStatus.Active ? detail.slug : null;

  // One source for both dots and copy: the set of fields that actually differ.
  const navSections: SettingsSection[] = [
    {
      id: "brand",
      label: t("settingsPage.nav.brand"),
      hint: t("settingsPage.nav.brandHint"),
      icon: <Camera />,
      dirty: changed.has("logoKey") || changed.has("photoKeys"),
    },
    {
      id: "identity",
      label: t("settingsIdentity"),
      hint: t("settingsPage.nav.identityHint"),
      icon: <UserRound />,
      dirty: changed.has("name") || changed.has("description"),
    },
    {
      id: "address",
      label: t("settingsAddress"),
      hint: t("settingsPage.nav.addressHint"),
      icon: <MapPin />,
      dirty: (
        ["street", "city", "district", "country", "postalCode"] as const
      ).some((k) => changed.has(k)),
    },
    {
      id: "documents",
      label: t("settingsDocuments"),
      hint: t("settingsPage.nav.documentsHint"),
      icon: <ShieldCheck />,
    },
    {
      id: "danger",
      label: t("dangerZone"),
      hint: t("settingsPage.nav.dangerHint"),
      icon: <AlertTriangle />,
      tone: "danger",
    },
  ];

  async function save() {
    setMessage(null);
    try {
      await updateMut.mutateAsync({
        name: draft.name.trim(),
        description: draft.description.trim(),
        // Sent whole. The command replaces the address rather than merging, so
        // omitting a field the provider cleared would silently keep the old
        // value and make deleting a line impossible.
        address: {
          street: draft.street.trim(),
          city: draft.city.trim(),
          district: draft.district.trim(),
          country: draft.country,
          postalCode: draft.postalCode.trim(),
        },
        logoKey: draft.logoKey,
        photoKeys: draft.photoKeys,
      });
      setMessage(t("settingsSaved"));
    } catch (err) {
      setMessage(providerErrorMessage(t, err));
    }
  }

  async function deactivate() {
    try {
      await deactivateMut.mutateAsync(activeProvider!.id);
      await nav({ to: "/provider" });
    } catch (err) {
      setMessage(providerErrorMessage(t, err));
    }
  }

  const statusLine = dirty ? t("settingsUnsaved") : (message ?? t("settingsNoChanges"));

  return (
    <SettingsLayout
      hero={
        <Hero
          detail={detail}
          completeness={completeness}
          publicSlug={publicSlug}
        />
      }
      nav={<SettingsNav sections={navSections} title={t("settings")} />}
      aside={
        <>
          <ProfileStatus completeness={completeness} publicSlug={publicSlug} />
          <HelpCard />
        </>
      }
      save={
        // Present whether or not anything changed: a save bar that appears
        // only when dirty moves the page under the reader at the moment they
        // edit their first field.
        <SettingsSaveBar>
          {/* One row on a phone, always: a message that wrapped pushed the
              buttons onto a second line and the bar grew upward over the page
              it was anchored to. The message truncates instead. From `xl` it
              sits under the two buttons, where there is room for it. */}
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-3.5 pr-16 2xl:pr-0 2xl:flex-col-reverse 2xl:items-stretch 2xl:gap-2.5 2xl:py-0">
            <div className="hidden min-w-0 sm:block">
              <p className="type-body-medium truncate font-semibold 2xl:text-[13.5px] 2xl:font-medium 2xl:text-[var(--color-muted-foreground)]">
                {statusLine}
              </p>
              {/* Hidden on narrow screens rather than allowed to wrap: it is a
                  hint, and the bar's height is load-bearing. */}
              <p className="type-caption hidden truncate text-[var(--color-muted-foreground)] sm:block 2xl:hidden">
                {t("settingsSaveHint")}
              </p>
            </div>
            <div className="flex items-center gap-3.5">
              <Button
                type="button"
                variant="outline"
                disabled={!dirty}
                onClick={() => {
                  setDraft(saved);
                  setMessage(null);
                }}
                className="h-[46px] rounded-[9px] px-4 text-[15px] sm:px-5 font-semibold text-[var(--color-ink-2)] 2xl:w-[112px]"
              >
                {t("settingsDiscard")}
              </Button>
              <Button
                disabled={!dirty || updateMut.isPending}
                onClick={() => void save()}
                className="h-[46px] gap-[11px] rounded-[9px] px-4 text-[15px] sm:px-5 font-semibold 2xl:flex-1 2xl:px-2"
              >
                <Save className="h-[18px] w-[18px]" />
                {updateMut.isPending ? t("settingsSaving") : t("settingsSave")}
              </Button>
            </div>
          </div>
        </SettingsSaveBar>
      }
    >
      <Section
        id="brand"
        icon={<Camera className="h-5 w-5" />}
        title={t("settingsPage.nav.brand")}
        blurb={t("settingsPage.brandBlurb")}
        side={
          <div className="relative rounded-[9px] bg-[var(--color-blue-softer)] py-3.5 pr-3.5 pb-4 pl-[46px]">
            <Info className="absolute top-[15px] left-[15px] h-5 w-5 text-[var(--color-primary)]" />
            <p className="text-[13.5px] leading-[18px] font-bold text-[var(--color-primary)]">
              {t("settingsPage.tipTitle")}
            </p>
            <p className="mt-[5px] text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]">
              {t("settingsPage.tipBody")}
            </p>
          </div>
        }
      >
        {/* Stacked, a rule between: the logo control is a picture beside
            its own instructions and does not fit the mockup's 150px drop. */}
        <div className="grid gap-5 [&>*+*]:border-t [&>*+*]:border-[var(--color-line-2)] [&>*+*]:pt-5">
          <LogoUpload
            cropStrings={logoCrop}
            url={draft.logoKey ? urlFor(draft.logoKey) : null}
            onSelect={(file) => {
              void media.upload("logo", file).then((r) => {
                if (!r) return;
                if (r.url) setFreshUrls((m) => ({ ...m, [r.key]: r.url! }));
                patch({ logoKey: r.key });
              });
            }}
            onClear={() => patch({ logoKey: null })}
            onReject={(reason) => setMessage(t(`mediaReject.${reason}`))}
            busy={media.busy}
            label={t("settingsLogo")}
            hint={t("settingsLogoHint")}
            chooseText={t("settingsImageChoose")}
            replaceText={t("settingsImageReplace")}
            removeText={t("settingsImageRemove")}
          />

          <div className="min-w-0">
            <p className="text-[13.5px] leading-[18px] font-medium text-[var(--color-headline)]">
              {t("settingsPortfolio")}
            </p>
            <p className="mt-0.5 mb-2.5 text-[13px] text-[var(--color-muted-foreground)]">
              {t("settingsPortfolioHint")}
            </p>
            <GalleryUpload
              cropStrings={photoCrop}
              urls={draft.photoKeys
                .map(urlFor)
                .filter((u): u is string => u !== null)}
              onSelect={(files) => {
                void media.uploadMany("photo", files).then((results) => {
                  if (results.length === 0) return;
                  setFreshUrls((m) => {
                    const next = { ...m };
                    for (const r of results) if (r.url) next[r.key] = r.url;
                    return next;
                  });
                  patch({
                    photoKeys: [
                      ...draft.photoKeys,
                      ...results.map((r) => r.key),
                    ],
                  });
                });
              }}
              onRemoveUrl={(url) =>
                patch({
                  photoKeys: draft.photoKeys.filter((k) => urlFor(k) !== url),
                })
              }
              onReject={(reason) => setMessage(t(`mediaReject.${reason}`))}
              busy={media.busy}
              max={MAX_PORTFOLIO_IMAGES}
              addText={t("settingsImageAdd")}
              emptyText={t("settingsPortfolioEmpty")}
              fullText={t("settingsPortfolioFull", {
                max: MAX_PORTFOLIO_IMAGES,
              })}
              removeText={t("settingsImageRemove")}
            />
          </div>

          {media.errorKey && (
            <p className="type-caption text-[var(--color-destructive)] md:col-span-2">
              {t(media.errorKey)}
            </p>
          )}
        </div>
      </Section>

      <Section
        id="identity"
        icon={<UserRound className="h-5 w-5" />}
        title={t("settingsPage.identityTitle")}
        blurb={t("settingsPage.identityBlurb")}
      >
        <div className="grid gap-x-[21px] gap-y-3 sm:grid-cols-[51fr_49fr]">
          <div className="grid content-start gap-[5px]">
            <Label htmlFor="name" className={LABEL}>{t("settingsPage.name")}</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={FIELD}
            />
          </div>

          {/* Read-only, and said out loud rather than rendered as a dead
            dropdown. The type decides how the calendar and the team work;
            changing it after the fact is a migration, not a setting. */}
          <div className="grid content-start gap-[5px]">
            <Label htmlFor="type" className={LABEL}>{t("settingsType")}</Label>
            <Select
              id="type"
              value={detail?.type ?? ""}
              onChange={() => undefined}
              disabled
              options={PROVIDER_TYPES.map((value) => ({
                value,
                label: t(`type.${value}`),
              }))}
              ariaLabel={t("settingsType")}
            />
            <p className="text-[12.5px] leading-[1.4] text-[var(--color-muted-foreground)]">
              {t("settingsTypeLocked")}
            </p>
          </div>

          <div className="grid gap-[5px] sm:col-span-2">
            <Label htmlFor="description" className={LABEL}>{t("settingsDescription")}</Label>
            <textarea
              id="description"
              rows={3}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder={t("settingsDescriptionHint")}
              className="rounded-[7px] border border-[var(--color-input)] bg-[var(--color-background)] px-3.5 pt-2.5 pb-2 text-[14.5px] leading-normal placeholder:text-[var(--color-faint)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none"
            />
          </div>

          {/* What the workspace IS, under what can be changed about it: the
            values support asks for and nobody can edit. */}
          <dl className="grid gap-3 border-t border-[var(--color-line-2)] pt-3 sm:col-span-2 sm:grid-cols-2">
            <Fact label={t("settingsWorkspaceId")} value={detail?.id ?? ""} mono />
            <Fact label={t("settingsSlug")} value={detail?.slug ?? ""} mono />
          </dl>
        </div>
      </Section>

      <Section
        id="address"
        icon={<MapPin className="h-5 w-5" />}
        title={t("settingsAddress")}
        blurb={t("settingsAddressBlurb")}
      >
        <div className="grid gap-x-[21px] gap-y-3 sm:grid-cols-2 lg:grid-cols-[31fr_29fr_40fr]">
          <div className="grid content-start gap-[5px]">
            <Label htmlFor="country" className={LABEL}>{ta("addrCountry")}</Label>
            <CountrySelect
              id="country"
              value={draft.country}
              onChange={(code) => patch({ country: code, city: "" })}
              locale={i18n.resolvedLanguage ?? i18n.language}
              ariaLabel={ta("addrCountry")}
              searchPlaceholder={tc("countrySearchPlaceholder")}
              noResultsText={tc("countryNoResults")}
            />
          </div>

          <div className="grid content-start gap-[5px]">
            <Label htmlFor="city" className={LABEL}>{ta("addrCity")}</Label>
            <CitySelect
              id="city"
              value={draft.city}
              onChange={(city) => patch({ city })}
              cities={cityQuery.cities}
              loading={cityQuery.loading}
              placeholder={ta("addrCityPlaceholder")}
              toggleLabel={ta("addrCityToggle")}
              noResultsText={ta("addrCityNoResults")}
              loadingText={ta("addrCityLoading")}
            />
          </div>

          <div className="grid content-start gap-[5px]">
            <Label htmlFor="district" className={LABEL}>{ta("addrDistrict")}</Label>
            <Input
              id="district"
              value={draft.district}
              onChange={(e) => patch({ district: e.target.value })}
              className={FIELD}
            />
          </div>

          <div className="grid content-start gap-[5px]">
            <Label htmlFor="postalCode" className={LABEL}>{ta("addrPostalCode")}</Label>
            <Input
              id="postalCode"
              value={draft.postalCode}
              onChange={(e) => patch({ postalCode: e.target.value })}
              className={FIELD}
            />
          </div>

          <div className="grid content-start gap-[5px] lg:col-span-2">
            <Label htmlFor="street" className={LABEL}>{ta("addrLine1")}</Label>
            <Input
              id="street"
              value={draft.street}
              onChange={(e) => patch({ street: e.target.value })}
              className={FIELD}
            />
          </div>
        </div>
      </Section>

      {/* Everything the wizard let someone skip, finishable here — and the only
        screen a rejection has to appear on. */}
      <Section
        id="documents"
        icon={<ShieldCheck className="h-5 w-5" />}
        title={t("settingsPage.documentsTitle")}
        blurb={t("settingsPage.documentsBlurb")}
      >
        <DocumentsSection
          providerId={activeProvider.id}
          providerType={providerType}
          documents={detail?.documents ?? []}
          reverificationRequestedAt={
            detail?.reverificationRequestedAt ?? null
          }
          onUploaded={() => void refetch()}
        />
      </Section>

      <Section
        id="danger"
        icon={<AlertTriangle className="h-5 w-5" />}
        title={t("dangerZone")}
        blurb={t("deactivateWarning")}
        tone="danger"
      >
        <Button variant="destructive" onClick={() => void deactivate()}>
          {t("deactivate")}
        </Button>
      </Section>
    </SettingsLayout>
  );
}

/**
 * The card across the top: who the workspace is, how finished its profile
 * is, and the two ways out to the public page. Every value is the saved one —
 * the card describes what a customer would see now, not the form's draft.
 */
function Hero({
  detail,
  completeness,
  publicSlug,
}: {
  detail: ProviderDetail | undefined;
  completeness: ProfileCompleteness;
  publicSlug: string | null;
}) {
  const { t } = useTranslation("provider");
  const name = detail?.name ?? "";
  const verified = detail?.status === ProviderStatus.Active;
  const meta = [detail?.type ? t(`type.${detail.type}`) : null, detail?.address?.city].filter(Boolean);

  return (
    <section
      className={cn(
        SETTINGS_BOX,
        "grid py-1 lg:grid-cols-[531fr_294fr] 2xl:grid-cols-[531fr_294fr_240fr]",
        !publicSlug && "2xl:grid-cols-[531fr_294fr]",
      )}
    >
      <div className="flex gap-4 px-5 py-4 pr-3 sm:gap-6">
        <div className="grid h-16 w-16 sm:h-[108px] sm:w-[105px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[var(--color-blue-soft)] text-2xl font-bold text-[var(--color-primary)]">
          {detail?.logo?.url ? (
            <img src={detail.logo.url} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsFrom(name)
          )}
        </div>
        <div className="min-w-0 pt-1.5">
          <h2 className="flex flex-wrap items-center gap-[7px] text-[19px] leading-6 font-extrabold text-[var(--color-headline)]">
            <span className="min-w-0 break-words">{name}</span>
            {verified ? (
              <BadgeCheck
                aria-label={t("settingsPage.verified")}
                className="h-[22px] w-[22px] shrink-0 fill-[var(--color-primary)] text-[var(--color-card)]"
              />
            ) : (
              <Badge tone={STATUS_TONE[detail?.status ?? ""] ?? "info"}>
                {t(`status.${detail?.status}`)}
              </Badge>
            )}
          </h2>
          {meta.length > 0 && (
            <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)] [word-spacing:2px]">
              {meta.join("  •  ")}
            </p>
          )}
          {detail?.description && (
            <p className="mt-2.5 line-clamp-3 text-sm leading-normal text-[var(--color-muted-foreground)]">
              {detail.description}
            </p>
          )}
        </div>
      </div>

      <div className="mx-5 border-t border-[var(--color-border)] py-4 lg:mx-0 lg:my-3 lg:border-t-0 lg:border-l lg:py-2.5 lg:pr-5 lg:pl-[22px]">
        <p className="text-[15px] leading-5 font-bold text-[var(--color-headline)]">
          {t("settingsPage.completeness")}
        </p>
        <div className="mt-2.5 flex items-center gap-[17px]">
          <div className="h-1.5 max-w-[198px] flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-ink-2)_8%,var(--color-background))]">
            <div
              className="h-full rounded-full bg-[var(--color-ok-fg)]"
              style={{ width: `${completeness.percent}%` }}
            />
          </div>
          <strong className="text-sm text-[var(--color-headline)] tabular-nums">{completeness.percent}%</strong>
        </div>
        <p className="mt-2.5 text-[13.5px] leading-[1.45] text-[var(--color-muted-foreground)]">
          {t("settingsPage.completenessHint")}
        </p>
        {publicSlug && (
          <Link
            to="/providers/$slug"
            params={{ slug: publicSlug }}
            className="mt-3 inline-flex items-center gap-[7px] text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("settingsPage.viewPublic")}
            <ArrowUpRight className="h-[15px] w-[15px]" />
          </Link>
        )}
      </div>

      {publicSlug && (
        <div className="mx-5 border-t border-[var(--color-border)] py-4 lg:col-span-2 2xl:col-span-1 2xl:mx-0 2xl:my-3 2xl:border-t-0 2xl:border-l 2xl:py-0 2xl:pr-4 2xl:pl-3">
          <QuickActions slug={publicSlug} />
        </div>
      )}
    </section>
  );
}

/**
 * "Ver perfil público" and "Partilhar perfil". Sharing hands the page's
 * address to the phone's own share sheet where there is one, and copies it
 * where there is not — the same link either way.
 */
function QuickActions({ slug }: { slug: string }) {
  const { t } = useTranslation("provider");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/providers/${slug}` : `${window.location.origin}/providers/${slug}`;
  const button =
    "mt-2.5 flex h-[38px] w-full items-center gap-[15px] rounded-lg border border-[color-mix(in_srgb,var(--color-blue-line)_50%,var(--color-background))] bg-[var(--color-blue-soft)] pl-[15px] text-sm text-[var(--color-headline)] hover:border-[var(--color-blue-line)] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:text-[var(--color-primary)]";

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dismissing the share sheet rejects; nothing to report.
    }
  }

  return (
    <div className="rounded-[10px] bg-[var(--color-blue-softer)] px-4 pt-3.5 pb-4">
      <p className="text-[15px] leading-5 font-bold text-[var(--color-headline)]">{t("settingsPage.quick")}</p>
      <Link to="/providers/$slug" params={{ slug }} className={button}>
        <Eye />
        {t("settingsPage.quickView")}
      </Link>
      <button type="button" onClick={() => void share()} className={button}>
        <Share2 />
        <span aria-live="polite">{copied ? t("settingsPage.quickCopied") : t("settingsPage.quickShare")}</span>
      </button>
    </div>
  );
}

/** The ring and the checklist under it. See `profileCompleteness` for what counts. */
function ProfileStatus({
  completeness,
  publicSlug,
}: {
  completeness: ProfileCompleteness;
  publicSlug: string | null;
}) {
  const { t } = useTranslation("provider");
  const { percent, steps, documents } = completeness;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const headline =
    percent === 100
      ? t("settingsPage.statusDone")
      : percent >= 50
        ? t("settingsPage.statusAlmost")
        : t("settingsPage.statusStart");

  return (
    <section className={cn(SETTINGS_BOX, "pt-[19px] pr-[18px] pb-[18px] pl-[19px]")}>
      <h2 className="text-base leading-[21px] font-bold text-[var(--color-headline)]">
        {t("settingsPage.status")}
      </h2>
      <div className="mt-3.5 flex gap-3.5">
        <div className="relative ml-px h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-[var(--color-blue-soft)]" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
              className="stroke-[var(--color-ok-fg)]"
            />
          </svg>
          <b className="absolute inset-0 grid place-items-center text-lg font-bold text-[var(--color-headline)] tabular-nums">
            {percent}%
          </b>
        </div>
        <div className="pt-1.5">
          <p className="text-[14.5px] leading-[19px] font-bold text-[var(--color-headline)]">{headline}</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-[var(--color-muted-foreground)]">
            {t("settingsPage.statusHint")}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[9px] border border-[var(--color-border)]">
        <ul className="py-2 pl-3.5">
          {steps.map(({ step, done }) => (
            <li key={step} className="flex min-h-[52px] items-start gap-4 py-1.5">
              {done ? (
                <span className="mt-1 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-[var(--color-ok-fg)] text-white">
                  <Check className="h-[13px] w-[13px]" strokeWidth={3.2} />
                </span>
              ) : (
                <span className="mt-1 h-[21px] w-[21px] shrink-0 rounded-full border-[1.6px] border-[var(--color-ink-2)]" />
              )}
              <a href={`#${step}`} className="grid min-w-0 hover:underline">
                <span className="text-sm leading-[19px] font-medium text-[var(--color-headline)]">
                  {t(`settingsPage.step.${step}`)}
                </span>
                <span className="mt-px text-[13px] leading-[18px] text-[var(--color-muted-foreground)]">
                  {step === "documents"
                    ? t("settingsPage.stepDocuments", { held: documents.held, needed: documents.needed })
                    : done
                      ? t("settingsPage.stepDone")
                      : t("settingsPage.stepTodo")}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {publicSlug && (
          <Link
            to="/providers/$slug"
            params={{ slug: publicSlug }}
            className="flex h-10 items-center justify-center gap-[7px] bg-[var(--color-blue-softer)] text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("settingsPage.viewPublic")}
            <ArrowUpRight className="h-[15px] w-[15px]" />
          </Link>
        )}
      </div>
    </section>
  );
}

function HelpCard() {
  const { t } = useTranslation("provider");
  return (
    <section className={cn(SETTINGS_BOX, "grid grid-cols-[30px_1fr] gap-x-3.5 pt-4 pr-[18px] pb-5 pl-5")}>
      <span className="mt-0.5 grid h-[30px] w-[30px] place-items-center rounded-lg bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
        <CircleHelp className="h-[19px] w-[19px]" />
      </span>
      <div>
        <h2 className="mt-0.5 text-[15px] leading-5 font-bold text-[var(--color-headline)]">{t("settingsPage.help")}</h2>
        <p className="mt-1 text-[13.5px] leading-[1.45] text-[var(--color-muted-foreground)]">{t("settingsPage.helpBody")}</p>
        <Link
          to="/help"
          className="mt-3 inline-flex h-[38px] items-center justify-center gap-[9px] rounded-[9px] border border-[var(--color-blue-line)] px-[18px] text-[14.5px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-blue-soft)]"
        >
          {t("settingsPage.helpLink")}
          <ArrowUpRight className="h-[15px] w-[15px]" />
        </Link>
      </div>
    </section>
  );
}

/** A value nobody can change, shown as one. */
function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-[var(--color-muted-foreground)]">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm font-semibold text-[var(--color-headline)]",
          mono && "font-mono text-[13px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
