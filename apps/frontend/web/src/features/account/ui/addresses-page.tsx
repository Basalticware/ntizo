import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";
import type { AddressDTO } from "@ntizo/shared";
import { Badge, Button, cn, countryName } from "@ntizo/frontend-ui";
import { AddressForm } from "@/features/account/ui/address-form";
import { CUSTOMER_CARD, CardHead } from "@/features/account/ui/customer-page";
import {
  useAddressMutations,
  useMyAddresses,
} from "@/features/account/viewmodel/use-addresses";
import { EmptyCard } from "@/shared/components/empty-card";

/**
 * A row's text action: the words in the brand blue, an underline on hover.
 * Three per row is too many outlined buttons for a line of text, so they
 * stay words — and the one that removes the row is the red one.
 */
function rowAction(destructive = false): string {
  return cn(
    "inline-flex items-center rounded-[6px] text-[14.5px] font-semibold underline-offset-[5px] hover:underline",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2",
    "disabled:cursor-default disabled:opacity-60 disabled:hover:no-underline",
    destructive
      ? "text-[var(--color-destructive)]"
      : "text-[var(--color-primary)]",
  );
}

/**
 * One address, on a row divider.
 *
 * The pin on the soft blue ground, the label with "default" as a badge beside
 * it, the address on one line, and the actions as words at the row's end —
 * under it on a phone.
 */
function AddressRow({
  address,
  onEdit,
  onDelete,
  onMakeDefault,
  busy,
}: {
  address: AddressDTO;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation("account");
  const lines = [
    address.line1,
    address.line2,
    [address.district, address.city].filter(Boolean).join(", "),
    // Named by the platform, not by a `country.MZ` translation key. The picker
    // offers every country there is, so a key-per-country table would need 245
    // entries in each of the eight languages to stop this line reading "JP".
    countryName(address.country, i18n.resolvedLanguage ?? i18n.language),
  ].filter(Boolean);

  return (
    <li className="grid grid-cols-[42px_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-[var(--color-line-2)] py-[18px] first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-start">
      <span
        aria-hidden="true"
        className="grid h-[42px] w-[42px] place-items-center rounded-[10px] bg-[var(--color-blue-soft)] text-[var(--color-primary)]"
      >
        <MapPin className="h-5 w-5" />
      </span>

      <div className="min-w-0 pt-px">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-base font-bold text-[var(--color-headline)]">
            {address.label}
          </span>
          {address.isDefault && <Badge tone="info">{t("addrDefault")}</Badge>}
        </div>
        <p className="m-0 mt-1 text-[15px] text-[var(--color-muted-foreground)]">
          {lines.join(" · ")}
        </p>
        {address.directions && (
          <p className="m-0 mt-1 text-sm text-[var(--color-muted-foreground)]">
            {address.directions}
          </p>
        )}
      </div>

      {/* Second column on a phone, its own column from `sm`. */}
      <div className="col-start-2 flex flex-wrap items-center gap-x-5 gap-y-1 sm:col-start-3 sm:pt-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className={rowAction()}
        >
          {t("edit")}
        </button>
        {!address.isDefault && (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={busy}
            className={rowAction()}
          >
            {t("addrMakeDefault")}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={rowAction(true)}
        >
          {t("delete")}
        </button>
      </div>
    </li>
  );
}

export function AddressesPage() {
  const { t } = useTranslation("account");
  const { data: addresses = [], isPending } = useMyAddresses();
  const { add, update, remove } = useAddressMutations();
  const [editing, setEditing] = useState<AddressDTO | "new" | null>(null);

  const busy = add.isPending || update.isPending || remove.isPending;

  return (
    <section className={CUSTOMER_CARD}>
      <CardHead
        icon={MapPin}
        title={t("navAddresses")}
        hint={t("addressesBlurb")}
        aside={
          // The page's one filled button: adding is what the page is for.
          editing === null ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus />
              {t("addrAdd")}
            </Button>
          ) : null
        }
      />

      {editing !== null && (
        <div className="mt-5">
          <AddressForm
            ariaLabel={editing === "new" ? t("addrAdd") : t("addrEditTitle")}
            initial={editing === "new" ? undefined : editing}
            submitting={busy}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing === "new") await add.mutateAsync(values);
              else await update.mutateAsync({ id: editing.id, input: values });
              toast.success(t("saved"));
              setEditing(null);
            }}
          />
        </div>
      )}

      {isPending ? null : addresses.length === 0 && editing === null ? (
        <div className="mt-5">
          <EmptyCard
            badge={MapPin}
            title={t("addressesEmptyTitle")}
            body={t("addressesEmptyBody")}
          />
        </div>
      ) : addresses.length > 0 ? (
        <ul className="m-0 mt-5 grid list-none border-t border-[var(--color-line-2)] p-0 pt-[18px]">
          {addresses.map((address) => (
            <AddressRow
              key={address.id}
              address={address}
              busy={busy}
              onEdit={() => setEditing(address)}
              onMakeDefault={() =>
                void update
                  .mutateAsync({ id: address.id, input: { isDefault: true } })
                  .then(() => toast.success(t("saved")))
              }
              onDelete={() =>
                void remove
                  .mutateAsync(address.id)
                  .then(() => toast.success(t("addrDeleted")))
              }
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
