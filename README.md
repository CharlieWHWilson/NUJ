# NUJ

## Project Info

NUJ is a Vite + React app that helps people stay connected with mates.

Shared-group database migration and release steps: [Shared Groups Setup](SHARED_GROUPS_SETUP.md).

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