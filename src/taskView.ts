import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile } from 'obsidian';
import { Task } from './types';
import { TaskProcessor } from './taskProcessor';

export const TASK_VIEW_TYPE = 'dynamic-todo-list-view';

export class TaskView extends ItemView {
    private tasks: Task[] = [];
    private processor: TaskProcessor;
    private taskListContainer: HTMLElement | null = null;
    private collapsedSections: Set<string> = new Set();

    constructor(leaf: WorkspaceLeaf, tasks: Task[], processor: TaskProcessor) {
        super(leaf);
        this.tasks = tasks;
        this.processor = processor;
    }

    getViewType(): string {
        return TASK_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Dynamic Todo List';
    }

    getIcon(): string {
        return 'checkbox-glyph';
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        
        this.taskListContainer = contentEl.createDiv({ cls: 'task-list' });
        await this.renderTaskList();
    }

    private async handleTaskToggle(task: Task, checkbox: HTMLElement, taskTextEl: HTMLElement) {
        try {
            checkbox.addClass('is-disabled');
            await this.processor.toggleTask(task);
            task.completed = !task.completed;
            
            // Update UI elements directly
            setIcon(checkbox, task.completed ? 'check-square' : 'square');
            taskTextEl.classList.toggle('task-completed', task.completed);
            await this.renderTaskList(); // Re-render to move task (and possibly note) to correct section
            
            checkbox.removeClass('is-disabled');
        } catch (error) {
            new Notice('Failed to update task. Check console for details.');
            console.error('Task toggle error:', error);
            checkbox.removeClass('is-disabled');
        }
    }

    private async getFileCreationDate(file: TFile): Promise<string> {
        try {
            const stat = await this.app.vault.adapter.stat(file.path);
            return stat ? new Date(stat.ctime).toLocaleDateString() : '';
        } catch (error) {
            console.error('Error getting file date:', error);
            return '';
        }
    }

    private isNoteCompleted(tasks: { open: Task[], completed: Task[] }): boolean {
        return tasks.open.length === 0 && tasks.completed.length > 0;
    }

    private async renderTaskList() {
        if (!this.taskListContainer) return;
        this.taskListContainer.empty();

        // Add \"Open Tasks\" header
        this.taskListContainer.createEl('h2', {
            text: 'Open Tasks',
            cls: 'task-list-header'
        });

        if (this.tasks.length === 0) {
            this.taskListContainer.createEl('div', {
                cls: 'task-empty-state',
                text: 'No tasks found in tagged notes. Tag a note with #tasks to include its tasks here.'
            });
            return;
        }

        const tasksByFile = this.groupTasksByFile();
        const openSections: [string, { open: Task[], completed: Task[] }][] = [];
        const completedSections: [string, { open: Task[], completed: Task[] }][] = [];

        // Sort notes into open and completed sections
        Object.entries(tasksByFile).forEach(entry => {
            if (this.isNoteCompleted(entry[1])) {
                completedSections.push(entry);
            } else {
                openSections.push(entry);
            }
        });

        // Render open notes
        for (const [path, tasks] of openSections) {
            await this.renderFileSection(path, tasks, this.taskListContainer);
        }

        // Render completed notes section if there are any
        if (completedSections.length > 0) {
            const completedContainer = this.taskListContainer.createDiv({
                cls: 'completed-notes-section'
            });

            const completedHeader = completedContainer.createDiv({
                cls: 'completed-notes-header'
            });

            const completedToggle = completedHeader.createDiv({
                cls: 'completed-notes-toggle'
            });

            completedHeader.createEl('span', {
                text: `Completed Notes (${completedSections.length})`
            });

            setIcon(completedToggle, 'chevron-right');

            const completedContent = completedContainer.createDiv({
                cls: 'completed-notes-content collapsed'
            });

            completedHeader.addEventListener('click', () => {
                const isNowCollapsed = !completedContent.hasClass('collapsed');
                completedContent.toggleClass('collapsed', isNowCollapsed);
                setIcon(completedToggle,
                    isNowCollapsed ? 'chevron-right' : 'chevron-down'
                );
            });

            // Render each completed note
            for (const [path, tasks] of completedSections) {
                await this.renderFileSection(path, tasks, completedContent);
            }
        }
    }

