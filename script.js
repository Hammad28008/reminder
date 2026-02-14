class BusinessManager {
    constructor() {
        // Data storage
        this.tasks = [];
        this.companies = [];
        this.meetings = [];
        this.documents = [];
        
        // UI State
        this.currentTab = 'tasks';
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
        
        // Load documents
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
    
    // UAE Time Functions
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
    
    // Company Functions
    addCompany(companyData) {
        const newCompany = {
            id: this.companies.length > 0 ? Math.max(...this.companies.map(c => c.id)) + 1 : 1,
            ...companyData,
            createdAt: new Date().toISOString(),
            documents: companyData.documents || [],
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
        if (!confirm('Are you sure you want to delete this company? All related meetings will also be deleted.')) return;
        
        // Delete related meetings
        this.meetings = this.meetings.filter(m => m.companyId !== companyId);
        
        // Delete company
        this.companies = this.companies.filter(c => c.id !== companyId);
        
        this.saveAllData();
        this.displayCompanies();
        this.displayMeetings();
        this.populateCompanySelects();
        this.updateAllStats();
        
        this.showNotification('Company Deleted', 'Company has been removed', 'warning');
    }
    
    // Meeting Functions
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
    
    confirmMeeting(meetingId, documents) {
        const meeting = this.meetings.find(m => m.id === meetingId);
        if (!meeting) return;
        
        meeting.status = 'confirmed';
        meeting.confirmedAt = new Date().toISOString();
        meeting.documents = [...(meeting.documents || []), ...documents];
        
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
    
    // Document Functions
    addDocument(documentData, file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const newDoc = {
                    id: this.documents.length > 0 ? Math.max(...this.documents.map(d => d.id)) + 1 : 1,
                    ...documentData,
                    fileData: e.target.result,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    uploadedAt: new Date().toISOString()
                };
                
                this.documents.push(newDoc);
                
                // Link to company or meeting
                if (documentData.targetType === 'company') {
                    const company = this.companies.find(c => c.id === documentData.targetId);
                    if (company) {
                        if (!company.documents) company.documents = [];
                        company.documents.push(newDoc.id);
                    }
                } else if (documentData.targetType === 'meeting') {
                    const meeting = this.meetings.find(m => m.id === documentData.targetId);
                    if (meeting) {
                        if (!meeting.documents) meeting.documents = [];
                        meeting.documents.push(newDoc.id);
                    }
                }
                
                this.saveAllData();
                resolve(newDoc);
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    getDocumentsForTarget(targetType, targetId) {
        const target = targetType === 'company' 
            ? this.companies.find(c => c.id === targetId)
            : this.meetings.find(m => m.id === targetId);
            
        if (!target || !target.documents) return [];
        
        return this.documents.filter(doc => target.documents.includes(doc.id));
    }
    
    // Reminder Functions
    checkAllReminders() {
        // Check meeting reminders
        this.checkMeetingReminders();
        
        // Check license expiry reminders
        if (this.settings.licenseReminders) {
            this.checkLicenseReminders();
        }
        
        // Check task reminders (existing)
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
                if (minutesUntil > 0 && minutesUntil <= reminderMin && !meeting.reminders[reminderKey]) {
                    this.sendMeetingReminder(meeting, reminderMin);
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
        
        // Add to notification panel
        this.addToNotificationPanel(title, body, 'warning');
    }
    
    checkLicenseReminders() {
        const today = new Date();
        const reminderDays = [30, 14, 7, 1]; // 30 days, 14 days, 7 days, 1 day
        
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
        
        this.addToNotificationPanel(title, body, 'danger');
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
        this.addToNotificationPanel(title, body, 'warning');
    }
    
    sendTaskOverdueReminder(task) {
        const title = `⚠️ Task Overdue: ${task.name}`;
        const body = `Task was due ${this.formatUAEDate(task.deadline)}`;
        
        this.showNotification(title, body, 'danger');
        this.playAlertSound();
        this.addToNotificationPanel(title, body, 'danger');
    }
    
    // Display Functions
    displayCompanies() {
        const container = document.getElementById('companiesContainer');
        if (!container) return;
        
        let filteredCompanies = this.companies;
        
        // Apply filter
        if (this.currentCompanyFilter === 'active') {
            filteredCompanies = filteredCompanies.filter(c => c.status === 'active');
        } else if (this.currentCompanyFilter === 'expiring') {
            filteredCompanies = filteredCompanies.filter(c => c.status === 'expiring-soon');
        } else if (this.currentCompanyFilter === 'expired') {
            filteredCompanies = filteredCompanies.filter(c => c.status === 'expired');
        }
        
        // Apply search
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
                    <p>Add your first company using the form</p>
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
                    <button class="action-btn schedule-meeting" data-id="${company.id}" title="Schedule Meeting">
                        <i class="fas fa-calendar-plus"></i>
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
                ${company.phone ? `
                <div class="detail-row">
                    <i class="fas fa-phone"></i>
                    <span><strong>Phone:</strong> ${company.phone}</span>
                </div>
                ` : ''}
                ${company.email ? `
                <div class="detail-row">
                    <i class="fas fa-envelope"></i>
                    <span><strong>Email:</strong> ${company.email}</span>
                </div>
                ` : ''}
                ${company.contactPerson ? `
                <div class="detail-row">
                    <i class="fas fa-user"></i>
                    <span><strong>Contact:</strong> ${company.contactPerson}</span>
                </div>
                ` : ''}
                ${company.industry ? `
                <div class="detail-row">
                    <i class="fas fa-industry"></i>
                    <span><strong>Industry:</strong> ${company.industry}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="company-footer">
                <span class="meeting-count">
                    <i class="fas fa-calendar-check"></i>
                    Meetings: ${this.meetings.filter(m => m.companyId === company.id).length}
                </span>
                <span class="document-count">
                    <i class="fas fa-file-alt"></i>
                    Docs: ${company.documents ? company.documents.length : 0}
                </span>
                <button class="btn-small upload-doc" data-company="${company.id}">
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
        
        // Apply filter
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
        
        // Apply search
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
                    <p>Schedule your first meeting</p>
                </div>
            `;
            return;
        }
        
        filteredMeetings.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
        
        filteredMeetings.forEach(meeting => {
            const element = this.createMeetingElement(meeting);
            container.appendChild(element);
        });
        
        // Update today's meetings
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
        else if (meeting.status === 'pending') statusText = 'Pending Confirmation';
        else if (meetingTime < now) statusText = 'Past';
        else if (hoursUntil < 1) statusText = 'Starting soon!';
        else statusText = 'Scheduled';
        
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
                    <button class="action-btn confirm-meeting" data-id="${meeting.id}" title="Confirm Meeting">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="action-btn cancel-meeting" data-id="${meeting.id}" title="Cancel Meeting">
                        <i class="fas fa-times-circle"></i>
                    </button>
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
      })} (UAE) - Duration: ${meeting.duration} minutes</span>
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
                    <i class="fas fa-link"></i> Join Meeting
                </a>
                ` : ''}
                <span class="document-count">
                    <i class="fas fa-file-alt"></i>
                    Docs: ${meeting.documents ? meeting.documents.length : 0}
                </span>
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
                        <small>${meeting.duration} min</small>
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
        
        // Empty cells for days before month starts
        for (let i = 0; i < firstDay.getDay(); i++) {
            calendarHTML += '<div class="calendar-day empty"></div>';
        }
        
        // Days of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dateStr = date.toISOString().split('T')[0];
            
            // Count meetings on this day
            const meetingsOnDay = this.meetings.filter(m => {
                const meetingDate = new Date(m.dateTime).toISOString().split('T')[0];
                return meetingDate === dateStr && m.status !== 'cancelled';
            }).length;
            
            const isToday = date.toDateString() === new Date().toDateString();
            
            calendarHTML += `
                <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${meetingsOnDay > 0 ? `
                        <span class="meeting-indicator">${meetingsOnDay} meeting${meetingsOnDay > 1 ? 's' : ''}</span>
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
    
    // UI Functions
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
            this.showNotificationPanel();
        }
        
        // Browser notification
        if (this.settings.desktopNotifications && this.notificationPermission) {
            new Notification(title, { body: message });
        }
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
        // Check reminders every minute
        setInterval(() => {
            this.checkAllReminders();
        }, 60000);
        
        // Auto-save
        setInterval(() => {
            this.saveAllData();
        }, this.settings.autoSaveInterval * 60000);
    }
    
    // Event Listeners
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
        
        // Delegated events for company actions
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
            } else if (target.classList.contains('schedule-meeting')) {
                this.switchToMeetingsTab(companyId);
            } else if (target.classList.contains('upload-doc')) {
                this.openDocumentUpload('company', companyId);
            }
        });
        
        // Delegated events for meeting actions
        document.getElementById('meetingsContainer').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const meetingId = parseInt(target.dataset.id);
            
            if (target.classList.contains('view-meeting')) {
                this.showMeetingDetails(meetingId);
            } else if (target.classList.contains('confirm-meeting')) {
                this.confirmMeeting(meetingId, []);
            } else if (target.classList.contains('cancel-meeting')) {
                const reason = prompt('Reason for cancellation:');
                if (reason) this.cancelMeeting(meetingId, reason);
            }
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
        
        // File upload handling
        document.getElementById('companyDocuments').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files, 'company');
        });
        
        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            // Implement month navigation
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            // Implement month navigation
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
        
        // Validate required fields
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
        
        // Get required documents
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
            // Reset form
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
                    Slot is not available. Please choose another time.
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
        
        copyBtn.style.display = 'block';
        copyBtn.dataset.slots = JSON.stringify(slots.filter(s => s.available));
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
    
    handleFileSelect(files, targetType) {
        const container = document.getElementById('uploadedFiles');
        container.innerHTML = '';
        
        Array.from(files).forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'uploaded-file';
            fileDiv.innerHTML = `
                <i class="fas fa-file"></i>
                <span>${file.name}</span>
                <small>${(file.size / 1024).toFixed(2)} KB</small>
            `;
            container.appendChild(fileDiv);
        });
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
        
        document.getElementById('uploadDocumentsBtn').onclick = () => {
            const files = document.getElementById('documentFile').files;
            const docType = document.getElementById('docType').value;
            
            Array.from(files).forEach(file => {
                this.addDocument({
                    targetType,
                    targetId,
                    type: docType
                }, file).then(() => {
                    this.showNotification('Uploaded', `${file.name} uploaded successfully`, 'success');
                });
            });
            
            modal.classList.remove('active');
            document.getElementById('documentFile').value = '';
        };
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
                    <h3>License Information</h3>
                    <p><strong>Number:</strong> ${company.licenseNumber}</p>
                    <p><strong>Expiry:</strong> ${new Date(company.licenseExpiry).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${company.status}">${company.status}</span></p>
                </div>
                
                <div class="detail-section">
                    <h3>Contact Information</h3>
                    <p><strong>Address:</strong> ${company.address}</p>
                    <p><strong>WhatsApp:</strong> ${company.whatsapp}</p>
                    ${company.phone ? `<p><strong>Phone:</strong> ${company.phone}</p>` : ''}
                    ${company.email ? `<p><strong>Email:</strong> ${company.email}</p>` : ''}
                    ${company.website ? `<p><strong>Website:</strong> <a href="${company.website}" target="_blank">${company.website}</a></p>` : ''}
                    ${company.contactPerson ? `<p><strong>Contact Person:</strong> ${company.contactPerson}</p>` : ''}
                </div>
                
                ${company.notes ? `
                <div class="detail-section">
                    <h3>Notes</h3>
                    <p>${company.notes}</p>
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>Meeting History (${meetings.length})</h3>
                    ${meetings.length > 0 ? `
                        <ul class="meeting-list">
                            ${meetings.slice(-5).map(m => `
                                <li>
                                    <strong>${m.title}</strong> - 
                                    ${new Date(m.dateTime).toLocaleDateString()}
                                    <span class="status-badge status-${m.status}">${m.status}</span>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p>No meetings scheduled</p>'}
                </div>
                
                <div class="detail-section">
                    <h3>Documents (${documents.length})</h3>
                    ${documents.length > 0 ? `
                        <ul class="document-list">
                            ${documents.map(d => `
                                <li>
                                    <i class="fas fa-file-${d.fileType.includes('pdf') ? 'pdf' : 'image'}"></i>
                                    <a href="${d.fileData}" download="${d.fileName}">${d.fileName}</a>
                                    <small>(${(d.fileSize / 1024).toFixed(2)} KB)</small>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p>No documents uploaded</p>'}
                </div>
            </div>
        `;
        
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
                    <h3>Company</h3>
                    <p><strong>Name:</strong> ${company ? company.name : 'Unknown'}</p>
                    <p><strong>License:</strong> ${company ? company.licenseNumber : 'N/A'}</p>
                </div>
                
                <div class="detail-section">
                    <h3>Meeting Details</h3>
                    <p><strong>Date & Time:</strong> ${new Date(meeting.dateTime).toLocaleString()} (UAE)</p>
                    <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
                    <p><strong>Platform:</strong> ${meeting.platform || 'Not specified'}</p>
                    ${meeting.link ? `
                        <p><strong>Link:</strong> <a href="${meeting.link}" target="_blank">Join Meeting</a></p>
                    ` : ''}
                    <p><strong>Status:</strong> <span class="status-badge status-${meeting.status}">${meeting.status}</span></p>
                </div>
                
                ${meeting.agenda ? `
                <div class="detail-section">
                    <h3>Agenda</h3>
                    <p>${meeting.agenda}</p>
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>Required Documents</h3>
                    ${meeting.requiredDocs && meeting.requiredDocs.length > 0 ? `
                        <ul>
                            ${meeting.requiredDocs.map(doc => `
                                <li>${doc.charAt(0).toUpperCase() + doc.slice(1)}</li>
                            `).join('')}
                        </ul>
                    ` : '<p>No specific documents required</p>'}
                </div>
                
                <div class="detail-section">
                    <h3>Uploaded Documents (${documents.length})</h3>
                    ${documents.length > 0 ? `
                        <ul class="document-list">
                            ${documents.map(d => `
                                <li>
                                    <i class="fas fa-file"></i>
                                    <a href="${d.fileData}" download="${d.fileName}">${d.fileName}</a>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p>No documents uploaded</p>'}
                </div>
                
                <div class="button-group">
                    <button class="btn-primary" onclick="window.businessManager.confirmMeeting(${meetingId}, [])">
                        <i class="fas fa-check"></i> Confirm Meeting
                    </button>
                    <button class="btn-danger" onclick="window.businessManager.cancelMeeting(${meetingId}, 'Cancelled by user')">
                        <i class="fas fa-times"></i> Cancel Meeting
                    </button>
                    <button class="btn-secondary" onclick="window.businessManager.openDocumentUpload('meeting', ${meetingId})">
                        <i class="fas fa-upload"></i> Upload Documents
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
    }
    
    switchToMeetingsTab(companyId) {
        // Switch to meetings tab
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector('[data-tab="meetings"]').classList.add('active');
        document.getElementById('meetingsTab').classList.add('active');
        
        // Pre-select company
        document.getElementById('meetingCompany').value = companyId;
    }
    
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        
        document.getElementById('reminderTime').value = this.settings.reminderTime;
        document.getElementById('notificationSound').value = this.settings.notificationSound;
        document.getElementById('desktopNotifications').checked = this.settings.desktopNotifications;
        document.getElementById('autoSaveInterval').value = this.settings.autoSaveInterval;
        document.getElementById('licenseReminders').checked = this.settings.licenseReminders;
        document.getElementById('defaultWorkStart').value = this.settings.defaultWorkStart;
        document.getElementById('defaultWorkEnd').value = this.settings.defaultWorkEnd;
        
        modal.classList.add('active');
        
        // Save settings on change
        document.getElementById('reminderTime').addEventListener('change', (e) => {
            this.settings.reminderTime = parseInt(e.target.value);
            this.saveSettings();
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
        
        document.getElementById('licenseReminders').addEventListener('change', (e) => {
            this.settings.licenseReminders = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('defaultWorkStart').addEventListener('change', (e) => {
            this.settings.defaultWorkStart = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('defaultWorkEnd').addEventListener('change', (e) => {
            this.settings.defaultWorkEnd = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('testSound').onclick = () => {
            this.playAlertSound();
        };
        
        document.getElementById('exportAllData').onclick = () => {
            this.exportAllData();
        };
        
        document.getElementById('backupData').onclick = () => {
            this.saveAllData();
            this.showNotification('Backup Created', 'All data saved to localStorage', 'success');
        };
    }
    
    exportCompanies() {
        const csv = this.convertCompaniesToCSV();
        this.downloadFile(csv, `companies_export_${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    exportMeetings() {
        const csv = this.convertMeetingsToCSV();
        this.downloadFile(csv, `meetings_export_${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    exportAllData() {
        const data = {
            tasks: this.tasks,
            companies: this.companies,
            meetings: this.meetings,
            documents: this.documents,
            exportDate: new Date().toISOString()
        };
        
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, `business_manager_backup_${new Date().toISOString().split('T')[0]}.json`);
    }
    
    convertCompaniesToCSV() {
        const headers = ['ID', 'Name', 'License Number', 'License Expiry', 'Industry', 'Address', 
                        'WhatsApp', 'Phone', 'Email', 'Website', 'Contact Person', 'Status', 'Created At'];
        
        let csv = headers.join(',') + '\n';
        
        this.companies.forEach(c => {
            const row = [
                c.id,
                `"${c.name}"`,
                `"${c.licenseNumber}"`,
                c.licenseExpiry,
                c.industry || '',
                `"${c.address}"`,
                `"${c.whatsapp}"`,
                c.phone || '',
                c.email || '',
                c.website || '',
                `"${c.contactPerson || ''}"`,
                c.status,
                c.createdAt
            ];
            csv += row.join(',') + '\n';
        });
        
        return csv;
    }
    
    convertMeetingsToCSV() {
        const headers = ['ID', 'Company ID', 'Company Name', 'Title', 'Date & Time', 'Duration', 
                        'Buffer', 'Platform', 'Link', 'Status', 'Created At'];
        
        let csv = headers.join(',') + '\n';
        
        this.meetings.forEach(m => {
            const row = [
                m.id,
                m.companyId,
                `"${this.getCompanyName(m.companyId)}"`,
                `"${m.title}"`,
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
        
        return csv;
    }
    
    downloadFile(content, fileName) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    // Task display functions (existing)
    displayTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;
        
        let filteredTasks = this.tasks;
        
        // Apply filter
        if (this.currentFilter === 'pending') {
            filteredTasks = filteredTasks.filter(t => t.status === 'pending');
        } else if (this.currentFilter === 'completed') {
            filteredTasks = filteredTasks.filter(t => t.status === 'completed');
        } else if (this.currentFilter === 'overdue') {
            filteredTasks = filteredTasks.filter(t => this.isTaskOverdue(t));
        }
        
        // Apply search
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
                        <button class="action-btn complete" data-id="${task.id}" title="Complete">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" data-id="${task.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        div.querySelector('.complete')?.addEventListener('click', () => {
            this.completeTask(task.id);
        });
        
        div.querySelector('.delete').addEventListener('click', () => {
            if (confirm('Delete this task?')) {
                this.deleteTask(task.id);
            }
        });
        
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
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.businessManager = new BusinessManager();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskDate').value = today;
    document.getElementById('meetingDate').value = today;
    document.getElementById('slotDate').value = today;
    document.getElementById('licenseExpiry').value = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
});
