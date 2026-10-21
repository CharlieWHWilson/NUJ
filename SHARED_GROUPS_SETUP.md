# Shared Groups and Mate Requests: Setup

## Apply the Supabase migration

In the production Supabase project, open **SQL Editor**, create a new query,
paste the entire contents of `supabase/migrations/034_shared_groups.sql`, and run it once.
Then run `supabase/migrations/035_short_shared_group_invites.sql` once. If 034 is
already installed, run only 035; do not rerun 034.
For mutual mate requests, also run `supabase/migrations/036_mate_requests.sql`
once after 035. If 034 and 035 are already installed, run only 036.
Use the staging project first if available. Do not edit or rerun migration 033 for this feature.

The existing app schema and migrations through 033 must already be installed,
including `profiles.username` and `profiles.last_checkin_at` and the check-in sync
trigger from migration 014. This migration does not change personal groups or mate connections.

If using the Supabase CLI with tracked migration history, apply pending migrations
through the usual `supabase db push` process instead of running the SQL manually.
Do not mix manual application and CLI pushes without reconciling migration history.

Migration 034 creates:

- `shared_groups`: owner, name, cadence and a reusable random invite code.
- `shared_group_members`: explicitly joined users, including the owner.
- `shared_group_removals`: prevents removed users from rejoining through an invitation.
- RPCs for creation, minimal invite preview, joining, listing and management.
- Row-level security, revoked direct client access and explicitly scoped RPC permissions.

Migration 035 changes invite codes to seven uppercase alphanumeric characters
(for example, `N7J2X9Q`), accepts lowercase input, and assigns unique random codes
on group creation and invite reset. It also replaces codes for existing groups:
previously shared long links stop working, so owners must share their new links.
The generation trigger handles both creation and the existing reset RPC.
Short codes are less resistant to guessing than long tokens; treat them as shared
access credentials, reset exposed invitations, and consider request rate limiting
before a large public rollout.

No Edge Function, service-role key in the app, Storage bucket, or new environment
variable is required. Anonymous users can preview a group only with its invite code;
joining and group operations require a verified account. Never grant direct table
access to `anon` or `authenticated`: the RPCs enforce the access rules.

## Mate requests: migration 036

Apply in staging and take a database backup before the production rollout. The
new frontend and database permissions should ship together: older app binaries
cannot add or remove mates through their old direct table writes after 036.
Existing reciprocal connections still work. Do not restore public profile reads
or direct mate-write grants to work around an outdated client.

Migration 036 adds `mate_requests`, a consent flag on mate rows, and RPCs for
sending, accepting, declining, cancelling, listing and removing connections.
Sending a request never adds a mate. Only explicit acceptance atomically creates
both users' mate rows, enabling individual check-in visibility and NUJs.

Legacy data is handled deliberately:

- Existing reciprocal pairs with linked user IDs remain accepted mates.
- Earlier one-sided or unlinked rows remain stored but are hidden from active mates
  and check-in reads. The owner sees names only under **Previous additions** in Mates.
- No requests are sent or accepted automatically. Owners can request an earlier
  linked addition explicitly or dismiss the old entry. Unlinked records must be
  connected using a NUJ code; names are never used to infer consent.
- Existing personal-group membership links remain stored, but only accepted mates
  appear as active members. A subsequent accepted request reactivates the original
  linked mate row and its group membership.

Requests appear quietly inside Mates, including the dashboard's expanded Mates
section. There are no request push notifications, app-icon badges, recommendation
lists, popularity counts, reminders or prompts to grow a circle.

Declines disappear from the sender's pending list without a public declined status.
The sender cannot immediately submit another request after a decline. The person
who declined may initiate a new request later. Cancelled requests have a 24-hour
cooldown before another request can be sent for the same pair. Crossed requests
remain pending until someone explicitly accepts; they never auto-accept.

Removing a mate ends both sides of the connection and clears pending NUJs between
them, without changing shared-group membership. Reconnecting requires a fresh
request initiated by the person who ended the connection and accepted by the other.

