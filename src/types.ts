import { TFile } from 'obsidian';

export interface PluginSettings {
    noteTag: string;
    taskPrefix: string;
    openOnStartup: boolean;
}

export interface Task {
    sourceFile: TFile;
    taskText: string;
    lineNumber: number;
    completed: boolean;
    completionDate: string | null;
}

export interface FileMetadata {
    created: number;
    lastUpdated: number;
}

export const DEFAULT_SETTINGS: Readonly<PluginSettings> = {
    noteTag: '#tasks',
    taskPrefix: '- [ ]',
    openOnStartup: false
};