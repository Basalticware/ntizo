/**
 * A person's current name, as the Activity context needs it to snapshot a
 * history row. This is this context's own port, like `ProviderNameReaderPort` (F5).
 */
export interface UserNameReaderPort {
  /** Display name, else the email; null if the account no longer exists. */
  findNameById(userId: string): Promise<string | null>;
}
