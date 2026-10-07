/**
 * Fills a development database with a marketplace that looks like one.
 *
 * The dev data had grown into `Catalog Sweep Test Provider A`, `teste`, four
 * categories named after UUIDs and not a single review — which is fine for the
 * suites that created it and useless for judging a design. Every screen that
 * shows a card, a rating, an icon or a price was being reviewed against
 * placeholder text, and the placeholders were what kept looking wrong.
 *
 * **Dev and QA only, and it says so.** It refuses `prod`, because it writes
 * fictional businesses and fictional verdicts about them, and neither belongs
 * anywhere a customer can read it. QA is where testers judge the same screens
 * dev's designers do, and an empty directory there tests nothing.
 *
 * Idempotent by slug and by email: a second run updates what it made before
 * rather than adding a parallel set. On dev, the test rows it finds are
 * deactivated, not deleted — the suites that created them may still be
 * asserting they exist, and a directory only lists `active` providers, so hiding
 * them is enough. On QA it hides nothing: every other business there belongs to
 * a real tester.
 *
 *   bun run --env-file=.env scripts/seed-demo.ts            # dry run
 *   export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"   # wrangler needs Node 22
 *   bun run --env-file=.env scripts/seed-demo.ts --apply
 *
 *   STAGE=qa bun run --env-file=.env scripts/seed-categories.ts --apply   # a fresh database has none
 *   STAGE=qa bun run --env-file=.env scripts/seed-demo.ts --apply
 *
 *   bun run --env-file=.env scripts/seed-demo.ts --photos-only            # dry run
 *   bun run --env-file=.env scripts/seed-demo.ts --photos-only --apply
 *
 * `--photos-only` uploads the photographs and points the image columns at them
 * — category covers, each demo service's `imageKeys`, each demo business's
 * `photoKeys` — re-uploads the generated marks, and touches nothing else. A
 * full run replaces a demo business's
 * services wholesale, and a service carries its bookings with it on delete; on
 * QA a tester may well have booked one since the last seed.
 *
 * The photographs are stock, from Pexels and Unsplash, checked into
 * `scripts/demo-photos/` with their provenance in its `CREDITS.md` — a seed
 * that fetched them at run time would work until the network was down or a
 * photo was taken down. A design reviewed against generated colour washes kept
 * being judged on the washes; cards, galleries and the category band read
 * differently with a person in the frame. Logos stay generated monograms: a
 * photograph is not a mark.
 */
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import postgres from "postgres";
import {
  category,
  categoryTranslation,
  service,
  serviceMember,
  serviceOption,
  serviceTranslation,
} from "../src/modules/ntizo/shared/infrastructure/database/catalog/schemas";
import { memberAvailability } from "../src/modules/ntizo/shared/infrastructure/database/scheduling/schemas";
import { emailSuppression } from "../src/modules/ntizo/shared/infrastructure/database/notification/schemas";
import {
  provider,
  providerDocument,
  providerMember,
} from "../src/modules/ntizo/shared/infrastructure/database/provider/schemas";
import { review } from "../src/modules/ntizo/shared/infrastructure/database/review/schemas";
import { profile, user } from "../src/modules/ntizo/shared/infrastructure/database/user/schemas";

const apply = process.argv.includes("--apply");
const photosOnly = process.argv.includes("--photos-only");

type Stage = "dev" | "qa";

/** Same stage selection the cities seed and the slug backfill use, minus prod. */
function readStage(): Stage {
  const stage = (process.env["STAGE"] ?? "dev").toLowerCase();
  if (stage !== "dev" && stage !== "qa") {
    throw new Error(
      `Refusing to run against "${stage}". This seed writes fictional businesses and fictional reviews of them; only dev and qa may hold either.`,
    );
  }
  return stage;
}

const STAGE = readStage();

