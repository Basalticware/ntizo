import { buttonHtml, emailLayout } from "./layout";
import { escapeHtml, pickCopy } from "./copy";

interface Copy {
  subject: string;
  heading: (firstName: string | null) => string;
  body: string;
  cta: string;
  orPaste: string;
  disclaimer: string;
}

/**
 * Eight locales, because this is the FIRST mail anybody receives.
 *
 * It shipped English-only while the app itself spoke eight languages, so a
 * Mozambican who registered in Portuguese was asked, in English, to confirm
 * the address — the one step between signing up and having an account.
 *
 * It is also the welcome. A separate "Bem-vindo à Ntizo — a sua conta está
 * pronta" used to follow it seconds later, landed on top of the inbox, and
 * was the one people opened: it told them the account was ready while sign-in
 * still refused them for want of the click in this one. So this mail greets
 * first and asks second, and the body says plainly that signing in waits for
 * the confirmation.
 */
const COPY: Record<string, Copy> = {
  "en-US": { subject: "Welcome to Ntizo — verify your email", heading: (n) => (n ? `Welcome, ${n}` : "Welcome to Ntizo"), body: "Your account has been created. One step left: verify your email address with the button below. You can sign in as soon as it's done.", cta: "Verify email", orPaste: "Or copy and paste this link into your browser:", disclaimer: "If you didn't create an account, you can safely ignore this email." },
  "pt-MZ": { subject: "Bem-vindo à Ntizo — confirme o seu e-mail", heading: (n) => (n ? `Bem-vindo, ${n}` : "Bem-vindo à Ntizo"), body: "A sua conta foi criada. Falta só um passo: confirme o seu endereço de e-mail no botão abaixo. Depois disso já pode entrar.", cta: "Confirmar e-mail", orPaste: "Ou copie e cole esta ligação no seu navegador:", disclaimer: "Se não criou nenhuma conta, pode ignorar este e-mail com segurança." },
  "pt-PT": { subject: "Bem-vindo à Ntizo — confirme o seu e-mail", heading: (n) => (n ? `Bem-vindo, ${n}` : "Bem-vindo à Ntizo"), body: "A sua conta foi criada. Falta só um passo: confirme o seu endereço de e-mail no botão abaixo. Depois disso já pode entrar.", cta: "Confirmar e-mail", orPaste: "Ou copie e cole esta ligação no seu navegador:", disclaimer: "Se não criou nenhuma conta, pode ignorar este e-mail com segurança." },
  "es-ES": { subject: "Bienvenido a Ntizo — verifica tu correo", heading: (n) => (n ? `Bienvenido, ${n}` : "Bienvenido a Ntizo"), body: "Tu cuenta se ha creado. Solo falta un paso: verifica tu dirección de correo con el botón de abajo. Después ya podrás iniciar sesión.", cta: "Verificar correo", orPaste: "O copia y pega este enlace en tu navegador:", disclaimer: "Si no creaste ninguna cuenta, puedes ignorar este correo." },
  "fr-FR": { subject: "Bienvenue sur Ntizo — vérifiez votre e-mail", heading: (n) => (n ? `Bienvenue, ${n}` : "Bienvenue sur Ntizo"), body: "Votre compte a été créé. Il reste une étape : vérifiez votre adresse e-mail avec le bouton ci-dessous. Vous pourrez ensuite vous connecter.", cta: "Vérifier l’e-mail", orPaste: "Ou copiez ce lien dans votre navigateur :", disclaimer: "Si vous n’avez pas créé de compte, vous pouvez ignorer cet e-mail." },
  "it-IT": { subject: "Benvenuto su Ntizo — verifica la tua e-mail", heading: (n) => (n ? `Benvenuto, ${n}` : "Benvenuto su Ntizo"), body: "Il tuo account è stato creato. Manca solo un passaggio: verifica il tuo indirizzo e-mail con il pulsante qui sotto. Dopo potrai accedere.", cta: "Verifica e-mail", orPaste: "Oppure copia e incolla questo link nel browser:", disclaimer: "Se non hai creato un account, puoi ignorare questa e-mail." },
  "de-DE": { subject: "Willkommen bei Ntizo — bestätigen Sie Ihre E-Mail", heading: (n) => (n ? `Willkommen, ${n}` : "Willkommen bei Ntizo"), body: "Ihr Konto wurde erstellt. Nur noch ein Schritt: Bestätigen Sie Ihre E-Mail-Adresse über die Schaltfläche unten. Danach können Sie sich anmelden.", cta: "E-Mail bestätigen", orPaste: "Oder kopieren Sie diesen Link in Ihren Browser:", disclaimer: "Wenn Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren." },
  "nl-NL": { subject: "Welkom bij Ntizo — bevestig je e-mailadres", heading: (n) => (n ? `Welkom, ${n}` : "Welkom bij Ntizo"), body: "Je account is aangemaakt. Nog één stap: bevestig je e-mailadres met de knop hieronder. Daarna kun je inloggen.", cta: "E-mailadres bevestigen", orPaste: "Of kopieer en plak deze link in je browser:", disclaimer: "Als je geen account hebt aangemaakt, kun je deze e-mail negeren." },
};

export function verifyEmailTemplate(
  url: string,
  locale = "en-US",
  firstName: string | null = null,
): { subject: string; html: string; text: string } {
  const c = pickCopy(COPY, locale);
  // better-auth defaults a missing name to "", which must greet like null
  // rather than as "Welcome, ".
  const name = firstName?.trim() || null;
  return {
    subject: c.subject,
    html: emailLayout({
      // Escaped here because `emailLayout` puts the heading into the markup
      // raw, and the name is whatever the person typed into the form.
      heading: c.heading(name ? escapeHtml(name) : null),
      bodyHtml: `<p style="font-size:14px;color:#333;line-height:1.5;">
        ${c.body}
      </p>${buttonHtml(url, c.cta)}
      <p style="font-size:12px;color:#888;">${c.orPaste}<br/><a href="${url}">${url}</a></p>`,
      disclaimer: c.disclaimer,
    }),
    text: `${c.heading(name)}\n\n${c.body}\n\n${url}`,
  };
}
