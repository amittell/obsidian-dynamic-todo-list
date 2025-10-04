# PR Review Fixes Progress

Branch: `pr-review-fixes`  
Review Comment: [#3310390328](https://github.com/obsidianmd/obsidian-releases/pull/7195#issuecomment-3310390328)

## ✅ Completed Fixes (6/14)

### 1. ✅ Update LICENSE year to 2025
- **Commit**: `cc27e34`
- **Changes**: Updated copyright from 2024 to 2025
- **Verified**: ✅

### 2. ✅ Remove unnecessary saveData on unload
- **Commit**: `a3c2262`
- **Changes**: Removed `await this.saveData()` call from `onunload()`
- **Verified**: ✅

### 3. ✅ Replace custom debounce with Obsidian's built-in
- **Commit**: `3e6a739`
- **Changes**: 
  - Imported `debounce` from 'obsidian'
  - Removed custom `src/utils.ts` file
  - Updated taskView.ts to use Obsidian's debounce
- **Verified**: ✅

### 4. ✅ Use Vault.process instead of Vault.modify
- **Commit**: `fcc3663`
- **Changes**: Replaced `vault.modify()` with `vault.process()` in taskProcessor.ts `toggleTask()` method
- **Verified**: ✅

### 5. ✅ Use instanceof checks instead of type casts
- **Commit**: `fcc3663`
- **Changes**: Changed `(view as MarkdownView)` to `view instanceof MarkdownView` in taskProcessor.ts
- **Verified**: ✅

### 6. ✅ Use getAllTags and MetadataCache for tag/header detection
- **Commit**: `fcd6d78`
- **Changes**:
  - Added `getAllTags` import from 'obsidian'
  - Implemented `fileHasConfiguredTag()` method using metadata cache
  - Implemented `fileHasConfiguredHeader()` method using metadata cache
  - Replaced string-based detection with metadata-based detection
- **Verified**: ✅

## 🔄 Remaining Fixes (8/14)

### 7. ⏳ Prefix CSS classes with dtl- and make selectors plugin-specific
- **Status**: Not started
- **Files**: styles.css, src/taskView.ts, src/taskListModal.ts
- **Scope**: Large - affects ~100+ class names
- **Priority**: HIGH (prevents conflicts with other plugins)
- **Approach**:
  1. Add root class `.dtl-root` or `.dtl-view` to main container
  2. Prefix ALL generic classes (task-, clickable-icon, hotkey-setting, wiki-links-enabled, settings-info-indicator, sub-setting)
  3. Update all TypeScript class references
  4. Test visual rendering

### 8. ⏳ Convert UI text to sentence case
- **Status**: Not started
- **Files**: src/main.ts, src/taskView.ts, src/settingsTab.ts, src/taskListModal.ts
- **Priority**: MEDIUM
- **Strings to change**:
  - 'Dynamic Todo List' → 'Dynamic todo list'
  - 'Toggle Task List' → 'Toggle task list'
  - 'Created (Newest)' → 'Created (newest)'
  - 'Created (Oldest)' → 'Created (oldest)'
  - 'Modified (Newest)' → 'Modified (newest)'
  - 'Modified (Oldest)' → 'Modified (oldest)'
  - 'Task Link Behavior' → 'Task link behavior'
  - 'Folder Filters' → 'Folder filters'
  - 'Add Include Folder' → 'Add include folder'
  - 'Add Exclude Folder' → 'Add exclude folder'
  - 'Completed Notes (...)' → 'Completed notes (...)'
  - 'Completed Tasks (...)' → 'Completed tasks (...)'
  - 'Tasks From Tagged Notes' → 'Tasks from tagged notes'

### 9. ⏳ Remove this.view property; avoid managing custom view references
- **Status**: Not started
- **Files**: src/main.ts
- **Priority**: HIGH (guideline violation)
- **Changes needed**:
  - Remove `private view: TaskView | null = null;` property
  - Remove all assignments to `this.view`
  - Update `activateView()` to not store view reference
  - Update all view interactions to use `workspace.getLeavesOfType()`
  - Update onunload to use `workspace.detachLeavesOfType()`

### 10. ⏳ Remove top-level settings heading
- **Status**: Not started
- **Files**: src/settingsTab.ts line 28
- **Priority**: LOW
- **Changes**: Remove `containerEl.createEl('h2', { text: 'Dynamic Todo List Settings' });`

### 11. ⏳ Use Setting().setHeading() for section headers
- **Status**: Not started  
- **Files**: src/settingsTab.ts lines 158, 185
- **Priority**: MEDIUM
- **Changes**:
  - Replace `containerEl.createEl('h3', { text: 'Task Link Behavior' });` with `new Setting(containerEl).setName('Task link behavior').setHeading();`
  - Replace `containerEl.createEl('h3', { text: 'Folder Filters' });` with `new Setting(containerEl).setName('Folder filters').setHeading();`

### 12. ⏳ Conditionally show/hide irrelevant settings
- **Status**: Not started
- **Files**: src/settingsTab.ts
- **Priority**: LOW (nice-to-have)
- **Changes**: Implement visibility toggling based on taskIdentificationMethod setting

### 13. ⏳ Finalize UI class usage after CSS changes
- **Status**: Blocked by #7
- **Priority**: HIGH
- **Changes**: Verification step after CSS refactoring

### 14. ⏳ Full build, deploy, and manual verification
- **Status**: Blocked by all above
- **Priority**: HIGH
- **Changes**: Final testing and verification

## Next Steps

1. **Implement Fix #9** - Remove this.view property (critical for guidelines)
2. **Implement Fix #8** - Convert UI text to sentence case (medium effort)
3. **Implement Fixes #10 & #11** - Settings tab improvements (quick wins)
4. **Implement Fix #7** - CSS namespacing (largest task, save for last or break into smaller commits)
5. **Final verification** - Build, deploy, test

## Build Status

Last successful build: `fcd6d78`  
All TypeScript compilation: ✅ PASSING  
No runtime errors: ✅ (to be verified after deployment)

## Testing Notes

- Local testing recommended after each major change
- Deploy using: `./build_deploy.sh`
- Test vault: `~/Documents/Alex's Messy Mind/`
- Focus areas:
  - Tag detection (both inline and frontmatter)
  - Task toggling with Vault.process
  - View lifecycle without this.view reference
  - CSS rendering with dtl- prefixes