function stageUrl(): string {
  const key = STAGE === "dev" ? "DEV_DB_URL" : "QA_DB_URL";
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Seeding ${STAGE} needs it.`);
  return value;
}

/* ── the categories, given the icons the band was built to draw ──────────── */

/**
 * A Lucide name per category.
 *
 * `category.icon` exists for exactly this and every row had it null, so the
 * band drew the same fallback tag eleven times — eleven controls that looked
 * identical in a component whose whole job is to be scannable.
 */
const CATEGORY_ICONS: Record<string, string> = {
  beauty: "Scissors",
  plumbing: "Wrench",
  electrical: "Zap",
  cleaning: "SprayCan",
  mechanic: "Car",
  cooking: "ChefHat",
  delivery: "Truck",
  building: "HardHat",
  driving: "CarFront",
  "aulas-de-musica": "Music",
  "jardinagem-e-piscinas": "Trees",
};

/**
 * Names for a category this platform did not have.
 *
 * `beauty` is added rather than assumed: a hair salon and a manicure were sitting
 * under "Limpeza de casa" for want of anywhere honest to put them, and a filter
 * that returns a barber when a customer asks for house cleaning is worse than
 * one trade missing. Every locale the platform speaks, because a category with
 * no name in the reader's language falls back to its code, and `beauty` on a
 * Portuguese page is not a category name.
 *
 * `aulas-de-musica` and `jardinagem-e-piscinas` were added on dev through the
 * admin form, so they live in dev's database and nowhere in code — a fresh
 * database such as QA's does not have them, and two demo businesses file their
 * services there. The names dev's admin typed are kept as typed; the locales it
 * left blank are filled in. Listed before `beauty` so they take the same places
 * in the band they hold on dev.
 */
const NEW_CATEGORIES: Record<string, Record<string, string>> = {
  "aulas-de-musica": {
    "en-US": "Music Lessons",
    "pt-MZ": "Aulas de Música",
    "pt-PT": "Aulas de Música",
    "es-ES": "Clases de música",
    "fr-FR": "Cours de musique",
    "de-DE": "Musikunterricht",
    "it-IT": "Lezioni di musica",
    "nl-NL": "Muziekles",
  },
  "jardinagem-e-piscinas": {
    "en-US": "Gardening & Pools",
    "pt-MZ": "Jardinagem e Piscinas",
    "pt-PT": "Jardinagem e Piscinas",
    "es-ES": "Jardinería y piscinas",
    "fr-FR": "Jardinage et piscines",
    "de-DE": "Garten & Pools",
    "it-IT": "Giardinaggio e piscine",
    "nl-NL": "Tuin & zwembad",
  },
  beauty: {
    "en-US": "Beauty & hair",
    "pt-MZ": "Beleza e cabelo",
    "pt-PT": "Beleza e cabelo",
    "es-ES": "Belleza y peluquería",
    "fr-FR": "Beauté et coiffure",
    "de-DE": "Beauty & Haare",
    "it-IT": "Bellezza e capelli",
    "nl-NL": "Beauty & haar",
  },
};

/** Two brand-adjacent stops per category, so a grid of marks reads as a grid of different trades. */
const CATEGORY_COLOURS: Record<string, [string, string]> = {
  beauty: ["#e64980", "#f06595"],
  plumbing: ["#006ffd", "#00c2d7"],
  electrical: ["#ffb020", "#ff7a45"],
  cleaning: ["#21b872", "#0fb5c9"],
  mechanic: ["#4a4f57", "#8b93a1"],
  cooking: ["#ee4040", "#ff8a5c"],
  delivery: ["#7048e8", "#4c6ef5"],
  building: ["#f08c00", "#e8590c"],
  driving: ["#1098ad", "#0c8599"],
  "aulas-de-musica": ["#ae3ec9", "#7048e8"],
  "jardinagem-e-piscinas": ["#2f9e44", "#66a80f"],
};

/** A business's mark: its initials on a tinted square, in its own trade's hue. */
function logoSvg(initials: string, code: string): string {
  const [from, to] = CATEGORY_COLOURS[code] ?? ["#006ffd", "#00c2d7"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="34" fill="url(#g)"/>
  <text x="80" y="80" fill="#ffffff" font-family="Figtree, sans-serif"
        font-size="62" font-weight="600" text-anchor="middle"
        dominant-baseline="central">${initials}</text>
</svg>`;
}

/* ── the photographs ─────────────────────────────────────────────────────── */

/**
 * Where the checked-in JPEGs live, laid out as their keys are: a file at
 * `demo-photos/service/x.jpg` is uploaded as `demo/service/x.jpg`.
 */
const PHOTO_DIR = new URL("./demo-photos/", import.meta.url).pathname;

function coverKey(code: string): string {
  return `demo/category/${code}.jpg`;
}

/**
 * One photograph per service, keyed by the business and the service's name.
 *
 * Its own photograph rather than its category's cover, which is what every
 * service used to get: two services of one business in the same category were
 * the same picture side by side, and a grid of beauty services was a grid of
 * one image.
 */
function serviceKey(p: DemoProvider, s: DemoService): string {
  return `demo/service/${p.slug}-${slugifyName(s.name)}.jpg`;
}

function portfolioKeys(p: DemoProvider): string[] {
  return Array.from({ length: p.photos }, (_, i) => `demo/portfolio/${p.slug}-${i + 1}.jpg`);
}

