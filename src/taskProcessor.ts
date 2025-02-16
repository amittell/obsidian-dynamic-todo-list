import { TFile, Vault } from 'obsidian';
import { Task, PluginSettings } from './types';

export class TaskProcessor {
    constructor(
        private vault: Vault,
        private settings: PluginSettings
    ) {}

    async processFile(file: TFile): Promise<Task[]> {
        try {
            const content = await this.vault.read(file);
            
            // Check if the note is tagged for task collection
            if (!content.includes(this.settings.noteTag)) {
                return [];
            }

            return this.extractTasksFromContent(content, file);
        } catch (error) {
            console.error(`Error processing file ${file.path}:`, error);
            return [];
        }
    }

    private extractTasksFromContent(content: string, file: TFile): Task[] {
        const tasks: Task[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            if (this.isCheckboxTaskLine(line)) {
                tasks.push(this.createTask(file, line, index));
            }
        });

        return tasks;
    }

    private isCheckboxTaskLine(line: string): boolean {
        const trimmedLine = line.trim();
        const uncheckedPrefix = this.settings.taskPrefix;
        const checkedPrefix = uncheckedPrefix.replace('[ ]', '[x]');
        return trimmedLine.startsWith(uncheckedPrefix) || trimmedLine.startsWith(checkedPrefix);
    }

    private createTask(file: TFile, line: string, lineNumber: number): Task {
        const uncheckedPrefix = this.settings.taskPrefix;
        const checkedPrefix = uncheckedPrefix.replace('[ ]', '[x]');
        const completed = line.includes(checkedPrefix);
        
        return {
            sourceFile: file,
            taskText: this.extractTaskText(line, completed ? checkedPrefix : uncheckedPrefix),
            lineNumber,
            completed
        };
    }

    private extractTaskText(line: string, prefix: string): string {
        return line.replace(prefix, '').trim();
    }

    async toggleTask(task: Task): Promise<void> {
        try {
            const content = await this.vault.read(task.sourceFile);
            const lines = content.split('\n');
            const taskLine = lines[task.lineNumber];
            
            const uncheckedPrefix = this.settings.taskPrefix;
            const checkedPrefix = uncheckedPrefix.replace('[ ]', '[x]');
            
            // Toggle the checkbox state
            const newLine = taskLine.replace(
                task.completed ? checkedPrefix : uncheckedPrefix,
                task.completed ? uncheckedPrefix : checkedPrefix
            );
            
            lines[task.lineNumber] = newLine;
            await this.vault.modify(task.sourceFile, lines.join('\n'));
        } catch (error) {
            console.error('Error toggling task:', error);
            throw error;
        }
    }
}