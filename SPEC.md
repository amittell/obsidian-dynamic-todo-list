# Dynamic Todo List Plugin Specification

## Overview
A plugin for Obsidian that dynamically aggregates tasks from notes, allowing centralized task management while maintaining task context in source notes. Tasks can be identified either by a tag (default: `#tasks`) or by the presence of a "task" header in the note.

## Core Features

### Task Collection
- Note-level task collection (configurable to use either tags or headers).
- Support for standard Markdown checkbox tasks (`- [ ]` by default).
- Configurable task prefix (supports alternative formats, e.g., `* [ ]`).
- Real-time task state synchronization with source notes.
- Automatic task reindexing on file changes (debounced).
- Folder filtering: Configurable include and exclude lists for folder paths.

### User Interface
- Side pane integration:
  - Dedicated right sidebar view (named "Dynamic Todo List").
  - Persistent between sessions (remembers open/closed state).
  - Tasks grouped by source note.
  - Collapsible file sections.
  - Display of file creation and modification dates.
  - Separate section for notes containing only completed tasks (collapsible).
- Quick access via:
  - Ribbon icon (checkbox).
  - Command palette ("Toggle Task List").
  - Default hotkey (Cmd/Ctrl + J).
- Task list features:
  - Tasks grouped by source note.
  - Task completion status.
  - Interactive checkboxes (real-time state sync).
  - Source context preservation (clicking a task opens the source note and scrolls to the task line).
  - Markdown rendering within task text.
  - Configurable handling of links within tasks (wiki-links and URL links).
- Search and Sorting:
    - Search input to filter tasks by text or file name.
    - Sort dropdown to sort tasks by name, creation date, or modification date (ascending or descending).
- Loading Indication:
    - Progress bar and text displayed during initial task indexing.

### Settings & Configuration
- Configurable note identification method (tag or header).
- Configurable note tag (default: `#tasks`).
- Customizable task prefix (default: `- [ ]`).
- Built-in hotkey configuration through Obsidian settings.
- Real-time settings application.
- Configurable sort preference (field and direction).
- Configurable archiving of completed tasks (hide tasks completed more than X days ago).
- Configurable link behavior:
    - Enable/disable navigation for wiki-links within tasks.
    - Enable/disable navigation for URL links within tasks.
- Folder filtering:
    - List of folders to include.
    - List of folders to exclude.

## Technical Architecture

### Core Components
1.  **Plugin Module** (`main.ts`)
    -   Plugin lifecycle management (`onload`, `onunload`).
    -   Command/hotkey registration.
    -   Settings management (loading, saving).
    -   View registration (`TaskView`).
    -   Event handling (file modifications, deletions).
    -   Task indexing coordination.
    -   Debounced re-indexing.

2.  **Task Processing** (`taskProcessor.ts`)
    -   File content analysis (with caching).
    -   Task extraction (based on configurable tag/prefix).
    -   State management (task completion, completion dates).
    -   File modifications (toggling task completion).
    -   Folder filtering.
    -   Obsidian link creation.
    -   Navigation to source task.

3.  **Task View** (`taskView.ts`)
    -   Sidebar view implementation.
    -   Task list rendering (grouped by file, collapsible sections).
    -   User interaction handling (checkbox toggles, clicks for navigation).
    -   Search and sorting implementation.
    -   Loading indicator management.
    -   Markdown rendering for task text.
    -   Local storage for collapse state, search term, and sort preference.
    -   Separation of notes into active and completed sections.

4. **Task List Modal** (`taskListModal.ts`)
    - Modal view for displaying tasks (alternative to the side panel).
    - Displays tasks grouped by file.
    - Allows toggling task completion status.

5.  **Settings Tab** (`settingsTab.ts`)
    -   UI for configuring plugin settings.

6.  **Type System** (`types.ts`)
    -   Interface definitions:
        -   `PluginSettings`: Defines all configurable settings.
        -   `Task`: Represents a single task.
        -   `FileMetadata`: Represents file metadata (created, lastUpdated).
    -   Default configurations (`DEFAULT_SETTINGS`).

7. **Utilities** (`utils.ts`)
    - `debounce` function for debouncing operations.

### Data Flow
1.  **Initialization**
    -   Load user settings.
    -   Initialize task processor.
    -   Register view type (`TaskView`).
    -   Register commands & hotkeys.
    -   Setup file watchers (with debouncing).
    -   Index tasks on startup (with loading indicator).

2.  **Task Management**
    -   Monitor file changes (debounced).
    -   Process tagged/relevant notes based on settings.
    -   Extract & index tasks (using `taskProcessor.ts`).
    -   Update task states.
    -   Update view if active.

3.  **User Interaction**
    -   Activate/deactivate side pane view.
    -   Display grouped tasks.
    -   Handle task toggles (update file, update view).
    -   Real-time sync with source files.
    -   Handle search input (filter tasks).
    -   Handle sort selection (sort tasks).
    -   Handle clicks on tasks (navigate to source).

### Event Handling
-   Debounced file updates.
-   Error boundaries (with user notices and console logging).
-   Graceful plugin unloading (saving settings).
-   View state management (persisting collapse state, search, and sort).

## Implementation Details

### File Structure
```
src/
├── main.ts           # Plugin core
├── taskProcessor.ts  # Task handling
├── taskView.ts      # Sidebar view
├── taskListModal.ts  # Modal view
├── settingsTab.ts   # Settings tab
├── types.ts         # Type definitions
└── utils.ts         # Utility functions
```

### Error Handling
-   Graceful degradation.
-   User feedback via notices.
-   Console logging.
-   Recovery mechanisms (e.g., reverting UI state on toggle error).

### Performance
-   Debounced processing (file updates, search input).
-   Efficient indexing (using Obsidian's `cachedRead`).
-   Responsive UI (background updates, asynchronous operations).
-   Local storage for persisting view state.

### Mobile Support
-   `manifest.json` declares `isDesktopOnly: false`.
-   Disabling wiki-links by default improves the mobile experience.

## Testing
Structured test suite in `test-data/`:

1.  Basic functionality (`1-basic-tasks.md`).
2.  Settings & configuration (`2-settings-test.md`).
3.  Error cases (`3-error-handling.md`).

See `TEST_PLAN.md` for detailed testing procedures.