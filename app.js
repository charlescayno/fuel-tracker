import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, 
    enableIndexedDbPersistence,
    collection, 
    onSnapshot, 
    addDoc, 
    doc, 
    deleteDoc, 
    setDoc, 
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4UD0AEyWMaQrJhicTBd-_162zMRjOG58",
  authDomain: "fuel-tracker-c565c.firebaseapp.com",
  projectId: "fuel-tracker-c565c",
  storageBucket: "fuel-tracker-c565c.firebasestorage.app",
  messagingSenderId: "758052138447",
  appId: "1:758052138447:web:650d2fe9a99d474bfab6ba"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable Firestore Offline IndexedDB Persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence warning: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence is not supported in this browser.');
    }
});

// Register Service Worker for PWA & Offline Caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope);
        }).catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
}

// PWA Install Prompt Handling
let deferredInstallPrompt = null;
const installPwaBtn = document.getElementById('install-pwa-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installPwaBtn) {
        installPwaBtn.classList.remove('hidden');
        installPwaBtn.classList.add('flex');
    }
});

if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted installation');
        }
        deferredInstallPrompt = null;
        installPwaBtn.classList.add('hidden');
        installPwaBtn.classList.remove('flex');
    });
}

window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed');
    if (installPwaBtn) {
        installPwaBtn.classList.add('hidden');
        installPwaBtn.classList.remove('flex');
    }
});

// Online / Offline Status Indicators
const networkStatus = document.getElementById('network-status');
const offlineBanner = document.getElementById('offline-banner');

const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    if (networkStatus) {
        if (isOnline) {
            networkStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span> Online';
            networkStatus.className = 'flex items-center text-[10px] font-medium text-emerald-600 mt-0.5';
        } else {
            networkStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></span> Offline (Cached)';
            networkStatus.className = 'flex items-center text-[10px] font-medium text-amber-600 mt-0.5';
        }
    }
    if (offlineBanner) {
        if (isOnline) {
            offlineBanner.classList.add('hidden');
        } else {
            offlineBanner.classList.remove('hidden');
        }
    }
    if (window.lucide) lucide.createIcons();
};

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// DOM Elements - Fuel
const form = document.getElementById('add-record-form');
const dateInput = document.getElementById('date');
const odometerInput = document.getElementById('odometer');
const litersInput = document.getElementById('liters');
const priceInput = document.getElementById('price');
const calculatedTotal = document.getElementById('calculated-total');
const historyTableBody = document.getElementById('history-table-body');
const emptyState = document.getElementById('empty-state');
const clearDataBtn = document.getElementById('clear-data-btn');
const profileSelect = document.getElementById('profile-select');
const addProfileBtn = document.getElementById('add-profile-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const submitBtn = document.getElementById('submit-btn');

// Last Odometer Hint Elements
const lastOdoHint = document.getElementById('last-odo-hint');
const lastDateHint = document.getElementById('last-date-hint');
const maintLastOdoHint = document.getElementById('maint-last-odo-hint');
const maintLastDateHint = document.getElementById('maint-last-date-hint');

let editingId = null;
let chartInstance = null;

// Stats Elements
const statAvgEconomy = document.getElementById('stat-avg-economy');
const statAvgCost = document.getElementById('stat-avg-cost');
const stat30dCost = document.getElementById('stat-30d-cost');
const statTotalDist = document.getElementById('stat-total-dist');

// Maintenance DOM Elements
const tabFuel = document.getElementById('tab-fuel');
const tabMaintenance = document.getElementById('tab-maintenance');
const viewFuel = document.getElementById('view-fuel');
const viewMaintenance = document.getElementById('view-maintenance');

const maintFormTitle = document.getElementById('maint-form-title');
const maintForm = document.getElementById('add-maintenance-form');
const maintDateInput = document.getElementById('maint-date');
const maintOdoInput = document.getElementById('maint-odometer');
const maintTypeInput = document.getElementById('maint-type');
const maintCostInput = document.getElementById('maint-cost');
const maintNotesInput = document.getElementById('maint-notes');
const maintSubmitBtn = document.getElementById('maint-submit-btn');
const maintCancelEditBtn = document.getElementById('maint-cancel-edit-btn');
const maintTableBody = document.getElementById('maint-table-body');
const maintEmptyState = document.getElementById('maint-empty-state');

// Service Reminders DOM Elements
const serviceRemindersGrid = document.getElementById('service-reminders-grid');
const reminderCurrentOdo = document.getElementById('reminder-current-odo');
const addCustomServiceBtn = document.getElementById('add-custom-service-btn');

let editingMaintId = null;

// State
let records = [];
let maintRecords = [];

// Load and migrate profiles (e.g. Cherry -> Chery)
let loadedProfiles = JSON.parse(localStorage.getItem('fuelProfiles')) || ['ADV 150'];
let profiles = [...new Set(loadedProfiles.map(p => p === 'Cherry' ? 'Chery' : p))];
if (!profiles.includes('ADV 150')) profiles.unshift('ADV 150');

let activeProfile = localStorage.getItem('activeProfile') || 'ADV 150';
if (activeProfile === 'Cherry') activeProfile = 'Chery';

localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
localStorage.setItem('activeProfile', activeProfile);

if (maintDateInput) maintDateInput.valueAsDate = new Date();
if (dateInput) dateInput.valueAsDate = new Date();

// Tab Switching Logic
if (tabFuel && tabMaintenance && viewFuel && viewMaintenance) {
    tabFuel.addEventListener('click', () => {
        tabFuel.classList.replace('border-transparent', 'border-blue-600');
        tabFuel.classList.replace('text-gray-500', 'text-blue-600');
        tabFuel.classList.add('font-semibold');
        tabMaintenance.classList.replace('border-blue-600', 'border-transparent');
        tabMaintenance.classList.replace('text-blue-600', 'text-gray-500');
        tabMaintenance.classList.remove('font-semibold');
        viewFuel.classList.remove('hidden');
        viewMaintenance.classList.add('hidden');
    });

    tabMaintenance.addEventListener('click', () => {
        tabMaintenance.classList.replace('border-transparent', 'border-blue-600');
        tabMaintenance.classList.replace('text-gray-500', 'text-blue-600');
        tabMaintenance.classList.add('font-semibold');
        tabFuel.classList.replace('border-blue-600', 'border-transparent');
        tabFuel.classList.replace('text-blue-600', 'text-gray-500');
        tabFuel.classList.remove('font-semibold');
        viewMaintenance.classList.remove('hidden');
        viewFuel.classList.add('hidden');
        renderServiceReminders();
    });
}

// Helper: Format Currency
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '₱0.00';
    return `₱${Number(amount).toFixed(2)}`;
};

