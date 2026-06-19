# 08 — Build & hand-off (Path A: free, ad-hoc)

How to get a testable build of Fellow 2 onto someone else's Mac at **$0** (no Apple
Developer Program). The recipient clicks past one Gatekeeper prompt; that's the only cost.

> For the polished, no-warnings route later (notarized DMG / TestFlight), see "Path B" notes
> at the bottom — that needs the $99/yr program.

---

## Prerequisites
- **Full Xcode** installed and selected (`xcode-select -p` → must end in `Xcode.app`;
  if not: `sudo xcode-select -s /Applications/Xcode.app`). Command Line Tools alone can't
  build the SwiftData macros.
- App targets **macOS 14.0+** — the recipient's Mac must be on Sonoma or newer.

---

## Option 1 — one command (recommended)

```bash
./scripts/build-app.sh
```

It will:
1. `xcodegen generate` (sync the project), then `xcodebuild` a **Release** build,
   **ad-hoc signed** (`CODE_SIGN_IDENTITY="-"`, no team, no provisioning profile).
2. Re-sign ad-hoc with hardened runtime and verify the signature.
3. Zip it with `ditto` into **`dist/Fellow2-YYYYMMDD.zip`**.

Then send `dist/Fellow2-….zip` + `docs/FOR-MILENA.md` to the tester.

**Why ad-hoc and not your Personal Team?** A free *development* signature is tied to
registered devices and expires in ~7 days — unreliable on someone else's Mac. Ad-hoc
("Sign to Run Locally") has no device list and no expiry; Gatekeeper just needs one manual
"Open Anyway".

---

## Option 2 — Xcode GUI (if you prefer clicking)

1. Xcode → **Product → Scheme → Edit Scheme → Run → Release** (build the Release config).
2. **Product → Archive**.
3. In the Organizer: **Distribute App → Custom → Copy App** → signing: **Sign to Run
   Locally** → Export.
4. Right-click the exported **Fellow 2.app → Compress** to make the zip.

---

## Before you send: smoke-test the export
Ad-hoc builds occasionally surprise you — don't let the first failure be on Milena's screen.
- Best: copy the `.app` to a **second Mac** (or a different macOS **user account**), and do
  the "Open Anyway" flow there.
- Confirm: app launches, **Sync macOS Calendar** imports events, notes save and persist
  across relaunch.

---

## What the recipient does
See **`docs/FOR-MILENA.md`** — install (unzip → Applications → Privacy & Security → Open
Anyway), then connect calendar (Internet Accounts → Google → Sync macOS Calendar).

---

## Troubleshooting: "Fellow 2 not opened" (Done / Move to Trash)
Expected Gatekeeper block. The "Open Anyway" button is **not** in that dialog:
1. Click **Done** → **System Settings → Privacy & Security → Security** → **Open Anyway**
   → authenticate → **Open Anyway** again.
2. If "Open Anyway" never appears, or it still refuses, the app picked up a quarantine flag
   in transit — clear it on the recipient Mac:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/Fellow 2.app"
   ```
   (Adjust the path to wherever the `.app` lives.) Then double-click — it opens cleanly.

> The quarantine flag is exactly why **Path B (notarized / TestFlight)** is better for
> non-technical testers — none of this appears.

## Known limitations of Path A (be upfront)
- **Gatekeeper warning** on first open — looks alarming to non-technical users; the
  FOR-MILENA sheet walks through it.
- **Not notarized** — fine for trusted internal testers, not for wide distribution.
- **No auto-update** — to ship a new version, rebuild and resend the zip.
- **Google sign-in** still uses the placeholder client ID, so testers must use the
  **EventKit** path (Sync macOS Calendar). See [07](07-integrations-and-sync.md).

---

## Path B (later, $99/yr) — when you want it frictionless
- **Notarized DMG**: Developer ID cert + `notarytool` → recipient opens normally, no warning.
- **TestFlight** (macOS supported): upload to App Store Connect → testers install via
  TestFlight with auto-updates. Best for multiple testers.
- Check whether **DH already has an Apple Developer / enterprise account** before paying
  personally — that would also be the "official" internal-tool route.
