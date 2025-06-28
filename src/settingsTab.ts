import { App, PluginSettingTab, Setting } from 'obsidian';
import DynamicTodoList from './main';

/**
 * Setting tab for the Dynamic Todo List plugin.
 * Allows the user to configure various aspects of the plugin.
 */
export class DynamicTodoListSettingTab extends PluginSettingTab {
    private plugin: DynamicTodoList;

    /**
     * Constructs the settings tab.
     * @param app - The Obsidian App instance.
     * @param plugin - The DynamicTodoList plugin instance.
     */
    constructor(app: App, plugin: DynamicTodoList) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Renders the settings tab in the Obsidian settings modal.
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty(); // Clear existing content

        containerEl.createEl('h2', { text: 'Dynamic Todo List Settings' });

        // Task Identification Method
        new Setting(containerEl)
            .setName('Task identification method')
            .setDesc('Choose how to identify task notes')
            .addDropdown(dropdown => dropdown
                .addOption('tag', 'By tag') // Option for tag-based identification
                .addOption('header', 'By note header') // Option for header-based identification
                .setValue(this.plugin.settings.taskIdentificationMethod) // Set the current value
                .onChange(async (value: 'tag' | 'header') => { // Handle value changes
                    this.plugin.settings.taskIdentificationMethod = value;
                    await this.plugin.saveSettings(); // Save the new setting
                }));

        // Note tag setting
        new Setting(containerEl)
            .setName('Note tag')
            .setDesc('The tag that marks notes to be included in the task list')
            .addText(text => text
                .setPlaceholder('#tasks') // Default placeholder
                .setValue(this.plugin.settings.noteTag) // Set the current value
                .onChange(async (value) => { // Handle value changes
                    this.plugin.settings.noteTag = value;
                    await this.plugin.saveSettings(); // Save the new setting
                    await this.plugin.indexTasks();    // Re-index tasks
                }));

        // Task prefix setting
        new Setting(containerEl)
            .setName('Task prefix')
            .setDesc('The prefix used to identify tasks (e.g., "- [ ]" or "* [ ]")')
            .addText(text => text
                .setPlaceholder('- [ ]') // Default placeholder
                .setValue(this.plugin.settings.taskPrefix) // Set the current value
                .onChange(async (value) => { // Handle value changes
                    this.plugin.settings.taskPrefix = value;
                    await this.plugin.saveSettings(); // Save the new setting
                    await this.plugin.indexTasks(); // Re-index tasks
                }));

        // Sort preference
        new Setting(containerEl)
            .setName('Default sort order')
            .setDesc('Choose how tasks are sorted by default')
            .addDropdown(dropdown => dropdown
                .addOption('name-asc', 'Name (A to Z)')   // Sort by file name (ascending)
                .addOption('name-desc', 'Name (Z to A)')  // Sort by file name (descending)
                .addOption('created-desc', 'Created (Newest)') // Sort by file creation date (descending)
                .addOption('created-asc', 'Created (Oldest)') // Sort by file creation date (ascending)
                .addOption('lastModified-desc', 'Modified (Newest)') // Sort by file modification date (descending)
                .addOption('lastModified-asc', 'Modified (Oldest)') // Sort by file modification date (ascending)
                .setValue(`${this.plugin.settings.sortPreference.field}-${this.plugin.settings.sortPreference.direction}`) // Set the current value
                .onChange(async (value) => { // Handle value changes
                    const [field, direction] = value.split('-'); // Split the value into field and direction
                    this.plugin.settings.sortPreference = {
                        field: field as 'name' | 'created' | 'lastModified', // Type assertion for field
                        direction: direction as 'asc' | 'desc' // Type assertion for direction
                    };
                    await this.plugin.saveSettings(); // Save the new setting
                    await this.plugin.indexTasks();    // Re-index tasks
                }));

        // Archive threshold setting
        const archiveSetting = new Setting(containerEl)
            .setName('Auto-archive completed tasks')
            .setDesc('Automatically hide completed tasks older than X days from view. Set to 0 to disable auto-archiving. This works together with the "Hide completed" toggle in the side pane - when the toggle is OFF, tasks are filtered by this age threshold.')
            .addText(text => text
                .setPlaceholder('90') // Default placeholder
                .setValue(String(this.plugin.settings.archiveCompletedOlderThan)) // Set the current value
                .onChange(async (value) => { // Handle value changes
                    const days = parseInt(value); // Parse the input as an integer
                    if (isNaN(days) || days < 0) {
                        return; // Ignore invalid input (non-numeric or negative)
                    }
                    this.plugin.settings.archiveCompletedOlderThan = days;
                    await this.plugin.saveSettings(); // Save the new setting
                }));
        
        // Add data attribute for styling
        archiveSetting.settingEl.setAttribute('data-setting', 'archive-completed');

