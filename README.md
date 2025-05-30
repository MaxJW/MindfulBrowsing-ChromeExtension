# Mindful Browsing

A chrome extension that shows a timer before accessing distracting websites, helping you browse with less distractions. Uses the latest Manifest V3!

## Features

- **Simple Timer**: Shows a timer before visiting distracting sites like e.g. X, YouTube, Facebook
- **No Repeat Timers**: Skip timer when navigating within the same site or going back in history within the same tab
- **Customizable**: Set timer duration, overlay colors, and motivational message
- **Statistics**: Track how many distractions you've avoided

## Installation

1. Clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder

## Usage

1. Visit a website from your list → timer overlay appears
2. Take a moment to breathe and reflect
3. Continue or close the tab
4. Customize settings by clicking the extension icon

## Default Sites

- facebook.com, x.com, reddit.com, instagram.com, youtube.com, tiktok.com

Add your own sites in the settings popup. Supports wildcards like `*.reddit.com`.

## Development

Built with vanilla JavaScript and Chrome Extension Manifest V3.

**Files:**
- `manifest.json` - Extension config
- `background.js` - Tab management
- `content.js` - Overlay injection
- `popup.*` - Settings interface
- `overlay.*` - Timer interface

## License

MIT