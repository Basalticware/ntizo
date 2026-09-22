# Admin user detail, and granting admin access

Date: 2026-09-22 · Status: design and mockup approved (2026-09-22)
Mockup: `2026-09-22-admin-user-detail.mockup.html` (same folder)

## Why

`/admin/users` lists everyone, but a row leads nowhere. Making someone an
admin today means editing the database by hand. On 2026-09-21 that went wrong:
only `better_auth.user.role` was updated, while authorization reads
`ntizo_user.user.role`, and `/admin` kept redirecting.

## What

- A page at `/admin/users/$userId`, built on the provider detail page's
  skeleton: back link, a "who this is" section, a decision section, a list.
- In the users list, a person's name links to it, exactly as `ProviderRow`
  links a business.
- An administrator can **grant** admin access to anyone else, and **remove**
  it from any other admin. Both go through an in-app confirmation dialog.

Not in scope: emailing the promoted person, suspending users, editing
profiles, pagination changes to the list.

## The page

Sections, top to bottom. The mockup is the reference for layout and copy.

1. **Who this is:** avatar (profile photo, initials as fallback), display
   name (the email when there is none), email, status badge. Pairs: Email with
   "verificado" or "por verificar", Telefone with the same, Papel, Idioma,
   Registado em, ID (monospaced). No bio, date of birth, gender or timezone.
2. **Papel na plataforma:** eyebrow, hint sentence, then exactly one of:
   - "Tornar admin" (primary) when `roleChange.to === "admin"`;
   - "Retirar admin" (outline) when `roleChange.to === "customer"`;
   - the sentence "Esta é a sua conta. Só outro administrador pode mudar o seu
     papel." when `roleChange.blockedReason === "self"`.
3. **Confirmation dialog:** the app's `Dialog`, never a browser alert.
   - Grant: "Dar acesso de administração a {name}?", the four abilities as a
     short list, a note that it is recorded in the activity, then Cancelar and
     "Dar acesso".
   - Remove: "Retirar o acesso de administração a {name}?", a note that their
     workspaces do not change, then Cancelar and "Retirar acesso"
     (destructive).
   - While saving, both buttons are disabled and the confirm button shows a
     spinner.
   - On success the dialog closes and the detail and list queries are
     invalidated.
   - On error the dialog stays open, shows the code's sentence, and its only
     action becomes "Fechar".
4. **Espaços:** the workspaces the person belongs to, from `provider_member`.
   This is the same source as the list's "Espaços" count, so the two always
   agree. Each row shows logo or initials, name, the person's role
   ("Proprietário"/"Colaborador" from the `provider` namespace), "membro desde
   {date}", and the business status badge. The row links to
   `/admin/providers/$providerId`. Empty state: "Não pertence a nenhum espaço."

