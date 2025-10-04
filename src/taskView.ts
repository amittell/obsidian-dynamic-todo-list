import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile, MarkdownRenderer, MarkdownView, Component, parseLinktext, debounce } from 'obsidian';
import { Task } from './types';
import { TaskProcessor } from './taskProcessor';
import DynamicTodoList from './main';

export const TASK_VIEW_TYPE = 'dynamic-todo-list';

export class TaskView extends ItemView {
    private static readonly STORAGE_KEYS = {
        COLLAPSED_SECTIONS: 'dynamic-todo-list-collapsed-sections',
        HIDE_COMPLETED: 'dynamic-todo-list-hide-completed',
        SEARCH: 'dynamic-todo-list-search',
        SORT: 'dynamic-todo-list-sort',
        COMPLETED_NOTES_COLLAPSED: 'dynamic-todo-list-completed-notes-collapsed'
    } as const;

    private static readonly MAX_CACHE_SIZE = 1000; // TODO: Make configurable via settings

    private tasks: Task[] = [];
    private processor: TaskProcessor;
    private plugin: DynamicTodoList;
    private taskListContainer: HTMLElement | null = null;
    private collapsedSections: Set<string> = new Set();
    private searchInput: HTMLInputElement | null = null;
    private loadingEl: HTMLElement | null = null;
    private isLoading = true;
    private markdownComponents: Component[] = [];
    private hideCompleted = false;
    private hideCompletedLabel: HTMLLabelElement | null = null;
    private hideCompletedCheckbox: HTMLInputElement | null = null;
    private fileStatsCache = new Map<string, {ctime: number, mtime: number, expires: number}>();
    private pendingFileStats = new Map<string, Promise<{ctime: number, mtime: number} | null>>();

    getIsLoading(): boolean {
        return this.isLoading;
    }

    constructor(leaf: WorkspaceLeaf, tasks: Task[], processor: TaskProcessor, plugin: DynamicTodoList) {
        super(leaf);
        this.tasks = tasks;
        this.processor = processor;
        this.plugin = plugin;
        // If we're created with tasks, we can start in non-loading state
        this.isLoading = tasks.length === 0;
    }

    getViewType(): string {
        return TASK_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Dynamic todo list';
    }

    getIcon(): string {
        return 'checkbox-glyph';
    }

    private cleanupExpiredCache(): void {
        const now = Date.now();
        for (const [key, value] of this.fileStatsCache) {
            if (value.expires <= now) {
                this.fileStatsCache.delete(key);
            }
        }
        
        // Enforce size limit by removing oldest entries
        if (this.fileStatsCache.size > TaskView.MAX_CACHE_SIZE) {
            const toRemoveCount = this.fileStatsCache.size - TaskView.MAX_CACHE_SIZE;
            const sortedEntries = Array.from(this.fileStatsCache.entries())
                .sort(([,a], [,b]) => a.expires - b.expires);
            
            for (let i = 0; i < toRemoveCount; i++) {
                this.fileStatsCache.delete(sortedEntries[i][0]);
            }
        }
    }

    private async getFileStats(file: TFile): Promise<{ctime: number, mtime: number} | null> {
        const now = Date.now();
        const cached = this.fileStatsCache.get(file.path);
        
        // Use cached stats if they're less than 30 seconds old
        if (cached && cached.expires > now) {
            return {ctime: cached.ctime, mtime: cached.mtime};
        }
        
        // Check if there's already a pending request for this file
        const pending = this.pendingFileStats.get(file.path);
        if (pending) {
            return pending;
        }
        
        // Clean up expired entries periodically
        if (this.fileStatsCache.size > 100) {
            this.cleanupExpiredCache();
        }
        
        // Create new request and cache the promise to prevent race conditions
        const promise = this.fetchFileStats(file.path, now);
        this.pendingFileStats.set(file.path, promise);
        
        try {
            const result = await promise;
            return result;
        } finally {
            // Always clean up the pending request when done
            this.pendingFileStats.delete(file.path);
        }
    }

