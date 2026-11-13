# Venue meet-ups pilot

## Enable the backend

Apply the existing migrations through `038_atomic_personal_groups.sql`, then
apply `supabase/migrations/039_venue_meetups.sql` in the Supabase SQL Editor.
Then apply `supabase/migrations/040_leave_meetup_offers.sql` to enable leaving
offers. Do not edit or reapply an already-installed migration.
Apply `supabase/migrations/041_offer_venue_coordinates.sql` for saved map pins.
This migration creates the venue catalogue, offers, group attempts, participants,
rewards and private server-timed check-in history. It does not seed venues or
modify existing shared-group cadences.

Existing `checkins` stores only the most recent check-in. The new ledger begins
when migration 039 is applied. No earlier check-ins are backfilled or inferred.
An insert/update of a normal check-in records server time and refreshes reward
qualification in the same database transaction. Client timestamps never count
as proof of historical check-ins.

### Give your account venue admin access

Sign up and verify your email first. Run this in the SQL Editor, replacing the
email with your own. This is privileged database setup, not a client-side option:

```sql
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users
    where lower(email) = lower('YOUR_VERIFIED_EMAIL')
      and email_confirmed_at is not null;
  if admin_id is null then
    raise exception 'No verified account found for this email.';
  end if;
  insert into public.venue_admins(user_id) values (admin_id)
    on conflict do nothing;
end;
$$;
```

To revoke access:

```sql
delete from public.venue_admins
where user_id = (select id from auth.users where lower(email) = lower('YOUR_VERIFIED_EMAIL'));
```

Authenticated users cannot read or change the allowlist or underlying meet-up
tables directly. All operations use scoped RPCs; venue writes and admin listings
recheck the allowlist on the server. Knowing the admin URL grants no access.

## Enter venues and offers

Sign in to the website and open `/admin/venues`. It is not linked in public/app
navigation.

1. Create a venue with its name, full address, description and IANA timezone,
   normally `Europe/London`.
   Use **Find address on map** to search the address with OpenStreetMap Nominatim,
   confirm the correct match, then save. Alternatively enter latitude/longitude.
   Both coordinates are optional, but must be supplied together. Changing an
   address clears its old coordinates so a stale pin is not saved.
2. Create an offer for that venue, with a reward, terms and repeated check-in rule.
3. Specify individual, minimum-member or whole-group unlocking.
4. For group offers, choose qualifying members only or all opted-in members as
   recipients. Individual offers can only reward qualifying members.
5. Set redemption validity (1–90 days from unlocking), an optional qualification
   end date, and active status.

Use terms to specify exclusions, venue opening times, any purchase requirement,
whether the group must attend together, and the staff redemption process.

### Offers map

Available offers have a List / Map toggle. Leaflet shows one pin per venue with
saved coordinates, with all that venue's offer headlines in its popup. The map
respects the selected venue filter. Venues without coordinates remain in List
view and map view explicitly reports missing locations. Old offer snapshots do
not need backfilling; the map uses the live available-offer catalogue.

The pilot uses OpenStreetMap public tiles with attribution. No API key, automatic
geocoding, bulk tile downloading, prefetching or offline map cache is implemented.
Address lookups are explicit admin clicks, limited to at most one request per
1.1 seconds in a browser; coordinate results are never automatically saved.
Do not use the public lookup service for parallel/bulk imports or autocomplete.
For production growth, choose a hosted tile/geocoding provider before exceeding
the public services' policies:
- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/nominatim/

Switch services without code changes using `VITE_MAP_TILE_URL` (Leaflet URL
template), `VITE_MAP_ATTRIBUTION` (provider attribution HTML), and
`VITE_GEOCODING_URL` (Nominatim-compatible search endpoint). Vite variables are
public client configuration; do not put secret server keys in them.
Map viewing sends tile requests to the provider, and address lookup sends only
the supplied venue address. No user location is requested or transmitted.
Selecting an offer is **not a reservation**, and NUJ does not check capacity,
opening times or physical attendance.

Deactivate a venue/offer to stop new selections. Existing attempts preserve a
snapshot of the original venue details, timezone, reward and terms; edits do not
change existing rules. To change terms for everyone, publish a new offer.
Deactivation is not revocation of previously selected offers/rewards.

## Member flow

- Apply migration 043 to enable venue categories: cafe, pub, entertainment,
  activity or other. Existing venues default to other; admins can set their category.
  Older clients omitting category preserve it on updates. Saved attempt snapshots
  remain unchanged when a venue category changes.
- Available offers have category icon filters and an explicit postcode/place search.
  Search uses the same rate-limited Nominatim lookup as venue entry. The member must
  choose a match before sorting. Distances are straight-line miles, not travel routes.
  Category icon buttons in the Filters pop-out support multiple selections (matching
  any selected category). No categories selected shows all offers. The independent
  Filters opens one pop-out containing category buttons and optional postcode/place
  search; both are available together.
  The selected search text stays visible above the offers even with Filters closed.
  Reopen Filters to edit or clear the postcode/place.
  Selected category buttons are bold. A chosen location becomes a compact clickable
  box; tap it to search again. Done closes the pop-out, keeping the current selections.
  Selection controls stay in the Filters pop-out. Selected category icons and postcode/place
  appear below the heading; the small Clear button resets all category/location selections.
  Offer cards show just the distance in miles at the top, and map pins include the distance.
  Category icons appear at the top-right of available and joined offer cards, including
  dashboard cards. Joined cards use the current catalogue category when available,
  without changing the saved offer snapshot or qualification terms.
  Offer details show one offer headline, venue and postcode beside a map icon (the
  full address is shown if no UK postcode is present). The full address, reward specifics, venue
  description and qualification rules are in icon-led T&Cs sections. The main card
  includes a compact cadence/duration strip; participation and progress remain visible.
  Unmapped venues sort last with "Distance unavailable". Clear location restores
  catalogue order. Category and location filters apply to both List and Map views,
  not joined rewards. No device geolocation or automatic searches are used.

