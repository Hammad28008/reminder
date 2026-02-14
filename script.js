class BusinessManager {
    constructor() {
        // Data storage
        this.tasks = [];
        this.companies = [];
        this.meetings = [];
        this.documents = [];
        
        // UI State
        this.currentTab = 'tasks';
        this.currentFilter = 'all';
        this.currentCompanyFilter = 'all';
        this.currentMeetingFilter = 'upcoming';
        this.searchTerms = { tasks: '', companies: '', meetings: '' };
        
        // Settings
        this.settings = this.loadSettings();
        
        // UAE Timezone (GMT+4)
        this.uaeTimezone = 'Asia/Dubai';
        
        // Initialize
        this.initializeApp();
    }
    
    initializeApp() {
        // Load all data
        this.loadAllData();
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Setup intervals
        this.setupIntervals();
        
        // Request notification permission
        this.requestNotificationPermission();
        
        // Update UI
        this.updateAllStats();
        this.updateUAETime();
        
        // Check for reminders
        this.checkAllReminders();
        
        // Update last saved time
        this.updateLastSaved();
        
        console.log('Business Manager initialized with UAE timezone');
    }
    
    loadSettings() {
        const defaultSettings = {
            reminderTime: 10,
            notificationSound: 'alert1.mp3',
            desktopNotifications: true,
            autoSaveInterval: 5,
            licenseReminders: true,
            defaultWorkStart: '09:00',
            defaultWorkEnd: '17:00',
            meetingDuration: 60,
            meetingBuffer: 15
        };
        
        const saved = localStorage.getItem('businessManagerSettings');
        return saved ? JSON.parse(saved) : defaultSettings;
    }
    
    saveSettings() {
        localStorage.setItem('businessManagerSettings', JSON.stringify(this.settings));
    }
    
    loadAllData() {
        // Load tasks
        try {
            const tasksData = localStorage.getItem('businessTasks');
            this.tasks = tasksData ? JSON.parse(tasksData) : [];
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
        }
        
        // Load companies
        try {
            const companiesData = localStorage.getItem('businessCompanies');
            this.companies = companiesData ? JSON.parse(companiesData) : [];
        } catch (error) {
            console.error('Error loading companies:', error);
            this.companies = [];
        }
        
        // Load meetings
        try {
            const meetingsData = localStorage.getItem('businessMeetings');
            this.meetings = meetingsData ? JSON.parse(meetingsData) : [];
        } catch (error) {
            console.error('Error loading meetings:', error);
            this.meetings = [];
        }
        
        // Load documents (as references only, files stored in IndexedDB)
        try {
            const documentsData = localStorage.getItem('businessDocuments');
            this.documents = documentsData ? JSON.parse(documentsData) : [];
        } catch (error) {
            console.error('Error loading documents:', error);
            this.documents = [];
        }
        
        // Update displays
        this.displayTasks();
        this.displayCompanies();
        this.displayMeetings();
        this.populateCompanySelects();
    }
    
    saveAllData() {
        // Save all data to localStorage
        localStorage.setItem('businessTasks', JSON.stringify(this.tasks));
        localStorage.setItem('businessCompanies', JSON.stringify(this.companies));
        localStorage.setItem('businessMeetings', JSON.stringify(this.meetings));
        localStorage.setItem('businessDocuments', JSON.stringify(this.documents));
        localStorage.setItem('businessLastSave', new Date().toISOString());
        
        this.updateLastSaved();
        console.log('All data saved to localStorage');
    }
    
    // ===== FILE UPLOAD FUNCTIONS (FIXED) =====
    
    async uploadDocument(file, targetType, targetId, docType) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Create document record
                const documentId = this.documents.length > 0 
                    ? Math.max(...this.documents.map(d => d.id)) + 1 
                    : 1;
                
                const newDoc = {
                    id: documentId,
                    name: file.name,
                    type: docType,
                    targetType: targetType,
                    targetId: targetId,
                    fileSize: file.size,
                    fileType: file.type,
                    uploadedAt: new Date().toISOString(),
                    // Store as base64 data URL
                    dataUrl: e.target.result
                };
                
                // Add to documents array
                this.documents.push(newDoc);
                
                // Link to company or meeting
                if (targetType === 'company') {
                    const company = this.companies.find(c => c.id === targetId);
                    if (company) {
                        if (!company.documents) company.documents = [];
                        company.documents.push(documentId);
                    }
                } else if (targetType === 'meeting') {
                    const meeting = this.meetings.find(m => m.id === targetId);
                    if (meeting) {
                        if (!meeting.documents) meeting.documents = [];
                        meeting.documents.push(documentId);
                    }
                }
                
                this.saveAllData();
                this.showNotification('Upload Successful', `${file.name} uploaded`, 'success');
                resolve(newDoc);
            };
            
            reader.onerror = (error) => {
                console.error('File read error:', error);
                this.showNotification('Upload Failed', 'Error reading file', 'danger');
                reject(error);
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    async uploadMultipleFiles(files, targetType, targetId, docType) {
        const uploadPromises = [];
        
        for (let i = 0; i < files.length; i++) {
            uploadPromises.push(this.uploadDocument(files[i], targetType, targetId, docType));
        }
        
        try {
            await Promise.all(uploadPromises);
            this.showNotification('Upload Complete', `${files.length} file(s) uploaded`, 'success');
            this.refreshDisplays();
        } catch (error) {
            this.showNotification('Upload Error', 'Some files failed to upload', 'danger');
        }
    }
    
    getDocumentsForTarget(targetType, targetId) {
        return this.documents.filter(doc => 
            doc.targetType === targetType && doc.targetId === targetId
        );
    }
    
    downloadDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc || !doc.dataUrl) return;
        
        const link = document.createElement('a');
        link.href = doc.dataUrl;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    deleteDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) return;
        
        // Remove from company/meeting references
        if (doc.targetType === 'company') {
            const company = this.companies.find(c => c.id === doc.targetId);
            if (company && company.documents) {
                company.documents = company.documents.filter(id => id !== docId);
            }
        } else if (doc.targetType === 'meeting') {
            const meeting = this.meetings.find(m => m.id === doc.targetId);
            if (meeting && meeting.documents) {
                meeting.documents = meeting.documents.filter(id => id !== docId);
            }
        }
        
        // Remove document
        this.documents = this.documents.filter(d => d.id !== docId);
        this.saveAllData();
        this.showNotification('Document Deleted', 'File removed', 'warning');
        this.refreshDisplays();
    }
    
    // ===== IMPORT/EXPORT FUNCTIONS (FIXED) =====
    
    exportAllData() {
        const exportData = {
            tasks: this.tasks,
            companies: this.companies,
            meetings: this.meetings,
            documents: this.documents.map(doc => ({
                ...doc,
                // Include document data URLs in export
                dataUrl: doc.dataUrl
            })),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `business_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Export Complete', 'All data exported successfully', 'success');
    }
    
    importData(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                // Validate import data
                if (!importData.tasks || !importData.companies || !importData.meetings) {
                    throw new Error('Invalid backup file format');
                }
                
                // Confirm import
                if (!confirm('This will replace all current data. Continue?')) {
                    return;
                }
                
                // Import data
                this.tasks = importData.tasks || [];
                this.companies = importData.companies || [];
                this.meetings = importData.meetings || [];
                this.documents = importData.documents || [];
                
                this.saveAllData();
                this.refreshDisplays();
                
                this.showNotification('Import Successful', 
                    `Imported ${this.tasks.length} tasks, ${this.companies.length} companies, ${this.meetings.length} meetings`, 
                    'success');
                
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification('Import Failed', 'Invalid backup file', 'danger');
            }
        };
        
        reader.readAsText(file);
    }
    
    exportCompanies() {
        const headers = ['ID', 'Name', 'License Number', 'License Expiry', 'Industry', 'Address', 
                        'WhatsApp', 'Phone', 'Email', 'Website', 'Contact Person', 'Status', 'Created At'];
        
        let csv = headers.join(',') + '\n';
        
        this.companies.forEach(c => {
            const row = [
                c.id,
                `"${c.name.replace(/"/g, '""')}"`,
                `"${c.licenseNumber.replace(/"/g, '""')}"`,
                c.licenseExpiry,
                c.industry || '',
                `"${c.address.replace(/"/g, '""')}"`,
                `"${c.whatsapp.replace(/"/g, '""')}"`,
                c.phone || '',
                c.email || '',
                c.website || '',
                `"${(c.contactPerson || '').replace(/"/g, '""')}"`,
                c.status,
                c.createdAt
            ];
            csv += row.join(',') + '\n';
        });
        
        this.downloadCSV(csv, `companies_export_${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    exportMeetings() {
        const headers = ['ID', 'Company ID', 'Company Name', 'Title', 'Date & Time', 'Duration', 
                        'Buffer', 'Platform', 'Link', 'Status', 'Created At'];
        
        let csv = headers.join(',') + '\n';
        
        this.meetings.forEach(m => {
            const row = [
                m.id,
                m.companyId,
                `"${this.getCompanyName(m.companyId).replace(/"/g, '""')}"`,
                `"${m.title.replace(/"/g, '""')}"`,
                m.dateTime,
                m.duration,
                m.buffer || 0,
                m.platform || '',
                m.link || '',
                m.status,
                m.createdAt
            ];
            csv += row.join(',') + '\n';
        });
        
        this.downloadCSV(csv, `meetings_export_${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    downloadCSV(csv, filename) {
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // Add BOM for UTF-8
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    // ===== COMPANY FUNCTIONS =====
    
    addCompany(companyData) {
        const newCompany = {
            id: this.companies.length > 0 ? Math.max(...this.companies.map(c => c.id)) + 1 : 1,
            ...companyData,
            createdAt: new Date().toISOString(),
            documents: [],
            status: this.getLicenseStatus(companyData.licenseExpiry)
        };
        
        this.companies.push(newCompany);
        this.saveAllData();
        this.displayCompanies();
        this.populateCompanySelects();
        this.updateAllStats();
        
        this.showNotification('Company Added', `${newCompany.name} has been added`, 'success');
        
        // Check license expiry
        this.checkLicenseExpiry(newCompany);
        
        return newCompany;
    }
    
    getLicenseStatus(expiryDate) {
        const today = new Date();
        const expiry = new Date(expiryDate);
        const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) return 'expired';
        if (daysUntilExpiry <= 30) return 'expiring-soon';
        return 'active';
    }
    
    updateCompany(companyId, updates) {
        const index = this.companies.findIndex(c => c.id === companyId);
        if (index === -1) return;
        
        this.companies[index] = { ...this.companies[index], ...updates };
        this.companies[index].status = this.getLicenseStatus(this.companies[index].licenseExpiry);
        
        this.saveAllData();
        this.displayCompanies();
        this.showNotification('Company Updated', 'Company details updated', 'success');
    }
    
    deleteCompany(companyId) {
        if (!confirm('Are you sure you want to delete this company? All related meetings and documents will also be deleted.')) return;
        
        // Delete related meetings
        this.meetings = this.meetings.filter(m => m.companyId !== companyId);
        
        // Delete related documents
        this.documents = this.documents.filter(d => !(d.targetType === 'company' && d.targetId === companyId));
        
        // Delete company
        this.companies = this.companies.filter(c => c.id !== companyId);
        
        this.saveAllData();
        this.displayCompanies();
        this.displayMeetings();
        this.populateCompanySelects();
        this.updateAllStats();
        
        this.showNotification('Company Deleted', 'Company has been removed', 'warning');
    }
    
    // ===== MEETING FUNCTIONS =====
    
    scheduleMeeting(meetingData) {
        // Check availability
        const isAvailable = this.isSlotAvailable(
            meetingData.dateTime, 
            meetingData.duration, 
            meetingData.buffer || 0
        );
        
        if (!isAvailable) {
            this.showNotification('Slot Not Available', 'This time slot is already booked', 'danger');
            return null;
        }
        
        const newMeeting = {
            id: this.meetings.length > 0 ? Math.max(...this.meetings.map(m => m.id)) + 1 : 1,
            ...meetingData,
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            documents: [],
            reminders: {
                '1day': false,
                '1hour': false,
                '30min': false
            }
        };
        
        this.meetings.push(newMeeting);
        this.saveAllData();
        this.displayMeetings();
        this.updateAllStats();
        this.updateCalendar();
        
        this.showNotification('Meeting Scheduled', `Meeting with ${this.getCompanyName(meetingData.companyId)} scheduled`, 'success');
        
        return newMeeting;
    }
    
    getCompanyName(companyId) {
        const company = this.companies.find(c => c.id === companyId);
        return company ? company.name : 'Unknown Company';
    }
    
    confirmMeeting(meetingId) {
        const meeting = this.meetings.find(m => m.id === meetingId);
        if (!meeting) return;
        
        meeting.status = 'confirmed';
        meeting.confirmedAt = new Date().toISOString();
        
        this.saveAllData();
        this.displayMeetings();
        
        this.showNotification('Meeting Confirmed', 'Meeting has been confirmed', 'success');
    }
    
    cancelMeeting(meetingId, reason) {
        const meeting = this.meetings.find(m => m.id === meetingId);
        if (!meeting) return;
        
        meeting.status = 'cancelled';
        meeting.cancelledAt = new Date().toISOString();
        meeting.cancellationReason = reason;
        
        this.saveAllData();
        this.displayMeetings();
        
        this.showNotification('Meeting Cancelled', 'Meeting has been cancelled', 'warning');
    }
    
    getUpcomingMeetings() {
        const now = new Date();
        return this.meetings
            .filter(m => m.status !== 'cancelled' && new Date(m.dateTime) > now)
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    }
    
    getTodaysMeetings() {
        const today = new Date().toISOString().split('T')[0];
        return this.meetings.filter(m => {
            const meetingDate = new Date(m.dateTime).toISOString().split('T')[0];
            return meetingDate === today && m.status !== 'cancelled';
        });
    }
    
    // ===== UAE TIME FUNCTIONS =====
    
    getCurrentUAETime() {
        return new Date().toLocaleString('en-US', { timeZone: this.uaeTimezone });
    }
    
    formatUAEDate(date) {
        return new Date(date).toLocaleString('en-US', { 
            timeZone: this.uaeTimezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    isSlotAvailable(dateTime, duration, buffer) {
        const proposedStart = new Date(dateTime);
        const proposedEnd = new Date(proposedStart.getTime() + duration * 60000);
        
        // Check against existing meetings
        for (const meeting of this.meetings) {
            if (meeting.status === 'cancelled') continue;
            
            const meetingStart = new Date(meeting.dateTime);
            const meetingEnd = new Date(meetingStart.getTime() + meeting.duration * 60000);
            
            // Add buffer time
            const bufferedStart = new Date(meetingStart.getTime() - buffer * 60000);
            const bufferedEnd = new Date(meetingEnd.getTime() + buffer * 60000);
            
            // Check for overlap
            if (proposedStart < bufferedEnd && proposedEnd > bufferedStart) {
                return false;
            }
        }
        
        return true;
    }
    
    generateTimeSlots(date, startTime, endTime, duration, breakTime) {
        const slots = [];
        const start = new Date(`${date}T${startTime}:00`);
        const end = new Date(`${date}T${endTime}:00`);
        
        let current = new Date(start);
        
        while (current < end) {
            const slotEnd = new Date(current.getTime() + duration * 60000);
            
            if (slotEnd <= end) {
                const slotTime = current.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: this.uaeTimezone 
                });
                
                const isAvailable = this.isSlotAvailable(current, duration, 0);
                
                slots.push({
                    time: slotTime,
                    datetime: current.toISOString(),
                    available: isAvailable,
                    endTime: slotEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                });
            }
            
            // Move to next slot
            current = new Date(current.getTime() + (duration + breakTime) * 60000);
        }
        
        return slots;
    }
    
    // ===== REMINDER FUNCTIONS =====
    
    checkAllReminders() {
        this.checkMeetingReminders();
        
        if (this.settings.licenseReminders) {
            this.checkLicenseReminders();
        }
        
        this.checkTaskReminders();
    }
    
    checkMeetingReminders() {
        const now = new Date();
        const reminderTimes = [1440, 60, 30]; // 1 day, 1 hour, 30 minutes in minutes
        
        this.meetings.forEach(meeting => {
            if (meeting.status === 'cancelled' || meeting.status === 'completed') return;
            
            const meetingTime = new Date(meeting.dateTime);
            const minutesUntil = (meetingTime - now) / (1000 * 60);
            
            reminderTimes.forEach(reminderMin => {
                const reminderKey = `${reminderMin}min`;
                if (minutesUntil > 0 && minutesUntil <= reminderMin && !meeting.reminders?.[reminderKey]) {
                    this.sendMeetingReminder(meeting, reminderMin);
                    if (!meeting.reminders) meeting.reminders = {};
                    meeting.reminders[reminderKey] = true;
                }
            });
        });
        
        this.saveAllData();
    }
    
    sendMeetingReminder(meeting, minutesBefore) {
        const companyName = this.getCompanyName(meeting.companyId);
        let timeText = '';
        
        if (minutesBefore === 1440) timeText = '1 day';
        else if (minutesBefore === 60) timeText = '1 hour';
        else timeText = '30 minutes';
        
        const title = `📅 Meeting Reminder: ${companyName}`;
        const body = `${meeting.title} in ${timeText} at ${this.formatUAEDate(meeting.dateTime)}`;
        
        this.showNotification(title, body, 'warning');
        this.playAlertSound();
    }
    
    checkLicenseReminders() {
        const today = new Date();
        const reminderDays = [30, 14, 7, 1];
        
        this.companies.forEach(company => {
            const expiryDate = new Date(company.licenseExpiry);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            reminderDays.forEach(reminderDay => {
                if (daysUntilExpiry === reminderDay && !company[`licenseReminded_${reminderDay}`]) {
                    this.sendLicenseReminder(company, reminderDay);
                    company[`licenseReminded_${reminderDay}`] = true;
                }
            });
        });
        
        this.saveAllData();
    }
    
    sendLicenseReminder(company, daysLeft) {
        const title = `⚠️ License Expiry: ${company.name}`;
        const body = `License expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
        
        this.showNotification(title, body, 'danger');
        this.playAlertSound();
    }
    
    checkTaskReminders() {
        const now = new Date();
        const reminderMinutes = this.settings.reminderTime;
        
        this.tasks.forEach(task => {
            if (task.status === 'pending') {
                const deadline = new Date(task.deadline);
                const minutesLeft = (deadline - now) / (1000 * 60);
                
                if (minutesLeft > 0 && minutesLeft <= reminderMinutes && !task.reminded) {
                    this.sendTaskReminder(task, minutesLeft);
                    task.reminded = true;
                }
                
                if (minutesLeft < 0 && !task.overdueReminded) {
                    this.sendTaskOverdueReminder(task);
                    task.overdueReminded = true;
                }
            }
        });
        
        this.saveAllData();
    }
    
    sendTaskReminder(task, minutesLeft) {
        const title = `⏰ Task Due Soon: ${task.name}`;
        const body = `Due in ${Math.floor(minutesLeft)} minutes`;
        
        this.showNotification(title, body, 'warning');
        this.playAlertSound();
    }
    
    sendTaskOverdueReminder(task) {
        const title = `⚠️ Task Overdue: ${task.name}`;
        const body = `Task was due ${this.formatUAEDate(task.deadline)}`;
        
        this.showNotification(title, body, 'danger');
        this.playAlertSound();
    }
    
    // ===== DISPLAY FUNCTIONS =====
    
    refreshDisplays() {
        this.displayTasks();
        this.displayCompanies();
        this.displayMeetings();
        this.updateAllStats();
    }
    
    displayTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;
        
        let filteredTasks = this.tasks;
        
        if (this.currentFilter === 'pending') {
            filteredTasks = filteredTasks.filter(t => t.status === 'pending');
        } else if (this.currentFilter === 'completed') {
            filteredTasks = filteredTasks.filter(t => t.status === 'completed');
        } else if (this.currentFilter === 'overdue') {
            filteredTasks = filteredTasks.filter(t => this.isTaskOverdue(t));
        }
        
        if (this.searchTerms.tasks) {
            const searchLower = this.searchTerms.tasks.toLowerCase();
            filteredTasks = filteredTasks.filter(t => 
                t.name.toLowerCase().includes(searchLower) ||
                (t.description && t.description.toLowerCase().includes(searchLower))
            );
        }
        
        container.innerHTML = '';
        
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list fa-3x"></i>
                    <h3>No Tasks Found</h3>
                </div>
            `;
            return;
        }
        
        filteredTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        
        filteredTasks.forEach(task => {
            const element = this.createTaskElement(task);
            container.appendChild(element);
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
            timeLeftText = `${minutesLeft}m left`;
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
                    <span>Created: ${this.formatUAEDate(task.createdAt)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span>Due: ${this.formatUAEDate(task.deadline)}</span>
                </div>
            </div>
            <div class="task-footer">
                <div class="task-due ${timeDiff < 0 ? 'overdue' : ''}">
                    <i class="fas fa-hourglass-half"></i>
                    <span>${timeLeftText}</span>
                </div>
                <div class="task-actions">
                    ${task.status === 'pending' ? `
                        <button class="action-btn complete-task" data-id="${task.id}" title="Complete">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete-task" data-id="${task.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        return div;
    }
    
    isTaskOverdue(task) {
        return task.status === 'pending' && new Date(task.deadline) < new Date();
    }
    
    completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            task.completedAt = new Date().toISOString();
            this.saveAllData();
            this.displayTasks();
            this.showNotification('Task Completed', 'Great job!', 'success');
        }
    }
    
    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveAllData();
        this.displayTasks();
        this.updateAllStats();
    }
    
    displayCompanies() {
        const container = document.getElementById('companiesContainer');
        if (!container) return;
        
        let filteredCompanies = this.companies;
        
        if (this.currentCompanyFilter === 'active') {
            filteredCompanies = filteredCompanies.filter(c => c.status === 'active');
        } else if (this.currentCompanyFilter === 'expiring') {
            filteredCompanies = filteredCompanies.filter(c => c.status === 'expiring-soon');
        } else if (this.currentCompanyFilter === 'expired') {
            filteredCompanies = filteredCompanies.filter(c => c.status === 'expired');
        }
        
        if (this.searchTerms.companies) {
            const searchLower = this.searchTerms.companies.toLowerCase();
            filteredCompanies = filteredCompanies.filter(c => 
                c.name.toLowerCase().includes(searchLower) ||
                c.licenseNumber.toLowerCase().includes(searchLower) ||
                (c.contactPerson && c.contactPerson.toLowerCase().includes(searchLower))
            );
        }
        
        container.innerHTML = '';
        
        if (filteredCompanies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-building fa-3x"></i>
                    <h3>No Companies Found</h3>
                </div>
            `;
            return;
        }
        
        filteredCompanies.sort((a, b) => {
            if (a.status === 'expired' && b.status !== 'expired') return -1;
            if (a.status !== 'expired' && b.status === 'expired') return 1;
            return new Date(a.licenseExpiry) - new Date(b.licenseExpiry);
        });
        
        filteredCompanies.forEach(company => {
            const element = this.createCompanyElement(company);
            container.appendChild(element);
        });
    }
    
    createCompanyElement(company) {
        const div = document.createElement('div');
        div.className = `company-item ${company.status}`;
        
        const expiryDate = new Date(company.licenseExpiry);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        let expiryText = '';
        if (daysUntilExpiry < 0) expiryText = `Expired ${Math.abs(daysUntilExpiry)} days ago`;
        else if (daysUntilExpiry === 0) expiryText = 'Expires today!';
        else expiryText = `Expires in ${daysUntilExpiry} days`;
        
        const documents = this.getDocumentsForTarget('company', company.id);
        
        div.innerHTML = `
            <div class="company-header">
                <div class="company-title">
                    <i class="fas fa-building"></i>
                    <h3>${company.name}</h3>
                    <span class="status-badge status-${company.status}">
                        ${company.status === 'active' ? 'Active' : company.status === 'expiring-soon' ? 'Expiring Soon' : 'Expired'}
                    </span>
                </div>
                <div class="company-actions">
                    <button class="action-btn view-company" data-id="${company.id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit-company" data-id="${company.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-company" data-id="${company.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="company-details">
                <div class="detail-row">
                    <i class="fas fa-id-card"></i>
                    <span><strong>License:</strong> ${company.licenseNumber}</span>
                </div>
                <div class="detail-row">
                    <i class="fas fa-calendar-alt"></i>
                    <span><strong>Expiry:</strong> ${expiryDate.toLocaleDateString()} (${expiryText})</span>
                </div>
                <div class="detail-row">
                    <i class="fas fa-map-marker-alt"></i>
                    <span><strong>Address:</strong> ${company.address}</span>
                </div>
                <div class="detail-row">
                    <i class="fab fa-whatsapp"></i>
                    <span><strong>WhatsApp:</strong> ${company.whatsapp}</span>
                </div>
            </div>
            
            <div class="company-footer">
                <span class="meeting-count">
                    <i class="fas fa-calendar-check"></i>
                    Meetings: ${this.meetings.filter(m => m.companyId === company.id).length}
                </span>
                <span class="document-count">
                    <i class="fas fa-file-alt"></i>
                    Docs: ${documents.length}
                </span>
                <button class="btn-small upload-doc" data-target="company" data-id="${company.id}">
                    <i class="fas fa-upload"></i> Upload
                </button>
            </div>
        `;
        
        return div;
    }
    
    displayMeetings() {
        const container = document.getElementById('meetingsContainer');
        if (!container) return;
        
        let filteredMeetings = this.meetings;
        const now = new Date();
        
        if (this.currentMeetingFilter === 'upcoming') {
            filteredMeetings = filteredMeetings.filter(m => 
                m.status !== 'cancelled' && new Date(m.dateTime) > now
            );
        } else if (this.currentMeetingFilter === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            filteredMeetings = filteredMeetings.filter(m => {
                const meetingDate = new Date(m.dateTime).toISOString().split('T')[0];
                return meetingDate === todayStr && m.status !== 'cancelled';
            });
        } else if (this.currentMeetingFilter === 'pending') {
            filteredMeetings = filteredMeetings.filter(m => m.status === 'pending');
        } else if (this.currentMeetingFilter === 'past') {
            filteredMeetings = filteredMeetings.filter(m => 
                new Date(m.dateTime) < now || m.status === 'completed'
            );
        }
        
        if (this.searchTerms.meetings) {
            const searchLower = this.searchTerms.meetings.toLowerCase();
            filteredMeetings = filteredMeetings.filter(m => 
                m.title.toLowerCase().includes(searchLower) ||
                this.getCompanyName(m.companyId).toLowerCase().includes(searchLower)
            );
        }
        
        container.innerHTML = '';
        
        if (filteredMeetings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times fa-3x"></i>
                    <h3>No Meetings Found</h3>
                </div>
            `;
            return;
        }
        
        filteredMeetings.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
        
        filteredMeetings.forEach(meeting => {
            const element = this.createMeetingElement(meeting);
            container.appendChild(element);
        });
        
        this.displayTodaysMeetings();
    }
    
    createMeetingElement(meeting) {
        const div = document.createElement('div');
        div.className = `meeting-item ${meeting.status}`;
        
        const companyName = this.getCompanyName(meeting.companyId);
        const meetingTime = new Date(meeting.dateTime);
        const now = new Date();
        const timeUntil = meetingTime - now;
        const hoursUntil = timeUntil / (1000 * 60 * 60);
        
        let statusText = '';
        if (meeting.status === 'cancelled') statusText = 'Cancelled';
        else if (meeting.status === 'confirmed') statusText = 'Confirmed';
        else if (meeting.status === 'pending') statusText = 'Pending';
        else if (meetingTime < now) statusText = 'Past';
        else if (hoursUntil < 1) statusText = 'Starting soon!';
        else statusText = 'Scheduled';
        
        const documents = this.getDocumentsForTarget('meeting', meeting.id);
        
        div.innerHTML = `
            <div class="meeting-header">
                <div class="meeting-title">
                    <i class="fas fa-calendar-check"></i>
                    <h3>${meeting.title}</h3>
                    <span class="status-badge status-${meeting.status}">${statusText}</span>
                </div>
                <div class="meeting-actions">
                    <button class="action-btn view-meeting" data-id="${meeting.id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${meeting.status === 'scheduled' ? `
                        <button class="action-btn confirm-meeting" data-id="${meeting.id}" title="Confirm">
                            <i class="fas fa-check-circle"></i>
                        </button>
                    ` : ''}
                    ${meeting.status !== 'cancelled' ? `
                        <button class="action-btn cancel-meeting" data-id="${meeting.id}" title="Cancel">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="meeting-company">
                <i class="fas fa-building"></i>
                <strong>${companyName}</strong>
            </div>
            
            <div class="meeting-datetime">
                <div class="datetime-row">
                    <i class="fas fa-calendar"></i>
                    <span>${meetingTime.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</span>
                </div>
                <div class="datetime-row">
                    <i class="fas fa-clock"></i>
                    <span>${meetingTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })} (UAE) - ${meeting.duration} min</span>
                </div>
            </div>
            
            ${meeting.agenda ? `
                <div class="meeting-agenda">
                    <i class="fas fa-sticky-note"></i>
                    <p>${meeting.agenda}</p>
                </div>
            ` : ''}
            
            <div class="meeting-footer">
                <span class="platform-badge">
                    <i class="fas fa-video"></i>
                    ${meeting.platform || 'Not specified'}
                </span>
                ${meeting.link ? `
                    <a href="${meeting.link}" target="_blank" class="meeting-link">
                        <i class="fas fa-link"></i> Join
                    </a>
                ` : ''}
                <span class="document-count">
                    <i class="fas fa-file-alt"></i>
                    Docs: ${documents.length}
                </span>
                <button class="btn-small upload-doc" data-target="meeting" data-id="${meeting.id}">
                    <i class="fas fa-upload"></i>
                </button>
            </div>
        `;
        
        return div;
    }
    
    displayTodaysMeetings() {
        const container = document.getElementById('todayMeetingsList');
        if (!container) return;
        
        const todayMeetings = this.getTodaysMeetings();
        
        if (todayMeetings.length === 0) {
            container.innerHTML = '<p class="no-meetings">No meetings scheduled for today</p>';
            return;
        }
        
        container.innerHTML = todayMeetings.map(meeting => {
            const meetingTime = new Date(meeting.dateTime);
            const companyName = this.getCompanyName(meeting.companyId);
            
            return `
                <div class="today-meeting-item">
                    <div class="today-meeting-time">
                        ${meetingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="today-meeting-info">
                        <strong>${companyName}</strong>
                        <span>${meeting.title}</span>
                    </div>
                    ${meeting.link ? `
                        <a href="${meeting.link}" target="_blank" class="join-now-btn">
                            Join
                        </a>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    populateCompanySelects() {
        const select = document.getElementById('meetingCompany');
        if (!select) return;
        
        select.innerHTML = '<option value="">Choose a company...</option>';
        
        this.companies
            .filter(c => c.status !== 'expired')
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = `${company.name} (${company.licenseNumber})`;
                select.appendChild(option);
            });
    }
    
    updateCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        document.getElementById('currentMonthYear').textContent = 
            now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        
        let calendarHTML = '';
        
        for (let i = 0; i < firstDay.getDay(); i++) {
            calendarHTML += '<div class="calendar-day empty"></div>';
        }
        
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dateStr = date.toISOString().split('T')[0];
            
            const meetingsOnDay = this.meetings.filter(m => {
                const meetingDate = new Date(m.dateTime).toISOString().split('T')[0];
                return meetingDate === dateStr && m.status !== 'cancelled';
            }).length;
            
            const isToday = date.toDateString() === new Date().toDateString();
            
            calendarHTML += `
                <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${meetingsOnDay > 0 ? `
                        <span class="meeting-indicator">${meetingsOnDay}</span>
                    ` : ''}
                </div>
            `;
        }
        
        calendarGrid.innerHTML = calendarHTML;
    }
    
    updateAllStats() {
        document.getElementById('totalCompanies').textContent = this.companies.length;
        document.getElementById('totalMeetings').textContent = this.meetings.length;
        
        const totalTasks = this.tasks.length;
        const pendingTasks = this.tasks.filter(t => t.status === 'pending').length;
        document.getElementById('globalStats').innerHTML = `
            <span>Tasks: ${totalTasks} (${pendingTasks}) | Companies: ${this.companies.length} | Meetings: ${this.meetings.length}</span>
        `;
    }
    
    updateUAETime() {
        const updateTime = () => {
            const uaeTime = new Date().toLocaleString('en-US', { 
                timeZone: this.uaeTimezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            document.getElementById('uaeTime').textContent = uaeTime;
        };
        
        updateTime();
        setInterval(updateTime, 1000);
    }
    
    // ===== UI FUNCTIONS =====
    
    showNotification(title, message, type = 'info') {
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
            
            // Limit to 10 notifications
            while (panel.children.length > 10) {
                panel.removeChild(panel.lastChild);
            }
            
            this.showNotificationPanel();
        }
        
        if (this.settings.desktopNotifications && this.notificationPermission) {
            new Notification(title, { body: message });
        }
        
        console.log(`${title}: ${message}`);
    }
    
    showNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.style.display = 'block';
            setTimeout(() => {
                panel.style.display = 'none';
            }, 10000);
        }
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
    
    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                this.notificationPermission = permission === 'granted';
            } else {
                this.notificationPermission = Notification.permission === 'granted';
            }
            this.updateReminderStatus();
        }
    }
    
    updateReminderStatus() {
        const statusEl = document.getElementById('reminderStatus');
        if (this.notificationPermission) {
            statusEl.innerHTML = '<i class="fas fa-bell"></i> Reminders: On';
            statusEl.style.background = '#d4edda';
            statusEl.style.color = '#155724';
        } else {
            statusEl.innerHTML = '<i class="fas fa-bell-slash"></i> Reminders: Off';
            statusEl.style.background = '#f8d7da';
            statusEl.style.color = '#721c24';
        }
    }
    
    updateLastSaved() {
        const lastSave = localStorage.getItem('businessLastSave');
        if (lastSave) {
            const date = new Date(lastSave);
            document.getElementById('lastSaved').textContent = 
                `Last saved: ${date.toLocaleTimeString()}`;
        }
    }
    
    setupIntervals() {
        setInterval(() => {
            this.checkAllReminders();
        }, 60000);
        
        setInterval(() => {
            this.saveAllData();
        }, this.settings.autoSaveInterval * 60000);
    }
    
    // ===== EVENT LISTENERS =====
    
    initEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                e.target.closest('.tab-btn').classList.add('active');
                const tabId = e.target.closest('.tab-btn').dataset.tab;
                document.getElementById(`${tabId}Tab`).classList.add('active');
                this.currentTab = tabId;
            });
        });
        
        // Add Task
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.handleAddTask();
        });
        
        // Add Company
        document.getElementById('addCompanyBtn').addEventListener('click', () => {
            this.handleAddCompany();
        });
        
        // Schedule Meeting
        document.getElementById('scheduleMeetingBtn').addEventListener('click', () => {
            this.handleScheduleMeeting();
        });
        
        // Check Availability
        document.getElementById('checkAvailabilityBtn').addEventListener('click', () => {
            this.handleCheckAvailability();
        });
        
        // Generate Slots
        document.getElementById('generateSlotsBtn').addEventListener('click', () => {
            this.handleGenerateSlots();
        });
        
        // Copy Slots
        document.getElementById('copySlotsBtn').addEventListener('click', () => {
            this.handleCopySlots();
        });
        
        // Task Filters
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.displayTasks();
            });
        });
        
        // Company Filters
        document.querySelectorAll('[data-company-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-company-filter]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCompanyFilter = e.target.dataset.companyFilter;
                this.displayCompanies();
            });
        });
        
        // Meeting Filters
        document.querySelectorAll('[data-meeting-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-meeting-filter]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentMeetingFilter = e.target.dataset.meetingFilter;
                this.displayMeetings();
            });
        });
        
        // Search inputs
        document.getElementById('taskSearch').addEventListener('input', (e) => {
            this.searchTerms.tasks = e.target.value;
            this.displayTasks();
        });
        
        document.getElementById('companySearch').addEventListener('input', (e) => {
            this.searchTerms.companies = e.target.value;
            this.displayCompanies();
        });
        
        document.getElementById('meetingSearch').addEventListener('input', (e) => {
            this.searchTerms.meetings = e.target.value;
            this.displayMeetings();
        });
        
        // Task actions delegation
        document.getElementById('tasksContainer').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const taskId = parseInt(target.dataset.id);
            
            if (target.classList.contains('complete-task')) {
                this.completeTask(taskId);
            } else if (target.classList.contains('delete-task')) {
                if (confirm('Delete this task?')) {
                    this.deleteTask(taskId);
                }
            }
        });
        
        // Company actions delegation
        document.getElementById('companiesContainer').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const companyId = parseInt(target.dataset.id);
            
            if (target.classList.contains('view-company')) {
                this.showCompanyDetails(companyId);
            } else if (target.classList.contains('edit-company')) {
                this.editCompany(companyId);
            } else if (target.classList.contains('delete-company')) {
                this.deleteCompany(companyId);
            } else if (target.classList.contains('upload-doc')) {
                const targetType = target.dataset.target;
                this.openDocumentUpload(targetType, companyId);
            }
        });
        
        // Meeting actions delegation
        document.getElementById('meetingsContainer').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const meetingId = parseInt(target.dataset.id);
            
            if (target.classList.contains('view-meeting')) {
                this.showMeetingDetails(meetingId);
            } else if (target.classList.contains('confirm-meeting')) {
                this.confirmMeeting(meetingId);
            } else if (target.classList.contains('cancel-meeting')) {
                const reason = prompt('Reason for cancellation:');
                if (reason) this.cancelMeeting(meetingId, reason);
            } else if (target.classList.contains('upload-doc')) {
                const targetType = target.dataset.target;
                this.openDocumentUpload(targetType, meetingId);
            }
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
            today.setHours(18, 0, 0);
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
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });
        
        // Export buttons
        document.getElementById('exportCompaniesBtn').addEventListener('click', () => {
            this.exportCompanies();
        });
        
        document.getElementById('exportMeetingsBtn').addEventListener('click', () => {
            this.exportMeetings();
        });
        
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportAllData();
        });
        
        // Import button in settings
        document.getElementById('importData').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                if (e.target.files.length > 0) {
                    this.importData(e.target.files[0]);
                }
            };
            input.click();
        });
        
        // Company file upload
        document.getElementById('companyDocuments').addEventListener('change', (e) => {
            const files = e.target.files;
            const container = document.getElementById('uploadedFiles');
            container.innerHTML = '';
            
            for (let i = 0; i < files.length; i++) {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'uploaded-file';
                fileDiv.innerHTML = `
                    <i class="fas fa-file"></i>
                    <span>${files[i].name}</span>
                    <small>${(files[i].size / 1024).toFixed(1)} KB</small>
                `;
                container.appendChild(fileDiv);
            }
        });
        
        // Document modal upload
        document.getElementById('uploadDocumentsBtn').addEventListener('click', () => {
            const files = document.getElementById('documentFile').files;
            const targetType = document.getElementById('docTargetType').value;
            const targetId = parseInt(document.getElementById('docTargetId').value);
            const docType = document.getElementById('docType').value;
            
            if (files.length === 0 || !targetId) {
                this.showNotification('Error', 'Please select files and target', 'danger');
                return;
            }
            
            this.uploadMultipleFiles(files, targetType, targetId, docType);
            document.getElementById('documentModal').classList.remove('active');
            document.getElementById('documentFile').value = '';
        });
        
        // Notification toggle
        document.getElementById('notificationToggle').addEventListener('click', () => {
            this.requestNotificationPermission();
        });
        
        // Clear notifications
        document.getElementById('clearNotifications').addEventListener('click', () => {
            document.getElementById('notificationsList').innerHTML = '';
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });
        
        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Reset company form
        document.getElementById('resetCompanyForm').addEventListener('click', () => {
            this.resetCompanyForm();
        });
    }
    
    handleAddTask() {
        const name = document.getElementById('taskName').value.trim();
        const description = document.getElementById('taskDesc').value.trim();
        const date = document.getElementById('taskDate').value;
        const time = document.getElementById('taskTime').value;
        const priority = document.querySelector('.priority-btn.active').dataset.priority;
        
        if (!name || !date || !time) {
            this.showNotification('Error', 'Please fill all required fields', 'danger');
            return;
        }
        
        const newTask = {
            id: this.tasks.length > 0 ? Math.max(...this.tasks.map(t => t.id)) + 1 : 1,
            name,
            description,
            deadline: `${date} ${time}`,
            priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            reminded: false,
            overdueReminded: false
        };
        
        this.tasks.push(newTask);
        this.saveAllData();
        this.displayTasks();
        this.updateAllStats();
        
        document.getElementById('taskName').value = '';
        document.getElementById('taskDesc').value = '';
        
        this.showNotification('Task Added', 'Task has been added successfully', 'success');
    }
    
    handleAddCompany() {
        const companyData = {
            name: document.getElementById('companyName').value.trim(),
            licenseNumber: document.getElementById('licenseNumber').value.trim(),
            licenseExpiry: document.getElementById('licenseExpiry').value,
            industry: document.getElementById('companyIndustry').value,
            address: document.getElementById('companyAddress').value.trim(),
            whatsapp: document.getElementById('companyWhatsapp').value.trim(),
            phone: document.getElementById('companyPhone').value.trim(),
            email: document.getElementById('companyEmail').value.trim(),
            website: document.getElementById('companyWebsite').value.trim(),
            contactPerson: document.getElementById('contactPerson').value.trim(),
            notes: document.getElementById('companyNotes').value.trim()
        };
        
        if (!companyData.name || !companyData.licenseNumber || !companyData.licenseExpiry || 
            !companyData.address || !companyData.whatsapp) {
            this.showNotification('Error', 'Please fill all required fields', 'danger');
            return;
        }
        
        this.addCompany(companyData);
        this.resetCompanyForm();
    }
    
    handleScheduleMeeting() {
        const companyId = parseInt(document.getElementById('meetingCompany').value);
        const title = document.getElementById('meetingTitle').value.trim();
        const date = document.getElementById('meetingDate').value;
        const time = document.getElementById('meetingTime').value;
        const duration = parseInt(document.getElementById('meetingDuration').value);
        const buffer = parseInt(document.getElementById('meetingBuffer').value);
        const platform = document.getElementById('meetingPlatform').value;
        const link = document.getElementById('meetingLink').value.trim();
        const agenda = document.getElementById('meetingAgenda').value.trim();
        
        const requiredDocs = [];
        document.querySelectorAll('.doc-required:checked').forEach(cb => {
            requiredDocs.push(cb.value);
        });
        
        if (!companyId || !title || !date || !time) {
            this.showNotification('Error', 'Please fill all required fields', 'danger');
            return;
        }
        
        const meetingData = {
            companyId,
            title,
            dateTime: `${date}T${time}:00`,
            duration,
            buffer,
            platform,
            link,
            agenda,
            requiredDocs,
            status: 'scheduled'
        };
        
        const meeting = this.scheduleMeeting(meetingData);
        
        if (meeting) {
            document.getElementById('meetingTitle').value = '';
            document.getElementById('meetingLink').value = '';
            document.getElementById('meetingAgenda').value = '';
            document.querySelectorAll('.doc-required').forEach(cb => cb.checked = false);
            document.getElementById('availabilityResult').innerHTML = '';
        }
    }
    
    handleCheckAvailability() {
        const date = document.getElementById('meetingDate').value;
        const time = document.getElementById('meetingTime').value;
        const duration = parseInt(document.getElementById('meetingDuration').value);
        const buffer = parseInt(document.getElementById('meetingBuffer').value);
        
        if (!date || !time) {
            this.showNotification('Error', 'Please select date and time', 'danger');
            return;
        }
        
        const dateTime = `${date}T${time}:00`;
        const isAvailable = this.isSlotAvailable(dateTime, duration, buffer);
        
        const resultDiv = document.getElementById('availabilityResult');
        const scheduleBtn = document.getElementById('scheduleMeetingBtn');
        
        if (isAvailable) {
            resultDiv.innerHTML = `
                <div class="availability-available">
                    <i class="fas fa-check-circle"></i>
                    Slot is available!
                </div>
            `;
            scheduleBtn.disabled = false;
        } else {
            resultDiv.innerHTML = `
                <div class="availability-unavailable">
                    <i class="fas fa-times-circle"></i>
                    Slot is not available
                </div>
            `;
            scheduleBtn.disabled = true;
        }
    }
    
    handleGenerateSlots() {
        const date = document.getElementById('slotDate').value;
        const startTime = document.getElementById('workStart').value;
        const endTime = document.getElementById('workEnd').value;
        const duration = parseInt(document.getElementById('slotDuration').value);
        const breakTime = parseInt(document.getElementById('slotBreak').value);
        
        if (!date) {
            this.showNotification('Error', 'Please select a date', 'danger');
            return;
        }
        
        const slots = this.generateTimeSlots(date, startTime, endTime, duration, breakTime);
        
        const slotsDiv = document.getElementById('generatedSlots');
        const copyBtn = document.getElementById('copySlotsBtn');
        
        const availableSlots = slots.filter(s => s.available);
        
        slotsDiv.innerHTML = `
            <h4>Available Slots for ${new Date(date).toLocaleDateString()}:</h4>
            <div class="slots-grid">
                ${slots.map(slot => `
                    <div class="slot-item ${slot.available ? 'available' : 'unavailable'}">
                        <span class="slot-time">${slot.time}</span>
                        <span class="slot-status">${slot.available ? '✓' : '✗'}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        if (availableSlots.length > 0) {
            copyBtn.style.display = 'block';
            copyBtn.dataset.slots = JSON.stringify(availableSlots);
        } else {
            copyBtn.style.display = 'none';
        }
    }
    
    handleCopySlots() {
        const slotsData = document.getElementById('copySlotsBtn').dataset.slots;
        if (!slotsData) return;
        
        const slots = JSON.parse(slotsData);
        const date = document.getElementById('slotDate').value;
        
        let message = `Available meeting slots for ${new Date(date).toLocaleDateString()} (UAE Time):\n\n`;
        slots.forEach(slot => {
            message += `• ${slot.time} - ${slot.endTime}\n`;
        });
        
        navigator.clipboard.writeText(message).then(() => {
            this.showNotification('Copied!', 'Slots copied to clipboard', 'success');
        });
    }
    
    resetCompanyForm() {
        document.getElementById('companyName').value = '';
        document.getElementById('licenseNumber').value = '';
        document.getElementById('licenseExpiry').value = '';
        document.getElementById('companyIndustry').value = '';
        document.getElementById('companyAddress').value = '';
        document.getElementById('companyWhatsapp').value = '';
        document.getElementById('companyPhone').value = '';
        document.getElementById('companyEmail').value = '';
        document.getElementById('companyWebsite').value = '';
        document.getElementById('contactPerson').value = '';
        document.getElementById('companyNotes').value = '';
        document.getElementById('uploadedFiles').innerHTML = '';
    }
    
    openDocumentUpload(targetType, targetId) {
        const modal = document.getElementById('documentModal');
        const targetSelect = document.getElementById('docTargetId');
        
        document.getElementById('docTargetType').value = targetType;
        
        targetSelect.innerHTML = '';
        
        if (targetType === 'company') {
            const company = this.companies.find(c => c.id === targetId);
            if (company) {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                targetSelect.appendChild(option);
            }
        } else {
            const meeting = this.meetings.find(m => m.id === targetId);
            if (meeting) {
                const option = document.createElement('option');
                option.value = meeting.id;
                option.textContent = meeting.title;
                targetSelect.appendChild(option);
            }
        }
        
        modal.classList.add('active');
    }
    
    showCompanyDetails(companyId) {
        const company = this.companies.find(c => c.id === companyId);
        if (!company) return;
        
        const modal = document.getElementById('companyDetailsModal');
        const content = document.getElementById('companyDetailsContent');
        
        const meetings = this.meetings.filter(m => m.companyId === companyId);
        const documents = this.getDocumentsForTarget('company', companyId);
        
        content.innerHTML = `
            <div class="company-detail-view">
                <h2>${company.name}</h2>
                
                <div class="detail-section">
                    <h3><i class="fas fa-id-card"></i> License Information</h3>
                    <p><strong>Number:</strong> ${company.licenseNumber}</p>
                    <p><strong>Expiry:</strong> ${new Date(company.licenseExpiry).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${company.status}">${company.status}</span></p>
                </div>
                
                <div class="detail-section">
                    <h3><i class="fas fa-address-card"></i> Contact Information</h3>
                    <p><strong>Address:</strong> ${company.address}</p>
                    <p><strong>WhatsApp:</strong> ${company.whatsapp}</p>
                    ${company.phone ? `<p><strong>Phone:</strong> ${company.phone}</p>` : ''}
                    ${company.email ? `<p><strong>Email:</strong> ${company.email}</p>` : ''}
                    ${company.contactPerson ? `<p><strong>Contact:</strong> ${company.contactPerson}</p>` : ''}
                </div>
                
                <div class="detail-section">
                    <h3><i class="fas fa-file-alt"></i> Documents (${documents.length})</h3>
                    ${documents.length > 0 ? `
                        <ul class="document-list">
                            ${documents.map(doc => `
                                <li>
                                    <i class="fas fa-file-${doc.fileType.includes('pdf') ? 'pdf' : 'image'}"></i>
                                    <a href="${doc.dataUrl}" download="${doc.name}">${doc.name}</a>
                                    <small>(${(doc.fileSize / 1024).toFixed(1)} KB)</small>
                                    <button class="btn-small delete-doc" data-id="${doc.id}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p>No documents uploaded</p>'}
                </div>
                
                <div class="button-group">
                    <button class="btn-secondary" onclick="window.businessManager.openDocumentUpload('company', ${companyId})">
                        <i class="fas fa-upload"></i> Upload Documents
                    </button>
                </div>
            </div>
        `;
        
        // Add delete document handlers
        content.querySelectorAll('.delete-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docId = parseInt(e.target.closest('button').dataset.id);
                if (confirm('Delete this document?')) {
                    this.deleteDocument(docId);
                    this.showCompanyDetails(companyId); // Refresh
                }
            });
        });
        
        modal.classList.add('active');
    }
    
    showMeetingDetails(meetingId) {
        const meeting = this.meetings.find(m => m.id === meetingId);
        if (!meeting) return;
        
        const modal = document.getElementById('meetingDetailsModal');
        const content = document.getElementById('meetingDetailsContent');
        
        const company = this.companies.find(c => c.id === meeting.companyId);
        const documents = this.getDocumentsForTarget('meeting', meetingId);
        
        content.innerHTML = `
            <div class="meeting-detail-view">
                <h2>${meeting.title}</h2>
                
                <div class="detail-section">
                    <h3><i class="fas fa-building"></i> Company</h3>
                    <p><strong>Name:</strong> ${company ? company.name : 'Unknown'}</p>
                    <p><strong>License:</strong> ${company ? company.licenseNumber : 'N/A'}</p>
                </div>
                
                <div class="detail-section">
                    <h3><i class="fas fa-clock"></i> Meeting Details</h3>
                    <p><strong>Date:</strong> ${new Date(meeting.dateTime).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${new Date(meeting.dateTime).toLocaleTimeString()} (UAE)</p>
                    <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
                    <p><strong>Platform:</strong> ${meeting.platform || 'Not specified'}</p>
                    ${meeting.link ? `
                        <p><strong>Link:</strong> <a href="${meeting.link}" target="_blank">Join Meeting</a></p>
                    ` : ''}
                    <p><strong>Status:</strong> <span class="status-badge status-${meeting.status}">${meeting.status}</span></p>
                </div>
                
                ${meeting.agenda ? `
                    <div class="detail-section">
                        <h3><i class="fas
