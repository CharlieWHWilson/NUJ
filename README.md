# NUJ

## Project Info

NUJ is a Vite + React app that helps people stay connected with mates.

Shared-group database migration and release steps: [Shared Groups Setup](SHARED_GROUPS_SETUP.md).

Venue offers, reward qualification and the private `/admin/venues` entry form:
[Meet-ups Setup](MEETUPS_SETUP.md). Apply migrations 039-041 and add your verified
account to the database admin allowlist before using the form.

## Website explainer page

The public `/explainer` page explains NUJ's purpose: small, regular connections that
make real-life meet-ups easier. It is available without signing in and linked
from the website's sign-in page. Its original copy is informed by
Marmalade Trust's loneliness guidance; no partnership or treatment claim is made.
The page emphasises maintaining connections between community activities and
invites exploratory pilots, without claiming proven impact or live venue offers.
Separate, directly linked sections explain the value for groups of mates,
organised community/support groups, and businesses encouraging in-person visits.
Community use is optional; the venue proposition invites businesses to join a
trial offering incentives to meet at their venue, with offers not yet live.
The page uses the app's design tokens and the "What is NUJ?" carousel's soft
icon circles, restrained typography and rounded surfaces.
App download calls to action use the shared `APP_STORE_URL`. Online signup links
open registration directly at `/auth?mode=register`. The copy explains that the
app is intended for quick check-ins and optional notifications, not browsing,
and that the same account works on the website and in the app.

The explainer route redirects to the normal home flow on native Capacitor platforms,
and its sign-in link is hidden there. Publishing this website page does not require
a native sync, build or App Store release.

## Local Development

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
bun install
bun run dev
```

## Deploy

Push changes to `main`. GitHub Actions builds the app and deploys it to GitHub Pages automatically.

## Custom Domain

Configure your domain in the GitHub Pages settings for this repository.

Read more here: [Using a custom domain with GitHub Pages](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site)

## iOS Submission

Run `npm run cap:sync` to rebuild the web app and copy its latest assets into the native projects, then open `ios/App/App.xcodeproj`.

Keep the App and AppClip marketing versions and build numbers identical. The prepared release is **1.0.6 (71)**; increment both targets together for subsequent uploads.

In Xcode, select the App scheme and a generic iOS device, choose **Product > Archive**, then use Organizer to validate and distribute to App Store Connect.

Screenshot mockups are in [store-previews/images](store-previews/images). Regenerate them on macOS with:

```sh
swift store-previews/export-screenshots.swift store-previews/mockups.html store-previews/images
```

The current exports are 768 × 1663 pixels. Confirm the required iPhone screenshot dimensions in App Store Connect before uploading; these dimensions have not been verified as an accepted upload size.