import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ImagePlus, Link2, Loader2, Save, Sparkles, Trash2, X, icons, type LucideIcon } from "lucide-react";
import { Button, Input, Select, cn } from "@ntizo/frontend-ui";
import { uploadCategoryImage } from "../data/admin-category.repository";
import { useSaveCategory } from "../viewmodel/use-admin-categories";
import {
  canSave,
  DEFAULT_LOCALE,
  emptyForm,
  formFrom,
  LOCALES,
  type AdminCategory,
} from "../domain/types";

/**
 * Resolve a Lucide icon name from the database to the component — the same
 * lookup the home page's category grid makes, so the tile here is the mark
 * customers will see. Unknown names draw `Sparkles`, as they do there.
 */
export function categoryIcon(name: string): LucideIcon {
  return icons[name as keyof typeof icons] ?? Sparkles;
}
/**
 * Creating and editing a category, in the panel the list opens on the right.
 *
 * A box per language, with the platform's own first and marked required —
 * that is the whole multi-language decision made visible. The other seven are
 * plainly optional: leaving them empty is normal, and a category with only
 * Portuguese is still browsable in Dutch because the server falls back.
 *
 * One image for every language, which is the answer to "different images per
 * language?": a photograph of a kitchen means the same thing in all eight.
 *
 * The mockup's description, highlight colour, order and subcategories are
 * not here: the save takes no colour and has no subcategories, the order is
 * the list's drag, and the description is not part of what this form sends.
 * The code stands where the mockup has its slug — it is the category's
 * address.
 *
 * Mounted afresh (by `key`) for every new or edited category, so yesterday's
 * half-typed category does not appear inside today's.
 */