Profiles and check-in reads are restricted to self/accepted mates; code lookup
returns only a display name, user ID and code, never an email. Shared-group RPCs
retain their separate, cadence-only visibility. Direct client writes to mates and
mate_requests are denied even if an older UI tries to bypass the request flow.

No additional environment variables or Edge Function deployment is required.

With two verified accounts and one unrelated account, verify sending, acceptance,
decline, cancellation, request ownership, and reciprocal removal. Confirm requests
alone do not reveal check-ins or enable NUJs, and that shared-group membership
survives mate removal. Do not test with real people without their agreement.

## Behaviour and privacy

- Personal groups remain private collections of existing mates.
- Shared groups are separate: joining does not create individual mate connections.
- A preview exposes only the name, owner display name, cadence and member count.
- Members see names and a boolean check-in status for the group's cadence, not
  timestamps, notes, history, emails, NUJ conversations or other profile data.
- Cadence status is calculated on the server using database calendar days (UTC on
  standard Supabase projects), consistently for every member.
- Only the owner gets the reusable invite code in group data. Anyone holding the
  link can forward it; resetting the invite invalidates previous links and codes.
- Removed accounts cannot rejoin, even after a reset. V1 has no unblock control.
- Members can leave and subsequently use a valid invitation to rejoin voluntarily.
- Owners must transfer ownership to another member or delete the group before leaving.
- Deleting a group removes its membership and removal records. Deleting the owner's
  account also deletes owned shared groups through the auth-user foreign key;
  transfer ownership before deleting an account to preserve a group.

## Links and onboarding

Invites use `https://nuj.social/join/<code>`. The checked-in associated-domain file
already covers every path on nuj.social. Deploy the updated website as well as the
native app, and retain SPA fallback routing for direct `/join/...` visits.

Invitations survive sign-in/signup in the same app or browser through local storage.
An App Store installation does not automatically carry browser storage into iOS:
new users should reopen the invitation after installation, or use **Groups > Join
group** to paste the link or code. The invitation message and public preview include
this fallback. Share uses the system Web Share API where supported, with clipboard
fallback; owners can also explicitly copy the link. No native sharing plugin is added.

## Verify before release

Use two verified accounts plus a logged-out browser:

1. Create a personal group; confirm its behaviour is unchanged and it has a single-person icon.
2. Create a shared group without adding mates; confirm its multi-person icon and owner controls.
3. Open its invite logged out; confirm only the minimal preview and privacy terms appear.
4. Sign up/sign in; confirm the invite returns and membership requires pressing **Join group**.
5. Join with the second account; confirm both members see the same group, with no new individual mate connections.
6. Check in; refocus/reopen the group on the other device to refresh its status.
7. Confirm ordinary members cannot edit, reset invites, remove members or transfer ownership.
8. Reset the invite and verify the old link fails. Remove the second account and verify it cannot rejoin.
9. Use a different member to test ownership transfer, leaving and deletion.

Local automated checks:

```sh
npm test -- src/lib/sharedGroups.test.ts src/test/sharedGroups.database.test.ts src/pages/SharedGroups.test.tsx
npm test -- src/lib/mateRequests.test.ts src/test/mateRequests.database.test.ts src/components/MateRequests.test.tsx
npm run build
```

The database tests use embedded PostgreSQL, never your live Supabase database.

## Ship the app

### Appraisal follow-up fixes

Apply `supabase/migrations/038_atomic_personal_groups.sql` once after migration
037 before deploying the follow-up frontend. Personal-group creation, renaming
and membership replacement now use one owner-checked transaction. Failed saves
leave the old name and membership intact; the editor retains the draft and shows
an error. Archived one-sided mate rows already present in a personal group are
preserved as private links until accepted or explicitly removed.

Deploy the updated account-deletion function as well:

```sh
supabase functions deploy delete-account
```

