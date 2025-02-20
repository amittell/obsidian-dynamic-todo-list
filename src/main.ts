import { Plugin, App, WorkspaceLeaf, Notice } from 'obsidian';
import { TaskView, TASK_VIEW_TYPE } from './taskView';
import { TaskProcessor } from './taskProcessor';
import { DynamicTodoListSettingTab } from './settingsTab';
import { Task, PluginSettings, DEFAULT_SETTINGS } from './types';
import { debounce } from '../src/utils'; // Using explicit relative path

export default class DynamicTodoList extends Plugin {
    settings: PluginSettings;
    private tasks: Task[] = [];
    private processor: TaskProcessor;
    private view: TaskView | null = null;
    private reindexingInProgress = false;
    private initialLoadComplete = false;

    override async onload(): Promise<void> {
        await this.loadSettings();
        
        // Initialize processor with app context for navigation
        this.processor = new TaskProcessor(this.app.vault, this.settings);
        this.processor.setApp(this.app);

        // Start indexing tasks immediately
        this.app.workspace.onLayoutReady(() => {
            this.indexTasks(true);
        });

        // Add UI elements first
        this.addRibbonIcon('checkbox-glyph', 'Dynamic Todo List', async () => {
            await this.activateView();
        });

        // Register view early
        this.registerView(
            TASK_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => {
                this.view = new TaskView(leaf, [], this.processor);
                return this.view;
            }
        );

        // Activate view if configured
        if (this.settings.openOnStartup) {
            await this.activateView();
        }

        // Add command
        this.addCommand({
            id: 'show-dynamic-task-list',
            name: 'Show Task List',
            callback: async () => {
                await this.activateView();
            },
            hotkeys: [{ modifiers: ['Mod'], key: 'j' }]
        });

        // Set up file watchers
        this.registerEvent(
            this.app.vault.on('modify', () => {
                this.debouncedIndex();
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', () => {
                this.indexTasks(false);
            })
        );

        this.addSettingTab(new DynamicTodoListSettingTab(this.app, this));
    }

    private debouncedIndex = debounce(() => this.indexTasks(false), 300, true);

    private async activateView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;

        // Check for existing view
        const existing = workspace.getLeavesOfType(TASK_VIEW_TYPE);
        if (existing.length > 0) {
            leaf = existing[0];
            workspace.revealLeaf(leaf);
        } else {
            // Create new leaf
            leaf = workspace.getRightLeaf(false);
            if (!leaf) return null;
            
            await leaf.setViewState({ type: TASK_VIEW_TYPE });
            workspace.revealLeaf(leaf);
        }

        // Wait for view to be ready and initialize if needed
        if (leaf && leaf.view instanceof TaskView) {
            // Update tasks if we already have them
            if (this.tasks.length > 0) {
                leaf.view.updateTasks(this.tasks);
                leaf.view.setLoading(false);
            } else {
                leaf.view.setLoading(true);
            }
        }

        return leaf;
    }

    async indexTasks(isInitialLoad = false): Promise<void> {
        if (this.reindexingInProgress) return;
        
        try {
            this.reindexingInProgress = true;
            const files = this.app.vault.getMarkdownFiles();
            
            if (isInitialLoad && this.view) {
                this.view.setLoading(true);
                this.view.updateLoadingProgress(0);
            }

            const newTasks: Task[] = [];
            const totalFiles = files.length;

            for (let i = 0; i < files.length; i++) {
                const tasks = await this.processor.processFile(files[i]);
                newTasks.push(...tasks);

                if (this.view) {
                    const progress = Math.round((i + 1) / totalFiles * 100);
                    this.view.updateLoadingProgress(progress);
                }
            }

            this.tasks = newTasks;
            this.initialLoadComplete = true;

            if (this.view) {
                this.view.updateTasks(this.tasks);
                this.view.setLoading(false);
            }
        } catch (error) {
            console.error('Error indexing tasks:', error);
            new Notice('Error updating tasks');
            if (this.view) {
                this.view.setLoading(false);
            }
        } finally {
            this.reindexingInProgress = false;
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

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

    async onunload() {
        // Save current state before unloading
        await this.saveData(this.settings);
    }
}