export function CategoryForm({
  editing,
  headingId,
  onDone,
}: {
  /** Null creates. */
  editing: AdminCategory | null;
  /** The panel's name: the id this form's heading carries. */
  headingId: string;
  /** After a save, and on Cancel: the panel closes. */
  onDone: () => void;
}) {
  const { t } = useTranslation("admin");
  const save = useSaveCategory();
  const [form, setForm] = useState(() => (editing ? formFrom(editing) : emptyForm()));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Kept until unmount rather than revoked on load: the rendered <img> is a
  // different element pointing at the same URL, and revoking early leaves it
  // blank.
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const ready = canSave(form.names) && !save.isPending && !uploading;
  const Icon = categoryIcon(form.icon.trim());
  const others = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

  async function pickImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      // The id is only a folder. Creating uses a placeholder, so a brand-new
      // category can carry an image without being saved first.
      const { key, url } = await uploadCategoryImage(editing?.id ?? "new", file);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      // The server returns a null URL where nothing serves the bucket, which
      // is the case locally — the local preview stands in so the person can
      // still see what they picked.
      setForm((f) => ({ ...f, imageKey: key, imageUrl: url ?? objectUrl.current }));
    } catch (e) {
      setError(t(`categoryUploadError.${(e as Error).message}`, { defaultValue: t("categoryUploadFailed") }));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    try {
      await save.mutateAsync({
        ...(editing ? { categoryId: editing.id } : {}),
        ...(editing || form.code.trim() ? { code: form.code.trim() } : {}),
        icon: form.icon.trim() || null,
        imageKey: form.imageKey,
        isActive: form.isActive,
        // Every language, including the blank ones. The server drops them, and
        // sending them is what makes clearing a translation expressible — a
        // filtered list could only ever add.
        translations: LOCALES.map((l) => ({ locale: l, name: form.names[l] })),
      });
      onDone();
    } catch (e) {
      // The server's code, not its English sentence: the message belongs in
      // the reader's language and the code is the contract that gets it there.
      const code = (e as { code?: string }).code ?? (e as Error).message;
      setError(t(`categoryError.${code}`, { defaultValue: t("categorySaveFailed") }));
    }
  }

  return (
    <section aria-labelledby={headingId} className="min-w-0 bg-[var(--color-card)] px-4 pt-5 pb-6 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <h2 id={headingId} className="m-0 text-[19px] font-bold text-[var(--color-headline)]">
          {editing ? t("categoriesPage.editTitle") : t("categoriesPage.createTitle")}
        </h2>
        <button
          type="button"
          onClick={onDone}
          aria-label={t("provider:close")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 mb-0 text-[14.5px] text-[var(--color-faint)]">
        {editing ? t("categoriesPage.editLead") : t("categoriesPage.createLead")}
      </p>

      {error && <p className="type-body mt-4 mb-0 text-[var(--color-destructive)]">{error}</p>}

      <div className="mt-[22px] grid gap-x-4 gap-y-[22px] sm:grid-cols-2">
        <Field id={`name-${DEFAULT_LOCALE}`} label={t("categoriesPage.name")} required>
          <Input
            id={`name-${DEFAULT_LOCALE}`}
            value={form.names[DEFAULT_LOCALE]}
            onChange={(e) =>
              setForm((f) => ({ ...f, names: { ...f.names, [DEFAULT_LOCALE]: e.target.value } }))
            }
            placeholder={t("categoryNamePlaceholder")}
            className={FIELD}
          />
        </Field>

        <Field id="category-code" label={t("categoryCode")} hint={t("categoryCodeHint")}>
          <div className="relative">
            <Link2 className="pointer-events-none absolute top-1/2 left-3.5 h-[17px] w-[17px] -translate-y-1/2 text-[var(--color-primary)]" />
            <Input
              id="category-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder={editing ? "" : t("categoryCodeAuto")}
              className={cn(FIELD, "pl-10")}
            />
          </div>
        </Field>

        <Field id="category-icon" label={t("categoryIcon")} hint={t("categoryIconHint")}>
          <div className="flex items-start gap-[18px]">
            <span className="grid h-[58px] w-[60px] shrink-0 place-items-center rounded-[9px] bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
              <Icon aria-hidden="true" className="h-[26px] w-[26px]" strokeWidth={2} />
            </span>
            <Input
              id="category-icon"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="wrench"
              className={FIELD}
            />
          </div>
        </Field>

        <Field id="category-image" label={t("categoryImage")} hint={t("categoryImageHint")}>
          <div className="flex items-start gap-[18px]">
            <span className="grid h-[58px] w-[78px] shrink-0 place-items-center overflow-hidden rounded-[9px] border border-[var(--color-border)] bg-[var(--color-muted)]">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus aria-hidden="true" className="h-5 w-5 text-[var(--color-muted-foreground)]" />
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                id="category-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void pickImage(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-[var(--color-blue-line)] px-4 text-[14.5px] font-medium whitespace-nowrap text-[var(--color-primary)] hover:bg-[var(--color-blue-soft)] disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {form.imageUrl ? t("categoryImageReplace") : t("categoryImageAdd")}
              </button>
              {form.imageKey && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10"
                  onClick={() => setForm((f) => ({ ...f, imageKey: null, imageUrl: null }))}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("categoryImageRemove")}
                </Button>
              )}
            </div>
          </div>
        </Field>

        <div className="sm:col-span-2">
          <Field id="category-state" label={t("categoriesPage.stateLabel")} hint={t("categoriesPage.stateHint")}>
            <Select
              id="category-state"
              value={form.isActive ? "active" : "hidden"}
              onChange={(value) => setForm((f) => ({ ...f, isActive: value === "active" }))}
              ariaLabel={t("categoriesPage.stateLabel")}
              triggerClassName={cn(PICKER_CLASS, "h-11")}
              options={[
                { value: "active", label: t("categoriesPage.active"), adornment: <Dot className="bg-[var(--color-success)]" /> },
                { value: "hidden", label: t("categoriesPage.inactive"), adornment: <Dot className="bg-[var(--color-destructive)]" /> },
              ]}
            />
          </Field>
        </div>

        {/* The other seven, plainly optional. */}
        <div className="grid gap-3 sm:col-span-2">
          <span className="text-[14.5px] font-semibold text-[var(--color-headline)]">
            {t("categoriesPage.otherNames")}{" "}
            <small className="text-sm font-normal text-[var(--color-faint)]">({t("categoriesPage.optional")})</small>
          </span>
          <span className="-mt-1.5 text-[13px] leading-[1.45] text-[var(--color-faint)]">{t("categoryNamesHint")}</span>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {others.map((locale) => (
              <div key={locale} className="grid gap-1.5">
                <label htmlFor={`name-${locale}`} className="text-[13px] text-[var(--color-muted-foreground)]">
                  {t(`locales.${locale}`, { defaultValue: locale })}
                </label>
                <Input
                  id={`name-${locale}`}
                  value={form.names[locale]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, names: { ...f.names, [locale]: e.target.value } }))
                  }
                  placeholder={form.names[DEFAULT_LOCALE] || ""}
                  className={FIELD}
                />
              </div>
            ))}
          </div>
        </div>

        {/* What a customer will see, from what is typed above. */}
        <div className="rounded-[10px] bg-[var(--color-blue-softer)] p-4 sm:col-span-2">
          <b className="block text-[15.5px] font-bold text-[var(--color-headline)]">{t("categoriesPage.preview")}</b>
          <span className="mt-1 block text-sm text-[var(--color-faint)]">{t("categoriesPage.previewLead")}</span>
          <div className="mt-3.5 flex items-center gap-[22px] rounded-[9px] border border-[var(--color-border)] bg-[var(--color-card)] py-2 pr-[18px] pl-2.5">
            <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[9px] bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
              <Icon aria-hidden="true" className="h-[26px] w-[26px]" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <b className="block truncate text-[15.5px] font-bold text-[var(--color-headline)]">
                {form.names[DEFAULT_LOCALE].trim() || t("categoryNamePlaceholder")}
              </b>
              <span className="mt-1 block truncate text-sm text-[var(--color-faint)]">
                {form.code.trim() || t("categoryCodeAuto")}
              </span>
            </div>
            <ChevronRight aria-hidden="true" className="ml-auto h-[18px] w-[18px] shrink-0 text-[var(--color-headline)]" />
          </div>
        </div>
      </div>

      <div className="mt-[26px] grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <Button type="button" variant="outline" className="h-[46px] rounded-lg text-[15.5px]" onClick={onDone}>
          {t("categoriesPage.cancel")}
        </Button>
        <Button type="button" disabled={!ready} className="h-[46px] gap-3.5 rounded-lg text-[15.5px] font-semibold" onClick={() => void submit()}>
          {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {t("categoriesPage.save")}
        </Button>
      </div>
    </section>
  );
}

const FIELD = "h-11 rounded-[7px] text-[14.5px] placeholder:text-[var(--color-faint)]";

/**
 * The mockup's picker field. `Select`'s `triggerClassName` replaces its own
 * classes, so the whole field is spelled here; the caller adds the height.
 */
export const PICKER_CLASS =
  "flex w-full items-center gap-3 rounded-[7px] border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 text-left text-[14.5px] text-[var(--color-headline)] transition-colors hover:border-[var(--color-blue-line)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("block h-3.5 w-3.5 rounded-full", className)} />;
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("admin");
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-[14.5px] font-semibold text-[var(--color-headline)]">
        {label}
        {required && (
          <em className="ml-1 text-[var(--color-destructive)] not-italic" title={t("categoryRequired")}>
            *
          </em>
        )}
      </label>
      {children}
      {hint && <span className="text-[13px] leading-[1.45] text-[var(--color-faint)]">{hint}</span>}
    </div>
  );
}
