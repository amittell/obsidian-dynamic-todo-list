# Dynamic Todo List for Obsidian

A plugin for Obsidian that creates a dynamic, aggregated list of tasks from your notes. Tag any note with `#tasks` to include its tasks in a centralized task list.

## Features

- 📑 **Note-Level Task Collection**: Tag any note with `#tasks` (or use header-based detection)
- ✅ **Standard Markdown Tasks**: Works with Obsidian's native task format
- 🔄 **Real-Time Updates**: Tasks update automatically as you edit notes
- 📱 **Mobile Compatible**: Works seamlessly on both desktop and mobile
- ⚡ **Quick Access**: 
  - Ribbon icon (dice)
  - Command palette
  - Configurable hotkey (set in Obsidian Settings > Hotkeys)
- 🎨 **Flexible Views**: 
  - Tasks organized by source notes with collapsible sections
  - Optional file headers with creation/modification dates
  - Flat list view with optional "completed tasks to bottom"
- 📎 **Folder Filtering**: Include/exclude folders with type-ahead autocomplete
- 🔍 **Search & Sort**: Filter tasks by text and sort by name, creation, or modification date
- 📋 **Auto-Archive**: Automatically hide completed tasks older than X days
- 🔗 **Smart Links**: Configurable wiki-link and URL navigation within tasks
- ⚙️ **Highly Configurable**: Customize task format, note tags, and display preferences

## Usage

1. Tag any note with `#tasks` (configurable in settings)
2. Add tasks using standard Markdown:
   ```markdown
   - [ ] Your task here
   ```
3. Access your tasks via:
   - Click the dice icon in the left ribbon
   - Use command palette: "Show Task List"
   - Set up a custom hotkey in Obsidian settings
4. Toggle tasks in the list to update them in their source notes

## Configuration

Settings > Dynamic Todo List:

**Task Identification:**
- Task identification method: By tag or by header
- Note Tag: The tag that marks notes containing tasks (default: `#tasks`)
- Task Prefix: The prefix used to identify tasks (default: `- [ ]`)

**Display Options:**
- Default sort order: Name, creation date, or modification date (ascending/descending)
- Auto-archive: Hide completed tasks older than X days
- Show file headers: Display file names as section headers
- Show dates: Show creation/modification dates in headers
- Move completed to bottom: In flat view, show completed tasks last

**Link Behavior:**
- Enable wiki-links: Allow clicking [[links]] in tasks
- Enable URL links: Allow clicking URLs in tasks

**Folder Filtering:**
- Include folders: Specify folders to scan (with autocomplete)
- Exclude folders: Specify folders to skip (with autocomplete)

## Example

```markdown
# Project Planning #tasks

## Today
- [ ] Review documentation
- [ ] Update dependencies
- [x] Setup environment

## Tomorrow
- [ ] Team meeting
- [ ] Code review
```

## Installation

### Community Plugins (NB: Future release - not currently available)
1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Dynamic Todo List"
4. Install and enable the plugin

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css`
2. Copy to your vault's `.obsidian/plugins/dynamic-todo-list/` folder
3. Reload Obsidian
4. Enable the plugin in Settings > Community Plugins

## Development

### Prerequisites
- Node.js and npm installed
- Basic knowledge of TypeScript and Obsidian API

### Building from Source
1. Clone the repository
2. Run `npm install`
3. Run `npm run build` to compile
4. Copy built files to your test vault's plugins folder

## Contributing

1. Fork the repository
2. Create your feature branch
3. Follow specifications in `SPEC.md`
4. Test using provided test files
5. Submit a pull request

## License

[MIT License](LICENSE) - see LICENSE file for details

## Support

- Review [SPEC.md](SPEC.md) for technical details
- Submit issues on GitHub with steps to reproduce
