# Writer Statistics Dashboard

An Obsidian plugin that tracks your daily writing statistics, streaks, and goals.

## Features

- **Word count tracking** — Automatically counts words as you type, distinguishing between typed and pasted text
- **Daily goal** — Set a daily word count goal and track your progress with a visual progress bar
- **Streak tracking** — See how many consecutive days you've been writing
- **7-day bar chart** — Visualize your writing output over the past week
- **30-day sparkline** — See your writing trends at a glance
- **Folder filtering** — Include or exclude specific folders from tracking
- **Status bar** — Always see today's word count and current streak

## Usage

1. Click the bar chart icon in the ribbon or use the command palette: **Open Writer Statistics**
2. The dashboard opens in the right sidebar showing your stats
3. Configure settings (daily goal, folders, paste counting) in Settings → Writer Statistics

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Daily goal | Target word count per day | 500 |
| Count pasted words | Include pasted text in totals | Yes |
| Include folders | Only track these folders (comma-separated) | All |
| Exclude folders | Never track these folders (comma-separated) | None |

## Installation

### From Community Plugins

1. Open **Settings → Community Plugins → Browse**
2. Search for "Writer Statistics Dashboard"
3. Click **Install**, then **Enable**

### Manual Installation

1. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/obsidian-writer-stats/` directory.
2. Enable the plugin in Obsidian's Community Plugins settings.


## Inspiration

This plugin was built in response to a request by u/Miserable-Singer330 in [this Reddit thread](https://www.reddit.com/r/ObsidianMD/comments/1r8vw0w/anyone_have_a_plugin_request/) — a writing statistics dashboard with streaks and goals.

## Author

Cody Bontecou