    private async fetchFileStats(filePath: string, requestTime: number): Promise<{ctime: number, mtime: number} | null> {
        try {
            const stat = await this.app.vault.adapter.stat(filePath);
            if (stat) {
                // Cache for 30 seconds
                this.fileStatsCache.set(filePath, {
                    ctime: stat.ctime,
                    mtime: stat.mtime,
                    expires: requestTime + 30000
                });
                return {ctime: stat.ctime, mtime: stat.mtime};
            }
            return null;
        } catch (error) {
            console.error('Error getting file stats:', error);
            return null;
        }
    }

    private async getFileCreationDate(file: TFile): Promise<string> {
        const stats = await this.getFileStats(file);
        return stats ? new Date(stats.ctime).toLocaleDateString() : '';
    }

    private async getFileModifiedDate(file: TFile): Promise<string> {
        const stats = await this.getFileStats(file);
        return stats ? new Date(stats.mtime).toLocaleDateString() : '';
    }

    private getSortValue(): string {
        const sortSelect = this.contentEl.querySelector('.task-sort') as HTMLSelectElement;
        if (!sortSelect) {
            console.warn('Sort select element not found, using default sort preference');
            return `${this.processor.settings.sortPreference.field}-${this.processor.settings.sortPreference.direction}`;
        }
        return sortSelect.value || `${this.processor.settings.sortPreference.field}-${this.processor.settings.sortPreference.direction}`;
    }

    private getSortedTasks(tasks: Task[]): Task[] {
        const sortValue = this.getSortValue();
        return this.sortTasks(tasks, sortValue);
    }

    private async preloadFileStats(tasks: Task[]): Promise<void> {
        const uniqueFiles = new Set(tasks.map(task => task.sourceFile));
        const promises = Array.from(uniqueFiles).map(file => this.getFileStats(file));
        await Promise.allSettled(promises);
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();

        // Restore states FIRST before creating UI elements
        this.collapsedSections = new Set(
            JSON.parse(localStorage.getItem(TaskView.STORAGE_KEYS.COLLAPSED_SECTIONS) || '[]')
        );
        this.hideCompleted = localStorage.getItem(TaskView.STORAGE_KEYS.HIDE_COMPLETED) === 'true';

        // Create all UI elements
        const headerSection = contentEl.createDiv({ cls: 'task-list-header-section' });
        headerSection.createEl('h2', { text: 'Dynamic todo list', cls: 'task-list-header' });
        const controlsSection = headerSection.createDiv({ cls: 'task-controls' });
        this.taskListContainer = contentEl.createDiv({ cls: 'task-list' });
        
        // Create loading overlay
        this.loadingEl = contentEl.createDiv({ cls: 'task-list-loading' });
        const loadingInner = this.loadingEl.createDiv({ cls: 'task-list-loading-inner' });
        loadingInner.createDiv({ cls: 'task-list-loading-spinner' });
        const progressBar = loadingInner.createDiv({ cls: 'task-list-loading-progress' });
        progressBar.createDiv({ 
            cls: 'task-list-loading-progress-inner'
        });
        loadingInner.createDiv({
            cls: 'task-list-loading-text',
            text: 'Loading tasks... 0%'
        });

        // Set up controls (now with the correct state already restored)
        await this.setupSearchAndSort(controlsSection);

        // Set initial loading state
        this.setLoading(this.isLoading);

        // If we already have tasks, render them
        if (this.tasks.length > 0) {
            this.renderTaskList();
        }
    }

