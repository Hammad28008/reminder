class TaskReminder {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.reminderInterval = null;
        this.autoSaveInterval = null;
        this.notificationPermission = false;
        this.settings = this.loadSettings();
        this.csvFileName = 'tasks.csv';
        this.historyFileName = 'task_history.csv';
        
        this.initializeApp();
    }
    
    initializeApp() {
        // Load tasks from CSV
        this.loadTasksFromCSV();
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Setup intervals
        this.setupIntervals();
        
        // Request notification permission
        this.requestNotificationPermission();
        
        // Update UI
        this.updateStats();
        
        // Check for due tasks on startup
        this.checkDueTasks();
        
        // Update last saved time
        this.updateLastSaved();
    }
    
    loadSettings() {
        const defaultSettings = {
            reminderTime: 10,
            notificationSound: 'alert1.mp3',
            desktopNotifications: true,
            autoSaveInterval: 5,
            autoDownloadCSV: false // New setting to control CSV downloads
        };
        
        const saved = localStorage.getItem('taskReminderSettings');
        return saved ? JSON.parse(saved) : defaultSettings;
    }
    
    saveSettings() {
        localStorage.setItem('taskReminderSettings', JSON.stringify(this.settings));
    }
    
    async loadTasksFromCSV() {
        try {
            // Try to load from localStorage first (for backup)
            const localTasks = localStorage.getItem('taskReminderTasks');
            if (localTasks) {
                this.tasks = JSON.parse(localTasks);
                console.log('Loaded tasks from localStorage');
            }
            
            // Try to load from CSV file
            await this.loadCSVFile();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
        }
    }
    
    async loadCSVFile() {
        try {
            const response = await fetch(this.csvFileName);
            if (response.ok) {
                const csvText = await response.text();
                this.parseCSV(csvText);
            }
        } catch (error) {
            console.log('No CSV file found, starting fresh');
            // Create initial CSV file if it doesn't exist
            await this.saveTasksToStorage(); // Only save to localStorage, don't download
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length <= 1) return; // Only header or empty
        
        // Parse CSV data
        const newTasks = [];
        for (let i = 1; i < lines.length; i++) {
            // Handle CSV with quoted fields containing commas
            const row = this.parseCSVRow(lines[i]);
            
            if (row.length >= 8) {
                const task = {
                    id: parseInt(row[0]) || newTasks.length + 1,
                    name: row[1].replace(/^"|"$/g, ''), // Remove quotes
                    description: row[2].replace(/^"|"$/g, ''),
                    deadline: row[3],
                    priority: row[4],
                    status: row[5],
                    createdAt: row[6] || new Date().toISOString(),
                    completedAt: row[7] || null,
                    lastReminded: row[8] || null,
                    lastOverdueReminded: row[9] || null
                };
                newTasks.push(task);
            }
        }
        
        // Only update if we found tasks
        if (newTasks.length > 0) {
            this.tasks = newTasks;
            console.log(`Loaded ${this.tasks.length} tasks from CSV`);
        }
        
        // Update display
        this.displayTasks();
    }
    
    parseCSVRow(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current); // Add last field
        return result;
    }
    
    async saveTasksToStorage(download = false) {
        // Save to localStorage
        localStorage.setItem('taskReminderTasks', JSON.stringify(this.tasks));
        localStorage.setItem('taskReminderLastSave', new Date().toISOString());
        
        // Save to CSV file only if download is requested
        if (download || this.settings.autoDownloadCSV) {
            await this.downloadCSVFile();
        } else {
            // Just save to localStorage and update the page
            await this.saveCSVToLocalStorage();
        }
        
        // Update last saved time
        this.updateLastSaved();
        
        console.log(`Tasks saved to ${download ? 'CSV file' : 'localStorage'}`);
    }
    
    async downloadCSVFile() {
        // Prepare CSV data
        const csvContent = this.generateCSVContent();
        
        // Create blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.csvFileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    async saveCSVToLocalStorage() {
        // Save CSV content to localStorage for backup
        const csvContent = this.generateCSVContent();
        localStorage.setItem('taskReminderCSV', csvContent);
    }
    
    generateCSVContent() {
        // CSV header
        let csvContent = 'ID,Name,Description,Deadline,Priority,Status,CreatedAt,CompletedAt,LastReminded,LastOverdueReminded\n';
        
        // Add each task
        this.tasks.forEach(task => {
            const row = [
                task.id,
                `"${(task.name || '').replace(/"/g, '""')}"`,
                `"${(task.description || '').replace(/"/g, '""')}"`,
                task.deadline,
                task.priority,
                task.status,
                task.createdAt,
                task.completedAt || '',
                task.lastReminded || '',
                task.lastOverdueReminded || ''
            ];
            csvContent += row.join(',') + '\n';
        });
        
        return csvContent;
    }
    
    backupToHistory(task) {
        // Create history entry
        const historyEntry = {
            ...task,
            archivedAt: new Date().toISOString(),
            historyId: Date.now()
        };
        
        // Get existing history
        let history = [];
        try {
            const historyData = localStorage.getItem('taskHistory');
            if (historyData) {
                history = JSON.parse(historyData);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
        
        // Add new entry
        history.push(historyEntry);
        
        // Keep only last 1000 history entries
        if (history.length > 1000) {
            history = history.slice(-1000);
        }
        
        // Save back
        localStorage.setItem('taskHistory', JSON.stringify(history));
        
        // Also append to history CSV in localStorage
        this.appendToHistoryStorage(historyEntry);
    }
    
    appendToHistoryStorage(task) {
        const historyEntry = [
            task.id,
            `"${(task.name || '').replace(/"/g, '""')}"`,
            `"${(task.description || '').replace(/"/g, '""')}"`,
            task.deadline,
            task.priority,
            task.status,
            task.createdAt,
            task.completedAt || '',
            new Date().toISOString()
        ].join(',') + '\n';
        
        // Get existing history CSV
        let historyCSV = localStorage.getItem('taskHistoryCSV') || 
                        'ID,Name,Description,Deadline,Priority,Status,CreatedAt,CompletedAt,ArchivedAt\n';
        
        // Append new entry
        historyCSV += historyEntry;
        
        // Save back to localStorage
        localStorage.setItem('taskHistoryCSV', historyCSV);
    }
    
    addTask(taskData) {
        const now = new Date();
        const newTask = {
            id: this.tasks.length > 0 ? Math.max(...this.tasks.map(t => t.id)) + 1 : 1,
            name: taskData.name,
            description: taskData.description || '',
            deadline: `${taskData.date} ${taskData.time}`,
            priority: taskData.priority || 'medium',
            status: 'pending',
            createdAt: now.toISOString(),
            createdDisplay: now.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            completedAt: null,
            lastReminded: null,
            lastOverdueReminded: null
        };
        
        this.tasks.push(newTask);
        this.saveTasksToStorage(); // Don't download CSV automatically
        this.displayTasks();
        this.updateStats();
        
        // Show success message
        this.showNotification('Task Added', `${newTask.name} has been added successfully!`, 'success');
        
        return newTask;
    }
    
    completeTask(taskId) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;
        
        this.tasks[taskIndex].status = 'completed';
        this.tasks[taskIndex].completedAt = new Date().toISOString();
        
        // Backup to history
        this.backupToHistory(this.tasks[taskIndex]);
        
        this.saveTasksToStorage(); // Don't download CSV automatically
        this.displayTasks();
        this.updateStats();
        
        // Show completion notification
        const taskName = this.tasks[taskIndex].name;
        this.showNotification('Task Completed', `Great job! "${taskName}" is now complete!`, 'success');
    }
    
    deleteTask(taskId) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;
        
        const taskName = this.tasks[taskIndex].name;
        this.tasks.splice(taskIndex, 1);
        this.saveTasksToStorage(); // Don't download CSV automatically
        this.displayTasks();
        this.updateStats();
        
        this.showNotification('Task Deleted', `"${taskName}" has been removed.`, 'warning');
    }
    
    displayTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;
        
        let filteredTasks = this.tasks;
        
        // Apply filter
        if (this.currentFilter === 'pending') {
            filteredTasks = filteredTasks.filter(task => task.status === 'pending');
        } else if (this.currentFilter === 'completed') {
            filteredTasks = filteredTasks.filter(task => task.status === 'completed');
        } else if (this.currentFilter === 'overdue') {
            filteredTasks = filteredTasks.filter(task => this.isTaskOverdue(task));
        }
        
        // Apply search
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filteredTasks = filteredTasks.filter(task => 
                task.name.toLowerCase().includes(searchLower) ||
                (task.description && task.description.toLowerCase().includes(searchLower))
            );
        }
        
        // Clear container
        container.innerHTML = '';
        
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list fa-3x"></i>
                    <h3>No Tasks Found</h3>
                    <p>${this.searchTerm ? 'Try a different search term' : 'Add your first task using the form'}</p>
                </div>
            `;
            return;
        }
        
        // Sort tasks: overdue first, then by deadline
        filteredTasks.sort((a, b) => {
            const aOverdue = this.isTaskOverdue(a);
            const bOverdue = this.isTaskOverdue(b);
            
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            
            return new Date(a.deadline) - new Date(b.deadline);
        });
        
        // Create task elements
        filteredTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }
    
    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item ${task.priority}-priority ${task.status} ${this.isTaskOverdue(task) ? 'overdue' : ''}`;
        
        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        const timeDiff = deadlineDate - now;
        const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeLeftText = '';
        if (timeDiff < 0) {
            timeLeftText = 'Overdue!';
        } else if (hoursLeft > 0) {
            timeLeftText = `${hoursLeft}h ${minutesLeft}m left`;
        } else {
            timeLeftText = `${minutesLeft} minutes left`;
        }
        
        // Format creation time
        let createdAtDisplay = task.createdDisplay;
        if (!createdAtDisplay && task.createdAt) {
            const createdDate = new Date(task.createdAt);
            createdAtDisplay = createdDate.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        div.innerHTML = `
            <div class="task-header-row">
                <div class="task-title">${task.name}</div>
                <span class="task-priority priority-${task.priority}">
                    ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
            </div>
            ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
            <div class="task-meta">
                <div class="meta-item">
                    <i class="fas fa-calendar-plus"></i>
                    <span>Created: ${createdAtDisplay || 'N/A'}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span>Due: ${this.formatDateTime(task.deadline)}</span>
                </div>
                ${task.completedAt ? `
                <div class="meta-item">
                    <i class="fas fa-check-circle"></i>
                    <span>Completed: ${this.formatDateTime(task.completedAt)}</span>
                </div>
                ` : ''}
            </div>
            <div class="task-footer">
                <div class="task-due ${timeDiff < 0 ? 'overdue' : ''}">
                    <i class="fas fa-hourglass-half"></i>
                    <span class="time-left">${timeLeftText}</span>
                </div>
                <div class="task-actions">
                    ${task.status === 'pending' ? `
                        <button class="action-btn complete" data-id="${task.id}" title="Mark Complete">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn edit" data-id="${task.id}" title="Edit Task">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" data-id="${task.id}" title="Delete Task">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="action-btn info" data-id="${task.id}" title="Task Details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        `;
        
        return div;
    }
    
    isTaskOverdue(task) {
        if (task.status === 'completed') return false;
        return new Date(task.deadline) < new Date();
    }
    
    formatDateTime(dateTimeStr) {
        try {
            const date = new Date(dateTimeStr);
            if (isNaN(date.getTime())) return 'Invalid date';
            
            return date.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid date';
        }
    }
    
    updateStats() {
        const total = this.tasks.length;
        const pending = this.tasks.filter(task => task.status === 'pending').length;
        const completed = this.tasks.filter(task => task.status === 'completed').length;
        const overdue = this.tasks.filter(task => this.isTaskOverdue(task)).length;
        
        document.getElementById('totalTasks').textContent = total;
        document.getElementById('pendingTasks').textContent = pending;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('taskStats').textContent = `${total} Tasks (${pending} pending, ${overdue} overdue)`;
    }
    
    updateLastSaved() {
        const lastSave = localStorage.getItem('taskReminderLastSave');
        let timeStr = 'Never saved';
        
        if (lastSave) {
            const lastSaveDate = new Date(lastSave);
            timeStr = lastSaveDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeStr = `Last saved: ${timeStr}`;
        }
        
        document.getElementById('lastSaved').textContent = timeStr;
    }
    
    checkDueTasks() {
        const now = new Date();
        const reminderMinutes = this.settings.reminderTime;
        
        this.tasks.forEach(task => {
            if (task.status === 'pending') {
                const deadline = new Date(task.deadline);
                const timeDiff = deadline - now;
                const minutesDiff = timeDiff / (1000 * 60);
                
                // Check if task is due within reminder time
                if (minutesDiff > 0 && minutesDiff <= reminderMinutes) {
                    this.sendReminder(task, minutesDiff);
                }
                
                // Check if overdue
                if (timeDiff < 0) {
                    this.sendOverdueReminder(task);
                }
            }
        });
    }
    
    sendReminder(task, minutesLeft) {
        // Skip if already reminded recently
        if (task.lastReminded && (Date.now() - task.lastReminded) < 60000) {
            return;
        }
        
        task.lastReminded = Date.now();
        this.saveTasksToStorage(); // Update storage
        
        // Browser notification
        if (this.settings.desktopNotifications && this.notificationPermission) {
            const notification = new Notification(`⏰ Task Due Soon: ${task.name}`, {
                body: `Due in ${Math.floor(minutesLeft)} minutes: ${task.description || 'No description'}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
                tag: `task-reminder-${task.id}`,
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                this.showNotificationPanel();
            };
        }
        
        // Sound alert
        this.playAlertSound();
        
        // Add to notification panel
        this.addToNotificationPanel(
            `Task Due Soon: ${task.name}`,
            `Due in ${Math.floor(minutesLeft)} minutes`,
            'warning'
        );
    }
    
    sendOverdueReminder(task) {
        // Skip if already reminded recently
        if (task.lastOverdueReminded && (Date.now() - task.lastOverdueReminded) < 300000) { // 5 minutes
            return;
        }
        
        task.lastOverdueReminded = Date.now();
        this.saveTasksToStorage(); // Update storage
        
        // Browser notification
        if (this.settings.desktopNotifications && this.notificationPermission) {
            const notification = new Notification(`⚠️ Task Overdue: ${task.name}`, {
                body: `Task was due ${this.formatDateTime(task.deadline)}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚠️</text></svg>',
                tag: `task-overdue-${task.id}`,
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                // Focus on the overdue task
                this.currentFilter = 'overdue';
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-filter="overdue"]').classList.add('active');
                this.displayTasks();
            };
        }
        
        // Sound alert
        this.playAlertSound();
        
        // Add to notification panel
        this.addToNotificationPanel(
            `Task Overdue: ${task.name}`,
            `Was due ${this.formatDateTime(task.deadline)}`,
            'danger'
        );
    }
    
    playAlertSound() {
        if (this.settings.notificationSound === 'none') return;
        
        const soundId = `alertSound${this.settings.notificationSound.charAt(5)}`;
        const audio = document.getElementById(soundId);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
    }
    
    addToNotificationPanel(title, message, type = 'info') {
        const panel = document.getElementById('notificationsList');
        if (!panel) return;
        
        const notification = document.createElement('div');
        notification.className = `notification-item ${type}`;
        notification.innerHTML = `
            <strong>${title}</strong>
            <p>${message}</p>
            <div class="notification-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        panel.insertBefore(notification, panel.firstChild);
        
        // Limit to 10 notifications
        while (panel.children.length > 10) {
            panel.removeChild(panel.lastChild);
        }
        
        // Show panel if hidden
        this.showNotificationPanel();
    }
    
    showNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.style.display = 'block';
            setTimeout(() => {
                panel.style.display = 'none';
            }, 10000); // Hide after 10 seconds
        }
    }
    
    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    this.notificationPermission = permission === 'granted';
                    this.updateReminderStatus();
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                }
            } else {
                this.notificationPermission = Notification.permission === 'granted';
                this.updateReminderStatus();
            }
        }
    }
    
    updateReminderStatus() {
        const statusEl = document.getElementById('reminderStatus');
        const toggleBtn = document.getElementById('notificationToggle');
        
        if (this.notificationPermission) {
            statusEl.innerHTML = '<i class="fas fa-bell"></i> Reminders: On';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';
            toggleBtn.innerHTML = '<i class="fas fa-bell-slash"></i> Disable Notifications';
        } else {
            statusEl.innerHTML = '<i class="fas fa-bell-slash"></i> Reminders: Off';
            statusEl.style.background = '#f8d7da';
            statusEl.style.color = '#721c24';
            toggleBtn.innerHTML = '<i class="fas fa-bell"></i> Enable Notifications';
        }
    }
    
    generateAIPrompt(taskId, problemType, problemDesc, triedSolutions) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return '';
        
        const problemTypes = {
            technical: 'Technical Issue',
            time: 'Time Management',
            understanding: 'Understanding the Task',
            resources: 'Lack of Resources',
            motivation: 'Motivation/Procrastination',
            other: 'Other'
        };
        
        return `I need help with completing a task. Here are the details:

TASK: ${task.name}
DESCRIPTION: ${task.description || 'No description provided'}
CREATED: ${task.createdDisplay || this.formatDateTime(task.createdAt)}
DEADLINE: ${this.formatDateTime(task.deadline)}
PRIORITY: ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
CURRENT STATUS: ${task.status}

PROBLEM TYPE: ${problemTypes[problemType] || 'Other'}
SPECIFIC ISSUE: ${problemDesc}
ATTEMPTED SOLUTIONS: ${triedSolutions}

Please provide:
1. Step-by-step solution approach
2. Recommended resources/tools
3. Time management strategy for this task
4. Alternative approaches if the main solution doesn't work
5. Common pitfalls to avoid

Keep the response practical and actionable.`;
    }
    
    setupIntervals() {
        // Clear existing intervals
        if (this.reminderInterval) clearInterval(this.reminderInterval);
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        
        // Setup reminder check interval (every minute)
        this.reminderInterval = setInterval(() => {
            this.checkDueTasks();
        }, 60000); // 1 minute
        
        // Setup auto-save interval
        const saveMinutes = this.settings.autoSaveInterval * 60000;
        this.autoSaveInterval = setInterval(() => {
            this.saveTasksToStorage(); // Don't download, just save to localStorage
            this.showNotification('Auto-save', 'Tasks have been auto-saved.', 'info');
        }, saveMinutes);
    }
    
    initEventListeners() {
        // Add task button
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.handleAddTask();
        });
        
        // Priority buttons
        document.querySelectorAll('.priority-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });
        
        // Quick add buttons
        document.getElementById('quickToday').addEventListener('click', () => {
            const today = new Date();
            today.setHours(18, 0, 0); // Set to 6 PM today
            document.getElementById('taskDate').value = today.toISOString().split('T')[0];
            document.getElementById('taskTime').value = '18:00';
        });
        
        document.getElementById('quickTomorrow').addEventListener('click', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(18, 0, 0);
            document.getElementById('taskDate').value = tomorrow.toISOString().split('T')[0];
            document.getElementById('taskTime').value = '18:00';
        });
        
        document.getElementById('quickWeek').addEventListener('click', () => {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextWeek.setHours(18, 0, 0);
            document.getElementById('taskDate').value = nextWeek.toISOString().split('T')[0];
            document.getElementById('taskTime').value = '18:00';
        });
        
        // Task actions (delegated)
        document.getElementById('tasksContainer').addEventListener('click', (e) => {
            const target = e.target.closest('.action-btn');
            if (!target) return;
            
            const taskId = parseInt(target.dataset.id);
            
            if (target.classList.contains('complete')) {
                this.completeTask(taskId);
            } else if (target.classList.contains('delete')) {
                if (confirm('Are you sure you want to delete this task?')) {
                    this.deleteTask(taskId);
                }
            } else if (target.classList.contains('edit')) {
                this.editTask(taskId);
            } else if (target.classList.contains('info')) {
                this.showTaskDetails(taskId);
            }
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentFilter = e.currentTarget.dataset.filter;
                this.displayTasks();
            });
        });
        
        // Search input
        document.getElementById('taskSearch').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.displayTasks();
        });
        
        // Refresh button
        document.getElementById('refreshTasks').addEventListener('click', () => {
            this.loadTasksFromCSV();
            this.displayTasks();
            this.showNotification('Refreshed', 'Task list has been refreshed.', 'info');
        });
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });
        
        // Export button - now explicitly downloads CSV
        document.getElementById('exportBtn').addEventListener('click', async () => {
            await this.saveTasksToStorage(true); // true = download CSV
            this.showNotification('Export Complete', 'Tasks have been exported to CSV file.', 'success');
        });
        
        // History button
        document.getElementById('historyBtn').addEventListener('click', () => {
            this.showHistory();
        });
        
        // Notification toggle
        document.getElementById('notificationToggle').addEventListener('click', () => {
            this.toggleNotifications();
        });
        
        // Help generator
        document.getElementById('generateHelpBtn').addEventListener('click', () => {
            this.openHelpModal();
        });
        
        // Clear notifications
        document.getElementById('clearNotifications')?.addEventListener('click', () => {
            document.getElementById('notificationsList').innerHTML = '';
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });
        
        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Prevent page refresh from triggering downloads
        window.addEventListener('beforeunload', (e) => {
            // Save to localStorage before leaving
            this.saveTasksToStorage(false);
        });
    }
    
    handleAddTask() {
        const name = document.getElementById('taskName').value.trim();
        const description = document.getElementById('taskDesc').value.trim();
        const date = document.getElementById('taskDate').value;
        const time = document.getElementById('taskTime').value;
        const priority = document.querySelector('.priority-btn.active').dataset.priority;
        
        if (!name) {
            this.showNotification('Error', 'Task name is required!', 'danger');
            return;
        }
        
        if (!date || !time) {
            this.showNotification('Error', 'Please set a deadline!', 'danger');
            return;
        }
        
        const taskData = { name, description, date, time, priority };
        this.addTask(taskData);
        
        // Clear form
        document.getElementById('taskName').value = '';
        document.getElementById('taskDesc').value = '';
        document.getElementById('taskDate').value = '';
        document.getElementById('taskTime').value = '18:00';
        
        // Reset priority to medium
        document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.priority-btn.medium').classList.add('active');
        
        // Focus back on task name
        document.getElementById('taskName').focus();
    }
    
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        document.getElementById('reminderTime').value = this.settings.reminderTime;
        document.getElementById('notificationSound').value = this.settings.notificationSound;
        document.getElementById('desktopNotifications').checked = this.settings.desktopNotifications;
        document.getElementById('autoSaveInterval').value = this.settings.autoSaveInterval;
        
        // Add auto-download CSV option
        const autoDownloadCheckbox = document.createElement('label');
        autoDownloadCheckbox.innerHTML = `
            <input type="checkbox" id="autoDownloadCSV" ${this.settings.autoDownloadCSV ? 'checked' : ''}>
            Auto-download CSV on save (not recommended)
        `;
        
        const settingsSection = document.querySelector('.settings-section:nth-child(2)');
        if (settingsSection && !document.getElementById('autoDownloadCSV')) {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            formGroup.innerHTML = `
                <label>
                    <input type="checkbox" id="autoDownloadCSV" ${this.settings.autoDownloadCSV ? 'checked' : ''}>
                    Auto-download CSV on save (not recommended)
                </label>
                <small style="display:block;color:#666;margin-top:5px;">
                    When checked, CSV will download every time you save. Leave unchecked for better experience.
                </small>
            `;
            settingsSection.appendChild(formGroup);
        }
        
        // Test sound button
        document.getElementById('testSound').addEventListener('click', () => {
            this.playAlertSound();
        });
        
        // Save settings button
        document.getElementById('exportCSV').addEventListener('click', async () => {
            await this.saveTasksToStorage(true); // Download CSV
            this.showNotification('Export Complete', 'Tasks exported to CSV file.', 'success');
        });
        
        // Import CSV
        document.getElementById('importCSV').addEventListener('click', () => {
            this.importCSV();
        });
        
        // Backup button
        document.getElementById('backupTasks').addEventListener('click', async () => {
            await this.saveTasksToStorage(true); // Download CSV
            this.showNotification('Backup Created', 'Tasks have been backed up to CSV.', 'success');
        });
        
        // Save settings on change
        document.getElementById('reminderTime').addEventListener('change', (e) => {
            this.settings.reminderTime = parseInt(e.target.value);
            this.saveSettings();
            this.setupIntervals();
        });
        
        document.getElementById('notificationSound').addEventListener('change', (e) => {
            this.settings.notificationSound = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('desktopNotifications').addEventListener('change', (e) => {
            this.settings.desktopNotifications = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('autoSaveInterval').addEventListener('change', (e) => {
            this.settings.autoSaveInterval = parseInt(e.target.value);
            this.saveSettings();
            this.setupIntervals();
        });
        
        // Auto-download CSV setting
        document.getElementById('autoDownloadCSV').addEventListener('change', (e) => {
            this.settings.autoDownloadCSV = e.target.checked;
            this.saveSettings();
        });
        
        modal.classList.add('active');
    }
    
    openHelpModal() {
        const modal = document.getElementById('helpModal');
        const taskSelect = document.getElementById('helpTaskSelect');
        
        // Populate task select with pending tasks
        taskSelect.innerHTML = '<option value="">Select a task...</option>';
        this.tasks
            .filter(task => task.status === 'pending')
            .forEach(task => {
                const option = document.createElement('option');
                option.value = task.id;
                option.textContent = `${task.name} (Due: ${this.formatDateTime(task.deadline)})`;
                taskSelect.appendChild(option);
            });
        
        // Clear previous prompt
        document.getElementById('promptResult').style.display = 'none';
        
        // Generate prompt button
        document.getElementById('generatePromptBtn').onclick = () => {
            const taskId = parseInt(taskSelect.value);
            const problemType = document.getElementById('problemType').value;
            const problemDesc = document.getElementById('problemDesc').value.trim();
            const triedSolutions = document.getElementById('triedSolutions').value.trim();
            
            if (!taskId || !problemDesc) {
                this.showNotification('Error', 'Please select a task and describe the problem.', 'danger');
                return;
            }
            
            const prompt = this.generateAIPrompt(taskId, problemType, problemDesc, triedSolutions);
            document.getElementById('generatedPrompt').value = prompt;
            document.getElementById('promptResult').style.display = 'block';
            
            // Scroll to result
            document.getElementById('promptResult').scrollIntoView({ behavior: 'smooth' });
        };
        
        // Copy to clipboard
        document.getElementById('copyPrompt').onclick = () => {
            const promptText = document.getElementById('generatedPrompt').value;
            navigator.clipboard.writeText(promptText).then(() => {
                this.showNotification('Copied!', 'Prompt copied to clipboard.', 'success');
            });
        };
        
        // Save as file
        document.getElementById('savePrompt').onclick = () => {
            const promptText = document.getElementById('generatedPrompt').value;
            const taskId = document.getElementById('helpTaskSelect').value;
            const blob = new Blob([promptText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai_help_task_${taskId}_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Saved', 'Prompt saved as text file.', 'success');
        };
        
        // Use with AI button
        document.getElementById('useWithAI').onclick = () => {
            this.showNotification('Ready', 'Prompt is ready! Copy and paste it to your AI assistant.', 'info');
        };
        
        modal.classList.add('active');
    }
    
    importCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.txt';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const csvText = event.target.result;
                    this.parseCSV(csvText);
                    this.saveTasksToStorage(false); // Save to localStorage
                    this.displayTasks();
                    this.updateStats();
                    this.showNotification('Import Successful', `${this.tasks.length} tasks imported from CSV.`, 'success');
                } catch (error) {
                    this.showNotification('Import Failed', 'Error reading CSV file.', 'danger');
                    console.error('CSV import error:', error);
                }
            };
            
            reader.onerror = () => {
                this.showNotification('Import Failed', 'Error reading file.', 'danger');
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Create edit modal
        const editModal = document.createElement('div');
        editModal.className = 'modal active';
        editModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-edit"></i> Edit Task</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Task Name:</label>
                        <input type="text" id="editTaskName" class="form-control" value="${task.name.replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label>Description:</label>
                        <textarea id="editTaskDesc" class="form-control" rows="3">${task.description || ''}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Due Date:</label>
                            <input type="date" id="editTaskDate" class="form-control" 
                                   value="${task.deadline.split(' ')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Time:</label>
                            <input type="time" id="editTaskTime" class="form-control" 
                                   value="${task.deadline.split(' ')[1] || '18:00'}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Priority:</label>
                        <select id="editTaskPriority" class="form-control">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <button id="saveEditBtn" class="btn-primary btn-large">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(editModal);
        
        // Close modal
        editModal.querySelector('.modal-close').addEventListener('click', () => {
            editModal.remove();
        });
        
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                editModal.remove();
            }
        });
        
        // Save changes
        editModal.querySelector('#saveEditBtn').addEventListener('click', () => {
            const newName = document.getElementById('editTaskName').value.trim();
            const newDesc = document.getElementById('editTaskDesc').value.trim();
            const newDate = document.getElementById('editTaskDate').value;
            const newTime = document.getElementById('editTaskTime').value;
            const newPriority = document.getElementById('editTaskPriority').value;
            
            if (!newName) {
                this.showNotification('Error', 'Task name cannot be empty!', 'danger');
                return;
            }
            
            task.name = newName;
            task.description = newDesc;
            task.deadline = `${newDate} ${newTime}`;
            task.priority = newPriority;
            
            this.saveTasksToStorage(false);
            this.displayTasks();
            editModal.remove();
            
            this.showNotification('Task Updated', 'Task has been updated successfully.', 'success');
        });
    }
    
    showTaskDetails(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const detailsModal = document.createElement('div');
        detailsModal.className = 'modal active';
        
        const createdDate = new Date(task.createdAt);
        const dueDate = new Date(task.deadline);
        const completedDate = task.completedAt ? new Date(task.completedAt) : null;
        
        detailsModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-info-circle"></i> Task Details</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="task-detail-card">
                        <h3>${task.name}</h3>
                        ${task.description ? `<p class="detail-desc">${task.description}</p>` : ''}
                        
                        <div class="detail-grid">
                            <div class="detail-item">
                                <strong><i class="fas fa-hashtag"></i> Task ID:</strong>
                                <span>${task.id}</span>
                            </div>
                            <div class="detail-item">
                                <strong><i class="fas fa-flag"></i> Priority:</strong>
                                <span class="priority-badge priority-${task.priority}">
                                    ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </span>
                            </div>
                            <div class="detail-item">
                                <strong><i class="fas fa-hourglass-half"></i> Status:</strong>
                                <span class="status-badge status-${task.status}">
                                    ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                </span>
                            </div>
                            <div class="detail-item">
                                <strong><i class="fas fa-calendar-plus"></i> Created:</strong>
                                <span>${createdDate.toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <strong><i class="fas fa-clock"></i> Due:</strong>
                                <span>${dueDate.toLocaleString()}</span>
                            </div>
                            ${completedDate ? `
                            <div class="detail-item">
                                <strong><i class="fas fa-check-circle"></i> Completed:</strong>
                                <span>${completedDate.toLocaleString()}</span>
                            </div>
                            ` : ''}
                            <div class="detail-item">
                                <strong><i class="fas fa-history"></i> Age:</strong>
                                <span>${this.getTimeDifference(createdDate, new Date())}</span>
                            </div>
                            ${task.status === 'pending' ? `
                            <div class="detail-item">
                                <strong><i class="fas fa-hourglass-end"></i> Time Left:</strong>
                                <span>${this.getTimeDifference(new Date(), dueDate)}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        ${task.lastReminded ? `
                        <div class="detail-note">
                            <i class="fas fa-bell"></i>
                            <span>Last reminded: ${new Date(task.lastReminded).toLocaleString()}</span>
                        </div>
                        ` : ''}
                        
                        ${task.lastOverdueReminded ? `
                        <div class="detail-note">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Last overdue reminder: ${new Date(task.lastOverdueReminded).toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(detailsModal);
        
        // Close modal
        detailsModal.querySelector('.modal-close').addEventListener('click', () => {
            detailsModal.remove();
        });
        
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                detailsModal.remove();
            }
        });
    }
    
    getTimeDifference(start, end) {
        const diff = Math.abs(end - start);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes} minutes`;
    }
    
    toggleNotifications() {
        if (this.notificationPermission) {
            this.notificationPermission = false;
            this.showNotification('Notifications Disabled', 'Browser notifications have been turned off.', 'warning');
        } else {
            this.requestNotificationPermission();
        }
        this.updateReminderStatus();
    }
    
    showHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('taskHistory') || '[]');
            
            if (history.length === 0) {
                this.showNotification('History', 'No completed tasks in history yet.', 'info');
                return;
            }
            
            // Create history modal
            const historyModal = document.createElement('div');
            historyModal.className = 'modal active';
            
            let historyHTML = '<h3><i class="fas fa-history"></i> Completed Tasks History</h3>';
            historyHTML += `<p>Total completed tasks: ${history.length}</p>`;
            historyHTML += '<div class="history-list">';
            
            history.slice(-20).reverse().forEach((task, index) => {
                const completedDate = task.completedAt ? new Date(task.completedAt) : null;
                const createdDate = new Date(task.createdAt);
                
                historyHTML += `
                    <div class="history-item">
                        <div class="history-header">
                            <span class="history-index">${history.length - index}.</span>
                            <strong>${task.name}</strong>
                            <span class="history-date">
                                ${completedDate ? completedDate.toLocaleDateString() : 'Unknown'}
                            </span>
                        </div>
                        <div class="history-details">
                            <span>Created: ${createdDate.toLocaleDateString()}</span>
                            <span>Priority: ${task.priority}</span>
                            <span>Completion Time: ${this.getTimeDifference(createdDate, completedDate || new Date())}</span>
                        </div>
                    </div>
                `;
            });
            
            historyHTML += '</div>';
            
            historyModal.innerHTML = `
                <div class="modal-content large-modal">
                    <div class="modal-header">
                        <h2><i class="fas fa-history"></i> Task History</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${historyHTML}
                        <div class="button-group">
                            <button id="exportHistoryBtn" class="btn-secondary">
                                <i class="fas fa-file-export"></i> Export History
                            </button>
                            <button id="clearHistoryBtn" class="btn-danger">
                                <i class="fas fa-trash"></i> Clear History
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(historyModal);
            
            // Close modal
            historyModal.querySelector('.modal-close').addEventListener('click', () => {
                historyModal.remove();
            });
            
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    historyModal.remove();
                }
            });
            
            // Export history
            historyModal.querySelector('#exportHistoryBtn').addEventListener('click', () => {
                this.exportHistory();
                historyModal.remove();
            });
            
            // Clear history
            historyModal.querySelector('#clearHistoryBtn').addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
                    localStorage.removeItem('taskHistory');
                    localStorage.removeItem('taskHistoryCSV');
                    this.showNotification('History Cleared', 'All history has been deleted.', 'warning');
                    historyModal.remove();
                }
            });
            
        } catch (error) {
            this.showNotification('History Error', 'Could not load history.', 'danger');
            console.error('History error:', error);
        }
    }
    
    exportHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('taskHistory') || '[]');
            
            if (history.length === 0) {
                this.showNotification('Export Failed', 'No history to export.', 'warning');
                return;
            }
            
            let csvContent = 'ID,Name,Description,Deadline,Priority,CreatedAt,CompletedAt,ArchivedAt\n';
            
            history.forEach(task => {
                const row = [
                    task.id,
                    `"${(task.name || '').replace(/"/g, '""')}"`,
                    `"${(task.description || '').replace(/"/g, '""')}"`,
                    task.deadline,
                    task.priority,
                    task.createdAt,
                    task.completedAt || '',
                    task.archivedAt || ''
                ];
                csvContent += row.join(',') + '\n';
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `task_history_${new Date().toISOString().split('T')[0]}.csv`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('History Exported', 'Task history exported to CSV.', 'success');
            
        } catch (error) {
            this.showNotification('Export Failed', 'Error exporting history.', 'danger');
            console.error('Export error:', error);
        }
    }
    
    showNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification-item ${type}`;
        notification.innerHTML = `
            <strong>${title}</strong>
            <p>${message}</p>
            <div class="notification-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        const panel = document.getElementById('notificationsList');
        if (panel) {
            panel.insertBefore(notification, panel.firstChild);
            this.showNotificationPanel();
        }
        
        // Also log to console
        console.log(`${title}: ${message}`);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskReminder = new TaskReminder();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('taskDate');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
    
    // Show welcome notification
    setTimeout(() => {
        if (window.taskReminder) {
            window.taskReminder.showNotification(
                'Welcome to Task Reminder Pro!',
                'Tasks are saved automatically. Use "Export" button to download CSV.',
                'success'
            );
        }
    }, 1500);
});

// Prevent accidental page refresh
window.addEventListener('beforeunload', (e) => {
    // Only show warning if there are unsaved tasks (though we auto-save)
    if (window.taskReminder && window.taskReminder.tasks.length > 0) {
        // Modern browsers ignore custom messages
        e.preventDefault();
        e.returnValue = '';
    }
});