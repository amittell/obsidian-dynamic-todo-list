import { TFile, Hotkey } from 'obsidian';

/**
 * Interface for the plugin settings.
 */
export interface PluginSettings {
  noteTag: string; // Tag used to identify notes containing tasks.
  taskPrefix: string; // Prefix used to identify tasks within a note (e.g., "- [ ]").
  openOnStartup: boolean; // Whether to open the task view on startup.
  hotkey: Hotkey | null; // Hotkey for toggling the task view.
  taskIdentificationMethod: 'tag' | 'header'; //  'tag' or 'header'
  folderFilters: { // Added folder filters
      include: string[]; // List of folders to include
      exclude: string[]; // List of folders to exclude
  };
  sortPreference: { // Added sort preference
      field: 'created' | 'lastModified' | 'name'; // Field to sort by
      direction: 'asc' | 'desc'; // Sort direction
  };
  archiveCompletedOlderThan: number; // Added archive setting for completed tasks
  enableWikiLinks: boolean; // Added wiki-link setting
  enableUrlLinks: boolean; // Added URL link setting
  showFileHeaders: boolean; // When enabled, groups tasks by source file with collapsible headers. When disabled, shows flat task list.
  moveCompletedTasksToBottom: boolean; // Move completed tasks to bottom in flat mode
  showFileHeaderDates: boolean; // Show created/modified dates in file headers when grouped mode is enabled
}

/**
 * Interface for a task object.
 */
export interface Task {
  sourceFile: TFile; // The file containing the task.
  taskText: string; // The text of the task.
  lineNumber: number; // The line number of the task within the file.
  completed: boolean; // Whether the task is completed.
  completionDate: string | null; // Date when task was completed
  sourceLink: string; // Obsidian URL to open the file and line of this task
  lastUpdated: number;
}

/**
 * Interface for file metadata (currently unused).
 */
export interface FileMetadata {
  created: number;
  lastUpdated: number;
}

/**
 * Default values for plugin settings.
 */
export const DEFAULT_SETTINGS: Readonly<PluginSettings> = {
  noteTag: '#tasks',
  taskPrefix: '- [ ]',
  openOnStartup: false,
  hotkey: null,
  taskIdentificationMethod: 'tag', // Default to tag-based identification
  folderFilters: {
      include: [],
      exclude: []
  },
  sortPreference: { // Default sort preference: last modified, descending
      field: 'lastModified',
      direction: 'desc'
  },
  archiveCompletedOlderThan: 90, // Default: 90 days
  enableWikiLinks: false, // Default: false (better for mobile experience)
  enableUrlLinks: true, // Default: true
  showFileHeaders: true, // Default: true (current behavior)
  moveCompletedTasksToBottom: false, // Default: false (preserve current behavior)
  showFileHeaderDates: true, // Default: true (show created/modified dates in file headers)
};
