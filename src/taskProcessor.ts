import { TFile, Vault, App, MarkdownView } from 'obsidian';
import { Task, PluginSettings } from './types';

/**
 * Handles the processing of tasks within files.
 * This includes finding, creating, and modifying tasks.
 */
export class TaskProcessor {
    private vault: Vault;
    private app: App | null = null; // Keep a reference to the App instance for navigation
    settings: PluginSettings;

    /**
     * Constructs a TaskProcessor.
     * @param vault - The Obsidian Vault instance.
     * @param settings - The plugin settings.
     */
    constructor(vault: Vault, settings: PluginSettings) {
        this.vault = vault;
        this.settings = settings;
    }

    /**
     * Processes a file to extract tasks.
     * @param file - The file to process.
     * @param specificLineNumber - Optional line number to process. If provided, only this line is processed.
     * @returns A promise that resolves to an array of tasks found in the file.
     */
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
                    // Check for a heading that contains the word 'task' (case-insensitive)
                    let hasTaskHeader = false;
                    for (let i = 0; i < Math.min(20, lines.length); i++) { // Limit check to first 20 lines
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

    /**
     * Checks if a given line is a task line based on the plugin settings.
     * @param line - The line to check.
     * @returns True if the line is a task line, false otherwise.
     */
    private isTaskLine(line: string): boolean {
        const trimmedLine = line.trim();
        return trimmedLine.startsWith(this.settings.taskPrefix) || // Matches unchecked tasks
               trimmedLine.startsWith(this.settings.taskPrefix.replace('[ ]', '[x]')) || // Matches checked tasks (lowercase x)
               trimmedLine.startsWith(this.settings.taskPrefix.replace('[ ]', '[X]')); // Matches checked tasks (uppercase X)
    }

    /**
     * Creates a Task object from a given file, line, and line number.
     * @param file - The file containing the task.
     * @param line - The line containing the task.
     * @param lineNumber - The line number of the task.
     * @returns A Task object or null if task creation fails.
     */
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
            const dateMatch = taskText.match(/✅ \d{4}-\d{2}-\d{2}$/); // Matches '✅ YYYY-MM-DD' at the end of the line
            let completionDate = null;

            if (dateMatch) {
                completionDate = dateMatch[0].substring(2); // Remove the ✅ and space
                taskText = taskText.replace(/✅ \d{4}-\d{2}-\d{2}$/, '').trim(); // Remove date from task text
            }

            return {
                sourceFile: file,
                taskText,
                lineNumber,
                completed: isChecked,
                completionDate,
                sourceLink: this.createTaskLink(file, lineNumber),
                lastUpdated: Date.now() // Timestamp for avoiding rapid re-processing
            };
        } catch (error) {
            console.error('Error creating task:', error);
            return null;
        }
    }

    /**
     * Creates an Obsidian link to a specific task within a file.
     * @param file - The file containing the task.
     * @param lineNumber - The line number of the task.
     * @returns An Obsidian URL string.
     */
    private createTaskLink(file: TFile, lineNumber: number): string {
        const vault = this.vault.getName();
        const filePath = file.path;
        return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(filePath)}&line=${lineNumber}`;
    }

    /**
     * Toggles the completion status of a task.
     * @param task - The task to toggle.
     * @param newState - The new completion state (true for completed, false for incomplete).
     */
    async toggleTask(task: Task, newState: boolean): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
            const lineNumber = task.lineNumber;
            
            // Use Vault.process for background-safe file modifications
            await this.vault.process(task.sourceFile, (content) => {
                const lines = content.split('\n');
                let line = lines[lineNumber];

                // Prepare the new line content
                const dateMatch = line.match(/✅ \d{4}-\d{2}-\d{2}$/); // Check for existing completion date

                if (newState) {
                    // Adding completion - replacing the task prefix with checked task, and adding a date if it isn't already there
                    line = line.replace(/\[ \]/, '[x]') + (!dateMatch ? ` ✅ ${today}` : ''); // Add completion mark and date
                    task.completionDate = dateMatch ? dateMatch[0].substring(2) : today; // update the completion date of task
                } else {
                    // Removing completion - replacing the task prefix with unchecked, and removing the date string
                    line = line.replace(/\[[xX]\]/, '[ ]').replace(/✅ \d{4}-\d{2}-\d{2}$/, '').trim(); // Remove completion mark and date
                    task.completionDate = null; // update the completion date of task
                }

                lines[lineNumber] = line;
                return lines.join('\n');
            });
            
            task.completed = newState;
            task.lastUpdated = Date.now();
        } catch (error) {
            console.error('Error toggling task:', error);
            throw error; // Re-throw the error to be caught by the caller
        }
    }

    /**
     * Navigates to the specified task in Obsidian.
     * @param task - The task to navigate to.
     */
    async navigateToTask(task: Task): Promise<void> {
        if (!this.app) {
            throw new Error('App not initialized');
        }

        try {
            // Find the most recent leaf that's not our task list
            const targetLeaf = this.app.workspace.getLeaf('tab');

            await targetLeaf.openFile(task.sourceFile); // Open the file containing the task

            // Focus and scroll to the task line
            const view = targetLeaf.view;
            if (view instanceof MarkdownView) {
                const editor = view.editor; // Access the editor with proper type
                if (editor) {
                    const pos = { line: task.lineNumber, ch: 0 }; // Cursor position at the start of the line
                    editor.setCursor(pos); // Set the cursor position
                    editor.scrollIntoView({ from: pos, to: pos }, true); // Scroll to the task line
                }
            }

            // Focus the leaf
            this.app.workspace.setActiveLeaf(targetLeaf);
        } catch (error) {
            console.error('Error navigating to task:', error);
            throw error; // Re-throw the error to be caught by the caller
        }
    }

    /**
     * Sets the App instance for the processor.
     * @param app The Obsidian App instance.
     */
    setApp(app: App): void {
        this.app = app;
    }
}