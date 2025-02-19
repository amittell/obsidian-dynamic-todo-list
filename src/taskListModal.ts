import { Modal, App, Notice, setIcon } from 'obsidian';
import { Task } from './types';
import { TaskProcessor } from './taskProcessor';

export class TaskListModal extends Modal {
    private tasks: Task[];
    private processor: TaskProcessor;
    private taskListContainer: HTMLElement | null = null;

    constructor(app: App, tasks: Task[], processor: TaskProcessor) {
        super(app);
        this.tasks = tasks;
        this.processor = processor;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Tasks From Tagged Notes' });
        this.taskListContainer = contentEl.createDiv({ cls: 'task-list' });
        this.renderTaskList();
    }

    private async handleTaskToggle(task: Task, checkbox: HTMLElement, taskTextEl: HTMLElement) {
        try {
            checkbox.addClass('is-disabled');
            const newState = !task.completed;
            await this.processor.toggleTask(task, newState);
            task.completed = newState;
            
            // Update UI elements directly without re-rendering
            setIcon(checkbox, task.completed ? 'check-square' : 'square');
            taskTextEl.classList.toggle('task-completed', task.completed);
            
            checkbox.removeClass('is-disabled');
        } catch (error) {
            new Notice('Failed to update task. Check console for details.');
            console.error('Task toggle error:', error);
            checkbox.removeClass('is-disabled');
        }
    }

    private renderTaskList() {
        if (!this.taskListContainer) return;
        this.taskListContainer.empty();
        
        if (this.tasks.length === 0) {
            this.taskListContainer.createEl('p', { text: 'No tasks found in tagged notes. Tag a note with #tasks to include its tasks here.' });
            return;
        }

        const tasksByFile = this.groupTasksByFile();
        this.renderGroupedTasks(tasksByFile);
    }

    private groupTasksByFile(): Record<string, Task[]> {
        return this.tasks.reduce((acc, task) => {
            const path = task.sourceFile.path;
            if (!acc[path]) {
                acc[path] = [];
            }
            acc[path].push(task);
            return acc;
        }, {} as Record<string, Task[]>);
    }

    private renderGroupedTasks(tasksByFile: Record<string, Task[]>) {
        if (!this.taskListContainer) return;
        
        Object.entries(tasksByFile).forEach(([path, tasks]) => {
            const fileSection = this.taskListContainer!.createDiv({ cls: 'task-section' });
            fileSection.createEl('h3', { text: path });
            const taskList = fileSection.createEl('ul');

            tasks.forEach(task => {
                const li = taskList.createEl('li', { cls: 'task-item' });
                
                const checkbox = li.createEl('div', { cls: 'task-checkbox clickable-icon' });
                setIcon(checkbox, task.completed ? 'check-square' : 'square');
                
                const taskText = li.createSpan({ 
                    text: task.taskText,
                    cls: task.completed ? 'task-completed' : ''
                });

                checkbox.addEventListener('click', () => 
                    this.handleTaskToggle(task, checkbox, taskText));
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.taskListContainer = null;
    }
}