[Previous content up to renderFileSection method, then replace that method with:]

    private formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    private async getFileMetadata(file: TFile): Promise<FileMetadata> {
        try {
            const stat = await this.app.vault.adapter.stat(file.path);
            return {
                created: stat?.ctime || Date.now(),
                lastUpdated: stat?.mtime || Date.now()
            };
        } catch (error) {
            console.error('Error getting file metadata:', error);
            return {
                created: Date.now(),
                lastUpdated: Date.now()
            };
        }
    }

    private async renderFileSection(path: string, tasks: { open: Task[], completed: Task[] }, container: HTMLElement) {
        const fileSection = container.createDiv({ cls: 'task-section' });
        
        // Create collapsible header with date
        const header = fileSection.createDiv({ cls: 'task-section-header' });
        
        // Title row with toggle and filename
        const titleRow = header.createDiv({ cls: 'task-section-title-row' });
        const toggleIcon = titleRow.createDiv({ cls: 'task-section-toggle' });
        
        titleRow.createEl('h3', {
            cls: 'task-section-title',
            text: path,
        });
        
        // Dates row
        const dates = header.createDiv({ cls: 'task-section-dates' });
        const fileData = await this.getFileMetadata(tasks.open[0]?.sourceFile || tasks.completed[0]?.sourceFile);
        
        const createdDate = this.formatDate(fileData.created);
        const updatedDate = this.formatDate(fileData.lastUpdated);
        
        dates.createSpan({ text: `Created: ${createdDate}` });
        if (fileData.created !== fileData.lastUpdated) {
            dates.createEl('br');
            dates.createSpan({ text: `Last updated: ${updatedDate}` });
        }
        
        const isCollapsed = this.collapsedSections.has(path);
        setIcon(toggleIcon, isCollapsed ? 'chevron-right' : 'chevron-down');
        
        const content = fileSection.createDiv({
            cls: `task-section-content ${isCollapsed ? 'collapsed' : ''}`
        });

        // Toggle collapse on header click
        header.addEventListener('click', () => {
            const isNowCollapsed = !this.collapsedSections.has(path);
            if (isNowCollapsed) {
                this.collapsedSections.add(path);
            } else {
                this.collapsedSections.delete(path);
            }
            content.toggleClass('collapsed', isNowCollapsed);
            setIcon(toggleIcon, isNowCollapsed ? 'chevron-right' : 'chevron-down');
        });

        // Render open tasks
        if (tasks.open.length > 0) {
            const openTasksList = content.createEl('ul', { cls: 'task-list-items' });
            tasks.open.forEach(task => this.renderTaskItem(openTasksList, task));
        }

        // Render completed tasks section if there are any
        if (tasks.completed.length > 0) {
            const completedSection = content.createDiv({ cls: 'completed-tasks-section' });
            const completedHeader = completedSection.createDiv({
                cls: 'completed-tasks-header'
            });
            
            const completedToggle = completedHeader.createDiv({
                cls: 'completed-tasks-toggle'
            });
            
            completedHeader.createEl('span', {
                text: `Completed Tasks (${tasks.completed.length})`
            });
            
            const completedContent = completedSection.createDiv({
                cls: 'completed-tasks-content collapsed'
            });
            
            setIcon(completedToggle, 'chevron-right');
            
            const completedList = completedContent.createEl('ul', {
                cls: 'task-list-items completed'
            });
            
            tasks.completed.forEach(task => 
                this.renderTaskItem(completedList, task));
            
            completedHeader.addEventListener('click', () => {
                const isNowCollapsed = !completedContent.hasClass('collapsed');
                completedContent.toggleClass('collapsed', isNowCollapsed);
                setIcon(completedToggle,
                    isNowCollapsed ? 'chevron-right' : 'chevron-down'
                );
            });
        }
    }

[Rest of the file remains the same]