/** The file a photo key is uploaded from, refusing one that was never checked in. */
async function photoFile(key: string): Promise<string> {
  const file = PHOTO_DIR + key.replace(/^demo\//, "");
  if (!(await Bun.file(file).exists())) {
    throw new Error(`No photograph for ${key} — expected ${file}. See demo-photos/CREDITS.md.`);
  }
  return file;
}

/* ── the businesses ──────────────────────────────────────────────────────── */

interface DemoService {
  name: string;
  description: string;
  category: string;
  /** Minor units. `null` prices the service by quote instead. */
  amountMinor: number | null;
  durationMinutes: number;
  locationType: "at_customer" | "at_provider" | "remote" | "flexible";
}

/**
 * The week a demo business works, in minutes from local midnight.
 *
 * `weekday` is 0 = Sunday, matching `Date#getUTCDay` and the column's own
 * check constraint. Nobody opens on Sunday and everybody closes early on
 * Saturday, which is what Maputo actually looks like and, more usefully here,
 * means the date strip has to render a closed day, a short day and a full one
 * rather than seven identical columns.
 *
 * `slotIntervalMinutes` is 30 for everyone, including the caterer whose real
 * business is an order rather than a 30-minute appointment. The column has a
 * documented third state — `0`, meaning "open, no grid" — and seeding it was
 * tried and reverted: the engine correctly returns no discrete starts for such
 * a window, and the time grid has no way to draw one, so it renders "no times
 * free this day" for a business that is open all week. A demo provider
 * indistinguishable from a broken one is worse than an unexercised branch.
 * The gap is the UI's, not the seed's, and it is recorded in follow-ups.
 *
 * `capacity` stays null, which the column reads as 1. Concurrency in this
 * product comes from an organization having several members with their own
 * calendars, not from one calendar holding several bookings — seeding a
 * capacity would fake the first with the second and hide whether the member
 * picker works.
 */
/** A person's name as an email local part: "Célia Nhaca" -> "celia-nhaca". */
function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const WEEK: { weekday: number; startMinute: number; endMinute: number }[] = [
  { weekday: 1, startMinute: 8 * 60, endMinute: 17 * 60 },
  { weekday: 2, startMinute: 8 * 60, endMinute: 17 * 60 },
  { weekday: 3, startMinute: 8 * 60, endMinute: 17 * 60 },
  { weekday: 4, startMinute: 8 * 60, endMinute: 17 * 60 },
  { weekday: 5, startMinute: 8 * 60, endMinute: 17 * 60 },
  { weekday: 6, startMinute: 8 * 60, endMinute: 13 * 60 },
];

interface DemoProvider {
  slug: string;
  name: string;
  type: "individual" | "organization";
  city: string;
  district: string | null;
  description: string;
  /**
   * The people who actually perform this business's services, besides the
   * owner. Empty for an individual, who is the only person there.
   *
   * They exist so the availability picker has something to pick between: it
   * hides itself below two performers, so an organization with one member
   * leaves the feature invisible and untestable. Real names, because the card
   * publishes a first name and "Profissional 2" is what it publishes when a
   * profile has none.
   */
  staff?: string[];
  /** Whether an administrator has accepted a document — drives the verified badge. */
  verified: boolean;
  /** Whether to give it a generated mark, so both card states appear in the grid. */
  logo: boolean;
  /**
   * How many portfolio photographs to generate.
   *
   * Varied on purpose, `0` included: the gallery has to read as finished for a
   * business with none, and has to fold the overflow into a count for one with
   * more than fits.
   */
  photos: number;
  services: DemoService[];
  /** Ratings left by other demo customers. Empty means a business nobody has reviewed yet. */
  ratings: number[];
}

const PROVIDERS: DemoProvider[] = [
  {
    slug: "estudio-mavalane", photos: 7, name: "Estúdio Mavalane", type: "organization",
    city: "Maputo", district: "Polana",
    description: "Salão de cabelo e barbearia com quatro profissionais. Marcação ao minuto, sem filas.",
    staff: ["Ana Sitoe", "Bruno Chirindza", "Célia Nhaca", "Dino Mabjaia"],
    verified: true, logo: true, ratings: [5, 5, 4, 5, 4, 5],
    services: [
      { name: "Corte de cabelo", description: "Corte, lavagem e acabamento.", category: "beauty", amountMinor: 80000, durationMinutes: 45, locationType: "at_provider" },
      { name: "Barba completa", description: "Aparo, toalha quente e óleo.", category: "beauty", amountMinor: 45000, durationMinutes: 30, locationType: "at_provider" },
    ],
  },
  {
    slug: "helder-cossa-electricidade", photos: 3, name: "Hélder Cossa", type: "individual",
    city: "Maputo", district: "Sommerschield",
    description: "Electricista certificado. Instalações, quadros e avarias urgentes ao domicílio.",
    verified: true, logo: false, ratings: [5, 4, 5, 5],
    services: [
      { name: "Avaria eléctrica urgente", description: "Diagnóstico e reparação no próprio dia.", category: "electrical", amountMinor: 120000, durationMinutes: 60, locationType: "at_customer" },
      { name: "Instalação de quadro eléctrico", description: "Quadro novo, com certificado.", category: "electrical", amountMinor: 450000, durationMinutes: 240, locationType: "at_customer" },
    ],
  },
  {
    slug: "canalizacoes-zimpeto", photos: 5, name: "Canalizações Zimpeto", type: "organization",
    city: "Maputo", district: "Zimpeto",
    description: "Fugas, desentupimentos e instalação de canalização. Atendimento em 24 horas.",
    staff: ["Faustino Cuna", "Gito Mucavele"],
    verified: true, logo: true, ratings: [4, 4, 5, 3, 4],
    services: [
      { name: "Desentupimento", description: "Máquina própria, sem partir azulejo.", category: "plumbing", amountMinor: 180000, durationMinutes: 90, locationType: "at_customer" },
      { name: "Reparação de fuga", description: "Localização e reparação.", category: "plumbing", amountMinor: 150000, durationMinutes: 60, locationType: "at_customer" },
    ],
  },
  {
    slug: "casa-limpa-matola", photos: 0, name: "Casa Limpa Matola", type: "organization",
    city: "Matola", district: "Machava",
    description: "Limpeza doméstica e de escritórios, avulsa ou por contrato mensal.",
    staff: ["Helena Zandamela", "Isaura Tembe", "Judite Nhantumbo"],
    verified: false, logo: true, ratings: [4, 5, 4, 4, 5, 4, 4],
    services: [
      { name: "Limpeza profunda", description: "Casa inteira, produtos incluídos.", category: "cleaning", amountMinor: 250000, durationMinutes: 240, locationType: "at_customer" },
      { name: "Limpeza de escritório", description: "Fora do horário de expediente.", category: "cleaning", amountMinor: 150000, durationMinutes: 120, locationType: "at_customer" },
    ],
  },
  {
    slug: "nelia-machava-unhas", photos: 4, name: "Nélia Machava", type: "individual",
    city: "Maputo", district: "Alto Maé",
    description: "Manicure e pedicure ao domicílio, com material esterilizado próprio.",
    verified: false, logo: false, ratings: [5, 5, 5],
    services: [
      { name: "Manicure ao domicílio", description: "Material esterilizado, levo tudo comigo.", category: "beauty", amountMinor: 60000, durationMinutes: 60, locationType: "at_customer" },
    ],
  },
  {
    slug: "auto-costa-do-sol", photos: 8, name: "Auto Costa do Sol", type: "organization",
    city: "Maputo", district: "Costa do Sol",
    description: "Mecânica geral, revisões e diagnóstico electrónico para ligeiros.",
    staff: ["Kito Maluleque", "Lázaro Bila", "Milton Guambe"],
    verified: true, logo: true, ratings: [4, 3, 4, 4],
    services: [
      { name: "Revisão completa", description: "Óleo, filtros e 30 pontos de verificação.", category: "mechanic", amountMinor: 300000, durationMinutes: 180, locationType: "at_provider" },
      { name: "Diagnóstico electrónico", description: "Leitura de erros e relatório.", category: "mechanic", amountMinor: 100000, durationMinutes: 45, locationType: "at_provider" },
    ],
  },
  {
    slug: "jardins-da-cidade", photos: 6, name: "Jardins da Cidade", type: "organization",
    city: "Maputo", district: "Sommerschield",
    description: "Manutenção de jardins, poda e sistemas de rega para casas e condomínios.",
    staff: ["Nelson Chissano", "Osvaldo Mondlane"],
    verified: false, logo: true, ratings: [5, 4, 4],
    services: [
      { name: "Manutenção mensal de jardim", description: "Corte, poda e limpeza, quatro visitas.", category: "jardinagem-e-piscinas", amountMinor: 200000, durationMinutes: 120, locationType: "at_customer" },
      { name: "Tratamento de piscina", description: "Análise, produtos e aspiração.", category: "jardinagem-e-piscinas", amountMinor: 120000, durationMinutes: 90, locationType: "at_customer" },
    ],
  },
  {
    slug: "ana-bila-explicacoes", photos: 0, name: "Ana Bila", type: "individual",
    city: "Beira", district: "Macuti",
    description: "Aulas de piano e teoria musical, do início ao 5.º grau. Online ou em casa.",
    verified: false, logo: false, ratings: [5, 5, 4, 5],
    services: [
      { name: "Aula de piano", description: "Uma hora, online ou em casa.", category: "aulas-de-musica", amountMinor: 50000, durationMinutes: 60, locationType: "flexible" },
    ],
  },
  {
    slug: "cozinha-da-vovo", photos: 2, name: "Cozinha da Vovó", type: "organization",
    city: "Nampula", district: null,
    description: "Catering para festas e almoços de empresa. Cozinha moçambicana e portuguesa.",
    staff: ["Paulina Macuácua", "Quitéria Sambo"],
    verified: false, logo: true, ratings: [4, 5],
    services: [
      { name: "Catering para 20 pessoas", description: "Entrada, prato e sobremesa.", category: "cooking", amountMinor: 900000, durationMinutes: 300, locationType: "at_customer" },
      { name: "Almoço de empresa", description: "Orçamento conforme o número de pessoas.", category: "cooking", amountMinor: null, durationMinutes: 120, locationType: "at_customer" },
    ],
  },
  {
    // The state the design has to hold: newly listed, nobody has been served
    // yet, so there is no score. A blank where the others have stars reads as a
    // bad one, which is the opposite of true.
    slug: "sergio-matola-pinturas", photos: 0, name: "Sérgio Matola", type: "individual",
    city: "Maputo", district: "Malhangalene",
    description: "Pintor e estucador. Interiores, exteriores e pequenas remodelações.",
    verified: false, logo: false, ratings: [],
    services: [
      { name: "Pintura de interiores", description: "Por divisão, tinta incluída.", category: "building", amountMinor: 220000, durationMinutes: 480, locationType: "at_customer" },
    ],
  },
];

/** The fictional customers whose verdicts the ratings above belong to. */
const REVIEWERS = [
  { email: "demo-cliente-1@ntizo.test", name: "Inês Muianga" },
  { email: "demo-cliente-2@ntizo.test", name: "Rui Chirindza" },
  { email: "demo-cliente-3@ntizo.test", name: "Paula Sitoe" },
  { email: "demo-cliente-4@ntizo.test", name: "Jorge Nhaca" },
  { email: "demo-cliente-5@ntizo.test", name: "Célia Banze" },
  { email: "demo-cliente-6@ntizo.test", name: "Tomás Guambe" },
  { email: "demo-cliente-7@ntizo.test", name: "Aida Cumbe" },
];

function ownerEmail(p: DemoProvider): string {
  return `demo-${p.slug}@ntizo.test`;
}

function staffEmail(p: DemoProvider, fullName: string): string {
  return `${slugifyName(fullName)}@${p.slug}.demo.ntizo.test`;
}

/**
 * Every address this seed invents, so none of them is ever written to.
 *
 * `.test` is reserved and never resolves, so a mail to one is a bounce — and a
 * tester booking a demo business on QA notifies its owner. Each bounce spends
 * the day's Resend quota the real sign-up mails need, and counts against the
 * sender's reputation. The delivery path already consults the suppression
 * list before it writes, so listing these addresses there stops the mail at
 * the source; the delivery is still recorded, as `suppressed`.
 */
const DEMO_EMAILS = [
  ...REVIEWERS.map((r) => r.email),
  ...PROVIDERS.map(ownerEmail),
  ...PROVIDERS.flatMap((p) => (p.staff ?? []).map((name) => staffEmail(p, name))),
];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0] ?? "")
    .join("")
    .toUpperCase();
}