// Helper: Format Number
const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toFixed(decimals);
};

// Render Profiles Dropdown
const renderProfiles = () => {
    if (!profileSelect) return;
    profileSelect.innerHTML = '';
    profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === activeProfile) opt.selected = true;
        profileSelect.appendChild(opt);
    });
};

// Auto-sync profile list from database records
const syncProfilesFromRecords = () => {
    let changed = false;
    records.forEach(r => {
        if (r.profile) {
            const p = r.profile === 'Cherry' ? 'Chery' : r.profile;
            if (!profiles.includes(p)) {
                profiles.push(p);
                changed = true;
            }
        }
    });
    maintRecords.forEach(r => {
        if (r.profile) {
            const p = r.profile === 'Cherry' ? 'Chery' : r.profile;
            if (!profiles.includes(p)) {
                profiles.push(p);
                changed = true;
            }
        }
    });
    if (changed) {
        localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
        renderProfiles();
    }
};

// Get current vehicle highest odometer reading
const getCurrentVehicleOdometer = (profileName) => {
    const profileFuel = records.filter(r => r.profile === profileName || (profileName === 'Chery' && r.profile === 'Cherry'));
    const profileMaint = maintRecords.filter(r => r.profile === profileName || (profileName === 'Chery' && r.profile === 'Cherry'));
    const allOdos = [
        ...profileFuel.map(r => Number(r.odometer)),
        ...profileMaint.map(r => Number(r.odometer))
    ].filter(v => v && !isNaN(v));
    return allOdos.length > 0 ? Math.max(...allOdos) : 0;
};

