/**
 * The six digits a person sends us from WhatsApp to prove they hold a number.
 *
 * Six, because the SMS code this replaces was six and the person reads it
 * once, inside a message that was typed for them.
 */
export const VERIFICATION_CODE_LENGTH = 6;

const SPACE = 10 ** VERIFICATION_CODE_LENGTH;

/**
 * The largest multiple of `SPACE` a uint32 can hold. A draw at or above it is
 * thrown away: taking it modulo `SPACE` would make the low codes slightly more
 * likely than the high ones.
 */
const LIMIT = Math.floor(0x1_0000_0000 / SPACE) * SPACE;

export type RandomSource = (buffer: Uint32Array) => Uint32Array;

const cryptoRandom: RandomSource = (buffer) => crypto.getRandomValues(buffer);

export function generateVerificationCode(random: RandomSource = cryptoRandom): string {
  const buffer = new Uint32Array(1);
  for (;;) {
    const [draw] = random(buffer);
    if (draw !== undefined && draw < LIMIT) {
      return String(draw % SPACE).padStart(VERIFICATION_CODE_LENGTH, "0");
    }
  }
}

/**
 * The code inside a message, whatever language the rest of it is in.
 *
 * Six digits standing alone, so a phone number typed into the chat never
 * yields six of its digits as a code.
 */
export function extractVerificationCode(text: string | null): string | null {
  if (!text) return null;
  return text.match(/(?<!\d)\d{6}(?!\d)/)?.[0] ?? null;
}
