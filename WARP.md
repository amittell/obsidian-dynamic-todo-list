# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Building the plugin
```bash
npm install                # Install dependencies
npm run dev                # Development build with watch mode
npm run build              # Production build with TypeScript checks
./build_deploy.sh          # Build and deploy to Obsidian vault
```

## Architecture Overview

This is an Obsidian plugin that creates a dynamic todo list by aggregating tasks from notes. The plugin follows Obsidian's plugin architecture with TypeScript and uses esbuild for bundling.

### Core Components

**main.ts** — Plugin entry point
- Plugin lifecycle (onload/onunload)
- Settings management
- View registration for the task sidebar
- File watchers with debouncing for real-time updates
- Command registration (toggle view with Cmd/Ctrl+J)

**taskProcessor.ts** — Task processing engine
- File scanning based on configurable tags (#tasks) or headers
- Task extraction from markdown files
- Task state management and file updates
- Folder filtering (include/exclude patterns)
- Navigation to source tasks

**taskView.ts** — Sidebar UI
- Renders tasks grouped by source file
- Collapsible file sections
- Search and sort functionality
- Separate sections for active and completed tasks
- Persists UI state (collapse states, search term, sort preference) using App.saveLocalStorage/loadLocalStorage
- Markdown rendering for task text
- Optional file header display with creation/modification dates
- Optional "move completed to bottom" for flat view

**settingsTab.ts** — Configuration interface
- Task identification method (tag vs header)
- Note tag/task prefix customization
- Folder filters with type-ahead suggestions (FolderSuggest)
- Sort preferences
- Task archiving settings
- Link behavior settings
- Show/hide file headers option
- Show/hide dates in file headers

**types.ts** — Type definitions
- PluginSettings interface
- Task interface with completion tracking
- Default settings configuration

**utils.ts** — Utility functions
- Debouncing implementation

### Data Flow

1. Files tagged with `#tasks` (configurable) or containing task headers are monitored
2. Tasks are extracted using configurable prefix (default: `- [ ]`)
3. Tasks are indexed and synchronized in real-time
4. UI updates automatically on file changes (debounced)
5. Task completion syncs bidirectionally with source files

## Key Technical Context

### Task Identification
- Supports two modes: tag-based (`#tasks`) and header-based ("Tasks" header)
- Configurable via settings
- Default is tag-based

### Performance Optimizations
- File changes are debounced to prevent excessive re-indexing
- Uses Obsidian's `cachedRead` for efficient file reading
- Tasks include `lastUpdated` timestamps to prevent circular updates
- DOM updates use batch operations where possible

### State Management
- UI state (collapse states, search term, sort preferences) persists using App.saveLocalStorage/loadLocalStorage (vault-specific)
- Tasks maintain bidirectional sync with source files
- Proper cleanup in plugin lifecycle methods

### Mobile Support
- Plugin is mobile compatible (`isDesktopOnly: false`)
- Responsive UI design
- Touch-friendly interactions

### Folder Filtering
- Supports include/exclude patterns for folder filtering
- Configurable via settings with type-ahead folder suggestions
- FolderSuggest class extends AbstractInputSuggest for autocomplete

## Important Development Notes

### Obsidian-Specific Patterns
- Use `this.app` to access Obsidian's API
- Implement proper plugin lifecycle (onload/onunload)
- Use `cachedRead` for efficient file reading
- Register views using `this.registerView()`
- Use `Notice` for user feedback
- Follow Obsidian's settings API patterns

### Code Style
- Use TypeScript strict mode
- Use async/await for file operations
- Implement proper error handling with user-friendly notices
- Follow existing modular architecture
- Clean up event listeners in onunload

### Testing
- Test using files in `test-data/` directory
- Reference `TEST_PLAN.md` for comprehensive manual testing procedures
- Test both desktop and mobile scenarios
- Verify real-time sync functionality
- Test both tag-based and header-based task identification

## Build System

- **Bundler**: esbuild (configured in `esbuild.config.mjs`)
- **TypeScript target**: ES2018
- **Module format**: ESNext
- **Output**: `main.js` (bundled from `src/main.ts`)
- **Production builds**: Include TypeScript type checking
- **Development builds**: Include inline sourcemaps and watch mode

## Deployment

The `build_deploy.sh` script builds the plugin and deploys to:
```
~/Documents/Alex's Messy Mind/.obsidian/plugins/dynamic-todo-list/
```

Files deployed:
- `main.js`
- `manifest.json`
- `styles.css`
