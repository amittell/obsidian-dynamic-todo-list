import { TFile, Vault, App } from 'obsidian';
import { Task, PluginSettings } from './types';

export class TaskProcessor {
    private vault: Vault;
    private app: App | null = null;
    settings: PluginSettings;

    constructor(vault: Vault, settings: PluginSettings) {
        this.vault = vault;
        this.settings = settings;
    }

    async processFile(file: TFile, specificLineNumber?: number): Promise<Task[]> {
        try {
            // Check folder filters first
            const filePath = file.path;
            const shouldInclude = this.settings.folderFilters.include.length === 0 || 
                this.settings.folderFilters.include.some(path => filePath.startsWith(path));
            const shouldExclude = this.settings.folderFilters.exclude.some(path => 
                filePath.startsWith(path));

            if (!shouldExclude && shouldInclude) {
                // Use cachedRead for better performance
                const content = await this.vault.cachedRead(file);
                const tasks: Task[] = [];

                // If we're checking a specific line, we can skip other checks
                if (specificLineNumber !== undefined) {
                    const lines = content.split('\n');
                    const line = lines[specificLineNumber];
                    if (this.isTaskLine(line)) {
                        const task = await this.createTask(file, line, specificLineNumber);
                        if (task) {
                            tasks.push(task);
                        }
                    }
                    return tasks;
                }

                // Quick check for task identifiers before full processing
                if (this.settings.taskIdentificationMethod === 'tag' && !content.includes(this.settings.noteTag)) {
                    return [];
                }

                const lines = content.split('\n');
                if (this.settings.taskIdentificationMethod === 'header') {
                    let hasTaskHeader = false;
                    for (let i = 0; i < Math.min(20, lines.length); i++) {
                        if (lines[i].startsWith('#') && lines[i].toLowerCase().includes('task')) {
                            hasTaskHeader = true;
                            break;
                        }
                    }
                    if (!hasTaskHeader) {
                        return [];
                    }
                }

                // Process all lines at once since we've already filtered the file
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (this.isTaskLine(line)) {
                        const task = await this.createTask(file, line, i);
                        if (task) {
                            tasks.push(task);
                        }
                    }
                }

                return tasks;
            }
            return [];
        } catch (error) {
            console.error(`Error processing file ${file.path}:`, error);
            return [];
        }
    }

    private isTaskLine(line: string): boolean {
        const trimmedLine = line.trim();
        return trimmedLine.startsWith(this.settings.taskPrefix) || 
               trimmedLine.startsWith(this.settings.taskPrefix.replace('[ ]', '[x]')) ||
               trimmedLine.startsWith(this.settings.taskPrefix.replace('[ ]', '[X]'));
    }

    private async createTask(file: TFile, line: string, lineNumber: number): Promise<Task | null> {
        try {
            // Extract task text and handle completion date
            const isChecked = line.includes('[x]') || line.includes('[X]');
            let taskText = line.trim();
            
            // Remove the task prefix (both checked and unchecked variants)
            if (isChecked) {
                taskText = taskText.replace(this.settings.taskPrefix.replace('[ ]', '[x]'), '');
                taskText = taskText.replace(this.settings.taskPrefix.replace('[ ]', '[X]'), '');
            } else {
                taskText = taskText.replace(this.settings.taskPrefix, '');
            }
            
            taskText = taskText.trim();

            // Handle completion date
            const dateMatch = taskText.match(/✅ \d{4}-\d{2}-\d{2}$/);
            let completionDate = null;

            if (dateMatch) {
                completionDate = dateMatch[0].substring(2); // Remove the ✅
                taskText = taskText.replace(/✅ \d{4}-\d{2}-\d{2}$/, '').trim();
            }

            return {
                sourceFile: file,
                taskText,
                lineNumber,
                completed: isChecked,
                completionDate,
                sourceLink: this.createTaskLink(file, lineNumber),
                lastUpdated: Date.now()
            };
        } catch (error) {
            console.error('Error creating task:', error);
            return null;
        }
    }

    private createTaskLink(file: TFile, lineNumber: number): string {
        const vault = this.vault.getName();
        const filePath = file.path;
        return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(filePath)}&line=${lineNumber}`;
    }

    async toggleTask(task: Task, newState: boolean): Promise<void> {
        try {
            // Use cachedRead for better performance
            const content = await this.vault.cachedRead(task.sourceFile);
            const lines = content.split('\n');
            let line = lines[task.lineNumber];
            
            // Prepare the new line content
            const dateMatch = line.match(/✅ \d{4}-\d{2}-\d{2}$/);
            const today = new Date().toISOString().split('T')[0];
            
            if (newState) {
                // Adding completion - optimize string operations
                line = line.replace(/\[ \]/, '[x]') + (!dateMatch ? ` ✅ ${today}` : '');
                task.completionDate = dateMatch ? dateMatch[0].substring(2) : today;
            } else {
                // Removing completion - optimize string operations
                line = line.replace(/\[[xX]\]/, '[ ]').replace(/✅ \d{4}-\d{2}-\d{2}$/, '').trim();
                task.completionDate = null;
            }
            
            lines[task.lineNumber] = line;
            task.completed = newState;
            task.lastUpdated = Date.now();
            
            // Modify file in background
            this.vault.modify(task.sourceFile, lines.join('\n')).catch(error => {
                console.error('Error modifying file:', error);
                throw error;
            });
        } catch (error) {
            console.error('Error toggling task:', error);
            throw error;
        }
    }

    async navigateToTask(task: Task): Promise<void> {
        if (!this.app) {
            throw new Error('App not initialized');
        }

        try {
            // Find the most recent leaf that's not our task list
            let targetLeaf = this.app.workspace.getLeaf('tab');

            await targetLeaf.openFile(task.sourceFile);

            // Focus and scroll to the task line
            const view = targetLeaf.view;
            if (view.getViewType() === 'markdown') {
                const editor = (view as any).editor;
                if (editor) {
                    const pos = { line: task.lineNumber, ch: 0 };
                    editor.setCursor(pos);
                    editor.scrollIntoView({ from: pos, to: pos }, true);
                }
            }

            // Focus the leaf
            this.app.workspace.setActiveLeaf(targetLeaf);
        } catch (error) {
            console.error('Error navigating to task:', error);
            throw error;
        }
    }

    setApp(app: App): void {
        this.app = app;
    }
}