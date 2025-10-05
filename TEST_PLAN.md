# Manual Test Plan for Dynamic Todo List Plugin

## Setup

1.  Create a fresh Obsidian vault called "plugin-test-vault".
2.  Install the plugin by copying the following files to `.obsidian/plugins/dynamic-todo-list/`:
    -   `main.js`
    -   `manifest.json`
    -   `styles.css` (if exists)
3.  Enable the plugin in Obsidian Settings > Community Plugins.
4.  Restart Obsidian (to ensure full initialization).

## Test Cases

### 1. Basic Task Detection

**1.1 Tag-Based Detection (Default)**

**Setup:**

-   Create a new note called "Tasks.md".
-   Add the following content:

```md
# My Tasks #tasks
- [ ] Basic task
- [x] Completed task
- [ ] Another task
```

**Expected:**

-   All three tasks should be displayed in the Dynamic Todo List view.
-   The "Completed task" should be marked as complete.
-   If "Show file headers" is enabled (default), tasks are grouped under "Tasks.md".
-   If "Show file headers" is disabled, tasks appear in a flat list.
- Clicking the checkbox next to a task should toggle its state in both the view and the source file.

**1.2 Header-Based Detection**

**Setup:**

-   Open Settings > Dynamic Todo List.
-   Change "Task identification method" to "By note header".
-   Create a new note called "TasksHeader.md"
- Add the following content:

```md
# Tasks
- [ ] A task with a header
- [x] Another completed task
```

