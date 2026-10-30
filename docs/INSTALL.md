# Installing "Should I Read This?" (Beta)

This guide is for beta testers. You will install the extension directly from a zip file — no Chrome Web Store required.

---

## What you need

- Google Chrome on macOS or Windows
- The zip file from the latest [GitHub Release](https://github.com/eldhoabe/-AnalyzePost/releases/latest)

---

## Installation steps

### 1. Download and unzip

1. Go to the [Releases page](https://github.com/eldhoabe/-AnalyzePost/releases/latest).
2. Under **Assets**, download `should-i-read-this-vX.Y.Z.zip`.
3. Unzip it into a **permanent folder** — somewhere like `Documents/should-i-read-this` or your Desktop.

   > **Do not leave it in your Downloads folder.** Chrome reads the extension from wherever you unzip it, every time it starts. If you delete or move the folder later, the extension will stop working.

---

### 2. Enable Developer mode in Chrome

1. Open a new tab and go to `chrome://extensions`.
2. In the top-right corner, toggle **Developer mode** on.

   You will see three new buttons appear: Load unpacked, Pack extension, and Update.

---

### 3. Load the extension

1. Click **Load unpacked**.
2. In the file picker, navigate to the folder you unzipped in step 1 and select it.
   - You should see a file called `manifest.json` inside that folder — that is the right one.
3. The extension card for **Should I Read This?** will appear on the page.

---

### 4. Pin it to your toolbar

1. Click the puzzle-piece icon (🧩) in the top-right of Chrome.
2. Find **Should I Read This?** and click the pin icon next to it.

The extension icon will appear in your toolbar.

---

### 5. Try it out

1. Go to any webpage and select some text (a LinkedIn post, a news article, anything).
2. Right-click the selected text and choose **Analyze this post**.
   - Or press **Alt+A** (Windows/Linux) / **Option+A** (Mac).
3. A card will appear with a signal score and a recommendation.

---

### 6. Updating to a new version

1. Download the new zip from the [Releases page](https://github.com/eldhoabe/-AnalyzePost/releases/latest).
2. Unzip it into the same permanent folder, replacing the old files (or into a new folder — either is fine).
3. Go to `chrome://extensions` and click the **reload icon** (↺) on the **Should I Read This?** card.

---

## Common questions

### "Chrome is warning me about developer mode extensions"

When Chrome starts, it may show a banner: **"Disable developer mode extensions."**

This is expected for extensions installed with Load unpacked. Click **Cancel** (or **Keep it**) to dismiss it. You will see this banner every time Chrome starts until the extension is published on the Chrome Web Store.

---

### Work-managed browsers (company laptops)

Some company-managed Chrome profiles block extensions that are not on an approved list. If you see an error like "Extensions are disabled by your administrator," try using a **personal Chrome profile** instead:

1. Click your profile picture in the top-right of Chrome.
2. Click **Add** to create a personal profile.
3. Repeat the installation steps in that profile.

---

### Privacy

When you analyze a post, the selected text is sent to the backend (`https://analyzepost.onrender.com`) over HTTPS.

**What is stored:** The backend caches a hash of the post text (not the text itself) so that repeated analyses of the same post do not call the AI model again. The hash is stored in memory and is lost when the server restarts.

**What is not stored:** The raw post text is discarded immediately after scoring unless you explicitly opt in via the `save_post` flag (off by default — the extension never sets it). Your IP address is used only for rate limiting (20 requests per minute) and is not logged or retained.

**To uninstall:** Go to `chrome://extensions`, find **Should I Read This?**, and click **Remove**. No data is stored locally beyond your profile settings (role and interests), which are stored in Chrome's extension storage on your own machine.

---

### Feedback

- **Bug reports:** [Open an issue on GitHub](https://github.com/eldhoabe/-AnalyzePost/issues/new)
- **Feedback form:** _(link coming soon — fill in before sending to testers)_

---

## Troubleshooting

### "Manifest file is missing or unreadable"

You selected the wrong folder. Make sure you selected the folder that **contains** `manifest.json`, not a parent folder or the zip file itself. Open the folder in Finder/Explorer first to confirm `manifest.json` is at its root.

### "Could not load extension from…" / manifest error in `chrome://extensions`

The extension card shows a red error. Click the error link to see details. Common cause: the folder was moved after loading. Click **Remove**, then re-load the extension from the new location.

### The card says "Couldn't reach the analysis backend"

The extension could not connect to `https://analyzepost.onrender.com`. Try:
1. Check your internet connection.
2. The backend may be asleep (it runs on Render's free tier and sleeps after inactivity). Wait 20–30 seconds and try again — the first request wakes it up.
3. If it still fails, [open an issue](https://github.com/eldhoabe/-AnalyzePost/issues/new) with the text you tried to analyze.
