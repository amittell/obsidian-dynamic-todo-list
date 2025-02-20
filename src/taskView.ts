import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile } from 'obsidian';
import { Task } from './types';
import { TaskProcessor } from './taskProcessor';

export const TASK_VIEW_TYPE = 'dynamic-todo-list';

export class TaskView extends ItemView {
    private tasks: Task[] = [];
    private processor: TaskProcessor;
    private taskListContainer: HTMLElement | null = null;
    private collapsedSections: Set<string> = new Set();
    private searchInput: HTMLInputElement | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private loadingEl: HTMLElement | null = null;
    private isLoading = true;

    getIsLoading(): boolean {
        return this.isLoading;
    }

    constructor(leaf: WorkspaceLeaf, tasks: Task[], processor: TaskProcessor) {
        super(leaf);
        this.tasks = tasks;
        this.processor = processor;
        // If we're created with tasks, we can start in non-loading state
        this.isLoading = tasks.length === 0;
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

    private async getFileCreationDate(file: TFile): Promise<string> {
        try {
            const stat = await this.app.vault.adapter.stat(file.path);
            return stat ? new Date(stat.ctime).toLocaleDateString() : '';
        } catch (error) {
            console.error('Error getting file creation date:', error);
            return '';
        }
    }

    private async getFileModifiedDate(file: TFile): Promise<string> {
        try {
            const stat = await this.app.vault.adapter.stat(file.path);
            return stat ? new Date(stat.mtime).toLocaleDateString() : '';
        } catch (error) {
            console.error('Error getting file modified date:', error);
            return '';
        }
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();

        // Create all UI elements first
        const headerSection = contentEl.createDiv({ cls: 'task-list-header-section' });
        headerSection.createEl('h2', { text: 'Dynamic Todo List', cls: 'task-list-header' });
        const controlsSection = headerSection.createDiv({ cls: 'task-controls' });
        this.taskListContainer = contentEl.createDiv({ cls: 'task-list' });
        
        // Create loading overlay
        this.loadingEl = contentEl.createDiv({ cls: 'task-list-loading' });
        const loadingInner = this.loadingEl.createDiv({ cls: 'task-list-loading-inner' });
        loadingInner.createDiv({ cls: 'task-list-loading-spinner' });
        const progressBar = loadingInner.createDiv({ cls: 'task-list-loading-progress' });
        progressBar.createDiv({ 
            cls: 'task-list-loading-progress-inner',
            attr: { style: 'width: 0%' }
        });
        loadingInner.createDiv({
            cls: 'task-list-loading-text',
            text: 'Loading tasks... 0%'
        });

        // Set up controls
        await this.setupSearchAndSort(controlsSection);

        // Restore collapse states
        this.collapsedSections = new Set(
            JSON.parse(localStorage.getItem('dynamic-todo-list-collapsed-sections') || '[]')
        );

        // Set initial loading state
        this.setLoading(this.isLoading);

        // If we already have tasks, render them
        if (this.tasks.length > 0) {
            this.renderTaskList();
        }
    }

    private async setupSearchAndSort(controlsSection: HTMLElement): Promise<void> {
        // Search box with stored value
        const savedSearch = localStorage.getItem('dynamic-todo-list-search') || '';
        this.searchInput = controlsSection.createEl('input', {
            cls: 'task-search',
            attr: { 
                type: 'text',
                placeholder: 'Search tasks or files...',
                value: savedSearch
            }
        });

        this.searchInput.addEventListener('input', () => {
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            this.debounceTimeout = setTimeout(() => {
                localStorage.setItem('dynamic-todo-list-search', this.searchInput!.value);
                this.renderTaskList();
            }, 200);
        });

        // Sort dropdown
        const sortSelect = controlsSection.createEl('select', { cls: 'task-sort' });
        sortSelect.createEl('option', { text: 'Name (A to Z)', value: 'name-asc' });
        sortSelect.createEl('option', { text: 'Name (Z to A)', value: 'name-desc' });
        sortSelect.createEl('option', { text: 'Created (Newest)', value: 'created-desc' });
        sortSelect.createEl('option', { text: 'Created (Oldest)', value: 'created-asc' });
        sortSelect.createEl('option', { text: 'Modified (Newest)', value: 'modified-desc' });
        sortSelect.createEl('option', { text: 'Modified (Oldest)', value: 'modified-asc' });

        // Get saved sort preference
        const savedSort = localStorage.getItem('dynamic-todo-list-sort') || 
            `${this.processor.settings.sortPreference.field}-${this.processor.settings.sortPreference.direction}`;
        sortSelect.value = savedSort;
        
        sortSelect.addEventListener('change', () => {
            const [field, direction] = sortSelect.value.split('-');
            this.processor.settings.sortPreference = {
                field: field as 'name' | 'created' | 'lastModified',
                direction: direction as 'asc' | 'desc'
            };
            localStorage.setItem('dynamic-todo-list-sort', sortSelect.value);
            this.renderTaskList();
        });
    }

    setLoading(loading: boolean): void {
        this.isLoading = loading;
        if (!this.loadingEl) return;

        if (!loading) {
            // Ensure 100% is shown briefly before hiding
            this.updateLoadingProgress(100);
            setTimeout(() => {
                if (this.loadingEl) {
                    this.loadingEl.addClass('hidden');
                }
            }, 300);
        } else {
            this.loadingEl.removeClass('hidden');
        }
        
        // Ensure tasks are rendered when loading completes
        if (!loading) {
            this.renderTaskList();
        }
    }

    updateLoadingProgress(percent: number): void {
        if (!this.loadingEl) return;
        
        const progressInner = this.loadingEl.querySelector('.task-list-loading-progress-inner') as HTMLElement;
        const progressText = this.loadingEl.querySelector('.task-list-loading-text') as HTMLElement;
        
        if (progressInner && progressText) {
            progressInner.style.width = `${percent}%`;
            progressText.textContent = `Loading tasks... ${Math.round(percent)}%`;
        }
    }

    private filterTasks(): Task[] {
        if (!this.searchInput?.value) {
            return this.tasks;
        }
        const searchTerm = this.searchInput.value.toLowerCase();
        return this.tasks.filter(task => 
            task.taskText.toLowerCase().includes(searchTerm) ||
            task.sourceFile.path.toLowerCase().includes(searchTerm)
        );
    }

    private sortTasks(tasks: Task[], sortBy: string): Task[] {
        const [field, direction] = sortBy.split('-');
        const multiplier = direction === 'desc' ? -1 : 1;

        return [...tasks].sort((a, b) => {
            switch (field) {
                case 'created':
                    return (a.sourceFile.stat.ctime - b.sourceFile.stat.ctime) * multiplier;
                case 'modified':
                    return (a.sourceFile.stat.mtime - b.sourceFile.stat.mtime) * multiplier;
                case 'name':
                default:
                    return a.sourceFile.basename.localeCompare(b.sourceFile.basename) * multiplier;
            }
        });
    }

    private async renderTaskList() {
        if (!this.taskListContainer) return;
        this.taskListContainer.empty();

        // Filter and sort tasks
        let filteredTasks = this.filterTasks();
        const sortSelect = this.contentEl.querySelector('.task-sort') as HTMLSelectElement;
        if (sortSelect) {
            filteredTasks = this.sortTasks(filteredTasks, sortSelect.value);
        }

        // Group tasks by file
        const { activeNotes, completedNotes } = this.groupTasksByFile(filteredTasks);

        if (Object.keys(activeNotes).length === 0 && Object.keys(completedNotes).length === 0) {
            this.taskListContainer.createEl('div', {
                cls: 'task-empty-state',
                text: this.searchInput?.value 
                    ? 'No matching tasks found.'
                    : 'No tasks found. Add tasks to your notes with the configured task prefix.'
            });
            return;
        }

        // Create active notes section
        if (Object.keys(activeNotes).length > 0) {
            const activeSection = this.taskListContainer.createDiv({ cls: 'active-notes-section' });
            for (const [path, tasks] of Object.entries(activeNotes)) {
                await this.renderFileSection(path, tasks, activeSection);
            }
        }

        // Create completed notes section if there are any
        if (Object.keys(completedNotes).length > 0) {
            const completedNotesSection = this.taskListContainer.createDiv({ cls: 'completed-notes-section' });
            const header = completedNotesSection.createDiv({ cls: 'completed-notes-header clickable' });
            const toggleIcon = header.createDiv({ cls: 'completed-notes-toggle' });
            
            header.createEl('h3', {
                text: `Completed Notes (${Object.keys(completedNotes).length})`
            });
            
            // Get saved collapse state for completed notes section
            const isCollapsed = localStorage.getItem('dynamic-todo-list-completed-notes-collapsed') === 'true';
            const content = completedNotesSection.createDiv({ 
                cls: `completed-notes-content ${isCollapsed ? 'collapsed' : ''}` 
            });
            
            setIcon(toggleIcon, isCollapsed ? 'chevron-right' : 'chevron-down');
            
            // Add click handler for toggling completed notes section
            header.addEventListener('click', () => {
                const willCollapse = !content.hasClass('collapsed');
                content.toggleClass('collapsed', willCollapse);
                setIcon(toggleIcon, willCollapse ? 'chevron-right' : 'chevron-down');
                localStorage.setItem('dynamic-todo-list-completed-notes-collapsed', willCollapse.toString());
            });

            // Render completed note sections
            for (const [path, tasks] of Object.entries(completedNotes)) {
                await this.renderFileSection(path, tasks, content);
            }
        }
    }

    private async renderFileSection(path: string, tasks: { open: Task[], completed: Task[] }, container: HTMLElement) {
        const section = container.createDiv({ cls: 'task-section' });
        const header = section.createDiv({ cls: 'task-section-header' });
        
        // Title row with toggle and file info
        const titleRow = header.createDiv({ cls: 'task-section-title-row' });
        const toggleIcon = titleRow.createDiv({ cls: 'task-section-toggle' });
        
        const file = tasks.open[0]?.sourceFile || tasks.completed[0]?.sourceFile;
        titleRow.createEl('h3', {
            cls: 'task-section-title',
            text: file?.basename || path
        });

        // Add date information
        if (file) {
            const dateInfo = header.createDiv({ cls: 'task-section-dates' });
            const createdDate = await this.getFileCreationDate(file);
            const modifiedDate = await this.getFileModifiedDate(file);

            if (createdDate) {
                dateInfo.createDiv({
                    cls: 'task-date-entry',
                    text: `Created: ${createdDate}`
                });
            }
            
            if (modifiedDate) {
                dateInfo.createDiv({
                    cls: 'task-date-entry',
                    text: `Modified: ${modifiedDate}`
                });
            }
        }

        // Set initial collapse state
        const isCollapsed = this.collapsedSections.has(path);
        setIcon(toggleIcon, isCollapsed ? 'chevron-right' : 'chevron-down');
        
        const content = section.createDiv({ 
            cls: `task-section-content ${isCollapsed ? 'collapsed' : ''}`
        });

        // Render open tasks first
        if (tasks.open.length > 0) {
            const openTasksList = content.createDiv({ cls: 'open-tasks' });
            tasks.open.forEach(task => this.renderTaskItem(openTasksList as HTMLElement, task));
        }

        // Filter completed tasks that haven't expired
        const threshold = this.processor.settings.archiveCompletedOlderThan;
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - threshold);
        
        const recentCompletedTasks = tasks.completed.filter(task => {
            if (!task.completionDate) return true;
            const completedDate = new Date(task.completionDate);
            return completedDate >= thresholdDate;
        });

        // Create completed tasks section if there are any recent ones
        if (recentCompletedTasks.length > 0) {
            const completedSection = content.createDiv({ cls: 'completed-tasks-section' });
            const completedHeader = completedSection.createDiv({
                cls: 'completed-tasks-header clickable'
            });
            
            const completedToggle = completedHeader.createDiv({
                cls: 'completed-tasks-toggle'
            });
            
            completedHeader.createEl('span', {
                text: `Completed Tasks (${recentCompletedTasks.length})`
            });
            
            const completedContent = completedSection.createDiv({
                cls: 'completed-tasks-content collapsed'
            });
            
            setIcon(completedToggle, 'chevron-right');
            
            recentCompletedTasks.forEach(task => this.renderTaskItem(completedContent as HTMLElement, task));
            
            completedHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = completedContent.hasClass('collapsed');
                completedContent.toggleClass('collapsed', !isCollapsed);
                setIcon(completedToggle, !isCollapsed ? 'chevron-right' : 'chevron-down');
            });
        }

        // Set up section collapse functionality
        header.addEventListener('click', () => {
            const isCollapsed = !content.hasClass('collapsed');
            content.toggleClass('collapsed', isCollapsed);
            setIcon(toggleIcon, isCollapsed ? 'chevron-right' : 'chevron-down');
            
            if (isCollapsed) {
                this.collapsedSections.add(path);
            } else {
                this.collapsedSections.delete(path);
            }

            // Save collapse states
            localStorage.setItem('dynamic-todo-list-collapsed-sections', 
                JSON.stringify(Array.from(this.collapsedSections)));
        });
    }

    private renderTaskItem(container: HTMLElement, task: Task) {
        const taskEl = container.createDiv({ cls: 'task-item' });
        
        const checkbox = taskEl.createDiv({ cls: 'task-checkbox clickable-icon' });
        setIcon(checkbox, task.completed ? 'check-square' : 'square');
        
        const taskText = taskEl.createEl('span', {
            text: task.taskText,
            cls: `task-text ${task.completed ? 'task-completed' : ''} clickable`
        });

        // Add click handler for task navigation
        taskText.addEventListener('click', async () => {
            await this.processor.navigateToTask(task);
        });
        
        // Add click handler for checkbox
        checkbox.addEventListener('click', async () => {
            try {
                checkbox.addClass('is-disabled');
                const newState = !task.completed;
                
                // Update UI immediately
                task.completed = newState;
                setIcon(checkbox, task.completed ? 'check-square' : 'square');
                taskText.toggleClass('task-completed', task.completed);
                
                // Update task section in background
                const taskSection = taskEl.closest('.task-section') as HTMLElement;
                if (taskSection) {
                    await this.updateTaskSectionAfterToggle(taskSection, task);
                }
                
                // Process the actual file change in background
                this.processor.toggleTask(task, newState).catch(error => {
                    // Revert UI if file operation fails
                    task.completed = !newState;
                    setIcon(checkbox, task.completed ? 'check-square' : 'square');
                    taskText.toggleClass('task-completed', task.completed);
                    new Notice('Failed to update task');
                    console.error('Task toggle error:', error);
                }).finally(() => {
                    checkbox.removeClass('is-disabled');
                });
            } catch (error) {
                new Notice('Failed to update task');
                console.error('Task toggle error:', error);
                checkbox.removeClass('is-disabled');
            }
        });
    }

    private async updateTaskSectionAfterToggle(section: HTMLElement, task: Task): Promise<void> {
        const path = task.sourceFile.path;
        
        // Get updated tasks for this file only
        const fileTasks = this.tasks.filter(t => t.sourceFile.path === path);
        const openTasks = fileTasks.filter(t => !t.completed);
        const completedTasks = fileTasks.filter(t => t.completed);

        // If all tasks are completed and we're in the active notes section,
        // trigger a full re-render to move the file to completed notes
        if (openTasks.length === 0 && completedTasks.length > 0 && 
            section.closest('.active-notes-section')) {
            this.renderTaskList();
            return;
        }

        // Update open tasks section if it exists
        const openTasksList = section.querySelector('.open-tasks') as HTMLElement;
        if (openTasksList) {
            openTasksList.empty();
            openTasks.forEach(task => this.renderTaskItem(openTasksList, task));
        }

        // Filter completed tasks by age
        const threshold = this.processor.settings.archiveCompletedOlderThan;
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - threshold);
        
        const recentCompletedTasks = completedTasks.filter(task => {
            if (!task.completionDate) return true;
            const completedDate = new Date(task.completionDate);
            return completedDate >= thresholdDate;
        });

        // Handle completed tasks section
        if (recentCompletedTasks.length > 0) {
            let completedSection = section.querySelector('.completed-tasks-section') as HTMLElement;
            let completedContent = section.querySelector('.completed-tasks-content') as HTMLElement;
            
            if (!completedSection) {
                completedSection = createDiv({ cls: 'completed-tasks-section' });
                const completedHeader = completedSection.createDiv({
                    cls: 'completed-tasks-header clickable'
                });
                
                const completedToggle = completedHeader.createDiv({
                    cls: 'completed-tasks-toggle'
                });
                
                completedHeader.createEl('span', {
                    text: `Completed Tasks (${recentCompletedTasks.length})`
                });
                
                completedContent = completedSection.createDiv({
                    cls: 'completed-tasks-content collapsed'
                });
                
                setIcon(completedToggle, 'chevron-right');
                
                completedHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCollapsed = completedContent.hasClass('collapsed');
                    completedContent.toggleClass('collapsed', !isCollapsed);
                    setIcon(completedToggle, !isCollapsed ? 'chevron-right' : 'chevron-down');
                });

                section.appendChild(completedSection);
            } else {
                // Update the completed tasks counter
                const counter = completedSection.querySelector('span');
                if (counter) {
                    counter.textContent = `Completed Tasks (${recentCompletedTasks.length})`;
                }
            }

            // Clear and re-render completed tasks
            if (completedContent) {
                completedContent.empty();
                recentCompletedTasks.forEach(task => this.renderTaskItem(completedContent, task));
            }
        } else {
            // Remove completed section if no completed tasks
            const completedSection = section.querySelector('.completed-tasks-section');
            if (completedSection) {
                completedSection.remove();
            }
        }
    }

    private groupTasksByFile(tasks: Task[] = this.tasks): { 
        activeNotes: Record<string, { open: Task[], completed: Task[] }>,
        completedNotes: Record<string, { open: Task[], completed: Task[] }>
    } {
        const groups: Record<string, { open: Task[], completed: Task[] }> = {};
        
        // First, group all tasks by file
        tasks.forEach(task => {
            const path = task.sourceFile.path;
            if (!groups[path]) {
                groups[path] = { open: [], completed: [] };
            }
            // Make sure each task only goes to one list
            if (task.completed) {
                groups[path].completed.push(task);
            } else {
                groups[path].open.push(task);
            }
        });

        // Then separate into active and completed notes
        const activeNotes: Record<string, { open: Task[], completed: Task[] }> = {};
        const completedNotes: Record<string, { open: Task[], completed: Task[] }> = {};

        Object.entries(groups).forEach(([path, tasks]) => {
            if (tasks.open.length === 0 && tasks.completed.length > 0) {
                completedNotes[path] = tasks;
            } else {
                activeNotes[path] = tasks;
            }
        });

        return { activeNotes, completedNotes };
    }

    updateTasks(newTasks: Task[]): void {
        // Ensure each task is properly categorized
        this.tasks = newTasks.map(task => ({
            ...task,
            // Ensure completed status is a boolean
            completed: Boolean(task.completed)
        }));
        
        if (!this.isLoading) {
            this.renderTaskList();
        }
    }
}