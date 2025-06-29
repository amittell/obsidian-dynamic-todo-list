# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building the plugin
```bash
npm run build   # Production build with TypeScript checks
npm run dev     # Development build with watch mode
```

### Development workflow
```bash
npm install     # Install dependencies
npm run dev     # Start development build with file watching
```

### Deploying the plugin
```bash
./build_deploy.sh  # Build and deploy to Obsidian vault
```

## Architecture Overview

This is an Obsidian plugin that creates a dynamic todo list by aggregating tasks from notes. The plugin follows Obsidian's plugin architecture with TypeScript and uses esbuild for bundling.

### Core Components

1. **Plugin Entry (main.ts)**: Main plugin class that extends Obsidian's Plugin class. Handles:
   - Plugin lifecycle (onload/onunload)
   - Settings management
   - View registration for the task sidebar
   - File watchers with debouncing for real-time updates
   - Command registration (toggle view with Cmd/Ctrl+J)

2. **Task Processing (taskProcessor.ts)**: Handles all task-related operations:
   - File scanning based on configurable tags (#tasks) or headers
   - Task extraction from markdown files
   - Task state management and file updates
   - Folder filtering (include/exclude patterns)
   - Navigation to source tasks

3. **Task View (taskView.ts)**: Implements the sidebar UI:
   - Renders tasks grouped by source file
   - Collapsible file sections
   - Search and sort functionality
   - Separate sections for active and completed tasks
   - Persists UI state (collapse states, search term, sort preference) in localStorage
   - Markdown rendering for task text

4. **Settings (settingsTab.ts)**: Configuration UI for:
   - Task identification method (tag vs header)
   - Note tag/task prefix customization
   - Folder filters
   - Sort preferences
   - Task archiving settings
   - Link behavior settings

5. **Type System (types.ts)**: TypeScript interfaces and defaults:
   - PluginSettings interface
   - Task interface with completion tracking
   - Default settings configuration

### Key Implementation Details

- **Debouncing**: File changes are debounced to prevent excessive re-indexing
- **Performance**: Uses Obsidian's cachedRead for efficient file reading
- **State Management**: Tasks include lastUpdated timestamps to prevent circular updates
- **Mobile Support**: Designed to work on both desktop and mobile (isDesktopOnly: false)
- **Error Handling**: Graceful degradation with user notices for errors

### Testing

Manual test plan available in TEST_PLAN.md covers:
- Basic task detection (tag and header modes)
- Settings configuration
- Real-time updates
- Error handling
- Performance testing
- Mobile compatibility