Titles are gender-neutral ("dar acesso de administração a", never "tornar
administradora"). New strings go into all 8 locales of the `admin` namespace.

## Authorization model

- `ntizo_user.user.role` is authoritative. `createGraphqlContextFactory` and
  `isPlatformAdmin` read it on every request, so a change applies on the
  target's next request. No sign-out or cache wait is needed for the API; the
  target's open tab shows the admin zone after a reload.
- Provider access comes from membership (`canAccessProvider`), not from role.
  Granting or removing admin therefore never touches a person's workspaces.
- Removing admin sets the role to `customer`.
- **Only one guard is needed to keep at least one admin:** nobody may change
  their own role. The requester is an admin and is not the target, so the
  requester remains an admin after any change. This is why there is no "last
  admin" state and no `LAST_ADMIN` code.
- **The race:** admins A and B remove each other at the same instant. Both
  passed `requireAdmin` when their requests started. Inside the transaction the
  command locks every admin row and the target's row (see the write side),
  then re-checks that the requester is still among the admins. The second
  transaction waits for the first, finds it is no longer an
  admin, and is refused with `ADMIN_ONLY`. The platform can never reach zero
  admins.

## Read side

- **Shared:** `userAdminDetailReadModel` in
  `packages/shared/src/read-models/system/user/`, next to
  `user-admin.schema.ts`:
  ```ts
  {
    id, email, name: string | null, avatarUrl: string | null,
    role, status, phoneNumber: string | null,
    emailVerified: boolean, phoneVerified: boolean,
    language: string, createdAt: string,
    workspaces: Array<{
      providerId, name, slug, logoUrl: string | null,
      providerStatus: string, memberRole: "owner" | "admin" | "staff", joinedAt: string
    }>,
    roleChange: { to: "admin" | "customer" | null, blockedReason: "self" | null }
  }
  ```
- **Query:** `user.detailForAdmin({ userId })` in
  `read/user/graphql/schema/queries.ts` (GraphQL `userDetailForAdmin`). The
  handler refuses non-admins with `ADMIN_ONLY` and returns `USER_NOT_FOUND`
  for an unknown id.
- **Repository:** `UserAdminRepositoryPort.findDetail(userId)`.
  - It selects columns explicitly, as `listAll` does. It joins `profile`,
    `better_auth.user` (`emailVerified`, `phoneNumberVerified`) and
    `provider_member` + `provider`.
  - Media keys are resolved to URLs the same way the list and provider detail
    already do.
  - Its result has no `roleChange`.
- **Projection:** `GetUserDetailForAdminProjection(requesterUserId, userId)`
  adds `roleChange`. When the target is the requester, the result is
  `{ to: null, blockedReason: "self" }`. Otherwise `to` is the opposite of the
  target's current admin-ness, and a non-admin role grants to `admin`.
  This rule lives in the projection because the repository's contract says the
  answer does not vary by requester.

## Write side

- **Mutation:** `user.admin.setPlatformRole({ userId, role: "admin" |
  "customer" })` in `write/user/graphql/schema/mutations.ts`, GraphQL
  `userAdminSetPlatformRole`, returning `{ userId, role }`. The handler calls
  `requireAdmin` (the same shape and `ADMIN_ONLY` code as the other write
  modules).
- **Command:** `SetPlatformRoleCommand` in `bounded-contexts/user/app/use-cases/`.
  1. Refuse with `CANNOT_CHANGE_OWN_ROLE` if the target is the requester.
     This check comes first because it needs no database.
  2. The rest runs inside `unitOfWork.atomicExecute`, like
     `DecideProviderStatusCommand`. First,
     `roleChangeLock.lockForRoleChange(targetId)`: `SELECT id, role … WHERE
     role = 'admin' OR id = $target FOR UPDATE`. It returns the admins' ids,
     and refuses with `ADMIN_ONLY` if the requester is not among them.
     - Locking the target as well means two admins granting the same person
       at once cannot both record a change. The second waits, and its next
       statement reads the committed role.
  3. `userRepo.findById(target)`: refuse with `USER_NOT_FOUND` if it is absent.
  4. `user.changePlatformRole(role, requesterId)`. If the role is unchanged
     this is a no-op with no event, and the command returns success (a double
     click is harmless).
  5. `userRepo.save(user)`, then `authRole.setRole(userId, role)`, then
     `outbox.publish(user.pullEvents(), "user")`.
  - `RoleChangeLockPort` and `AuthRolePort` are two small ports of their own,
    implemented by `DrizzleUserRepository` and `BetterAuthIdentityAdapter`.
    Keeping them separate means `UserRepositoryPort` and `AuthIdentityPort`
    stay as they are, and so does every test double that implements them.
- **Aggregate:** `User.changePlatformRole(to, byUserId)` records
  `UserPlatformRoleChanged` (`user.role.changed`) with
  `{ userId, from, to, changedByUserId }`.
- **`AuthRolePort.setRole`:** writes `better_auth.user.role` in the same
  transaction. Nothing reads it for authorization. It is written only so the
  two columns stop disagreeing, which was the trap of 2026-09-21.

## Activity

- `user.role.changed` is added to `ACTIVITY_TYPES` (shared).
- The handler in `write/activity/events/handlers/user.event-handlers.ts`
  records actor = `changedByUserId` and payload `{ targetName, to }`. The target
  name is resolved at write time, as `providerName` is for
  `provider.status.decided`. It uses a new `UserNameReaderPort` +
  cross-BC adapter in the activity context: display name, falling back to
  email.
- Web:
  - `activityType.user.role.changed` sentences in 8 locales, one for each
    direction: "{actor} deu acesso de administração a {targetName}" and
    "{actor} retirou o acesso de administração a {targetName}";
  - an icon in `activity-icon.tsx` (`ShieldCheck`);
  - the type in the admin activity filter picker, which reads the shared list.

## Web

- The route `routes/admin/users.tsx` becomes `users.index.tsx` and
  `users.$userId.tsx` is added, the same split as `providers.*`. A leaf
  `users.tsx` beside a `$userId` child would become a layout without an
  `<Outlet/>`.
- `features/admin/users/`:
  - `data`: `detail` and `setPlatformRole` in `admin-user.repository.ts`;
  - `domain`: `AdminUserDetail` types;
  - `viewmodel`: `useAdminUserDetail` and `useSetPlatformRole` (on success,
    invalidate `["admin","users"]`);
  - `ui`: `user-detail-page.tsx`, `role-section.tsx`,
    `role-confirm-dialog.tsx`, `workspaces-section.tsx`.
- `users-page.tsx`: the name in `Person` becomes a `Link` to the detail.

## Error codes

| Code | When | Sentence (pt-MZ) |
|---|---|---|
| `ADMIN_ONLY` | the requester is not an admin (or stopped being one mid-flight) | Já não tem acesso de administração: outro administrador retirou-o entretanto. Nada foi alterado. |
| `CANNOT_CHANGE_OWN_ROLE` | the target is the requester | Não pode mudar o seu próprio papel. |
| `USER_NOT_FOUND` | unknown id | Este utilizador já não existe. |
| anything else | | Não foi possível alterar o papel. Tente novamente. |

## Testing

- **Backend (bun test):**
  - the aggregate records the event and treats an unchanged role as a no-op;
  - the command covers each refusal (not an admin under lock, self, not
    found), the no-op, and a successful grant and removal writing both
    columns and publishing;
  - both handlers refuse non-admins;
  - the projection's `roleChange` for self, admin and non-admin targets;
  - the activity handler's payload;
  - one repository test against a real Postgres (the dev database, like the existing repository tests)
    proving that `lockForRoleChange` really holds the row locks: a second connection's `FOR UPDATE NOWAIT` on a locked row fails with SQLSTATE 55P03.
- **Web (vitest):** `user-detail-page.test.tsx`:
  - the button shown for each `roleChange`;
  - the self sentence;
  - confirm before mutate;
  - an error kept inside the dialog;
  - the workspaces and the empty state.
  `users-page` asserts that the name links to the detail.
- **E2E (Playwright, Docker harness):** an admin opens a customer, grants
  access, confirms, and sees "Administrador". The same run takes the desktop
  and phone screenshots.

## Delivery

1. Build in the worktree `.claude/worktrees/admin-user-detail`, branch
   `feat/admin-user-detail`, from `origin/dev` `d678b8ab`.
2. Open a PR to `dev`.
3. Deploy the API first, then the web.
4. No migration: both columns already exist.