    private async setupSearchAndSort(controlsSection: HTMLElement): Promise<void> {
        // Create a container for the first row (search and sort)
        const firstRow = controlsSection.createDiv({ cls: 'task-controls-row' });
        
        // Search box with stored value
        const savedSearch = localStorage.getItem(TaskView.STORAGE_KEYS.SEARCH) || '';
        this.searchInput = firstRow.createEl('input', {
            cls: 'task-search',
            attr: { 
                type: 'text',
                placeholder: 'Search tasks or files...',
                value: savedSearch
            }
        });

        const debouncedSearch = debounce(() => {
            localStorage.setItem(TaskView.STORAGE_KEYS.SEARCH, this.searchInput!.value);
            this.renderTaskList();
        }, 200, true);
        
        this.searchInput.addEventListener('input', () => {
            debouncedSearch();
        });

        // Sort dropdown
        const sortSelect = firstRow.createEl('select', { cls: 'task-sort' });
        sortSelect.createEl('option', { text: 'Name (A to Z)', value: 'name-asc' });
        sortSelect.createEl('option', { text: 'Name (Z to A)', value: 'name-desc' });
        sortSelect.createEl('option', { text: 'Created (newest)', value: 'created-desc' });
        sortSelect.createEl('option', { text: 'Created (oldest)', value: 'created-asc' });
        sortSelect.createEl('option', { text: 'Modified (newest)', value: 'modified-desc' });
        sortSelect.createEl('option', { text: 'Modified (oldest)', value: 'modified-asc' });

        // Get saved sort preference
        const savedSort = localStorage.getItem(TaskView.STORAGE_KEYS.SORT) || 
            `${this.processor.settings.sortPreference.field}-${this.processor.settings.sortPreference.direction}`;
        sortSelect.value = savedSort;
        
        sortSelect.addEventListener('change', () => {
            const [field, direction] = sortSelect.value.split('-');
            this.processor.settings.sortPreference = {
                field: field as 'name' | 'created' | 'lastModified',
                direction: direction as 'asc' | 'desc'
            };
            localStorage.setItem(TaskView.STORAGE_KEYS.SORT, sortSelect.value);
            this.renderTaskList();
        });

        // Create a container for the second row (action buttons)
        const secondRow = controlsSection.createDiv({ cls: 'task-controls-row task-action-buttons' });

        // Collapse all button
        const collapseAllBtn = secondRow.createEl('button', {
            cls: 'task-action-button',
            attr: { 'aria-label': 'Collapse all sections' }
        });
        setIcon(collapseAllBtn, 'chevrons-down-up');
        collapseAllBtn.addEventListener('click', () => this.collapseAll());

        // Expand all button
        const expandAllBtn = secondRow.createEl('button', {
            cls: 'task-action-button',
            attr: { 'aria-label': 'Expand all sections' }
        });
        setIcon(expandAllBtn, 'chevrons-up-down');
        expandAllBtn.addEventListener('click', () => this.expandAll());

        // Hide completed checkbox container
        const hideCompletedContainer = secondRow.createDiv({ cls: 'task-hide-completed-container' });
        const hideCompletedCheckbox = hideCompletedContainer.createEl('input', {
            cls: 'task-hide-completed-checkbox',
            attr: { 
                type: 'checkbox',
                id: 'hide-completed-tasks',
                checked: this.hideCompleted,
                'aria-label': 'Hide all completed tasks'
            }
        });
        
        this.hideCompletedLabel = hideCompletedContainer.createEl('label', {
            cls: 'task-hide-completed-label',
            text: 'Hide completed',
            attr: { 
                for: 'hide-completed-tasks',
                title: 'When checked: hide all completed tasks. When unchecked: show recent completed tasks (older than archive threshold will still be hidden)'
            }
        });

        hideCompletedCheckbox.addEventListener('change', () => {
            this.hideCompleted = hideCompletedCheckbox.checked;
            localStorage.setItem(TaskView.STORAGE_KEYS.HIDE_COMPLETED, this.hideCompleted.toString());
            this.renderTaskList();
        });
        
        // Store reference to checkbox for state synchronization
        this.hideCompletedCheckbox = hideCompletedCheckbox;
    }

    /**
     * Refreshes the view to reflect any setting changes
     */
    public refreshSettings(): void {
        this.renderTaskList();
    }

    private collapseAll(): void {
        // Get all file paths from current tasks
        const allPaths = new Set<string>();
        this.tasks.forEach(task => allPaths.add(task.sourceFile.path));
        
        // Add all paths to collapsed sections
        this.collapsedSections = new Set(allPaths);
        
        // Save state
        localStorage.setItem(TaskView.STORAGE_KEYS.COLLAPSED_SECTIONS, 
            JSON.stringify(Array.from(this.collapsedSections)));
        
        // Re-render
        this.renderTaskList();
    }

