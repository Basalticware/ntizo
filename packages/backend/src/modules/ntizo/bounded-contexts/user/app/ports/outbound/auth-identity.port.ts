/**
 * The user's login identity, as far as this context needs to touch it.
 *
 * A port rather than a direct write because the auth identity lives in another
 * module's tables. The use case depends on this interface and knows nothing
 * about better-auth; exactly one adapter knows, and says so.
 */
export interface AuthIdentityPort {
  /**
   * Writes the number onto the auth identity and clears its verified flag.
   *
   * Both in one statement, always: a number and a stale "verified" belong to
   * different phones the moment they are written separately and something
   * fails in between.
   *
   * @param phoneNumber E.164, or null to release the number.
   * @throws {PhoneNumberAlreadyInUseError} when another account holds it.
   */
  setPhoneNumber(userId: string, phoneNumber: string | null): Promise<void>;

  /** The account's number and whether it is confirmed, or null when it has none. */
  findPhoneOf(userId: string): Promise<{ phoneNumber: string; verified: boolean } | null>;

  /** Whose number this is. The column is unique, so there is at most one. */
  findByPhoneNumber(phoneNumber: string): Promise<{ userId: string; verified: boolean } | null>;

  /**
   * Confirms the number, but only if the account still holds `issuedFor`.
   *
   * Conditional in the statement itself, so a number changed between asking
   * for a code and sending it cannot end up confirmed by a message from the
   * old one. Returns whether a row changed.
   */
  markPhoneNumberVerified(userId: string, issuedFor: string): Promise<boolean>;
}
