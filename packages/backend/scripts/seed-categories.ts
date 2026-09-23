/**
 * Seeds the eight categories the landing page already shows.
 *
 * They used to exist as translation keys in the web app's `landing` namespace,
 * which works only for a list developers ship. The whole point of the admin
 * form is that somebody who is not a developer can add the ninth — so the
 * eight have to move into the database.
 *
 * The names are written out here rather than read from those files. This
 * script first read `landing.json`'s `cat` keys, and the home refresh
 * (`8bf2216f`) removed them once the database held the categories — after
 * which a run on a fresh database created eight categories with no name in any
 * language and reported success. The table below is what dev's database held
 * when that was found, so every stage starts from the same words.
 *
 * Idempotent by `code`: a category already there keeps its row and its
 * translations. Run it twice and the second run changes nothing, which is what
 * makes it safe to put in front of a deploy.
 *
 *   bun run --env-file=.env scripts/seed-categories.ts            # dry run
 *   bun run --env-file=.env scripts/seed-categories.ts --apply
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import postgres from "postgres";
import { LOCALES } from "@ntizo/shared";
import {
  category,
  categoryTranslation,
} from "../src/modules/ntizo/shared/infrastructure/database/catalog/schemas";

const apply = process.argv.includes("--apply");

/** Same stage selection the cities seed and the slug backfill use. */
function stageUrl(): string {
  const stage = (process.env["STAGE"] ?? "dev").toLowerCase();
  const key = { dev: "DEV_DB_URL", qa: "QA_DB_URL", prod: "PROD_DB_URL" }[stage];
  if (!key) throw new Error(`Unknown STAGE "${stage}" — expected dev, qa or prod.`);
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Seeding ${stage} needs it.`);
  return value;
}

/**
 * The order they appear on the home page, which is a layout rather than an
 * index — sorting them alphabetically would reshuffle the whole grid every
 * time somebody switched language.
 */
const CODES = [
  "plumbing",
  "electrical",
  "cleaning",
  "mechanic",
  "cooking",
  "delivery",
  "building",
  "driving",
] as const;

const NAMES: Record<(typeof CODES)[number], Record<string, string>> = {
  plumbing: { "de-DE": "Sanitär", "en-US": "Plumbing", "es-ES": "Fontanería", "fr-FR": "Plomberie", "it-IT": "Idraulica", "nl-NL": "Loodgieterswerk", "pt-MZ": "Canalização", "pt-PT": "Canalização" },
  electrical: { "de-DE": "Elektrik", "en-US": "Electrical", "es-ES": "Electricidad", "fr-FR": "Électricité", "it-IT": "Elettricità", "nl-NL": "Elektra", "pt-MZ": "Electricidade", "pt-PT": "Electricidade" },
  cleaning: { "de-DE": "Hausreinigung", "en-US": "House cleaning", "es-ES": "Limpieza del hogar", "fr-FR": "Ménage", "it-IT": "Pulizie domestiche", "nl-NL": "Huisschoonmaak", "pt-MZ": "Limpeza de casa", "pt-PT": "Limpeza de casa" },
  mechanic: { "de-DE": "Kfz-Werkstatt", "en-US": "Mechanic", "es-ES": "Mecánico", "fr-FR": "Mécanicien", "it-IT": "Meccanico", "nl-NL": "Automonteur", "pt-MZ": "Mecânico", "pt-PT": "Mecânico" },
  cooking: { "de-DE": "Koch", "en-US": "Cook", "es-ES": "Cocinero", "fr-FR": "Cuisinier", "it-IT": "Cuoco", "nl-NL": "Kok", "pt-MZ": "Cozinheiro", "pt-PT": "Cozinheiro" },
  delivery: { "de-DE": "Lieferungen", "en-US": "Delivery", "es-ES": "Entregas", "fr-FR": "Livraisons", "it-IT": "Consegne", "nl-NL": "Bezorging", "pt-MZ": "Entregas", "pt-PT": "Entregas" },
  building: { "de-DE": "Maurer", "en-US": "Builder", "es-ES": "Albañil", "fr-FR": "Maçon", "it-IT": "Muratore", "nl-NL": "Metselaar", "pt-MZ": "Pedreiro", "pt-PT": "Pedreiro" },
  driving: { "de-DE": "Fahrer", "en-US": "Drivers", "es-ES": "Conductores", "fr-FR": "Chauffeurs", "it-IT": "Autisti", "nl-NL": "Chauffeurs", "pt-MZ": "Motoristas", "pt-PT": "Motoristas" },
};

async function main(): Promise<void> {
  const sql = postgres(stageUrl(), { max: 1 });
  const db = drizzle(sql);

  const existing = await db
    .select({ code: category.code })
    .from(category)
    .where(inArray(category.code, [...CODES]));
  const have = new Set(existing.map((r) => r.code));

  // A locale added to the platform without a name here would ship a category
  // that reads as its code on that language's pages. Refuse before writing
  // anything, rather than half-seed and say it worked.
  const missing = CODES.flatMap((code) =>
    LOCALES.filter((l) => !NAMES[code][l]?.trim()).map((l) => `${code}/${l}`),
  );
  if (missing.length > 0) {
    throw new Error(`Faltam nomes para: ${missing.join(", ")}`);
  }

  let created = 0;
  for (const [i, code] of CODES.entries()) {
    if (have.has(code)) {
      console.log(`  = ${code} (já existe)`);
      continue;
    }
    const translations = LOCALES.map((locale) => ({ locale, name: NAMES[code][locale]!.trim() }));
    console.log(
      `  ${apply ? "+" : "?"} ${code} — ${translations.length}/${LOCALES.length} idiomas`,
    );
    if (!apply) continue;

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(category)
        .values({ code, sortOrder: i, isActive: true })
        .returning({ id: category.id });
      await tx.insert(categoryTranslation).values(
        translations.map((t) => ({
          categoryId: row!.id,
          locale: t.locale,
          name: t.name,
          description: null,
        })),
      );
    });
    created += 1;
  }

  console.log(
    apply
      ? `\n  ${created} categorias criadas.`
      : `\n  Simulação. Corra com --apply para escrever.`,
  );
  await sql.end();
  process.exit(0);
}

void main();