// Update Last Odometer Hints
const updateOdometerHints = () => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileFuel = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const profileMaint = maintRecords.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));

    // Fuel Form Odometer Hint
    if (lastOdoHint && lastDateHint) {
        if (profileFuel.length > 0) {
            const sortedFuel = [...profileFuel].sort((a, b) => new Date(a.date) - new Date(b.date));
            const lastRecord = sortedFuel[sortedFuel.length - 1];
            const dateStr = new Date(lastRecord.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            
            lastOdoHint.textContent = `${formatNumber(lastRecord.odometer, 0)} km`;
            lastDateHint.textContent = `(${dateStr})`;
            lastOdoHint.onclick = () => odometerInput.focus();
        } else {
            lastOdoHint.textContent = 'No logs yet';
            lastDateHint.textContent = '';
            lastOdoHint.onclick = null;
        }
    }

    // Maintenance Form Odometer Hint
    if (maintLastOdoHint && maintLastDateHint) {
        const allLogs = [
            ...profileFuel.map(r => ({ date: r.date, odo: r.odometer })),
            ...profileMaint.map(r => ({ date: r.date, odo: r.odometer }))
        ].filter(r => r.odo && !isNaN(r.odo));

        if (allLogs.length > 0) {
            const sortedLogs = allLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
            const latestLog = sortedLogs[sortedLogs.length - 1];
            const dateStr = new Date(latestLog.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            maintLastOdoHint.textContent = `${formatNumber(latestLog.odo, 0)} km`;
            maintLastDateHint.textContent = `(${dateStr})`;
            maintLastOdoHint.onclick = () => maintOdoInput.focus();
        } else {
            maintLastOdoHint.textContent = 'No logs yet';
            maintLastDateHint.textContent = '';
            maintLastOdoHint.onclick = null;
        }
    }
};

// ==================== SERVICE REMINDERS & HEALTH METERS ====================

// Default Service Interval Definitions
const defaultServices = [
    { id: 'oil_change', name: 'Oil Change', defaultInterval: 2000, icon: 'droplet', matchTypes: ['oil change', 'engine oil'] },
    { id: 'gear_oil', name: 'Gear Oil', defaultInterval: 4000, icon: 'disc', matchTypes: ['gear oil', 'transmission'] },
    { id: 'cvt_belt', name: 'CVT Belt / Spark Plug / Air Filter', defaultInterval: 8000, icon: 'cpu', matchTypes: ['cvt cleaning / belt', 'cvt', 'belt', 'spark plug', 'air filter'] },
    { id: 'brakes_tires', name: 'Brakes & Tires Inspection', defaultInterval: 5000, icon: 'shield', matchTypes: ['brakes', 'tires'] }
];

// Get stored service config for active profile
const getServicesConfig = () => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const key = `service_config_${currentProfileName}`;
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored service config:', e);
        }
    }
    return defaultServices;
};

// Save service config for active profile
const saveServicesConfig = (config) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const key = `service_config_${currentProfileName}`;
    localStorage.setItem(key, JSON.stringify(config));
};

// Global function to adjust service interval
window.editServiceInterval = (serviceId) => {
    const config = getServicesConfig();
    const service = config.find(s => s.id === serviceId);
    if (!service) return;

    const currentInterval = service.defaultInterval;
    const input = prompt(`Enter service interval in kilometers for "${service.name}":`, currentInterval);
    if (input && !isNaN(input) && parseFloat(input) > 0) {
        service.defaultInterval = parseFloat(input);
        saveServicesConfig(config);
        renderServiceReminders();
    }
};

