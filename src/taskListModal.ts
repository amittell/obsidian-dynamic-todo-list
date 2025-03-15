import { Modal, App, Notice, setIcon } from 'obsidian';
import { Task } from './types';
import { TaskProcessor } from './taskProcessor';

/**
 * A modal that displays a list of tasks, grouped by file.
 * Allows for toggling task completion status.
 */
export class TaskListModal extends Modal {
    private tasks: Task[];
    private processor: TaskProcessor;
    private taskListContainer: HTMLElement | null = null;

    /**
     * Constructs a TaskListModal.
     * @param app - The Obsidian App instance.
     * @param tasks - The list of tasks to display.
     * @param processor - The TaskProcessor instance.
     */
    constructor(app: App, tasks: Task[], processor: TaskProcessor) {
        super(app);
        this.tasks = tasks;
        this.processor = processor;
    }

    /**
     * Called when the modal is opened.
     * Sets up the modal content and renders the task list.
     */
    onOpen() {
        const { contentEl } = this;
        contentEl.empty(); // Clear any existing content

        contentEl.createEl('h2', { text: 'Tasks From Tagged Notes' }); // Set the modal title
        this.taskListContainer = contentEl.createDiv({ cls: 'task-list' }); // Create a container for the task list
        this.renderTaskList(); // Render the task list
    }

    /**
     * Handles the toggling of a task's completion status.
     * @param task - The task to toggle.
     * @param checkbox - The checkbox element associated with the task.
     * @param taskTextEl - The element containing the task text.
     */
    private async handleTaskToggle(task: Task, checkbox: HTMLElement, taskTextEl: HTMLElement) {
        try {
            checkbox.addClass('is-disabled'); // Disable checkbox during processing
            const newState = !task.completed; // Determine new completion state
            await this.processor.toggleTask(task, newState); // Toggle task in the file
            task.completed = newState; // Update task state

            // Update UI elements directly without re-rendering the entire list
            setIcon(checkbox, task.completed ? 'check-square' : 'square'); // Update checkbox icon
            taskTextEl.classList.toggle('task-completed', task.completed); // Toggle 'task-completed' class

            checkbox.removeClass('is-disabled'); // Re-enable checkbox
        } catch (error) {
            new Notice('Failed to update task. Check console for details.'); // Display error message
            console.error('Task toggle error:', error);
            checkbox.removeClass('is-disabled'); // Re-enable checkbox on error
        }
    }

    /**
     * Renders the task list in the modal.
     * If no tasks are found, displays a message.
     */
    private renderTaskList() {
        if (!this.taskListContainer) return;
        this.taskListContainer.empty(); // Clear existing content

        if (this.tasks.length === 0) {
            this.taskListContainer.createEl('p', { text: 'No tasks found in tagged notes. Tag a note with #tasks to include its tasks here.' });
            return;
        }

        const tasksByFile = this.groupTasksByFile(); // Group tasks by file
        this.renderGroupedTasks(tasksByFile); // Render grouped tasks
    }

    /**
     * Groups tasks by their source file path.
     * @returns A record where keys are file paths and values are arrays of tasks.
     */
    private groupTasksByFile(): Record<string, Task[]> {
        // Use reduce to group tasks by file path
        return this.tasks.reduce((acc, task) => {
            const path = task.sourceFile.path;
            if (!acc[path]) {
                acc[path] = []; // Initialize array if file path not seen before
            }
            acc[path].push(task); // Add task to the corresponding file path
            return acc;
        }, {} as Record<string, Task[]>);
    }

    /**
     * Renders tasks grouped by file.
     * @param tasksByFile - A record where keys are file paths and values are arrays of tasks.
     */
    private renderGroupedTasks(tasksByFile: Record<string, Task[]>) {
        if (!this.taskListContainer) return;

        // Iterate through each file and its tasks
        Object.entries(tasksByFile).forEach(([path, tasks]) => {
            const fileSection = this.taskListContainer!.createDiv({ cls: 'task-section' }); // Create a section for each file
            fileSection.createEl('h3', { text: path }); // Display file path as heading
            const taskList = fileSection.createEl('ul'); // Create unordered list for tasks

            // Render each task within the file section
            tasks.forEach(task => {
                const li = taskList.createEl('li', { cls: 'task-item' }); // Create list item for task

                // Create checkbox for toggling task completion
                const checkbox = li.createEl('div', { cls: 'task-checkbox clickable-icon' });
                setIcon(checkbox, task.completed ? 'check-square' : 'square'); // Set checkbox icon based on completion status

                // Display task text
                const taskText = li.createSpan({
                    text: task.taskText,
                    cls: task.completed ? 'task-completed' : '' // Add class for completed tasks
                });

                // Add click listener to checkbox for toggling
                checkbox.addEventListener('click', () =>
                    this.handleTaskToggle(task, checkbox, taskText));
            });
        });
    }

    /**
     * Called when the modal is closed.
     * Cleans up the modal content.
     */
    onClose() {
        const { contentEl } = this;
        contentEl.empty(); // Clear modal content
        this.taskListContainer = null; // Reset container reference
    }
}