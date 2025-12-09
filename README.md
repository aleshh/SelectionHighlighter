# Selection Highlighter (Safari Web Extension)

A small Safari Web Extension that automatically highlights all occurrences of the currently selected text on a page and adds a lightweight “find” toolbar with navigation controls.

When you select some text (by double-clicking or dragging), the extension:

- Highlights every matching occurrence of that text in the document
- Shows a full-width toolbar at the top of the window
- Displays `current / total` match count
- Lets you jump to the previous/next match
- Lets you clear all highlights

All of this happens automatically; no toolbar click required.

---

## Features

- **Automatic highlighting**
  - Listens for `selectionchange` and runs after you finish selecting text.
  - Ignores very short selections (less than 2 characters).

- **Minimal, page-integrated toolbar**
  - Fixed to the top of the viewport, full width, light gray background.
  - Right-aligned contents: `N / N matches` + Previous / Next / Close.
  - Thin, compact (≈30px tall) and attempts to ignore page CSS via strong resets.

- **Navigation**
  - Previous / Next buttons implemented with inline SVG arrows for consistent sizing.
  - The initially active match is the one nearest to your original selection (no jump to top of page).
  - Previous / Next scroll the page to center the active match.

- **Non-intrusive behavior**
  - Ignores selections inside its own toolbar.
  - Avoids interfering while you are actively drag-selecting with the mouse.
  - Clearing the selection (e.g. clicking elsewhere) clears the highlights and hides the toolbar.

---

## How it works

- **Manifest**
  - Uses a Safari Web Extension project template (Manifest V3 style).
  - `content_scripts` inject `content.js` on `<all_urls>` at `document_idle`.
  - `background.js` is essentially a no-op (only used for logging); the logic lives in `content.js`.

- **Content script (`content.js`)**
  - Tracks:
    - `selectionchange` events
    - Mouse down/up to avoid running while the user is still dragging
  - When it decides to run:
    1. Reads the current selection string.
    2. Clears any previous highlights / toolbar.
    3. Walks the DOM (skipping `<script>`, `<style>`, `<noscript>`) and wraps matches in `<span>` elements with a highlight class.
    4. Computes which match is closest to the original selection and sets that as the active match.
    5. Injects a toolbar at the top of the page with:
       - A label `current / total matches`
       - Prev/Next buttons (inline SVG)
       - A close button (`×`) to clear everything.

---

## Repository structure

The repo is an Xcode project with a macOS host app and a Safari Web Extension target. The important parts for the extension are:

- `SelectionHighlighter.xcodeproj/`
- `SelectionHighlighter/` (macOS host app)
- `SelectionHighlighter Extension/`
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `images/toolbar-icon.svg`
  - `images/icon-48.png`
  - `images/icon-96.png`
  - `images/icon-128.png`
  - `images/icon-256.png`
  - `images/icon-512.png`

You normally only need to edit files inside **`SelectionHighlighter Extension/`**.

---

## Development setup

Requirements:

- macOS (Safari 17+ recommended)
- Xcode (the project was created from **File → New → Project… → macOS → Safari Web Extension App**)

### 1. Enable the Develop menu and unsigned extensions in Safari

In Safari:

1. `Safari → Settings… → Advanced`
2. Check **“Show Develop menu in menu bar”**
3. In the menu bar, open **Develop**
4. Enable **“Allow Unsigned Extensions”**

(You only need this for development; a signed extension from the App Store would not require it.)

---

## Building and running

1. Open `SelectionHighlighter.xcodeproj` in Xcode.
2. In the scheme selector, choose the **macOS app** target (not the extension target).
3. Run (`⌘R`).
   - Xcode builds the app and the extension and launches the small host app window.
4. In that window, click **“Open Safari Extensions Preferences”**, or manually open:
   - `Safari → Settings… → Extensions`
5. Find **“Selection Highlighter”** (or the project’s extension name) and:
   - Enable the checkbox.
   - Allow it to run on “All Websites” (or as needed).

Once enabled:

- Go to any normal web page.
- Double-click a word, or drag to select multiple words.
- After you finish the selection, the highlights and toolbar should appear automatically.

---

## Customization

You can tweak behavior in `content.js`:

- **Minimum selection length**
  Change the `selectedText.length < 2` check to allow shorter or longer selections.

- **Highlight appearance**
  Edit the `.HIGHLIGHT_CLASS` and `.ACTIVE_CLASS` rules inside `injectStyle()`.

- **Toolbar layout**
  All toolbar styling is in `injectStyle()` under the `#BAR_ID` rules:
  - Alignment (`justify-content`)
  - Colors
  - Drop shadow
  - Height / spacing
  - Icon sizes (`button svg { width: …; height: … }`)

- **Matching behavior**
  Currently the search is case-insensitive and literal (`new RegExp(escaped, "gi")`).
  You can modify this to be case-sensitive or use more complex patterns.

---

## Debugging

- **Background script console**
  - Safari menu: `Develop → Web Extension Background Pages → Selection Highlighter`
- **Content script console**
  - `Develop → [this page] → Show Web Inspector → Console`
- Look for logs prefixed with `SelectionHighlighter`.