// Global function to quick-fill maintenance form from reminder card
window.quickLogService = (serviceName) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const currentOdo = getCurrentVehicleOdometer(currentProfileName);

    if (maintDateInput) maintDateInput.valueAsDate = new Date();
    if (maintOdoInput) maintOdoInput.value = currentOdo > 0 ? currentOdo : '';
    
    // Select service type in dropdown or add option
    if (maintTypeInput) {
        let found = false;
        for (let i = 0; i < maintTypeInput.options.length; i++) {
            if (maintTypeInput.options[i].text.toLowerCase() === serviceName.toLowerCase() ||
                serviceName.toLowerCase().includes(maintTypeInput.options[i].value.toLowerCase())) {
                maintTypeInput.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = document.createElement('option');
            opt.value = serviceName;
            opt.textContent = serviceName;
            opt.selected = true;
            maintTypeInput.appendChild(opt);
        }
    }

    if (maintCostInput) maintCostInput.focus();
    maintForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Add Custom Service Reminder
if (addCustomServiceBtn) {
    addCustomServiceBtn.addEventListener('click', () => {
        const name = prompt('Enter service name (e.g. Brake Fluid, Coolant Flush, Battery):');
        if (!name || !name.trim()) return;
        
        const intervalInput = prompt(`Enter service interval in kilometers for "${name.trim()}":`, '5000');
        if (!intervalInput || isNaN(intervalInput) || parseFloat(intervalInput) <= 0) return;
        
        const config = getServicesConfig();
        const id = 'custom_' + Date.now();
        config.push({
            id: id,
            name: name.trim(),
            defaultInterval: parseFloat(intervalInput),
            icon: 'wrench',
            matchTypes: [name.trim().toLowerCase()]
        });
        saveServicesConfig(config);
        
        // Add to maintenance type dropdown if not exists
        if (maintTypeInput) {
            const opt = document.createElement('option');
            opt.value = name.trim();
            opt.textContent = name.trim();
            maintTypeInput.appendChild(opt);
        }

        renderServiceReminders();
    });
}

// Render Preventative Maintenance Reminders
const renderServiceReminders = () => {
    if (!serviceRemindersGrid) return;
    
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const currentOdo = getCurrentVehicleOdometer(currentProfileName);
    
    if (reminderCurrentOdo) {
        reminderCurrentOdo.textContent = `${formatNumber(currentOdo, 0)} km`;
    }

    const config = getServicesConfig();
    const profileMaint = maintRecords.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));
    
    serviceRemindersGrid.innerHTML = '';

    config.forEach(service => {
        const interval = service.defaultInterval;
        
        // Find most recent maintenance record matching this service type
        const matchingLogs = profileMaint.filter(r => {
            if (!r.type) return false;
            const logType = r.type.toLowerCase();
            return service.matchTypes ? service.matchTypes.some(m => logType.includes(m)) : logType.includes(service.name.toLowerCase());
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        let lastServiceOdo = 0;
        let lastServiceDate = null;
        let hasLogged = false;

        if (matchingLogs.length > 0) {
            lastServiceOdo = parseFloat(matchingLogs[0].odometer) || 0;
            lastServiceDate = new Date(matchingLogs[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            hasLogged = true;
        }

        const kmSinceLast = Math.max(0, currentOdo - lastServiceOdo);
        const remainingKm = interval - kmSinceLast;
        const percentUsed = Math.min(100, Math.max(0, (kmSinceLast / interval) * 100));

        let statusText = '';
        let statusBadgeClass = '';
        let progressBarColor = 'bg-emerald-500';
        let statusIcon = 'check-circle';

        if (remainingKm <= 0) {
            const overdueKm = Math.abs(remainingKm);
            statusText = `OVERDUE by ${formatNumber(overdueKm, 0)} km`;
            statusBadgeClass = 'bg-rose-100 text-rose-700 border-rose-200';
            progressBarColor = 'bg-rose-600';
            statusIcon = 'alert-triangle';
        } else if (remainingKm <= interval * 0.25) {
            statusText = `Due soon! (${formatNumber(remainingKm, 0)} km left)`;
            statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
            progressBarColor = 'bg-amber-500';
            statusIcon = 'clock';
        } else {
            statusText = `Due in ${formatNumber(remainingKm, 0)} km`;
            statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            progressBarColor = 'bg-emerald-500';
            statusIcon = 'shield-check';
        }

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col justify-between hover:shadow-sm transition-all';
        card.innerHTML = `
            <div>
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center space-x-2">
                        <div class="p-2 rounded-lg bg-white border border-gray-200 shadow-2xs text-gray-700">
                            <i data-lucide="${service.icon || 'wrench'}" class="h-4 w-4 text-orange-600"></i>
                        </div>
                        <h4 class="text-sm font-bold text-gray-900 leading-tight">${service.name}</h4>
                    </div>
                    <button onclick="editServiceInterval('${service.id}')" class="text-gray-400 hover:text-gray-700 p-1 rounded-md transition-colors" title="Adjust interval (current: every ${formatNumber(interval, 0)} km)">
                        <i data-lucide="settings" class="h-3.5 w-3.5"></i>
                    </button>
                </div>

                <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>Interval: <strong class="text-gray-700">${formatNumber(interval, 0)} km</strong></span>
                    <span class="text-[11px] ${hasLogged ? 'text-gray-600' : 'text-gray-400'}">
                        ${hasLogged ? `Last: ${formatNumber(lastServiceOdo, 0)} km` : 'No logs yet'}
                    </span>
                </div>

                <!-- Progress Bar -->
                <div class="w-full bg-gray-200 rounded-full h-2 mb-2.5 overflow-hidden">
                    <div class="${progressBarColor} h-2 rounded-full transition-all duration-500" style="width: ${percentUsed}%;"></div>
                </div>

                <div class="flex items-center justify-between mb-3">
                    <span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${statusBadgeClass}">
                        <i data-lucide="${statusIcon}" class="h-3 w-3 mr-1"></i>
                        ${statusText}
                    </span>
                    <span class="text-[11px] font-medium text-gray-500">${formatNumber(kmSinceLast, 0)} / ${formatNumber(interval, 0)} km</span>
                </div>
            </div>

            <button onclick="quickLogService('${service.name}')" class="w-full mt-2 text-xs bg-white hover:bg-orange-50 text-orange-700 font-semibold py-1.5 px-3 rounded-lg border border-orange-200 transition-colors flex items-center justify-center shadow-2xs">
                <i data-lucide="plus" class="h-3.5 w-3.5 mr-1"></i> Log Service
            </button>
        `;
        serviceRemindersGrid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
};

// Calculate total amount in form on input change
const calculateFormTotal = () => {
    if (!calculatedTotal) return;
    const liters = parseFloat(litersInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = liters * price;
    calculatedTotal.textContent = formatCurrency(total);
};

if (litersInput) litersInput.addEventListener('input', calculateFormTotal);
if (priceInput) priceInput.addEventListener('input', calculateFormTotal);

// Handle Profile Change
if (profileSelect) {
    profileSelect.addEventListener('change', (e) => {
        activeProfile = e.target.value;
        localStorage.setItem('activeProfile', activeProfile);
        renderTable();
        renderMaintenanceTable();
        renderServiceReminders();
        updateOdometerHints();
    });
}

// Handle Add Profile
if (addProfileBtn) {
    addProfileBtn.addEventListener('click', () => {
        const newProfile = prompt('Enter new vehicle name (e.g. Chery, Civic, NMAX):');
        if (newProfile && newProfile.trim() !== '') {
            let trimmed = newProfile.trim();
            if (trimmed.toLowerCase() === 'cherry') trimmed = 'Chery';
            if (!profiles.includes(trimmed)) {
                profiles.push(trimmed);
                localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
            }
            activeProfile = trimmed;
            localStorage.setItem('activeProfile', activeProfile);
            renderProfiles();
            renderTable();
            renderMaintenanceTable();
            renderServiceReminders();
            updateOdometerHints();
        }
    });
}

// Cancel Fuel Edit
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        editingId = null;
        form.reset();
        dateInput.valueAsDate = new Date();
        calculatedTotal.textContent = '₱0.00';
        submitBtn.textContent = 'Save Record';
        cancelEditBtn.classList.add('hidden');
    });
}

// Make functions globally available for inline onclick handlers
window.editRecord = (id) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    
    editingId = id;
    dateInput.value = record.date;
    odometerInput.value = record.odometer;
    litersInput.value = record.liters;
    priceInput.value = record.pricePerLiter;
    calculateFormTotal();
    
    submitBtn.textContent = 'Update Record';
    cancelEditBtn.classList.remove('hidden');
    
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.deleteRecord = async (id) => {
    if (confirm('Are you sure you want to delete this record?')) {
        try {
            await deleteDoc(doc(db, "fuelRecords", id));
        } catch (err) {
            alert('Failed to delete record: ' + err.message);
        }
    }
};

// Edit Maintenance Record
window.editMaintRecord = (id) => {
    const record = maintRecords.find(r => r.id === id);
    if (!record) return;

    editingMaintId = id;
    maintDateInput.value = record.date;
    maintOdoInput.value = record.odometer;
    maintTypeInput.value = record.type;
    maintCostInput.value = record.cost;
    maintNotesInput.value = record.notes || '';

    if (maintFormTitle) maintFormTitle.innerHTML = '<i data-lucide="edit" class="h-5 w-5 mr-2 text-orange-600"></i> Edit Maintenance';
    if (maintSubmitBtn) maintSubmitBtn.textContent = 'Update Record';
    if (maintCancelEditBtn) maintCancelEditBtn.classList.remove('hidden');

    if (window.lucide) lucide.createIcons();
    maintForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Cancel Maintenance Edit
if (maintCancelEditBtn) {
    maintCancelEditBtn.addEventListener('click', () => {
        editingMaintId = null;
        maintForm.reset();
        maintDateInput.valueAsDate = new Date();
        if (maintFormTitle) maintFormTitle.innerHTML = '<i data-lucide="wrench" class="h-5 w-5 mr-2 text-orange-600"></i> Log Maintenance';
        if (maintSubmitBtn) maintSubmitBtn.textContent = 'Save Record';
        maintCancelEditBtn.classList.add('hidden');
        if (window.lucide) lucide.createIcons();
    });
}

window.deleteMaintRecord = async (id) => {
    if (confirm('Are you sure you want to delete this maintenance record?')) {
        try {
            await deleteDoc(doc(db, "maintRecords", id));
        } catch (err) {
            alert('Failed to delete maintenance record: ' + err.message);
        }
    }
};

// Update Efficiency Chart
const updateChart = (processedData) => {
    const ctx = document.getElementById('efficiencyChart');
    if (!ctx) return;
    
    const chartData = processedData.filter(d => d.kmPerLiter !== null && !isNaN(d.kmPerLiter));
    const labels = chartData.map(d => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    const dataPoints = chartData.map(d => d.kmPerLiter);

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (chartData.length === 0) return;

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Efficiency (km/L)',
                data: dataPoints,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#2563eb',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return ' ' + context.parsed.y.toFixed(2) + ' km/L'; }
                    }
                }
            },
            scales: {
                y: { title: { display: true, text: 'km/L' } }
            }
        }
    });
};

