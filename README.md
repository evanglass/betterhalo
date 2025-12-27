# BetterHalo - Manifest V3 Extension Template

This is a basic template for a cross-browser extension using Manifest V3, compatible with Chrome, Edge, and Firefox.

## Project Structure
...
## How to Install Manually

### Chrome / Edge / Brave
1.  **Open Extensions Page:**
    - In Chrome, go to `chrome://extensions/`.
    - In Edge, go to `edge://extensions/`.
2.  **Enable Developer Mode:**
    - Toggle the **Developer mode** switch in the top right corner.
3.  **Load Unpacked Extension:**
    - Click the **Load unpacked** button.
    - Navigate to and select the folder containing this project (`BetterHalo`).

### Firefox
1.  **Open Debugging Page:**
    - Go to `about:debugging#/runtime/this-firefox`.
2.  **Load Temporary Add-on:**
    - Click the **Load Temporary Add-on...** button.
    - Navigate to the project folder and select the `manifest.json` file.

## Verify Installation
- You should see "BetterHalo" in your list of extensions.
- Click the extension icon in the toolbar to see the popup.
- Open the console on any webpage to see the "BetterHalo content script loaded" message.

## Development

- **Background Script:** Edit `background.js` for background tasks.
- **Content Script:** Edit `content.js` to interact with web pages.
- **Popup:** Edit files in the `popup/` directory to change the extension's UI.
- **Icons:** Add your own icons to an `icons/` folder and update `manifest.json` if needed.
