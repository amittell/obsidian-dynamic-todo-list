import { Plugin, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import { TaskView, TASK_VIEW_TYPE } from './taskView';
import { TaskProcessor } from './taskProcessor';
import { DynamicTodoListSettingTab } from './settingsTab';
import { Task, PluginSettings, DEFAULT_SETTINGS } from './types';
import { debounce } from '../src/utils'; // Using explicit relative path

/**
 * Main plugin class for the Dynamic Todo List plugin.
 * This plugin extends Obsidian's Plugin class and provides functionality
 * for dynamically aggregating and managing tasks from notes.
 */
export default class DynamicTodoList extends Plugin {
    settings: PluginSettings;
    private tasks: Task[] = [];
    private processor: TaskProcessor;
    private view: TaskView | null = null;
    private reindexingInProgress = false;
    private initialLoadComplete = false;

    /**
     * Called when the plugin is loaded.
     * Initializes settings, task processor, UI elements, and event handlers.
     * @override
     */
    override async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize processor with app context for navigation
        this.processor = new TaskProcessor(this.app.vault, this.settings);
        this.processor.setApp(this.app);

        // Start indexing tasks immediately once the layout is ready
        this.app.workspace.onLayoutReady(() => {
            this.indexTasks(true);
        });

        // Add UI elements - ribbon icon for toggling the view
        this.addRibbonIcon('checkbox-glyph', 'Dynamic Todo List', async () => {
            await this.toggleView();
        });

        // Register the view
        this.registerView(
            TASK_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => {
                this.view = new TaskView(leaf, [], this.processor, this); // Pass the plugin instance
                return this.view;
            }
        );

        // Activate view if configured in settings
        if (this.settings.openOnStartup) {
            await this.activateView();
        }

        // Add command to toggle the view, with a hotkey
        this.addCommand({
            id: 'show-dynamic-task-list',
            name: 'Toggle Task List',
            callback: async () => {
                await this.toggleView();
            }
        });

        // Set up file watchers to re-index tasks on file modification and deletion
        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                // Only process markdown files
                if (!(file instanceof TFile) || file.extension !== 'md') return;

                // Skip processing if the file change was triggered by our own task toggle (within a short time window)
                const skipFullProcess = this.tasks.some(t =>
                    t.sourceFile.path === file.path &&
                    Date.now() - t.lastUpdated < 500 // 500ms threshold
                );

                if (skipFullProcess) return;

                // Check if this file is in our task list
                const existingTasks = this.tasks.filter(t => t.sourceFile.path === file.path);
                if (existingTasks.length > 0) {
                    // Process file changes in background without blocking the main thread
                    setTimeout(() => {
                        this.processor.processFile(file).then(updatedTasks => {
                            if (updatedTasks.length > 0) {
                                // Remove old tasks for this file and add new ones
                                this.tasks = [
                                    ...this.tasks.filter(t => t.sourceFile.path !== file.path),
                                    ...updatedTasks
                                ].map(task => ({
                                    ...task,
                                    completed: Boolean(task.completed)  // Ensure completed is boolean
                                }));

                                // Update the view if it's open and not currently loading
                                if (this.view && !this.view.getIsLoading()) {
                                    this.view.updateTasks(this.tasks);
                                }
                            }
                        }).catch(error => {
                            console.error('Error processing file changes:', error);
                        });
                    }, 100); // Short delay for responsiveness
                } else {
                    // If this is a new file that might contain tasks, do a full index (debounced)
                    this.debouncedIndex();
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', () => {
                this.indexTasks(false); // Re-index on file deletion
            })
        );

        // Add settings tab
        this.addSettingTab(new DynamicTodoListSettingTab(this.app, this));
    }

    // Debounced version of indexTasks, using the utility function.  The trailing 'true' causes it to run immediately the first time.
    private debouncedIndex = debounce(() => this.indexTasks(false), 100, true);

    /**
     * Activates the task view in the right sidebar.
     * If a view of the same type already exists, it reveals that leaf.
     * Otherwise, it creates a new leaf.
     * @returns The created or existing leaf, or null if a new leaf couldn't be created.
     */
    private async activateView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;

        // Check for existing view
        const existing = workspace.getLeavesOfType(TASK_VIEW_TYPE);
        if (existing.length > 0) {
            leaf = existing[0];
            workspace.revealLeaf(leaf); // Bring existing view to front
        } else {
            // Create new leaf in the right sidebar
            leaf = workspace.getRightLeaf(false);
            if (!leaf) return null; // No right leaf available

            await leaf.setViewState({ type: TASK_VIEW_TYPE }); // Set the view type
            workspace.revealLeaf(leaf); // Reveal the new leaf
        }

        // Wait for view to be ready and initialize if needed
        if (leaf && leaf.view instanceof TaskView) {
            // Update tasks if we already have them
            if (this.tasks.length > 0) {
                leaf.view.updateTasks(this.tasks);
                leaf.view.setLoading(false); // We have tasks, so we're not loading
            } else {
                leaf.view.setLoading(true); // No tasks yet, show loading indicator
            }
        }

        return leaf;
    }

    /**
     * Toggles the task view. If the view is open, it closes it.
     * If the view is closed, it opens it.  If closing, and it's
     * in the right sidebar, and there are no other leaves, collapse
     * the sidebar.
     */
    private async toggleView(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(TASK_VIEW_TYPE);

        if (existing.length > 0) {
            const leaf = existing[0];

            // Remember which side the leaf was on
            const isInRightSidebar = leaf.getRoot() === workspace.rightSplit;

            // Detach our view (close it)
            leaf.detach();

            // If we were in the right sidebar and there are no other leaves, collapse it
            if (isInRightSidebar && workspace.rightSplit) {
                const rightLeaves = workspace.getLeavesOfType('');
                const hasVisibleSidebarLeaves = rightLeaves.some(l =>
                    l !== leaf && // Exclude our own leaf
                    l.getRoot() === workspace.rightSplit // Check if it's in the right sidebar
                );

                if (!hasVisibleSidebarLeaves) {
                    workspace.rightSplit.collapse(); // Collapse the right sidebar
                }
            }
        } else {
            // Open the view if it's closed
            await this.activateView();
        }
    }

    /**
     * Indexes all tasks in the vault, updating the task list.
     * @param isInitialLoad - True if this is the initial indexing on plugin load, false otherwise.
     */
    async indexTasks(isInitialLoad = false): Promise<void> {
        if (this.reindexingInProgress) return; // Prevent concurrent indexing

        try {
            this.reindexingInProgress = true;
            const files = this.app.vault.getMarkdownFiles(); // Get all markdown files

            if (isInitialLoad && this.view) {
                this.view.setLoading(true); // Show loading indicator
                this.view.updateLoadingProgress(0); // Initialize progress
            }

            const newTasks: Task[] = [];
            const totalFiles = files.length;

            // Loop through all markdown files
            for (let i = 0; i < files.length; i++) {
                const tasks = await this.processor.processFile(files[i]); // Process each file
                newTasks.push(...tasks); // Add the tasks to the list

                if (this.view) {
                    const progress = Math.round((i + 1) / totalFiles * 100); // Calculate progress
                    this.view.updateLoadingProgress(progress);  // Update loading progress
                }
            }

            this.tasks = newTasks; // Update the task list
            this.initialLoadComplete = true;

            if (this.view) {
                this.view.updateTasks(this.tasks); // Update the view with the new tasks
                this.view.setLoading(false); // Hide loading indicator
            }
        } catch (error) {
            console.error('Error indexing tasks:', error);
            new Notice('Error updating tasks'); // Display error message to the user
            if (this.view) {
                this.view.setLoading(false); // Ensure loading indicator is hidden on error
            }
        } finally {
            this.reindexingInProgress = false; // Allow reindexing after completion or error
        }
    }

    /**
     * Refreshes the task view if it's not currently loading.
     */
    async refreshTaskView(): Promise<void> {
        if (this.view && !this.view.getIsLoading()) {
            this.view.updateTasks(this.tasks);
        }
    }

    /**
     * Loads the plugin settings from storage.
     */
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * Saves the plugin settings to storage.
     */
    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Re-initialize the processor with new settings
        this.processor = new TaskProcessor(this.app.vault, this.settings);
        this.processor.setApp(this.app);
        // Re-index with new settings if needed
        if (this.initialLoadComplete) {
            await this.indexTasks(false);
        }
    }

    /**
     * Called when the plugin is unloaded.  Handles cleanup.
     */
    async onunload() {
        // Cleanup will be handled automatically
    }
}