**Expected:**
- The tasks in "TasksHeader.md" should appear.
- The tasks in "Tasks.md" should no longer appear (since it doesn't use the header method).

**1.3 Mixed Content**
**Setup:**
- Add content that is *not* a task to "Tasks.md" and "TasksHeader.md", both above and below the tasks.

**Expected:**
- Only valid tasks are displayed, other content is ignored.

### 2. Settings Configuration

**2.1 Note Tag**

**Steps:**

1.  Open Settings > Dynamic Todo List.
2.  Change "Note tag" to "#todo".
3.  Create a new note called "Todo.md" with:

```md
# Todo Items #todo
- [ ] A new task with #todo tag
```

4. Create a new note called "Tasks_still.md" with

```md
# Tasks #tasks
- [ ] A new task with #tasks tag
```

**Expected:**

-   The plugin should reindex automatically.
-   Only the task in "Todo.md" (with the `#todo` tag) should be displayed.
- The task in "Tasks_still.md" should not be displayed.

**2.2 Task Prefix**

**Steps:**

1.  Open Settings > Dynamic Todo List.
2.  Change "Task prefix" to `* [ ]`.
3.  Create a new note called "StarTasks.md" with:

```md
* [ ] A task with a star prefix
```

4. Edit "Todo.md" to have a task with the old prefix:

```md
- [ ] #todo A task with a dash prefix
```

**Expected:**

-   The plugin should reindex.
-   Only the task in "StarTasks.md" should be displayed.
- The task in "Todo.md" should not be displayed.

**2.3 Default Sort Order**

**Steps:**

1.  Open Settings > Dynamic Todo List.
2.  Change "Default sort order" to "Name (Z to A)".
3. Create multiple tasks with different names.

**Expected:**

-   Tasks should be sorted alphabetically from Z to A by their source file name.
- Test all other sort options (Name A-Z, Created Newest, Created Oldest, Modified Newest, Modified Oldest) and verify correct sorting.

**2.4 Archive Completed Tasks**

**Steps:**

1.  Open Settings > Dynamic Todo List.
2.  Change "Archive completed tasks" to "1".
3.  Complete a task and wait for more than 24 hours.

**Expected:**

-   The completed task should be hidden from the view after 24 hours.
- If you change the setting to 0, the task should reappear.

**2.5 Enable Wiki-Links**

**Steps:**
1. Open Settings > Dynamic Todo List.
2. Toggle "Enable wiki-links" to on.
3. Create a task with a wiki-link: `- [ ] #tasks [[Some Note]]`

**Expected:**
- Clicking on the wiki-link should *not* open the linked note (for now). It should open the task in its source note.

**2.6 Enable URL Links**

**Steps:**
1. Open Settings > Dynamic Todo List.
2. Ensure "Enable URL links" is on (default).
3. Create a task with a URL: `- [ ] Visit https://obsidian.md` in a note tagged #tasks

**Expected:**
- Clicking on the URL should open the URL in a browser.
- If disabled, clicking the URL will open the task in its source note.

**2.7 Show File Headers**

**Steps:**
1. Open Settings > Dynamic Todo List.
2. Toggle "Show file headers" on (default).
3. Create multiple notes with tasks.

**Expected:**
- Tasks are grouped by source file with collapsible sections.
- Each file section shows the file name.
- If "Show created / modified dates" is enabled, file headers show creation and modification dates.

**2.8 Show Created / Modified Dates**

**Steps:**
1. Open Settings > Dynamic Todo List.
2. Ensure "Show file headers" is enabled.
3. Toggle "Show created / modified dates" on/off.

**Expected:**
- When enabled: File headers display "Created: [date] | Modified: [date]".
- When disabled: File headers show only the file name.

**2.9 Move Completed Tasks to Bottom**

**Steps:**
1. Open Settings > Dynamic Todo List.
2. Disable "Show file headers".
3. Enable "Move completed tasks to bottom of list".
4. Create a mix of completed and open tasks.

**Expected:**
- In flat list view, all open tasks appear first.
- All completed tasks appear at the bottom.
- This setting only appears when file headers are disabled.

**2.10 Folder Filters (Include)**
**Steps:**
1. Create a folder called `tasks`.
2. Create a note inside called `tasks/in.md` with a task.
3. Create a note outside called `out.md` with a task.
4. Open Settings > Dynamic Todo List.
5. Add `tasks/` to "Include folders".

**Expected:**
- Only the task in `tasks/in.md` should be displayed.

**2.11 Folder Filters (Exclude)**
**Steps:**
1. Create a folder called `tasks`.
2. Create a note inside called `tasks/in.md` with a task.
3. Create a note outside called `out.md` with a task.
4. Open Settings > Dynamic Todo List.
5. Add `tasks/` to "Exclude folders".

**Expected:**
- Only the task in `out.md` should be displayed.

**2.12 Folder Autocomplete**

**Steps:**
1. Open Settings > Dynamic Todo List.
2. Click "Add include folder" or "Add exclude folder".
3. Start typing a folder path.

**Expected:**
- Type-ahead suggestions appear showing matching folders from your vault.
- Selecting a suggestion fills in the folder path.

**2.13 Test combinations of include and exclude filters.**

**2.14 Test adding and removing include/exclude filters.**

### 3. Real-time Updates

**Steps:**

1.  Open the Dynamic Todo List view.
2.  Open a note containing tasks in a separate pane.
3.  Add a new task to the note.
4.  Edit an existing task's text.
5.  Toggle a task's completion status.
6.  Delete a task.

**Expected:**

-   The Dynamic Todo List view should update automatically within a short delay (due to debouncing) to reflect all changes.

### 4. Error Handling

**Steps:**

1.  Create a note with malformed tasks:

```md
-#tasks No space
- [ #tasks Missing bracket
- [x] tasks Missing hash
```

**Expected:**

-   The plugin should not crash.
-   Invalid tasks should be ignored.
-   Valid tasks in the same file (if any) should still be indexed.

### 5. Performance

**Steps:**

1.  Create a large number of notes (e.g., 50) with multiple tasks in each (e.g., 10 tasks per note).
2.  Open the Dynamic Todo List view.

**Expected:**

-   The view should load and display all tasks within a reasonable time (a few seconds).
-   Obsidian should remain responsive, with no significant lag or freezing.

### 6. Plugin Lifecycle

**Steps:**

1.  Disable the plugin.
2.  Re-enable the plugin.
3.  Restart Obsidian.

**Expected:**

-   The plugin should disable and re-enable cleanly without errors.
-   Settings should persist across restarts.
-   Tasks should be re-indexed correctly after restarting.

### 7. View State

**Steps:**

1. Open the Dynamic Todo List view.
2.  Collapse some file sections.
3.  Enter text in the search input.
4.  Change the sort order.
5. Close the view.
6. Re-open the view.

**Expected:**

-   Collapsed sections should remain collapsed.
-   The search input should retain its value.
-   The selected sort order should be preserved.

### 8. Mobile Compatibility

**Steps:**

1.  Install the plugin on a mobile device.
2.  Repeat tests 1-3 and 7 on mobile.

**Expected:**

-   All functionality should work identically on mobile.
-   No desktop-specific errors should appear.
-   The UI should be responsive and usable on a smaller screen.

### 9. Navigation

**Steps:**
1. Open the Dynamic Todo List View.
2. Click on the text of a task (not on a link).

**Expected:**
- Obsidian should open the source note containing the task.
- The view should scroll to the task line.

### 10. Search Functionality

**Steps:**
1. Open the Dynamic Todo List view.
2. Type text in the search box at the top.

**Expected:**
- Tasks are filtered to show only those matching the search text.
- Search matches task text and file names.
- Search is case-insensitive.
- Clearing the search box shows all tasks again.

### 11. Vault-Specific Storage

**Steps:**
1. Open the Dynamic Todo List view.
2. Collapse some file sections and enter a search term.
3. Close Obsidian.
4. Open a different vault with the same plugin.
5. Return to the original vault.

**Expected:**
- Each vault maintains its own view state (collapsed sections, search, sort).
- State from one vault doesn't leak into another vault.
- Uses App.loadLocalStorage/saveLocalStorage (not browser localStorage).

### 12. Edge Cases and Boundary Conditions

**11.1 Empty Files:**
- Create empty markdown files, both with and without the task tag/header.
- **Expected:** No errors, empty files are ignored.

**11.2 Files with Only Whitespace:**
- Create files with only whitespace and the task tag/header.
- **Expected:** No errors, files are ignored.

**11.3 Very Long Task Text:**
- Create tasks with extremely long text.
- **Expected:** Text should wrap or truncate gracefully in the view.

**11.4 Special Characters in Task Text:**
- Create tasks with various special characters (e.g., `!@#$%^&*()_+=-`{}[]\|;:'",<.>/?`).
- **Expected:** Characters should be rendered correctly.

**11.5 HTML in Task Text:**
- Create tasks with HTML tags in the task text.
- **Expected:** HTML should be rendered as plain text (not interpreted).

**11.6 Unicode Characters:**
- Create tasks with various Unicode characters.
- **Expected:** Characters should be rendered correctly.

**11.7 Very Large Number of Tasks:**
- Create a very large number of tasks (e.g., thousands).
- **Expected:** Performance should be reasonable; loading may take longer, but the UI should remain responsive.

**11.8 Rapidly Changing Files:**
- Modify files very rapidly (e.g., using an external script).
- **Expected:** Debouncing should prevent excessive re-indexing.

**11.9 Files with Same Name in Different Folders:**
- Create multiple files with the same name in different folders.
- **Expected:** Tasks should be grouped correctly by full file path.

**11.10 Files with very long path:**
- Create files with very long paths.
- **Expected:** Paths should be displayed correctly (possibly truncated) in the view.

## Bug Report Template

If you find issues, please report them with:

1.  Test case number and step where the issue occurred.
2.  Expected vs actual behavior.
3.  Steps to reproduce.
4.  Platform (desktop/mobile) and Obsidian version.
5.  Console logs (if available - press Ctrl+Shift+I to open developer tools).