// Process records to calculate derived values
const processRecords = (data) => {
    if (data.length === 0) return [];
    
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return sortedData.map((record, index) => {
        const amount = (record.liters || 0) * (record.pricePerLiter || 0);
        
        if (index === 0) {
            return {
                ...record,
                amount,
                tripKm: null,
                pesoPerKm: null,
                kmPerLiter: null,
                daysInterval: null,
                avgKmPerDay: null,
                kmIn30Days: null,
                litersIn30Days: null,
                pesosIn30Days: null
            };
        }
        
        const prevRecord = sortedData[index - 1];
        const tripKm = record.odometer - prevRecord.odometer;
        const pesoPerKm = tripKm > 0 ? amount / tripKm : null;
        const kmPerLiter = (record.liters > 0) ? tripKm / record.liters : null;
        
        const diffTime = Math.abs(new Date(record.date) - new Date(prevRecord.date));
        const daysInterval = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const avgKmPerDay = daysInterval > 0 ? tripKm / daysInterval : 0;
        const kmIn30Days = avgKmPerDay * 30;
        const litersIn30Days = kmPerLiter ? (kmIn30Days / kmPerLiter) : null;
        const pesosIn30Days = (litersIn30Days && record.pricePerLiter) ? (litersIn30Days * record.pricePerLiter) : null;

        return {
            ...record,
            amount,
            tripKm,
            pesoPerKm,
            kmPerLiter,
            daysInterval,
            avgKmPerDay,
            kmIn30Days,
            litersIn30Days,
            pesosIn30Days
        };
    });
};