- Expanding Meet-ups on the dashboard shows compact cards with venue names and
  snapshotted offer titles for the viewer's shared-group offers, including pending opt-ins. Use the
  offer title for a short headline (for example, "GBP 2 off") and the reward
  description for the full detail.
  Pending offers show "Not opted in yet" and an Opt in button, not personal progress.
  Available offers not selected by a shared group are not shown there; an empty
  section says "No meet-ups joined yet" and links to all venue offers.
  Each joined group offer has its own personal streak bar and days/weeks count, current
  opted-in member count and qualification count (against the group threshold
  where applicable). A completed personal streak is not necessarily a group unlock.
  The help icon appears only when expanded
  and explains the connection-to-meet-up flow.
  Each offer card opens `/meetup/:offerId` directly.
- `/meetups` lists available venue offers and the viewer's shared-group attempts.
- `/meetup/:id` uses a real **offer UUID**, not the old mock `m1`/`m3` IDs.
- Offer summaries use icon tiles for cadence, qualification thresholds and reward
  recipients. Full qualification and participation wording, terms, check-in
  timezone, qualification end date and redemption window are in a T&Cs dialog.
  The location-pin link opens the venue name
  and address in Google Maps in a new tab; saved attempts use original details.
- A current shared-group owner selects an offer for the group. This opts the
  owner in and leaves other members free to participate.
- Each member opts in before check-ins count. Their start time is their own
  acceptance time, not a retroactive group selection date.
  Once a saved offer's qualification deadline has passed, opt-in/rejoin controls
  are hidden and show "Offer ended". Earned rewards keep their separate redemption window.
- Dashboard and Offers cards let members opt in directly or opt out after confirmation.
  Whole-group offers remain limited to starting members; other offer rules allow
  current shared-group members to opt in even without an existing participant row.
- Members can also leave a joined offer from its detail page after confirmation.
  Leaving resets their progress and qualification, forfeits unused rewards for
  that group offer, and returns its dashboard card to the pending opt-in state. It does not
  leave the shared group or reset anyone else's progress or earned group unlock.
  Members can opt in again while the offer's original qualification window allows
  it; only check-ins after the new opt-in count. Rejoining requires a fresh
  qualifying streak even for an already-unlocked all-recipient reward.
  Forfeited rewards can be earned again, but redeemed rewards are retained and
  cannot be earned or redeemed twice. Whole-group starting rosters remain fixed.
- Unfinished participants who leave and rejoin start counting from their current
  membership date; check-ins while outside the group do not earn past credit.
- The usual one-tap NUJ check-in counts towards both group presence and the offer.
  There is no additional venue check-in.
- Members can see participation and qualification status, but not one another's
  detailed check-in histories.
- Whole-group offers freeze the starting group roster, including members who
  have not yet opted in. Every starting member must opt in and qualify. Later
  joiners cannot enter that attempt; members who leave before unlocking can
  block it. Use individual/minimum-member offers for fluid groups.
- Minimum-member offers count current qualifying members until unlocking. Once
  unlocked, the group unlock remains earned.
- There is one attempt per group/offer and one reward per person/offer, even
  across different groups. Deleting a group does not make that reward available
  to earn again. Deleted-group rewards cannot be redeemed.

The existing `meetup_attendees` and `useJoinedMeetups` are legacy individual
attendance scaffolding. They are not used by this shared-group offer flow and
are not migrated into qualifying attempts.

## Check-in periods

- **Daily:** one check-in on each consecutive calendar day in the venue timezone.
- **Weekly:** at least one check-in in each consecutive seven-day window,
  anchored to the member's start date in the venue timezone. This means four
  weeks, not an ambiguous calendar month.
- Multiple taps on the same day/within the same weekly window count once.
- A missed window resets an unfinished streak. An incomplete current window
  does not reset a streak while there is still time to check in.
- Qualification is earned once the required consecutive windows contain
  check-ins; it does not require waiting until the end of the final window.
- Once qualified, that status does not decay. Only events received after opt-in
  and on/before the snapshotted offer end time can qualify.
- No offline/backdated credit or manual progress edits are exposed.

## Redemption

The member shows the reward on their phone. Staff review its venue, terms,
validity and unused status, then confirm redemption on that phone. The server
checks ownership, current group membership, expiry and unused status under a row
lock before marking it used.

This is **member-device confirmation**, not independently authenticated staff
approval, proof of attendance, or a fraud-proof venue system. A member can
confirm their own reward; use a small trusted pilot and explain this to venues.
Screenshots are not authoritative: staff must view and confirm the live screen.
Future staff-authenticated scanning would require a separate access model.

## Release and validation

Apply the migration before publishing the website or syncing a new native build.
Native users need the rebuilt app to see the real meet-ups screens/dashboard
link. Existing native check-ins still feed the backend ledger after migration.

This version does not send a new reward-unlocked push notification. Normal
check-in reminders and NUJs are unchanged; progress/rewards refresh when the
meet-ups screen is opened or refreshed. Venue bookings, location verification,
staff accounts, venue self-registration and repeat reward campaigns are outside
this pilot.

Run the database and UI tests using the repository's existing Vitest commands:

```sh
npm test -- src/test/meetups.database.test.ts src/lib/meetups.test.ts src/pages/VenueOffers.test.tsx
```

The database tests run the actual migration in PGlite, including admin isolation,
server-timed history, opt-in, daily/weekly rules, frozen terms and one-use rewards.
No live Supabase credentials are needed for these tests.