The Profile screen checks shared groups before its deletion confirmation. Owners
are warned that deletion also removes owned groups for every member, and can cancel
to transfer ownership first. The server independently requires the explicit
`deleteOwnedSharedGroups: true` confirmation when groups are owned. Older clients
that omit this confirmation are blocked from accidentally deleting owned groups.

The login screen now has **Forgot password?**; Profile reset failures remain
retryable and display an error instead of silently disabling the button. Supabase
Auth must allow `https://nuj.social/account/update-password` as a redirect URL, plus
the exact local development origin/path used for testing. Native email recovery
uses the HTTPS universal link rather than `capacitor://localhost`. Implicit token
fragments and PKCE codes are consumed on the recovery page and removed from the URL.
Test recovery in the same app/browser that initiated the request when using PKCE.

NUJ cards and legacy notification preparation now prefer current profile names;
the secured push function continues to derive its own canonical name server-side.
No usernames are copied to other users' rows just to update their display.

Use two agreed test accounts to verify failed/successful group saves, a renamed
mate's NUJ labels, password recovery on web/iOS, and cancelling account deletion as
a group owner. Automated account-deletion tests never delete production users.

### Priority notification and freshness fixes

Apply `supabase/migrations/037_authorize_nuj_push.sql` once after migration 036,
then deploy the updated Edge Function:

```sh
supabase functions deploy send-nuj-push
```

Use the linked production project only after staging verification. Reauthenticate
the Supabase CLI with `supabase login` if its access token has expired. No new
secrets are required; retain the existing APNs and Supabase server credentials.
The existing website client key must never be replaced with a service-role key.

The function validates the caller's user token and claims an actual NUJ event
through the caller's authenticated database context. The database checks the
actor, mutual mate connection, event type and recent event timestamp; it generates
the recipient, display name and message. Caller-provided recipient/title/body are
ignored. Each event/type can be claimed only once, preventing replayed pushes.
Only `read_at` and `acknowledged_at` remain client-updatable on NUJ events.

Apply the SQL before deploying the function. Without migration 037 the secured
function refuses to deliver; sending and acknowledging NUJs in the app still
persist even if push delivery fails. Claims are at-most-once attempts: a failed
APNs attempt is not automatically retried. Check delivery responses/server logs
instead of repeatedly submitting the same event.

The app's local Badge plugin is now compiled into the App target and registered
by `NujBridgeViewController`, selected in the main storyboard. A new native build
is required; a website-only deployment cannot repair an installed iOS bridge.

NUJs, mates, shared groups and mate requests refresh on foreground/native resume;
NUJs also refresh on incoming/opened pushes, with a visible-screen polling fallback.
Check-in state also refreshes at local midnight. Turning reminders off cancels
daily, interval and weekly inactivity notifications. Native reminder scheduling
is serialized so turning the setting off wins over in-flight permission checks.

Before release, test on a physical iPhone:

1. Send a real NUJ between accepted mates; confirm exactly one push and the current sender name.
2. Acknowledge it from the other account; confirm the sender's outbox refreshes on return.
3. Confirm the app-icon badge clears without `UNIMPLEMENTED` bridge errors.
4. Disable reminders; confirm no pending notification IDs 1001, 1002 or 1101-1110 remain.
5. Leave the app open across midnight, or simulate the date in a test environment;
  confirm yesterday's check-in no longer shows as today's.

Automated security and lifecycle checks:

```sh
npm test -- src/test/nujPush.server.test.ts src/test/mateRequests.database.test.ts src/hooks/useAppRefresh.test.tsx src/hooks/useCheckin.test.tsx src/lib/dailyReminder.test.ts
npm exec --yes --package=deno -- deno check --node-modules-dir=none --no-lock supabase/functions/send-nuj-push/index.ts
```

After applying the migration and deploying the website:

```sh
npm run build
npx cap copy ios
npm run cap:open:ios
```

Run on an iPhone, confirm the invite opens the full app, then increment the version/build,
archive and submit the new build. The existing App Store binary will not acquire these
screens merely because the migration or website is deployed. If using Xcode Cloud's
committed-web-assets fallback, commit the freshly copied iOS assets before building.