        // Show file headers setting
        const showFileHeadersSetting = new Setting(containerEl)
            .setName('Show file headers')
            .setDesc('Display file names as section headers in the task list. When disabled, shows a flat list of tasks without file groupings. Example: "Project Tasks > Task 1" vs just "Task 1".')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFileHeaders)
                .onChange(async (value) => {
                    this.plugin.settings.showFileHeaders = value;
                    await this.plugin.saveSettings();
                    await this.plugin.refreshTaskView(); // Refresh view to apply changes
                    this.display(); // Re-render settings to show/hide conditional setting
                }));

        // Show created/modified dates in file headers setting (conditional sub-setting)
        if (this.plugin.settings.showFileHeaders) {
            const showDatesSetting = new Setting(containerEl)
                .setName('Show created / modified dates')
                .setDesc('When enabled, file headers show creation and modification dates. When disabled, headers show only the file name for a more compact view.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.showCreatedModifiedInFileHeaders)
                    .onChange(async (value) => {
                        this.plugin.settings.showCreatedModifiedInFileHeaders = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshTaskView(); // Refresh view to apply changes
                    }));
            
            // Style as a sub-setting with indentation
            showDatesSetting.settingEl.style.marginLeft = '20px';
            showDatesSetting.settingEl.style.borderLeft = '2px solid var(--background-modifier-border)';
            showDatesSetting.settingEl.style.paddingLeft = '15px';
        }

        // Move completed tasks to bottom setting (conditional sub-setting)
        if (!this.plugin.settings.showFileHeaders) {
            const moveCompletedSetting = new Setting(containerEl)
                .setName('Move completed tasks to bottom of list')
                .setDesc('When enabled, completed tasks automatically appear at the bottom of the flat task list, after all open tasks. Example: "Buy milk" (open) followed by "Done shopping" (completed).')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.moveCompletedTasksToBottom)
                    .onChange(async (value) => {
                        this.plugin.settings.moveCompletedTasksToBottom = value;
                        await this.plugin.saveSettings();
                        await this.plugin.refreshTaskView(); // Refresh view to apply changes
                    }));
            
            // Style as a sub-setting with indentation
            moveCompletedSetting.settingEl.style.marginLeft = '20px';
            moveCompletedSetting.settingEl.style.borderLeft = '2px solid var(--background-modifier-border)';
            moveCompletedSetting.settingEl.style.paddingLeft = '15px';
        }

        // Link Behavior section
        containerEl.createEl('h3', { text: 'Task Link Behavior' });

        // Setting to enable/disable wiki-links in the task view
        new Setting(containerEl)
            .setName('Enable wiki-links')
            .setDesc('Allow clicking wiki-links ([[links]]) in tasks to navigate to the linked note. When disabled, clicking a wiki-link will open the task in its source note.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableWikiLinks) // Set the initial value
                .onChange(async (value) => { // Handle value changes
                    this.plugin.settings.enableWikiLinks = value;
                    await this.plugin.saveSettings(); // Save setting
                    await this.plugin.refreshTaskView(); // Refresh view to apply changes
                }));

        // Setting to enable/disable URL links in the task view
        new Setting(containerEl)
            .setName('Enable URL links')
            .setDesc('Allow clicking URL links in tasks to open them in the browser. When disabled, clicking a URL will open the task in its source note.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableUrlLinks) // Set the initial value.
                .onChange(async (value) => { // Handle value changes
                    this.plugin.settings.enableUrlLinks = value;
                    await this.plugin.saveSettings();  // Save setting
                    await this.plugin.refreshTaskView(); // Refresh view to apply changes
                }));

        // Folder Filters section
        containerEl.createEl('h3', { text: 'Folder Filters' });

        // Include folders
        const includeContainer = containerEl.createDiv('include-folders');
        includeContainer.createEl('h4', { text: 'Include folders' });

        // Loop through existing include paths and create settings for each
        this.plugin.settings.folderFilters.include.forEach((path, index) => {
            new Setting(includeContainer)
                .addText(text => text
                    .setValue(path) // Set the current value
                    .onChange(async (value) => { // Handle value changes
                        this.plugin.settings.folderFilters.include[index] = value; // Update the specific path
                        await this.plugin.saveSettings(); // Save settings
                    }))
                .addButton(btn => btn
                    .setIcon('trash') // Add a trash icon for removing the entry
                    .onClick(async () => { // Handle removal
                        this.plugin.settings.folderFilters.include.splice(index, 1); // Remove the path from the array
                        await this.plugin.saveSettings(); // Save settings
                        this.display(); // Re-render the settings tab to reflect the change
                    }));
        });

        // Button to add a new include folder
        new Setting(includeContainer)
            .addButton(btn => btn
                .setButtonText('Add Include Folder')
                .onClick(async () => {
                    this.plugin.settings.folderFilters.include.push(''); // Add a new empty entry
                    await this.plugin.saveSettings(); // Save settings
                    this.display(); // Re-render the settings tab
                }));

        // Exclude folders
        const excludeContainer = containerEl.createDiv('exclude-folders');
        excludeContainer.createEl('h4', { text: 'Exclude folders' });

        // Loop through existing exclude paths and create settings for each
        this.plugin.settings.folderFilters.exclude.forEach((path, index) => {
            new Setting(excludeContainer)
                .addText(text => text
                    .setValue(path) // Set the current value
                    .onChange(async (value) => { // Handle value changes
                        this.plugin.settings.folderFilters.exclude[index] = value; // Update the specific path
                        await this.plugin.saveSettings(); // Save settings
                    }))
                .addButton(btn => btn
                    .setIcon('trash')  // Add trash icon for removing entry
                    .onClick(async () => { // Handle removal
                        this.plugin.settings.folderFilters.exclude.splice(index, 1); // Remove the path from the array
                        await this.plugin.saveSettings(); // Save settings
                        this.display(); // Re-render the settings tab to reflect the change
                    }));
        });

        // Button to add a new exclude folder
        new Setting(excludeContainer)
            .addButton(btn => btn
                .setButtonText('Add Exclude Folder')
                .onClick(async () => {
                    this.plugin.settings.folderFilters.exclude.push(''); // Add a new empty entry
                    await this.plugin.saveSettings(); // Save settings
                    this.display(); // Re-render the settings tab
                }));
    }
}