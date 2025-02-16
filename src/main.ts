import {
    Plugin,
    PluginSettingTab,
    App,
    Setting,
    Notice,
    WorkspaceLeaf,
    Platform,
    Command,
    Hotkey,
    Modifier,
    ButtonComponent
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
        // First unregister any existing commands to ensure clean state
        //@ts-ignore
        this.app.commands.removeCommand(`${this.manifest.id}:show-dynamic-task-list`);

        await this.loadSettings();
        this.processor = new TaskProcessor(this.app.vault, this.settings);

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

        // Register base command without hotkey
        const command: Command = {
            id: 'show-dynamic-task-list',
            name: 'Show Task List',
            callback: async () => {
                await this.activateView();
            }
        };

        // Add hotkey if one is configured
        if (this.settings.hotkey) {
            command.hotkeys = [this.settings.hotkey];
        }

        // Register the command
        this.addCommand(command);

        // Register settings tab
        this.addSettingTab(new DynamicTodoListSettingTab(this.app, this));

        // Setup file watchers
        this.registerEvent(
            this.app.vault.on('modify', () => {
                if (this.indexingTimeout) {
                    clearTimeout(this.indexingTimeout);
                }
                this.indexingTimeout = setTimeout(() => this.indexTasks(), 500);
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', () => {
                this.indexTasks();
            })
        );

        setTimeout(() => {
            this.indexTasks(true);
        }, 100);

        if (this.app.workspace.getLeavesOfType(TASK_VIEW_TYPE).length > 0) {
            this.indexTasks(true);
        }
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

        const leaf: WorkspaceLeaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
        if (leaf) {
            await leaf.setViewState({ type: TASK_VIEW_TYPE });
            workspace.revealLeaf(leaf);
            this.indexTasks(true);
        }
    }

    async indexTasks(isInitial = false): Promise<void> {
        if (this.reindexingInProgress) return;

        try {
            this.reindexingInProgress = true;
            const files = this.app.vault.getMarkdownFiles();
            const newTasks: Task[] = [];

            const taskPromises = files.map(file => this.processor.processFile(file));
            const fileTaskArrays = await Promise.all(taskPromises);

            for (const fileTasks of fileTaskArrays) {
                newTasks.push(...fileTasks);
            }

            this.tasks = newTasks;

            if (this.view) {
                this.view.updateTasks(this.tasks);
            }

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
        const loadedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
        
        // Ensure hotkey is properly initialized
        if (loadedData && loadedData.hotkey === undefined) {
            this.settings.hotkey = null;
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        await this.updateHotkeys();
    }

    async updateHotkeys(): Promise<void> {
        const commandId = 'show-dynamic-task-list';
        
        // Remove existing command
        //@ts-ignore
        this.app.commands.removeCommand(`${this.manifest.id}:${commandId}`);
        
        // Clear existing hotkeys from Obsidian's registry
        //@ts-ignore
        if (this.app.hotkeyManager) {
            //@ts-ignore
            this.app.hotkeyManager.removeHotkeys(`${this.manifest.id}:${commandId}`);
        }
        
        // Add the command fresh
        this.addCommand({
            id: commandId,
            name: 'Show Task List',
            callback: async () => {
                await this.activateView();
            },
            hotkeys: this.settings.hotkey ? [this.settings.hotkey] : []
        });
        
        // Force Obsidian to rebuild its hotkey mappings
        //@ts-ignore
        if (this.app.hotkeyManager?.updateHotkeys) {
            //@ts-ignore
            this.app.hotkeyManager.updateHotkeys();
        }
    }
}

class DynamicTodoListSettingTab extends PluginSettingTab {
    plugin: DynamicTodoList;
    private capturingHotkey: boolean = false;

    constructor(app: App, plugin: DynamicTodoList) {
        super(app, plugin);
        this.plugin = plugin;
    }

    formatHotkey(hotkey: Hotkey | null): string {
        if (!hotkey) return 'Click to set hotkey';
        
        const keys: string[] = [];
        if (hotkey.modifiers) {
            if (hotkey.modifiers.includes('Mod')) {
                keys.push(Platform.isMacOS ? '⌘' : 'Ctrl');
            }
            if (hotkey.modifiers.includes('Shift')) {
                keys.push('⇧');
            }
            if (hotkey.modifiers.includes('Alt')) {
                keys.push(Platform.isMacOS ? '⌥' : 'Alt');
            }
        }
        if (hotkey.key) {
            keys.push(hotkey.key.toUpperCase());
        }
        return keys.join(' ');
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Dynamic Todo List Settings' });

        // Note tag setting
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

        // Task prefix setting
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
        let hotkeyButton: ButtonComponent;
        const hotkeyControl = new Setting(containerEl)
            .setName('Quick access hotkey')
            .setDesc('Configure the keyboard shortcut')
            .addButton(button => {
                hotkeyButton = button;
                button
                    .setButtonText(this.formatHotkey(this.plugin.settings.hotkey))
                    .onClick(async () => {
                        await this.captureHotkey(button);
                    });
                return button;
            })
            .addExtraButton(button => 
                button
                    .setIcon('settings')
                    .setTooltip('Configure hotkey')
                    .onClick(async () => {
                        await this.captureHotkey(hotkeyButton);
                    })
            )
            .addExtraButton(button => 
                button
                    .setIcon('trash')
                    .setTooltip('Clear hotkey')
                    .onClick(async () => {
                        this.plugin.settings.hotkey = null;
                        await this.plugin.saveSettings();
                        hotkeyButton.setButtonText('Click to set hotkey');
                        new Notice('Hotkey cleared');
                    })
            );
    }

    async captureHotkey(button: ButtonComponent): Promise<void> {
        if (this.capturingHotkey) return;

        this.capturingHotkey = true;
        const originalText = button.buttonEl.textContent || '';
        const oldHotkey = this.plugin.settings.hotkey;
        button.setButtonText('Press hotkey...');
        button.buttonEl.addClass('capturing-hotkey');

        return new Promise((resolve) => {
            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown, true);
                document.removeEventListener('keyup', handleKeyUp, true);
                this.capturingHotkey = false;
                button.buttonEl.removeClass('capturing-hotkey');
                resolve();
            };

            let pressedKeys: Set<string> = new Set();
            let modifiers: Set<Modifier> = new Set();

            const handleKeyDown = async (e: KeyboardEvent) => {
                e.preventDefault();
                e.stopPropagation();

                if (e.key === 'Escape') {
                    button.setButtonText(originalText);
                    cleanup();
                    return;
                }

                pressedKeys.add(e.code);

                if (e.ctrlKey || e.metaKey) modifiers.add('Mod');
                if (e.shiftKey) modifiers.add('Shift');
                if (e.altKey) modifiers.add('Alt');

                const mainKey = Array.from(pressedKeys)
                    .filter(key => !['ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight']
                        .includes(key))
                    .pop();

                if (mainKey) {
                    const newHotkey: Hotkey = {
                        modifiers: Array.from(modifiers),
                        key: mainKey.replace('Key', '').replace('Digit', '')
                    };

                    try {
                        this.plugin.settings.hotkey = newHotkey;
                        await this.plugin.saveSettings();
                        
                        // Update UI
                        button.setButtonText(this.formatHotkey(newHotkey));
                        new Notice(`Hotkey set to: ${this.formatHotkey(newHotkey)}`);
                        
                        cleanup();
                    } catch (error) {
                        this.plugin.settings.hotkey = oldHotkey;
                        button.setButtonText(this.formatHotkey(oldHotkey));
                        new Notice('Failed to set hotkey');
                        cleanup();
                    }
                }
            };

            const handleKeyUp = (e: KeyboardEvent) => {
                e.preventDefault();
                e.stopPropagation();
                pressedKeys.delete(e.code);
            };

            document.addEventListener('keydown', handleKeyDown, true);
            document.addEventListener('keyup', handleKeyUp, true);
        });
    }
}