import { Plugin, App, WorkspaceLeaf, Notice } from 'obsidian';
import { TaskView, TASK_VIEW_TYPE } from './taskView';
import { TaskProcessor } from './taskProcessor';
import { DynamicTodoListSettingTab } from './settingsTab';
import { Task, PluginSettings, DEFAULT_SETTINGS } from './types';

export default class DynamicTodoList extends Plugin {
    settings: PluginSettings;
    private tasks: Task[] = [];
    private processor: TaskProcessor;
    private view: TaskView | null = null;
    private reindexingInProgress = false;

    override async onload(): Promise<void> {
        await this.loadSettings();
        
        // Initialize processor with app context for navigation
        this.processor = new TaskProcessor(this.app.vault, this.settings);
        this.processor.setApp(this.app);

        // Register view type
        this.registerView(
            TASK_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => {
                this.view = new TaskView(leaf, this.tasks, this.processor);
                return this.view;
            }
        );

        // Add command to show task list
        this.addCommand({
            id: 'show-dynamic-task-list',
            name: 'Show Task List',
            callback: async () => {
                await this.activateView();
            },
            hotkeys: [{ modifiers: ['Mod'], key: 'j' }]
        });

        // Add settings tab
        this.addSettingTab(new DynamicTodoListSettingTab(this.app, this));

        // Setup file watcher with debouncing
        let timeoutId: NodeJS.Timeout;
        this.registerEvent(
            this.app.vault.on('modify', () => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => this.indexTasks(), 2000);
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', () => {
                this.indexTasks();
            })
        );

        // Initial index
        await this.indexTasks();

        // Open on startup if configured
        if (this.settings.openOnStartup) {
            this.activateView();
        }
    }

    private async activateView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.app;

        // Check for existing view
        const existing = workspace.getLeavesOfType(TASK_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return existing[0];
        }

        // Create new leaf
        const leaf = workspace.getRightLeaf(false);
        if (!leaf) return null;
        
        await leaf.setViewState({ type: TASK_VIEW_TYPE });
        workspace.revealLeaf(leaf);
        return leaf;
    }

    async indexTasks(): Promise<void> {
        if (this.reindexingInProgress) return;
        
        try {
            this.reindexingInProgress = true;
            const files = this.app.vault.getMarkdownFiles();
            this.tasks = [];
            
            for (const file of files) {
                const fileTasks = await this.processor.processFile(file);
                this.tasks.push(...fileTasks);
            }

            // Sort tasks based on settings
            if (this.settings.sortPreference.field === 'created') {
                this.tasks.sort((a, b) => b.sourceFile.stat.ctime - a.sourceFile.stat.ctime);
            } else if (this.settings.sortPreference.field === 'lastModified') {
                this.tasks.sort((a, b) => b.sourceFile.stat.mtime - a.sourceFile.stat.mtime);
            }

            // Update view if it exists
            if (this.view) {
                this.view.updateTasks(this.tasks);
            }
        } catch (error) {
            console.error('Error indexing tasks:', error);
            new Notice('Error updating tasks');
        } finally {
            this.reindexingInProgress = false;
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        await this.indexTasks();
    }
}