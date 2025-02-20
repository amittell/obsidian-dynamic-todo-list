import { App, PluginSettingTab, Setting } from 'obsidian';
import DynamicTodoList from './main';

export class DynamicTodoListSettingTab extends PluginSettingTab {
    private plugin: DynamicTodoList;

    constructor(app: App, plugin: DynamicTodoList) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Dynamic Todo List Settings' });

        // Task Identification Method
        new Setting(containerEl)
            .setName('Task identification method')
            .setDesc('Choose how to identify task notes')
            .addDropdown(dropdown => dropdown
                .addOption('tag', 'By tag')
                .addOption('header', 'By note header')
                .setValue(this.plugin.settings.taskIdentificationMethod)
                .onChange(async (value: 'tag' | 'header') => {
                    this.plugin.settings.taskIdentificationMethod = value;
                    await this.plugin.saveSettings();
                }));

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

        // Sort preference
        new Setting(containerEl)
            .setName('Default sort order')
            .setDesc('Choose how tasks are sorted by default')
            .addDropdown(dropdown => dropdown
                .addOption('name-asc', 'Name (A to Z)')
                .addOption('name-desc', 'Name (Z to A)')
                .addOption('created-desc', 'Created (Newest)')
                .addOption('created-asc', 'Created (Oldest)')
                .addOption('lastModified-desc', 'Modified (Newest)')
                .addOption('lastModified-asc', 'Modified (Oldest)')
                .setValue(`${this.plugin.settings.sortPreference.field}-${this.plugin.settings.sortPreference.direction}`)
                .onChange(async (value) => {
                    const [field, direction] = value.split('-');
                    this.plugin.settings.sortPreference = {
                        field: field as 'name' | 'created' | 'lastModified',
                        direction: direction as 'asc' | 'desc'
                    };
                    await this.plugin.saveSettings();
                    await this.plugin.indexTasks();
                }));

        // Archive threshold setting
        new Setting(containerEl)
            .setName('Archive completed tasks')
            .setDesc('Hide completed tasks older than X days (0 to show all)')
            .addText(text => text
                .setPlaceholder('7')
                .setValue(String(this.plugin.settings.archiveCompletedOlderThan))
                .onChange(async (value) => {
                    const days = parseInt(value);
                    if (isNaN(days) || days < 0) {
                        return;
                    }
                    this.plugin.settings.archiveCompletedOlderThan = days;
                    await this.plugin.saveSettings();
                }));

        // Folder Filters section
        containerEl.createEl('h3', { text: 'Folder Filters' });

        // Include folders
        const includeContainer = containerEl.createDiv('include-folders');
        includeContainer.createEl('h4', { text: 'Include folders' });
        
        this.plugin.settings.folderFilters.include.forEach((path, index) => {
            new Setting(includeContainer)
                .addText(text => text
                    .setValue(path)
                    .onChange(async (value) => {
                        this.plugin.settings.folderFilters.include[index] = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton(btn => btn
                    .setIcon('trash')
                    .onClick(async () => {
                        this.plugin.settings.folderFilters.include.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(includeContainer)
            .addButton(btn => btn
                .setButtonText('Add Include Folder')
                .onClick(async () => {
                    this.plugin.settings.folderFilters.include.push('');
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Exclude folders
        const excludeContainer = containerEl.createDiv('exclude-folders');
        excludeContainer.createEl('h4', { text: 'Exclude folders' });
        
        this.plugin.settings.folderFilters.exclude.forEach((path, index) => {
            new Setting(excludeContainer)
                .addText(text => text
                    .setValue(path)
                    .onChange(async (value) => {
                        this.plugin.settings.folderFilters.exclude[index] = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton(btn => btn
                    .setIcon('trash')
                    .onClick(async () => {
                        this.plugin.settings.folderFilters.exclude.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(excludeContainer)
            .addButton(btn => btn
                .setButtonText('Add Exclude Folder')
                .onClick(async () => {
                    this.plugin.settings.folderFilters.exclude.push('');
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }
}