    private expandAll(): void {
        // Clear all collapsed sections
        this.collapsedSections.clear();
        
        // Save state
        localStorage.setItem(TaskView.STORAGE_KEYS.COLLAPSED_SECTIONS, '[]');
        
        // Re-render
        this.renderTaskList();
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
            // Use data attribute instead of style manipulation
            progressInner.setAttribute('data-progress', Math.round(percent).toString());
            progressText.textContent = `Loading tasks... ${Math.round(percent)}%`;
        }
    }

    private filterTasks(): Task[] {
        let filtered = this.tasks;
        
        // Apply search filter
        if (this.searchInput?.value) {
            const searchTerm = this.searchInput.value.toLowerCase();
            filtered = filtered.filter(task => 
                task.taskText.toLowerCase().includes(searchTerm) ||
                task.sourceFile.path.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply completed filter if enabled
        if (this.hideCompleted) {
            filtered = filtered.filter(task => !task.completed);
        }
        
        return filtered;
    }

    private filterTasksByArchiveThreshold(tasks: Task[]): Task[] {
        const threshold = this.plugin.settings.archiveCompletedOlderThan;
        if (threshold <= 0) return tasks;
        
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - threshold);
        
        return tasks.filter(task => {
            if (!task.completed) return true; // Show all open tasks
            if (!task.completionDate) return true; // Show completed tasks without completion date
            const completedDate = new Date(task.completionDate);
            return completedDate >= thresholdDate; // Show recently completed tasks
        });
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
                    if (this.plugin.settings.showFileHeaders) {
                        // Grouped mode: sort by file name (current behavior)
                        return a.sourceFile.basename.localeCompare(b.sourceFile.basename) * multiplier;
                    } else {
                        // Flat mode: sort by task text content
                        return a.taskText.localeCompare(b.taskText) * multiplier;
                    }
            }
        });
    }

    private async renderTaskList() {
        // Clean up existing components
        this.markdownComponents.forEach(component => component.unload());
        this.markdownComponents = [];

        if (!this.taskListContainer) return;
        this.taskListContainer.empty();

        // Filter tasks
        const filteredTasks = this.filterTasks();

        // Preload file stats if needed
        if (this.plugin.settings.showFileHeaders && this.plugin.settings.showFileHeaderDates) {
            await this.preloadFileStats(filteredTasks);
        }

        // Check if we should show file headers
        if (this.plugin.settings.showFileHeaders) {
            // Sorting is handled inside renderTaskListWithHeaders
            await this.renderTaskListWithHeaders(filteredTasks);
        } else {
            // Sorting is handled inside renderFlatTaskList
            await this.renderFlatTaskList(filteredTasks);
        }
    }

    private async renderTaskListWithHeaders(filteredTasks: Task[]) {
        // Sort tasks for grouped view
        const sortedTasks = this.getSortedTasks(filteredTasks);
        
        // Group tasks by file
        const { activeNotes, completedNotes } = this.groupTasksByFile(sortedTasks);

        if (Object.keys(activeNotes).length === 0 && Object.keys(completedNotes).length === 0) {
            this.taskListContainer!.createEl('div', {
                cls: 'task-empty-state',
                text: this.searchInput?.value 
                    ? 'No matching tasks found.'
                    : 'No tasks found. Add tasks to your notes with the configured task prefix.'
            });
            return;
        }

        // Create active notes section
        if (Object.keys(activeNotes).length > 0) {
            const activeSection = this.taskListContainer!.createDiv({ cls: 'active-notes-section' });
            for (const [path, tasks] of Object.entries(activeNotes)) {
                await this.renderFileSection(path, tasks, activeSection);
            }
        }

        // Create completed notes section if there are any
        if (Object.keys(completedNotes).length > 0) {
            const completedNotesSection = this.taskListContainer!.createDiv({ cls: 'completed-notes-section' });
            const header = completedNotesSection.createDiv({ cls: 'completed-notes-header clickable' });
            const toggleIcon = header.createDiv({ cls: 'completed-notes-toggle' });
            
            header.createEl('h3', {
                text: `Completed notes (${Object.keys(completedNotes).length})`
            });
            
            // Get saved collapse state for completed notes section
            const isCollapsed = localStorage.getItem(TaskView.STORAGE_KEYS.COMPLETED_NOTES_COLLAPSED) === 'true';
            const content = completedNotesSection.createDiv({ 
                cls: `completed-notes-content ${isCollapsed ? 'collapsed' : ''}` 
            });
            
            setIcon(toggleIcon, isCollapsed ? 'chevron-right' : 'chevron-down');
            
            // Add click handler for toggling completed notes section
            header.addEventListener('click', () => {
                const willCollapse = !content.hasClass('collapsed');
                content.toggleClass('collapsed', willCollapse);
                setIcon(toggleIcon, willCollapse ? 'chevron-right' : 'chevron-down');
                localStorage.setItem(TaskView.STORAGE_KEYS.COMPLETED_NOTES_COLLAPSED, willCollapse.toString());
            });

            // Render completed note sections
            for (const [path, tasks] of Object.entries(completedNotes)) {
                await this.renderFileSection(path, tasks, content);
            }
        }
    }

    private async renderFlatTaskList(filteredTasks: Task[]) {
        if (filteredTasks.length === 0) {
            this.taskListContainer!.createEl('div', {
                cls: 'task-empty-state',
                text: this.searchInput?.value 
                    ? 'No matching tasks found.'
                    : 'No tasks found. Add tasks to your notes with the configured task prefix.'
            });
            return;
        }

        // Apply completed task filtering based on archive threshold
        let visibleTasks = filteredTasks;
        if (!this.hideCompleted) {
            visibleTasks = this.filterTasksByArchiveThreshold(filteredTasks);
        }

        // Create flat task list container
        const flatTaskList = this.taskListContainer!.createDiv({ cls: 'flat-task-list' });
        
        // Check if we should group completed tasks at the bottom
        if (this.plugin.settings.moveCompletedTasksToBottom && !this.hideCompleted) {
            // Split tasks into open and completed
            const openTasks = visibleTasks.filter(task => !task.completed);
            const completedTasks = visibleTasks.filter(task => task.completed);
            
            // Sort each group separately using existing sort logic
            const sortedOpenTasks = this.getSortedTasks(openTasks);
            const sortedCompletedTasks = this.getSortedTasks(completedTasks);
            
            // Render open tasks first
            sortedOpenTasks.forEach(task => {
                this.renderTaskItem(flatTaskList, task);
            });
            
            // Render completed tasks after open tasks
            sortedCompletedTasks.forEach(task => {
                this.renderTaskItem(flatTaskList, task);
            });
        } else {
            // Sort all tasks together and render in order
            const sortedTasks = this.getSortedTasks(visibleTasks);
            sortedTasks.forEach(task => {
                this.renderTaskItem(flatTaskList, task);
            });
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

        // Add date information if setting is enabled
        if (file && this.plugin.settings.showFileHeaderDates) {
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

        // Only render completed tasks section if hide completed is unchecked
        if (!this.hideCompleted) {
            // When hide completed is OFF, filter completed tasks by auto-archive threshold
            const recentCompletedTasks = this.filterTasksByArchiveThreshold(tasks.completed);

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
                    text: `Completed tasks (${recentCompletedTasks.length})`
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
            localStorage.setItem(TaskView.STORAGE_KEYS.COLLAPSED_SECTIONS, 
                JSON.stringify(Array.from(this.collapsedSections)));
        });
    }


    private renderTaskItem(container: HTMLElement, task: Task) {
        const taskEl = container.createDiv({ cls: 'task-item' });
        
        const checkbox = taskEl.createDiv({ cls: 'task-checkbox clickable-icon' });
        setIcon(checkbox, task.completed ? 'check-square' : 'square');
        
        const taskTextContainer = taskEl.createDiv({
            cls: `task-text ${task.completed ? 'task-completed' : ''}`
        });
        const taskClickWrapper = taskTextContainer.createDiv({ cls: 'task-click-wrapper' });

        // Create component for proper cleanup
        const component = new Component();
        this.markdownComponents.push(component);

        // Render markdown with Obsidian's renderer
        MarkdownRenderer.renderMarkdown(
            task.taskText,
            taskClickWrapper,
            task.sourceFile.path,
            component
        ).then(() => {
            // Process links after rendering
            taskClickWrapper.findAll('.internal-link').forEach(link => {
                if (!this.processor.settings.enableWikiLinks) {
                    link.addClass('disabled-link');
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleTaskClick(task);
                    });
                } else {
                    // Handle wiki-link navigation
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const linkText = link.getAttribute('data-href') || link.textContent;
                        if (!linkText) return;

                        // Parse the link text to get the target file
                        const { path } = parseLinktext(linkText);
                        if (!path) return;

                        // Try to find and open the target file
                        const targetFile = this.app.metadataCache.getFirstLinkpathDest(path, task.sourceFile.path);
                        if (targetFile) {
                            this.app.workspace.openLinkText(
                                linkText,
                                task.sourceFile.path,
                                false, // Don't create new files
                                { active: true } // Make the opened note active
                            ).catch(() => {
                                new Notice('Failed to open linked note');
                            });
                        } else {
                            new Notice('Linked note not found');
                        }
                    });
                }
            });

            if (!this.processor.settings.enableUrlLinks) {
                taskClickWrapper.findAll('a:not(.internal-link)').forEach(link => {
                    link.addClass('disabled-link');
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleTaskClick(task);
                    });
                });
            }

            // Handle clicks on non-link elements
            taskClickWrapper.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const isUrlLink = target.matches('a:not(.internal-link)') ||
                                target.closest('a:not(.internal-link)');
                const isWikiLink = target.matches('.internal-link') ||
                                target.closest('.internal-link');
                
                // Don't interfere with enabled links
                if ((isUrlLink && this.processor.settings.enableUrlLinks) ||
                    (isWikiLink && this.processor.settings.enableWikiLinks)) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                this.handleTaskClick(task);
            });
        });

        // Add checkbox handler with debounce
        let isProcessing = false;
        checkbox.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isProcessing) return;
            isProcessing = true;
            
            try {
                checkbox.addClass('is-disabled');
                const newState = !task.completed;
                
                // Update UI immediately
                task.completed = newState;
                setIcon(checkbox, task.completed ? 'check-square' : 'square');
                taskTextContainer.toggleClass('task-completed', task.completed);
                
                const taskSection = taskEl.closest('.task-section') as HTMLElement;
                if (taskSection) {
                    await this.updateTaskSectionAfterToggle(taskSection, task);
                }
                
                // Process file change
                await this.processor.toggleTask(task, newState);
            } catch (error) {
                // Revert UI state on error
                task.completed = !task.completed;
                setIcon(checkbox, task.completed ? 'check-square' : 'square');
                taskTextContainer.toggleClass('task-completed', task.completed);
                new Notice('Failed to update task');
                console.error('Task toggle error:', error);
            } finally {
                checkbox.removeClass('is-disabled');
                isProcessing = false;
            }
        });
    }

    private async handleTaskClick(task: Task): Promise<void> {
        // First look for an existing leaf with this file
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        const existingLeaf = leaves.find(leaf => {
            if (leaf.view instanceof MarkdownView) {
                return leaf.view.file?.path === task.sourceFile.path;
            }
            return false;
        });

        if (existingLeaf) {
            // Activate and focus the existing leaf
            await this.app.workspace.setActiveLeaf(existingLeaf);
            const view = existingLeaf.view as MarkdownView;
            
            // Ensure the editor is focused and cursor is set
            if (view.editor) {
                view.editor.focus();
                view.editor.setCursor(task.lineNumber);
                // Scroll the line into view
                view.editor.scrollIntoView(
                    { from: { line: task.lineNumber, ch: 0 }, to: { line: task.lineNumber, ch: 0 } },
                    true
                );
            }
        } else {
            // Let the processor handle opening in a new leaf
            await this.processor.navigateToTask(task);
        }
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

        // Only handle completed tasks section if hide completed is unchecked
        if (!this.hideCompleted) {
            // When hide completed is OFF, filter completed tasks by auto-archive threshold
            // Only show completed tasks newer than the threshold
            const recentCompletedTasks = this.filterTasksByArchiveThreshold(completedTasks);

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
                        text: `Completed tasks (${recentCompletedTasks.length})`
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
                        counter.textContent = `Completed tasks (${recentCompletedTasks.length})`;
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
        } else {
            // Remove completed section if hide completed is enabled
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
        
        // Sync checkbox state to ensure visual and functional states match
        this.syncCheckboxState();
        
        if (!this.isLoading) {
            this.renderTaskList();
        }
    }
    
    private syncCheckboxState(): void {
        // Ensure checkbox visual state matches internal state
        if (this.hideCompletedCheckbox) {
            this.hideCompletedCheckbox.checked = this.hideCompleted;
        }
    }

    async onClose(): Promise<void> {
        // Clean up caches to prevent memory leaks
        this.fileStatsCache.clear();
        this.pendingFileStats.clear();
        
        // Clean up existing markdown components
        this.markdownComponents.forEach(component => component.unload());
        this.markdownComponents = [];
        
        await super.onClose();
    }
}