/* ── media ───────────────────────────────────────────────────────────────── */

/**
 * Puts the generated SVGs in *both* buckets the seeded rows can be read
 * through.
 *
 * Shelling out to wrangler rather than using the R2 API: the local bucket is a
 * miniflare directory, not an S3 endpoint, and wrangler is the only thing that
 * knows where it is. The dev server picks the objects up without a restart —
 * verified by fetching one back through `/api/media` while it was running.
 *
 * **Both, and that is the whole point of this function.** It used to write only
 * `ntizo-media-local`, while `stageUrl()` above points every run at the shared
 * dev Neon database. So a seed wrote `logoKey`/`photoKeys` rows that the
 * deployed dev site would resolve against `ntizo-media-dev` — a bucket the
 * files had never been put in. Every demo photograph on dev.ntizo.co.mz was a
 * 404 for exactly that reason, and nothing said so: the rows were valid, the
 * URLs were well-formed, and only a browser fetching one found out.
 *
 * The two are not interchangeable because the same key resolves differently
 * per environment — locally through this Worker's own `GET /api/media/*`,
 * on dev through the bucket's public `r2.dev` host. Writing one and not the
 * other leaves whichever environment was missed showing the fallback mark
 * forever.
 *
 * QA gets only its own bucket. The local bucket is there for a local
 * `wrangler dev`, whose `.dev.vars` point it at dev's database — nothing local
 * ever reads QA's rows.
 */
