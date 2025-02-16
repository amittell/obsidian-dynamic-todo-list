import {
    Plugin,
    PluginSettingTab,
    App,
    Setting,
    Notice,
    WorkspaceLeaf
} from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, Task } from './types';
import { TaskProcessor } from './taskProcessor';
import { TaskView, TASK_VIEW_TYPE } from './taskView';

export default class DynamicTodoList extends Plugin {
    settings: PluginSettings;
    private tasks: Task[] = [];
    private processor!: TaskProcessor;
    private reindexingInProgress = false;
    private view: TaskView | null = null;
    private indexingTimeout: NodeJS.Timeout | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.processor = new TaskProcessor(this.app.vault, this.settings);

        // Initialize immediate indexing
        this.indexTasks(true);

        // Register view
        this.registerView(
            TASK_VIEW_TYPE,
            (leaf) => {
                this.view = new TaskView(leaf, this.tasks, this.processor);
                return this.view;
            }
        );

        // Add ribbon icon
        this.addRibbonIcon('checkbox-glyph', 'Dynamic Todo List', async () => {
            await this.activateView();
        }).addClass('dynamic-todo-list-ribbon');

        // Add commands
        this.addCommand({
            id: 'show-dynamic-task-list',
            name: 'Show Task List',
            callback: async () => {
                await this.activateView();
            },
            hotkeys: [{ modifiers: ['Mod'], key: 'j' }]
        });

        this.addSettingTab(new DynamicTodoListSettingTab(this.app, this));

        // Setup improved file watcher with shorter debounce
        this.registerEvent(
            this.app.vault.on('modify', () => {
                if (this.indexingTimeout) {
                    clearTimeout(this.indexingTimeout);
                }
                this.indexingTimeout = setTimeout(() => this.indexTasks(), 500);
            })
        );

        // Register file deletion event
        this.registerEvent(
            this.app.vault.on('delete', () => {
                this.indexTasks();
            })
        );
    }

    onunload(): void {
        this.app.workspace.detachLeavesOfType(TASK_VIEW_TYPE);
    }

    private async activateView(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(TASK_VIEW_TYPE);
        
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }

        // Create new leaf
        const leaf: WorkspaceLeaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
        if (leaf) {
            await leaf.setViewState({ type: TASK_VIEW_TYPE });
            workspace.revealLeaf(leaf);
        }
    }

    async indexTasks(isInitial = false): Promise<void> {
        if (this.reindexingInProgress) return;

        try {
            this.reindexingInProgress = true;
            const files = this.app.vault.getMarkdownFiles();
            const newTasks: Task[] = [];

            // Process files in parallel for better performance
            const taskPromises = files.map(file => this.processor.processFile(file));
            const fileTaskArrays = await Promise.all(taskPromises);

            // Flatten the results
            for (const fileTasks of fileTaskArrays) {
                newTasks.push(...fileTasks);
            }

            this.tasks = newTasks;

            // Update view if it exists
            if (this.view) {
                this.view.updateTasks(this.tasks);
            }

            // Only show notice for non-initial indexing
            if (!isInitial) {
                new Notice('Tasks updated');
            }
        } catch (error) {
            console.error('Error indexing tasks:', error);
            new Notice('Failed to index tasks. Check console for details.');
        } finally {
            this.reindexingInProgress = false;
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}

class DynamicTodoListSettingTab extends PluginSettingTab {
    plugin: DynamicTodoList;

    constructor(app: App, plugin: DynamicTodoList) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Dynamic Todo List Settings' });

        new Setting(containerEl)
            .setName('Note tag')
            .setDesc('The tag that marks notes to be included in the task list')
            .addText(text => text
                .setPlaceholder('#tasks')
                .setValue(this.plugin.settings.noteTag)
                .onChange(async (value) => {
                    this.plugin.settings.noteTag = value;
                    await this.plugin.saveSettings();
                    await this.plugin.indexTasks();
                }));

        new Setting(containerEl)
            .setName('Task prefix')
            .setDesc('The prefix used to identify tasks (e.g., "- [ ]" or "* [ ]")')
            .addText(text => text
                .setPlaceholder('- [ ]')
                .setValue(this.plugin.settings.taskPrefix)
                .onChange(async (value) => {
                    this.plugin.settings.taskPrefix = value;
                    await this.plugin.saveSettings();
                    await this.plugin.indexTasks();
                }));

        // Hotkey setting
        const hotkeyDiv = containerEl.createDiv('hotkey-setting');
        new Setting(hotkeyDiv)
            .setName('Quick access hotkey')
            .setDesc('Configure the keyboard shortcut')
            .addButton(button => button
                .setButtonText('Open Hotkeys Settings')
                .onClick(() => {
                    // Create or focus the settings tab
                    const workspace = this.app.workspace;
                    const leaf = workspace.getMostRecentLeaf();
                    
                    if (leaf) {
                        leaf.setViewState({
                            type: 'setting-hotkeys'
                        }).then(() => {
                            workspace.revealLeaf(leaf);
                            new Notice('Search for "Dynamic Todo List" to find the hotkey setting', 3000);
                        });
                    }
                })
            );
    }
}
