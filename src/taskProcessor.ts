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

    async processFile(file: TFile): Promise<Task[]> {
        try {
            // Check folder filters first
            const filePath = file.path;
            const shouldInclude = this.settings.folderFilters.include.length === 0 || 
                this.settings.folderFilters.include.some(path => filePath.startsWith(path));
            const shouldExclude = this.settings.folderFilters.exclude.some(path => 
                filePath.startsWith(path));

            if (!shouldExclude && shouldInclude) {
                const content = await this.vault.read(file);
                const tasks: Task[] = [];

                // Check identification method
                if (this.settings.taskIdentificationMethod === 'tag') {
                    if (!content.includes(this.settings.noteTag)) {
                        return [];
                    }
                } else if (this.settings.taskIdentificationMethod === 'header') {
                    const lines = content.split('\n');
                    let hasTaskHeader = false;
                    for (const line of lines) {
                        if (line.startsWith('#') && line.toLowerCase().includes('task')) {
                            hasTaskHeader = true;
                            break;
                        }
                    }
                    if (!hasTaskHeader) {
                        return [];
                    }
                }

                const lines = content.split('\n');
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
                sourceLink: this.createTaskLink(file, lineNumber)
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
            const content = await this.vault.read(task.sourceFile);
            const lines = content.split('\n');
            let line = lines[task.lineNumber];

            // Handle completion date
            const dateMatch = line.match(/✅ \d{4}-\d{2}-\d{2}$/);
            const today = new Date().toISOString().split('T')[0];

            if (newState) {
                // Adding completion
                line = line.replace(/\[ \]/, '[x]');
                if (!dateMatch) {
                    line = `${line} ✅ ${today}`;
                }
                task.completionDate = dateMatch ? dateMatch[0].substring(2) : today;
            } else {
                // Removing completion
                line = line
                    .replace(/\[[xX]\]/, '[ ]')
                    .replace(/✅ \d{4}-\d{2}-\d{2}$/, '')
                    .trim();
                task.completionDate = null;
            }

            lines[task.lineNumber] = line;
            task.completed = newState;
            await this.vault.modify(task.sourceFile, lines.join('\n'));
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