const MEDIA_BUCKETS: Record<Stage, { bucket: string; local: boolean }[]> = {
  dev: [
    { bucket: "ntizo-media-local", local: true },
    { bucket: "ntizo-media-dev", local: false },
  ],
  qa: [{ bucket: "ntizo-media-qa", local: false }],
};

let mediaChecked = false;

/**
 * Wrangler refuses to start on Node 20, and the default `node` on a machine set
 * up for this project often is 20 — the API's own dev script carries the same
 * requirement. Checked once, before the first upload, so the failure names the
 * fix instead of surfacing as a wrangler banner in the middle of the seed.
 */
async function assertWranglerCanRun(): Promise<void> {
  if (mediaChecked) return;
  const proc = Bun.spawn(["node", "--version"], { stdout: "pipe", stderr: "ignore" });
  const version = (await new Response(proc.stdout).text()).trim();
  const major = Number(/^v(\d+)/.exec(version)?.[1] ?? 0);
  if (major < 22) {
    throw new Error(
      `wrangler needs Node 22 to write the media bucket; \`node\` here is ${version}.\n` +
        `  export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"\n` +
        `and run this again.`,
    );
  }
  mediaChecked = true;
}

async function putOneBucket(
  key: string,
  file: string,
  contentType: string,
  { bucket, local }: { bucket: string; local: boolean },
): Promise<void> {
  const placement =
    local
      ? ["--local", "--persist-to", ".wrangler/state"]
      : // `--remote` is not the default here: wrangler resolves an unqualified
        // put against the local simulation, which is the mistake that produced
        // the 404s this function's doc comment describes.
        ["--remote"];

  const proc = Bun.spawn(
    [
      "bunx", "wrangler", "r2", "object", "put", `${bucket}/${key}`,
      "--file", file, "--content-type", contentType,
      ...placement,
    ],
    { cwd: "../../apps/backend/api", stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(
      `wrangler put ${bucket}/${key} failed: ${await new Response(proc.stderr).text()}`,
    );
  }
}

async function putFile(key: string, file: string, contentType: string): Promise<void> {
  await assertWranglerCanRun();
  // The remote write needs Cloudflare credentials, which a machine that has
  // only ever run the local stack may not have. It still throws rather than
  // warning: a seed that half-succeeds is what shipped the broken images, and
  // an error naming the bucket is the cheapest possible way to find that out.
  for (const target of MEDIA_BUCKETS[STAGE]) await putOneBucket(key, file, contentType, target);
}

async function putMedia(key: string, svg: string): Promise<void> {
  const file = `/tmp/ntizo-seed-${key.replace(/[^a-z0-9]/gi, "-")}.svg`;
  await Bun.write(file, svg);
  await putFile(key, file, "image/svg+xml");
}

async function putPhoto(key: string): Promise<void> {
  await putFile(key, await photoFile(key), "image/jpeg");
}

/**
 * Whether a key resolves in this stage's deployed bucket.
 *
 * Asked only of a category image this seed did not put there. An admin's own
 * upload is kept; but dev's `mechanic` cover pointed at an object that was
 * never in the bucket, so the band drew a broken image for it, and keeping
 * that would be keeping a 404 out of politeness.
 */
async function objectExists(key: string): Promise<boolean> {
  await assertWranglerCanRun();
  const remote = MEDIA_BUCKETS[STAGE].find((b) => !b.local)!;
  const proc = Bun.spawn(
    ["bunx", "wrangler", "r2", "object", "get", `${remote.bucket}/${key}`, "--remote", "--pipe"],
    { cwd: "../../apps/backend/api", stdout: "ignore", stderr: "ignore" },
  );
  return (await proc.exited) === 0;
}

/* ── the run ─────────────────────────────────────────────────────────────── */

const sqlClient = postgres(stageUrl(), { ssl: "require", max: 4 });
const db = drizzle(sqlClient);

const DEMO_CODES = Object.keys(CATEGORY_ICONS);
const now = new Date();

/** Every photograph key the demo set uses, so a missing file fails before anything is written. */
function allPhotoKeys(): string[] {
  return [
    ...DEMO_CODES.map(coverKey),
    ...PROVIDERS.flatMap((p) => p.services.map((s) => serviceKey(p, s))),
    ...PROVIDERS.flatMap(portfolioKeys),
  ];
}

async function uploadPhotos(): Promise<void> {
  const keys = allPhotoKeys();
  for (const key of keys) await photoFile(key);
  console.log(
    `photos: ${keys.length} to upload to ${MEDIA_BUCKETS[STAGE].map((b) => b.bucket).join(" + ")}`,
  );
  if (!apply) return;
  for (const key of keys) await putPhoto(key);
}

/**
 * The generated marks, under the keys `logoKey` already holds.
 *
 * Part of `--photos-only` too, though it changes no row: dev's demo rows were
 * written while the seed still put media only in the local bucket, so every
 * mark on dev.ntizo.co.mz pointed at an object `ntizo-media-dev` never had.
 */
async function uploadMarks(): Promise<void> {
  const marked = PROVIDERS.filter((p) => p.logo);
  console.log(`marks: ${marked.length} to upload`);
  if (!apply) return;
  for (const p of marked) {
    await putMedia(
      `demo/logo/${p.slug}.svg`,
      logoSvg(initials(p.name), p.services[0]?.category ?? "plumbing"),
    );
  }
}

/**
 * Gives each demo category its cover, by code — including the ones dev's admin
 * created by hand, which this seed never made but which share the codes.
 *
 * A cover an admin uploaded is left alone when it actually loads; this seed
 * only fills a blank, refreshes its own, or replaces one that 404s.
 */
async function setCategoryCovers(): Promise<void> {
  const rows = await db
    .select({ id: category.id, code: category.code, imageKey: category.imageKey })
    .from(category)
    .where(inArray(category.code, DEMO_CODES));
  for (const c of rows) {
    const key = coverKey(c.code);
    if (c.imageKey === key) continue;
    let why = "had none";
    if (c.imageKey && !c.imageKey.startsWith("demo/")) {
      if (await objectExists(c.imageKey)) {
        console.log(`  cover ${c.code}: keeping the admin's ${c.imageKey}`);
        continue;
      }
      why = `its ${c.imageKey} is not in the bucket`;
    } else if (c.imageKey) {
      why = `was ${c.imageKey}`;
    }
    console.log(`  cover ${c.code} -> ${key} (${why})`);
    if (apply) {
      await db.update(category).set({ imageKey: key, updatedAt: now }).where(eq(category.id, c.id));
    }
  }
}

/**
 * `--photos-only`: points the existing demo rows at their photographs and does
 * nothing else — no services replaced, no reviews rewritten, no week reset.
 *
 * Services are found by their business and their Portuguese name, the same
 * pair the full run writes them from; one a tester renamed is reported and
 * skipped rather than guessed at.
 */
async function setPhotoColumns(): Promise<void> {
  for (const p of PROVIDERS) {
    const [row] = await db
      .select({ id: provider.id })
      .from(provider)
      .where(eq(provider.slug, p.slug));
    if (!row) {
      console.log(`  ${p.name}: not seeded on ${STAGE} yet — run without --photos-only first`);
      continue;
    }
    if (apply) {
      await db
        .update(provider)
        .set({ photoKeys: portfolioKeys(p), updatedAt: now })
        .where(eq(provider.id, row.id));
    }

    const services = await db
      .select({ id: service.id, name: serviceTranslation.name })
      .from(service)
      .innerJoin(
        serviceTranslation,
        and(eq(serviceTranslation.serviceId, service.id), eq(serviceTranslation.locale, "pt-MZ")),
      )
      .where(eq(service.providerId, row.id));

    let matched = 0;
    for (const s of p.services) {
      const found = services.filter((r) => r.name === s.name);
      if (found.length === 0) {
        console.log(`  ${p.name}: no service named "${s.name}" — skipped`);
        continue;
      }
      matched += found.length;
      if (apply) {
        await db
          .update(service)
          .set({ imageKeys: [serviceKey(p, s)], updatedAt: now })
          .where(inArray(service.id, found.map((f) => f.id)));
      }
    }
    console.log(
      `  ${p.name}: ${p.photos} portfolio photos, ${matched}/${p.services.length} services`,
    );
  }
}

async function run(): Promise<void> {
  console.log(`${STAGE}: ${apply ? "applying." : "dry run — pass --apply to write.\n"}`);

  if (photosOnly) {
    console.log("photos only: uploads and image columns, nothing else.\n");
    await uploadPhotos();
    await uploadMarks();
    await setCategoryCovers();
    await setPhotoColumns();
    return;
  }

  /* 1. Categories: give them their icons, and hide the ones named after UUIDs. */
  const categories = await db.select().from(category);
  const demoCategories = categories.filter((c) => DEMO_CODES.includes(c.code));
  const junk = categories.filter((c) => /^(catalog-sweep-test|svc-filter-test)/.test(c.code));

  console.log(`categories: ${demoCategories.length} to give icons, ${junk.length} test rows to hide`);
  if (apply) {
    for (const c of demoCategories) {
      await db
        .update(category)
        .set({ icon: CATEGORY_ICONS[c.code]!, updatedAt: now })
        .where(eq(category.id, c.id));
    }
    if (junk.length > 0) {
      await db
        .update(category)
        .set({ isActive: false, updatedAt: now })
        .where(inArray(category.id, junk.map((c) => c.id)));
    }
  }

  /* 1b. Any demo category the platform does not have yet, with its names. */
  const categoryByCode = new Map(demoCategories.map((c) => [c.code, c.id]));
  let nextSortOrder = categories.length;
  for (const [code, names] of Object.entries(NEW_CATEGORIES)) {
    if (categoryByCode.has(code)) continue;
    console.log(`categories: creating "${code}" — the platform had nowhere to file it`);
    if (!apply) continue;

    const [row] = await db
      .insert(category)
      .values({
        code,
        icon: CATEGORY_ICONS[code]!,
        isActive: true,
        // Last in the band. The existing order is a layout somebody chose, and
        // inserting into the middle of it would reshuffle a row of controls
        // people have learned the shape of. Counted up, so two categories new
        // in the same run do not tie for the same place.
        sortOrder: nextSortOrder++,
      })
      .returning({ id: category.id });
    categoryByCode.set(code, row!.id);

    for (const [locale, name] of Object.entries(names)) {
      await db.insert(categoryTranslation).values({ categoryId: row!.id, locale, name });
    }
  }

  /* 2. Media: the photographs, each category's cover, and the generated marks. */
  await uploadPhotos();
  await uploadMarks();
  await setCategoryCovers();

  /* 3. Reviewers — real user rows, because a review carries a foreign key to one. */
  const reviewerIds = new Map<string, string>();
  for (const r of REVIEWERS) {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, r.email));
    let id = existing?.id;
    if (!id) {
      id = `demo-${randomUUID()}`;
      if (apply) {
        await db.insert(user).values({ id, email: r.email, role: "customer", status: "active" });
        await db.insert(profile).values({
          userId: id,
          firstName: r.name.split(" ")[0] ?? r.name,
          lastName: r.name.split(" ").slice(1).join(" "),
          displayName: r.name,
          language: "pt-MZ",
          timezone: "Africa/Maputo",
        });
      }
    }
    reviewerIds.set(r.email, id ?? "(dry-run)");
  }
  console.log(`reviewers: ${REVIEWERS.length}`);

  /* 4. The businesses, their services and their verdicts. */
  for (const p of PROVIDERS) {
    const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, ownerEmail(p)));
    const ownerId = existingUser?.id ?? `demo-${randomUUID()}`;

    if (!apply) {
      console.log(
        `  would seed ${p.name} — ${p.services.length} services, ${p.ratings.length} reviews, ` +
          `${1 + (p.staff?.length ?? 0)} people working ${WEEK.length} days a week`,
      );
      continue;
    }

    if (!existingUser) {
      await db.insert(user).values({
        id: ownerId, email: ownerEmail(p),
        role: p.type === "organization" ? "organization_owner" : "individual_provider",
        status: "active",
      });
      await db.insert(profile).values({
        userId: ownerId,
        firstName: p.name.split(" ")[0] ?? p.name,
        lastName: p.name.split(" ").slice(1).join(" "),
        displayName: p.name,
        language: "pt-MZ",
        timezone: "Africa/Maputo",
      });
    }

    const [existingProvider] = await db
      .select({ id: provider.id })
      .from(provider)
      .where(eq(provider.slug, p.slug));

    const values = {
      ownerUserId: ownerId,
      type: p.type,
      name: p.name,
      slug: p.slug,
      status: "active",
      description: p.description,
      addressCity: p.city,
      addressDistrict: p.district,
      addressCountry: "MZ",
      timezone: "Africa/Maputo",
      logoKey: p.logo ? `demo/logo/${p.slug}.svg` : null,
      photoKeys: portfolioKeys(p),
      updatedAt: now,
    };

    let providerId: string;
    if (existingProvider) {
      providerId = existingProvider.id;
      await db.update(provider).set(values).where(eq(provider.id, providerId));
    } else {
      const [row] = await db.insert(provider).values(values).returning({ id: provider.id });
      providerId = row!.id;
    }

    await db
      .insert(providerMember)
      .values({ providerId, userId: ownerId, role: "owner" })
      .onConflictDoNothing();

    // The staff, each a real user with a real profile — the availability
    // picker publishes a first name, and a member whose profile has none falls
    // back to "Profissional 2", which is what this seed exists to stop the
    // design being judged against.
    //
    // Emails are derived from the slug and the name so a second run finds the
    // same people instead of hiring a parallel set, matching how the reviewers
    // above are keyed.
    for (const fullName of p.staff ?? []) {
      const email = staffEmail(p, fullName);
      const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
      let staffUserId = existingUser?.id;
      if (!staffUserId) {
        staffUserId = `demo-${randomUUID()}`;
        if (apply) {
          await db.insert(user).values({ id: staffUserId, email, role: "customer", status: "active" });
          await db.insert(profile).values({
            userId: staffUserId,
            firstName: fullName.split(" ")[0] ?? fullName,
            lastName: fullName.split(" ").slice(1).join(" "),
            displayName: fullName,
            language: "pt-MZ",
            timezone: "Africa/Maputo",
          });
        }
      }
      if (apply) {
        await db
          .insert(providerMember)
          .values({ providerId, userId: staffUserId, role: "staff" })
          .onConflictDoNothing();
      }
    }

    // Everyone who works here, owner included: the owner of a one-person
    // business is the person who does the job, and an organization's owner is
    // usually still on the floor.
    const members = apply
      ? await db
          .select({ id: providerMember.id })
          .from(providerMember)
          .where(eq(providerMember.providerId, providerId))
      : [];

    // Replaced wholesale, like the services below — this seed is the authority
    // on when a demo business is open, and a second run must not stack a second
    // identical week on top of the first.
    await db.delete(memberAvailability).where(eq(memberAvailability.providerId, providerId));
    for (const m of members) {
      for (const w of WEEK) {
        await db.insert(memberAvailability).values({
          providerId,
          memberId: m.id,
          weekday: w.weekday,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
          slotIntervalMinutes: 30,
        });
      }
    }

    // The verified badge reads an accepted document, not the provider's status
    // — every listed provider is active, so a badge driven by that would be lit
    // on all of them.
    if (p.verified) {
      const [doc] = await db
        .select({ id: providerDocument.id })
        .from(providerDocument)
        .where(
          and(eq(providerDocument.providerId, providerId), eq(providerDocument.status, "accepted")),
        );
      if (!doc) {
        await db.insert(providerDocument).values({
          providerId,
          type: p.type === "organization" ? "COMMERCIAL_REGISTRY" : "NATIONAL_ID",
          status: "accepted",
          storageKey: `demo/doc/${p.slug}.pdf`,
          uploadedByUserId: ownerId,
        });
      }
    }

    // Services are replaced wholesale so a second run does not stack duplicates
    // — the demo set is the authority on what this business sells.
    const owned = await db.select({ id: service.id }).from(service).where(eq(service.providerId, providerId));
    if (owned.length > 0) {
      await db.delete(service).where(inArray(service.id, owned.map((s) => s.id)));
    }

    for (const [i, s] of p.services.entries()) {
      const categoryId = categoryByCode.get(s.category);
      if (!categoryId) throw new Error(`No category "${s.category}" — run seed-categories first.`);

      const [row] = await db
        .insert(service)
        .values({
          providerId,
          categoryId,
          sourceLocale: "pt-MZ",
          locationType: s.locationType,
          bookingMode: s.amountMinor === null ? "quote" : "priced",
          status: "published",
          sortOrder: i,
          imageKeys: [serviceKey(p, s)],
        })
        .returning({ id: service.id });
      const serviceId = row!.id;

      await db.insert(serviceTranslation).values({
        serviceId, locale: "pt-MZ", name: s.name, description: s.description,
      });

      // Who performs it. Without this row the service has nobody, and with
      // nobody it has no availability at all — `availabilityForService`
      // resolves its performers through this table, so a service missing from
      // it returns an empty week however complete its members' calendars are.
      // That was the state of every published service before this seed learned
      // to write it.
      //
      // Everyone, rather than a subset: which of a business's people can do
      // which job is a real distinction, but inventing it here would make some
      // services quietly unbookable for reasons no reader could see.
      for (const m of members) {
        await db.insert(serviceMember).values({ serviceId, memberId: m.id }).onConflictDoNothing();
      }

      // A quote service has no options at all — nothing is priced until the
      // provider has seen the job.
      if (s.amountMinor !== null) {
        await db.insert(serviceOption).values({
          serviceId,
          pricingMode: "fixed",
          amountMinor: s.amountMinor,
          currency: "MZN",
          durationMinutes: s.durationMinutes,
          isDefault: true,
          isActive: true,
          sortOrder: 0,
        });
      }
    }

    await db.delete(review).where(eq(review.providerId, providerId));
    for (const [i, rating] of p.ratings.entries()) {
      const reviewer = REVIEWERS[i % REVIEWERS.length]!;
      await db
        .insert(review)
        .values({
          providerId,
          authorUserId: reviewerIds.get(reviewer.email)!,
          rating,
          comment: i === 0 ? COMMENTS[rating] ?? null : null,
          status: "published",
        })
        .onConflictDoNothing();
    }

    console.log(
      `  ${p.name} — ${p.services.length} services, ${p.ratings.length} reviews, ` +
        `${members.length} people × ${WEEK.length} days = ${members.length * WEEK.length} availability windows`,
    );
  }

  /* 5. Stop every invented address from being mailed. */
  console.log(`\nemail suppressions: ${DEMO_EMAILS.length} demo addresses`);
  if (apply) {
    await db
      .insert(emailSuppression)
      .values(
        DEMO_EMAILS.map((email) => ({
          email,
          // The column accepts only what a provider reports. "bounce" is what
          // any write here would come back as, so it is the honest one of the two.
          reason: "bounce",
          detail: { source: "seed-demo", note: "Reserved .test address; never deliverable." },
        })),
      )
      .onConflictDoNothing();
  }

  /* 6. Hide the leftover test businesses so the directory reads as a directory. */
  // Dev only. On QA every business this seed did not make belongs to a real
  // tester, and suspending one would take it off the directory mid-test.
  if (STAGE === "dev") {
    const demoSlugs = PROVIDERS.map((p) => p.slug);
    const stale = await db
      .select({ id: provider.id, name: provider.name })
      .from(provider)
      .where(and(eq(provider.status, "active"), notInArray(provider.slug, demoSlugs)));
    console.log(`\ntest businesses to hide: ${stale.length}`);
    if (apply && stale.length > 0) {
      await db
        .update(provider)
        .set({ status: "suspended", updatedAt: now })
        .where(inArray(provider.id, stale.map((s) => s.id)));
    }
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(provider)
    .where(eq(provider.status, "active"));
  console.log(`\nactive providers now: ${n}`);
}

/** One line of praise or complaint per score, so a card's first comment fits its stars. */
const COMMENTS: Record<number, string> = {
  5: "Trabalho impecável e pontual. Recomendo.",
  4: "Bom serviço, só chegou um pouco atrasado.",
  3: "Resolveu, mas tive de insistir para marcar.",
};

await run();
await sqlClient.end();