// Update Dashboard Stats
const updateStats = (processedData) => {
    if (!statAvgEconomy || !statAvgCost || !stat30dCost || !statTotalDist) return;

    if (processedData.length < 2) {
        statAvgEconomy.textContent = "-- km/L";
        statAvgCost.textContent = "₱--";
        stat30dCost.textContent = "₱--";
        statTotalDist.textContent = "-- km";
        return;
    }

    let totalTripKm = 0;
    let totalLiters = 0;
    let totalAmount = 0;
    
    for (let i = 1; i < processedData.length; i++) {
        if (processedData[i].tripKm) totalTripKm += processedData[i].tripKm;
        if (processedData[i].liters) totalLiters += processedData[i].liters;
        if (processedData[i].amount) totalAmount += processedData[i].amount;
    }

    const avgEconomy = totalLiters > 0 ? totalTripKm / totalLiters : 0;
    const fuelCostPerKm = totalTripKm > 0 ? totalAmount / totalTripKm : 0;
    
    const latestRecord = processedData[processedData.length - 1];
    const firstRecord = processedData[0];
    const totalDistance = latestRecord.odometer - firstRecord.odometer;

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileMaint = maintRecords.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));
    const totalMaintAmount = profileMaint.reduce((sum, r) => sum + (r.cost || 0), 0);
    const trueCostPerKm = totalDistance > 0 ? (totalAmount + totalMaintAmount) / totalDistance : 0;

    statAvgEconomy.textContent = `${formatNumber(avgEconomy)} km/L`;
    statAvgCost.textContent = formatCurrency(fuelCostPerKm);
    stat30dCost.textContent = formatCurrency(trueCostPerKm);
    statTotalDist.textContent = `${formatNumber(totalDistance, 0)} km`;
};

