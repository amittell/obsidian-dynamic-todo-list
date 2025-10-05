# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2025-10-05

### Added
- **Folder filtering with autocomplete** - Include/exclude specific folders with type-ahead folder suggestions
- **Flexible view modes** - Toggle between grouped (by file) and flat task lists
- **Display options**:
  - Show/hide file headers
  - Show/hide created/modified dates in headers
  - Move completed tasks to bottom in flat view
- **Auto-archive** - Automatically hide completed tasks older than X days
- **Link controls** - Enable/disable wiki-links and URL links in tasks
- **Search functionality** - Filter tasks by text (matches task content and file names)
- **Sort options** - Sort by name, creation date, or modification date (ascending/descending)
- **Pre-commit hooks** - Automatic code quality checks before commits (ESLint, TypeScript, build)
- **CI/CD workflow** - Automated testing and validation on GitHub Actions

### Changed
- **Vault-specific storage** - View state (collapsed sections, search, sort) now stored per-vault instead of globally
- **Tag placement** - Tasks are now identified by tags in note titles (e.g., `# My Tasks #tasks`) instead of on individual tasks
- **Task identification** - Choose between tag-based or header-based task detection
- **Improved performance** - Optimized sorting, caching, and debouncing
- **Better mobile experience** - Wiki-links disabled by default for better mobile usability
- **Modern Obsidian APIs** - Migrated from deprecated APIs to current best practices

### Fixed
- **Memory leaks** - Proper cleanup of event listeners and components
- **Cross-vault data leakage** - Each vault now maintains independent state
- **CSS conflicts** - Prefixed all CSS classes with `dtl-` to avoid plugin conflicts
- **Race conditions** - Fixed file stats caching issues
- **Type-ahead autocomplete** - Fixed JavaScript error in folder suggestions (`.contains()` → `.includes()`)

### Developer
- Comprehensive documentation (README, SPEC, TEST_PLAN, WARP, CLAUDE)
- Pre-commit hooks for code quality
- CI/CD pipeline for automated checks
- Updated to follow Obsidian plugin review guidelines

## [0.1.0] - 2024

### Added
- Initial release
- Basic task aggregation from tagged notes
- Real-time task synchronization
- Collapsible file sections
- Task completion tracking
- Source navigation (click to open note)
- Mobile compatibility
- Configurable task prefix and note tag
- Ribbon icon and command palette integration
- Hotkey support

---

## Version History Summary

- **1.0.0** - Production ready with folder filtering, display options, vault-specific storage, and modern Obsidian APIs
- **0.1.0** - Initial release with core functionality
