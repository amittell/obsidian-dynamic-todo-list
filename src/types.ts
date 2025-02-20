import { TFile, Hotkey } from 'obsidian';

export interface PluginSettings {
    noteTag: string;
    taskPrefix: string;
    openOnStartup: boolean;
    hotkey: Hotkey | null;
    // New settings from dev
    taskIdentificationMethod: 'tag' | 'header';
    folderFilters: {
        include: string[];
        exclude: string[];
    };
    sortPreference: {
        field: 'created' | 'lastModified' | 'name';
        direction: 'asc' | 'desc';
    };
    archiveCompletedOlderThan: number; // days
}

export interface Task {
    sourceFile: TFile;
    taskText: string;
    lineNumber: number;
    completed: boolean;
    completionDate: string | null;
    sourceLink: string; // Used for task navigation
}

export interface FileMetadata {
    created: number;
    lastUpdated: number;
}

export const DEFAULT_SETTINGS: Readonly<PluginSettings> = {
    noteTag: '#tasks',
    taskPrefix: '- [ ]',
    openOnStartup: false,
    hotkey: null,
    // New default settings from dev
    taskIdentificationMethod: 'tag',
    folderFilters: {
        include: [],
        exclude: []
    },
    sortPreference: {
        field: 'lastModified',
        direction: 'desc'
    },
    archiveCompletedOlderThan: 90 // 90 days default
};
