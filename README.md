# Dynamic Todo List for Obsidian

A plugin for Obsidian that creates a dynamic, aggregated list of tasks from your notes. Tag any note with `#tasks` to include its tasks in a centralized task list.

## Features

- 📑 **Note-Level Task Collection**: Tag any note with `#tasks` to include all its tasks
- ✅ **Standard Markdown Tasks**: Works with Obsidian's native task format
- 🔄 **Real-Time Updates**: Tasks update automatically as you edit notes
- 📱 **Mobile Compatible**: Works seamlessly on both desktop and mobile
- ⚡ **Quick Access**: 
  - Ribbon icon (dice)
  - Command palette
  - Configurable hotkey (set in Obsidian Settings > Hotkeys)
- 🎨 **Source Context**: Tasks stay organized by their source notes
- ⚙️ **Configurable**: Customize task format and note tag

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
- Note Tag: The tag that marks notes containing tasks (default: `#tasks`)
- Task Prefix: The prefix used to identify tasks (default: `- [ ]`)

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

### Community Plugins
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

### Setup
1. Clone the repository
2. Run `npm install`
3. Run `npm run build` to compile
4. Copy built files to your test vault's plugins folder

### Testing
- Test files are in `test-data/` directory
- Follow test cases in `TEST_PLAN.md`
- Run through test scenarios in numerical order

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
- Check [TEST_PLAN.md](TEST_PLAN.md) for testing procedures
- Submit issues on GitHub with steps to reproduce