// Render Tables
const renderTable = () => {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileRecords = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const tableEl = document.querySelector('#view-fuel table');
    
    if (profileRecords.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableEl) tableEl.classList.add('hidden');
        updateStats([]);
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        updateOdometerHints();
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');

    const processedData = processRecords(profileRecords);
    const displayData = [...processedData].sort((a, b) => new Date(b.date) - new Date(a.date));

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-bold bg-yellow-50">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${row.tripKm !== null ? row.tripKm : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-600 font-medium bg-amber-50">${formatNumber(row.liters)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-600 font-medium bg-amber-50">${formatCurrency(row.pricePerLiter)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">${formatCurrency(row.amount)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700 font-medium bg-blue-50">${row.pesoPerKm !== null ? formatCurrency(row.pesoPerKm) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 font-medium bg-green-50">${row.kmPerLiter !== null ? formatNumber(row.kmPerLiter) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${row.pesosIn30Days !== null ? formatCurrency(row.pesosIn30Days) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="editRecord('${row.id}')" class="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors mr-1" title="Edit">
                    <i data-lucide="edit-2" class="h-4 w-4"></i>
                </button>
                <button onclick="deleteRecord('${row.id}')" class="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors" title="Delete">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        historyTableBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
    updateStats(processedData);
    updateChart(processedData);
    updateOdometerHints();
    renderServiceReminders();
};

const renderMaintenanceTable = () => {
    if (!maintTableBody) return;
    maintTableBody.innerHTML = '';
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileMaint = maintRecords.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));
    const tableContainer = maintTableBody.closest('table');
    
    if (profileMaint.length === 0) {
        if (maintEmptyState) maintEmptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        updateOdometerHints();
        renderServiceReminders();
        return;
    }

    if (maintEmptyState) maintEmptyState.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');

    const displayData = [...profileMaint].sort((a, b) => new Date(b.date) - new Date(a.date));

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-bold bg-yellow-50">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${row.type}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${row.notes || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-700 font-medium bg-orange-50">${formatCurrency(row.cost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="editMaintRecord('${row.id}')" class="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors mr-1" title="Edit">
                    <i data-lucide="edit-2" class="h-4 w-4"></i>
                </button>
                <button onclick="deleteMaintRecord('${row.id}')" class="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors" title="Delete">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        maintTableBody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
    
    const currentProfileRecords = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const processedData = processRecords(currentProfileRecords);
    updateStats(processedData);
    updateOdometerHints();
    renderServiceReminders();
};

// Handle Fuel Form Submit
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = editingId ? 'Updating...' : 'Saving...';

        try {
            const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
            const recordData = {
                date: dateInput.value,
                odometer: parseFloat(odometerInput.value),
                liters: parseFloat(litersInput.value),
                pricePerLiter: parseFloat(priceInput.value),
                profile: currentProfileName
            };

            if (editingId) {
                await setDoc(doc(db, "fuelRecords", editingId), recordData);
                editingId = null;
                cancelEditBtn.classList.add('hidden');
            } else {
                await addDoc(collection(db, "fuelRecords"), recordData);
            }

            odometerInput.value = '';
            litersInput.value = '';
            priceInput.value = '';
            calculatedTotal.textContent = '₱0.00';
            dateInput.valueAsDate = new Date();

            submitBtn.textContent = 'Saved!';
            submitBtn.classList.replace('bg-blue-600', 'bg-green-600');
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Record';
                submitBtn.classList.replace('bg-green-600', 'bg-blue-600');
            }, 1200);

        } catch (err) {
            console.error("Error saving fuel record:", err);
            alert("Error saving record: " + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
}

// Handle Maintenance Form Submit (Create & Edit)
if (maintForm) {
    maintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const origText = maintSubmitBtn ? maintSubmitBtn.textContent : 'Save Record';
        if (maintSubmitBtn) {
            maintSubmitBtn.disabled = true;
            maintSubmitBtn.textContent = editingMaintId ? 'Updating...' : 'Saving...';
        }

        try {
            const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
            const recordData = {
                date: maintDateInput.value,
                odometer: parseFloat(maintOdoInput.value),
                type: maintTypeInput.value,
                cost: parseFloat(maintCostInput.value),
                notes: maintNotesInput.value,
                profile: currentProfileName
            };

            if (editingMaintId) {
                await setDoc(doc(db, "maintRecords", editingMaintId), recordData);
                editingMaintId = null;
                if (maintFormTitle) maintFormTitle.innerHTML = '<i data-lucide="wrench" class="h-5 w-5 mr-2 text-orange-600"></i> Log Maintenance';
                if (maintCancelEditBtn) maintCancelEditBtn.classList.add('hidden');
            } else {
                await addDoc(collection(db, "maintRecords"), recordData);
            }
            
            maintOdoInput.value = '';
            maintCostInput.value = '';
            maintNotesInput.value = '';
            maintDateInput.valueAsDate = new Date();

            if (maintSubmitBtn) {
                maintSubmitBtn.textContent = 'Saved!';
                maintSubmitBtn.classList.replace('bg-orange-600', 'bg-green-600');
                setTimeout(() => {
                    maintSubmitBtn.disabled = false;
                    maintSubmitBtn.textContent = 'Save Record';
                    maintSubmitBtn.classList.replace('bg-green-600', 'bg-orange-600');
                }, 1200);
            }
        } catch (err) {
            console.error("Error saving maintenance record:", err);
            alert("Error saving maintenance record: " + err.message);
            if (maintSubmitBtn) {
                maintSubmitBtn.disabled = false;
                maintSubmitBtn.textContent = origText;
            }
        }
    });
}

// Clear All Data
if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
        const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
        if (confirm(`Are you sure you want to delete ALL records for ${currentProfileName}? This cannot be undone.`)) {
            try {
                const batch = writeBatch(db);
                
                const profileFuel = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
                profileFuel.forEach(r => {
                    batch.delete(doc(db, "fuelRecords", r.id));
                });

                const profileMaint = maintRecords.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
                profileMaint.forEach(r => {
                    batch.delete(doc(db, "maintRecords", r.id));
                });

                await batch.commit();
            } catch (err) {
                alert("Failed to clear data: " + err.message);
            }
        }
    });
}

// REAL-TIME LISTENERS (Works online and offline via IndexedDB cache)
onSnapshot(collection(db, "fuelRecords"), (snapshot) => {
    records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    syncProfilesFromRecords();
    renderTable();
    renderServiceReminders();
});

onSnapshot(collection(db, "maintRecords"), (snapshot) => {
    maintRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    syncProfilesFromRecords();
    renderMaintenanceTable();
    renderServiceReminders();
});

renderProfiles();
updateOdometerHints();
renderServiceReminders();