    private groupTasksByFile(): Record<string, { open: Task[], completed: Task[] }> {
        return this.tasks.reduce((acc, task) => {
            const path = task.sourceFile.path;
            if (!acc[path]) {
                acc[path] = { open: [], completed: [] };
            }
            
            if (task.completed) {
                acc[path].completed.push(task);
            } else {
                acc[path].open.push(task);
            }
            
            return acc;
        }, {} as Record<string, { open: Task[], completed: Task[] }>);
    }

    private async renderFileSection(path: string, tasks: { open: Task[], completed: Task[] }, container: HTMLElement) {
        const fileSection = container.createDiv({ cls: 'task-section' });
        
        // Create collapsible header with date
        const header = fileSection.createDiv({ cls: 'task-section-header' });
        const toggleIcon = header.createDiv({ cls: 'task-section-toggle' });
        
        const title = header.createEl('h3', {
            cls: 'task-section-title',
            text: path,
        });
        
        const date = await this.getFileCreationDate(tasks.open[0]?.sourceFile || tasks.completed[0]?.sourceFile);
        if (date) {
            header.createDiv({
                cls: 'task-section-date',
                text: date
            });
        }
        
        const isCollapsed = this.collapsedSections.has(path);
        setIcon(toggleIcon, isCollapsed ? 'chevron-right' : 'chevron-down');
        
        const content = fileSection.createDiv({
            cls: `task-section-content ${isCollapsed ? 'collapsed' : ''}`
        });

        // Toggle collapse on header click
        header.addEventListener('click', () => {
            const isNowCollapsed = !this.collapsedSections.has(path);
            if (isNowCollapsed) {
                this.collapsedSections.add(path);
            } else {
                this.collapsedSections.delete(path);
            }
            content.toggleClass('collapsed', isNowCollapsed);
            setIcon(toggleIcon, isNowCollapsed ? 'chevron-right' : 'chevron-down');
        });

        // Render open tasks
        if (tasks.open.length > 0) {
            const openTasksList = content.createEl('ul', { cls: 'task-list-items' });
            tasks.open.forEach(task => this.renderTaskItem(openTasksList, task));
        }

        // Render completed tasks section if there are any
        if (tasks.completed.length > 0) {
            const completedSection = content.createDiv({ cls: 'completed-tasks-section' });
            const completedHeader = completedSection.createDiv({
                cls: 'completed-tasks-header'
            });
            
            const completedToggle = completedHeader.createDiv({
                cls: 'completed-tasks-toggle'
            });
            
            completedHeader.createEl('span', {
                text: `Completed Tasks (${tasks.completed.length})`
            });
            
            const completedContent = completedSection.createDiv({
                cls: 'completed-tasks-content collapsed'
            });
            
            setIcon(completedToggle, 'chevron-right');
            
            const completedList = completedContent.createEl('ul', {
                cls: 'task-list-items completed'
            });
            
            tasks.completed.forEach(task => 
                this.renderTaskItem(completedList, task));
            
            completedHeader.addEventListener('click', () => {
                const isNowCollapsed = !completedContent.hasClass('collapsed');
                completedContent.toggleClass('collapsed', isNowCollapsed);
                setIcon(completedToggle,
                    isNowCollapsed ? 'chevron-right' : 'chevron-down'
                );
            });
        }
    }

    private renderTaskItem(container: HTMLElement, task: Task) {
        const li = container.createEl('li', { cls: 'task-item' });
        const checkbox = li.createEl('div', {
            cls: 'task-checkbox clickable-icon',
            attr: {
                'aria-label': task.completed ?
                    'Mark task incomplete' : 'Mark task complete'
            }
        });
        
        setIcon(checkbox, task.completed ? 'check-square' : 'square');
        
        const taskText = li.createEl('span', {
            text: task.taskText,
            cls: task.completed ? 'task-completed' : ''
        });

        checkbox.addEventListener('click', () =>
            this.handleTaskToggle(task, checkbox, taskText));
    }

    updateTasks(newTasks: Task[]) {
        this.tasks = newTasks;
        this.renderTaskList();
    }
}
