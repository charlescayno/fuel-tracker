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
const calculatedRange = document.getElementById('calculated-range');
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

// Vehicle Specs, Logo & Range Estimator Elements
const navbarVehicleLogo = document.getElementById('navbar-vehicle-logo');
const vehicleLogoBadge = document.getElementById('vehicle-logo-badge');
const specVehicleName = document.getElementById('spec-vehicle-name');
const specFuelBadge = document.getElementById('spec-fuel-badge');
const specFuelDesc = document.getElementById('spec-fuel-desc');
const specTankSize = document.getElementById('spec-tank-size');
const specFullRange = document.getElementById('spec-full-range');
const specFullCost = document.getElementById('spec-full-cost');
const editSpecsBtn = document.getElementById('edit-specs-btn');
const litersPercentHint = document.getElementById('liters-percent-hint');

let editingId = null;
let chartInstance = null;

// Stats Elements
const statAvgEconomy = document.getElementById('stat-avg-economy');
const statAvgCost = document.getElementById('stat-avg-cost');
const statMonthlyPesos = document.getElementById('stat-monthly-pesos');
const statMonthlyLiters = document.getElementById('stat-monthly-liters');
const statTrueCost = document.getElementById('stat-true-cost');
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

// ==================== VEHICLE LOGOS & ICONS ====================
const getVehicleLogo = (profileName, cssClass = 'h-6 w-6') => {
    const p = (profileName || '').toLowerCase();
    
    // Honda (ADV 150, PCX, Click, Civic, CRV, City, etc.)
    if (p.includes('honda') || p.includes('adv') || p.includes('pcx') || p.includes('click') || p.includes('beat') || p.includes('wave') || p.includes('civic') || p.includes('city') || p.includes('crv')) {
        return `
            <svg class="${cssClass} text-red-500 hover:text-red-400 transition-colors" viewBox="0 0 100 82" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Honda">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M50 0C32.5 0 16.5 2.1 7.2 5.8 5.1 6.6 4 8.7 4.2 10.9l4.5 48.6c.5 5.5 4.8 9.8 10.3 10.4 8.6 1 20 1.6 31 1.6s22.4-.6 31-1.6c5.5-.6 9.8-4.9 10.3-10.4l4.5-48.6c.2-2.2-.9-4.3-3-5.1C83.5 2.1 67.5 0 50 0zm0 7.8c15.8 0 30.1 1.8 37.8 4.7l-3.8 41.5c-.2 2.2-2 3.9-4.2 4.1-7.2.8-17.7 1.4-29.8 1.4s-22.6-.6-29.8-1.4c-2.2-.2-4-1.9-4.2-4.1L12.2 12.5C19.9 9.6 34.2 7.8 50 7.8zm-22.5 13.5l5.5 35.8h7.5l-3.2-20.8h25.4l-3.2 20.8h7.5l5.5-35.8h-7.6l-2.4 15.6H37.5l-2.4-15.6H27.5z"/>
            </svg>
        `;
    }

    // Chery (Chery Tiggo 8, Tiggo 8 Pro, Tiggo 7, Arrizo, Omoda, etc.)
    if (p.includes('chery') || p.includes('cherry') || p.includes('tiggo') || p.includes('arrizo') || p.includes('omoda') || p.includes('jaecoo')) {
        return `
            <svg class="${cssClass} text-red-500 hover:text-red-400 transition-colors" viewBox="0 0 100 68" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Chery">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M50 4C26.5 4 7 15.5 7 29.5c0 10 9.8 18.7 24.2 22.8l3.9-7C23.8 41.8 16.8 36.1 16.8 29.5c0-8.6 14.9-15.7 33.2-15.7s33.2 7.1 33.2 15.7c0 6.6-7 12.3-18.3 15.8l3.9 7C83.2 48.2 93 39.5 93 29.5 93 15.5 73.5 4 50 4zm0 17.5l-15.6 27.5h8.3l7.3-13.2 7.3 13.2h8.3L50 21.5zm0 11.8l3.9 6.8h-7.8l3.9-6.8z"/>
            </svg>
        `;
    }

    // Yamaha (NMAX, Aerox, Mio, Sniper, R15, MT, etc.)
    if (p.includes('yamaha') || p.includes('nmax') || p.includes('aerox') || p.includes('mio') || p.includes('sniper') || p.includes('tracer')) {
        return `
            <svg class="${cssClass} text-red-600" viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Yamaha">
                <circle cx="50" cy="50" r="44" stroke="currentColor" stroke-width="8" fill="none"/>
                <path d="M50 6v88M6 50h88M19 19l62 62M81 19L19 81" stroke="currentColor" stroke-width="6"/>
            </svg>
        `;
    }

    // Toyota (Vios, Fortuner, Innova, Hilux, Corolla, Raize, Wigo, etc.)
    if (p.includes('toyota') || p.includes('vios') || p.includes('fortuner') || p.includes('innova') || p.includes('hilux') || p.includes('raize') || p.includes('wigo') || p.includes('rush')) {
        return `
            <svg class="${cssClass} text-red-600" viewBox="0 0 100 70" fill="none" stroke="currentColor" stroke-width="6" xmlns="http://www.w3.org/2000/svg" title="Toyota">
                <ellipse cx="50" cy="35" rx="46" ry="30"/>
                <ellipse cx="50" cy="24" rx="26" ry="14"/>
                <ellipse cx="50" cy="35" rx="14" ry="29"/>
            </svg>
        `;
    }

    // Default Motorcycle/Bike vs Car icon
    if (p.includes('bike') || p.includes('scooter') || p.includes('motor') || p.includes('150') || p.includes('125') || p.includes('160')) {
        return `
            <svg class="${cssClass} text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="5" cy="16" r="3"></circle>
                <circle cx="19" cy="16" r="3"></circle>
                <path d="M12 16h2l2-4h3"></path>
                <path d="m8 16 3-8h3l2 4"></path>
                <path d="m14 8-1.5-3.5L10 5"></path>
            </svg>
        `;
    }

    return `
        <svg class="${cssClass} text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2"></path>
            <circle cx="7" cy="17" r="2"></circle>
            <circle cx="17" cy="17" r="2"></circle>
        </svg>
    `;
};

// ==================== VEHICLE SPECIFICATIONS & PRESETS ====================
const defaultVehicleSpecs = {
    'ADV 150': {
        tankCapacity: 8.0,
        fuelGrade: '91 RON Unleaded',
        fuelDesc: 'Recommended: Regular Unleaded (Petron Xtra, Shell FuelSave 91, Caltex Silver)'
    },
    'Chery': {
        tankCapacity: 51.0,
        fuelGrade: '95 RON Premium',
        fuelDesc: 'Recommended: Premium Unleaded (Petron XCS 95, Shell V-Power 95, Caltex Platinum)'
    },
    'Chery Tiggo 8 Pro': {
        tankCapacity: 51.0,
        fuelGrade: '95 RON Premium',
        fuelDesc: 'Recommended: Premium Unleaded (Petron XCS 95, Shell V-Power 95, Caltex Platinum)'
    },
    'Tiggo 8 Pro': {
        tankCapacity: 51.0,
        fuelGrade: '95 RON Premium',
        fuelDesc: 'Recommended: Premium Unleaded (Petron XCS 95, Shell V-Power 95, Caltex Platinum)'
    }
};

const getVehicleSpecs = (profileName) => {
    const p = (profileName === 'Cherry') ? 'Chery' : profileName;
    const stored = localStorage.getItem(`vehicle_spec_${p}`);
    if (stored) {
        try { return JSON.parse(stored); } catch (e) { }
    }
    if (defaultVehicleSpecs[p]) {
        return defaultVehicleSpecs[p];
    }
    return {
        tankCapacity: 45.0,
        fuelGrade: '91/95 RON',
        fuelDesc: 'Recommended: Unleaded Gasoline'
    };
};

const saveVehicleSpecs = (profileName, specs) => {
    const p = (profileName === 'Cherry') ? 'Chery' : profileName;
    localStorage.setItem(`vehicle_spec_${p}`, JSON.stringify(specs));
};

const getVehicleAvgEconomy = (profileName) => {
    const p = (profileName === 'Cherry') ? 'Chery' : profileName;
    const profileRecords = records.filter(r => r.profile === p || (p === 'Chery' && r.profile === 'Cherry'));
    const processed = processRecords(profileRecords);
    let totalTripKm = 0;
    let totalLiters = 0;
    for (let i = 1; i < processed.length; i++) {
        if (processed[i].tripKm) totalTripKm += processed[i].tripKm;
        if (processed[i].liters) totalLiters += processed[i].liters;
    }
    if (totalLiters > 0) return totalTripKm / totalLiters;
    return p.toLowerCase().includes('adv') ? 45.0 : 10.5;
};

const updateVehicleSpecsAndRange = (avgEconomy, latestPrice) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);

    // Update Brand Logos
    if (navbarVehicleLogo) {
        navbarVehicleLogo.innerHTML = getVehicleLogo(currentProfileName, 'h-4 w-4');
    }
    if (vehicleLogoBadge) {
        vehicleLogoBadge.innerHTML = getVehicleLogo(currentProfileName, 'h-7 w-7 sm:h-8 sm:w-8');
    }

    if (specVehicleName) specVehicleName.textContent = currentProfileName;
    if (specFuelBadge) specFuelBadge.innerHTML = `<i data-lucide="check-circle-2" class="h-3 w-3 mr-1 inline"></i> ${specs.fuelGrade}`;
    if (specFuelDesc) specFuelDesc.textContent = specs.fuelDesc;
    if (specTankSize) specTankSize.textContent = `${formatNumber(specs.tankCapacity, 1)} L`;

    if (specFullRange) {
        if (avgEconomy > 0) {
            const range = specs.tankCapacity * avgEconomy;
            specFullRange.textContent = `~${formatNumber(range, 0)} km`;
        } else {
            specFullRange.textContent = '-- km';
        }
    }

    if (specFullCost) {
        if (latestPrice > 0) {
            const cost = specs.tankCapacity * latestPrice;
            specFullCost.textContent = formatCurrency(cost);
        } else {
            specFullCost.textContent = '₱--';
        }
    }

    updateLitersPercentHint();
    if (window.lucide) lucide.createIcons();
};

const updateLitersPercentHint = () => {
    if (!litersPercentHint) return;
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);
    const litersVal = parseFloat(litersInput.value) || 0;
    
    if (litersVal > 0 && specs.tankCapacity > 0) {
        const pct = ((litersVal / specs.tankCapacity) * 100).toFixed(1);
        litersPercentHint.textContent = `${pct}% of ${specs.tankCapacity}L tank filled`;
        litersPercentHint.className = 'text-[11px] text-blue-600 font-semibold mt-1 block';
    } else {
        litersPercentHint.textContent = `Tank capacity: ${specs.tankCapacity} L`;
        litersPercentHint.className = 'text-[11px] text-gray-500 mt-1 block';
    }
};

const calculateFormTotal = () => {
    const liters = parseFloat(litersInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = liters * price;
    if (calculatedTotal) calculatedTotal.textContent = formatCurrency(total);

    // Live Range Added calculation
    if (calculatedRange) {
        const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
        const avgEconomy = getVehicleAvgEconomy(currentProfileName);
        if (liters > 0 && avgEconomy > 0) {
            const rangeAdded = liters * avgEconomy;
            calculatedRange.textContent = `+${formatNumber(rangeAdded, 1)} km`;
        } else {
            calculatedRange.textContent = '+0 km';
        }
    }
    updateLitersPercentHint();
};

if (litersInput) litersInput.addEventListener('input', calculateFormTotal);
if (priceInput) priceInput.addEventListener('input', calculateFormTotal);

if (editSpecsBtn) {
    editSpecsBtn.addEventListener('click', () => {
        const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
        const specs = getVehicleSpecs(currentProfileName);
        
        const newTank = prompt(`Enter fuel tank capacity in Liters for "${currentProfileName}":`, specs.tankCapacity);
        if (newTank && !isNaN(newTank) && parseFloat(newTank) > 0) {
            specs.tankCapacity = parseFloat(newTank);
        }

        const newGrade = prompt(`Enter recommended fuel octane/grade for "${currentProfileName}" (e.g. 91 RON Unleaded, 95 RON Premium):`, specs.fuelGrade);
        if (newGrade && newGrade.trim()) {
            specs.fuelGrade = newGrade.trim();
        }

        saveVehicleSpecs(currentProfileName, specs);
        renderTable();
    });
}

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
    return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper: Format Number
const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

    if (navbarVehicleLogo) {
        navbarVehicleLogo.innerHTML = getVehicleLogo(activeProfile, 'h-4 w-4');
    }
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

const defaultServices = [
    { id: 'oil_change', name: 'Oil Change', defaultInterval: 2000, icon: 'droplet', matchTypes: ['oil change', 'engine oil'] },
    { id: 'gear_oil', name: 'Gear Oil', defaultInterval: 4000, icon: 'disc', matchTypes: ['gear oil', 'transmission'] },
    { id: 'cvt_belt', name: 'CVT Belt / Spark Plug / Air Filter', defaultInterval: 8000, icon: 'cpu', matchTypes: ['cvt cleaning / belt', 'cvt', 'belt', 'spark plug', 'air filter'] },
    { id: 'brakes_tires', name: 'Brakes & Tires Inspection', defaultInterval: 5000, icon: 'shield', matchTypes: ['brakes', 'tires'] }
];

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

const saveServicesConfig = (config) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const key = `service_config_${currentProfileName}`;
    localStorage.setItem(key, JSON.stringify(config));
};

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

window.quickLogService = (serviceName) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const currentOdo = getCurrentVehicleOdometer(currentProfileName);

    if (maintDateInput) maintDateInput.valueAsDate = new Date();
    if (maintOdoInput) maintOdoInput.value = currentOdo > 0 ? currentOdo : '';
    
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
        
        if (maintTypeInput) {
            const opt = document.createElement('option');
            opt.value = name.trim();
            opt.textContent = name.trim();
            maintTypeInput.appendChild(opt);
        }

        renderServiceReminders();
    });
}

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

if (profileSelect) {
    profileSelect.addEventListener('change', (e) => {
        activeProfile = e.target.value;
        localStorage.setItem('activeProfile', activeProfile);
        if (navbarVehicleLogo) {
            navbarVehicleLogo.innerHTML = getVehicleLogo(activeProfile, 'h-4 w-4');
        }
        renderTable();
        renderMaintenanceTable();
        renderServiceReminders();
        updateOdometerHints();
        calculateFormTotal();
    });
}

if (addProfileBtn) {
    addProfileBtn.addEventListener('click', () => {
        const newProfile = prompt('Enter new vehicle name (e.g. Chery Tiggo 8 Pro, Honda Click, Yamaha NMAX, Toyota Vios):');
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
            calculateFormTotal();
        }
    });
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        editingId = null;
        form.reset();
        dateInput.valueAsDate = new Date();
        calculatedTotal.textContent = '₱0.00';
        if (calculatedRange) calculatedRange.textContent = '+0 km';
        submitBtn.textContent = 'Save Record';
        cancelEditBtn.classList.add('hidden');
        updateLitersPercentHint();
    });
}

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
    if (!statAvgEconomy || !statAvgCost || !statMonthlyPesos || !statMonthlyLiters || !statTrueCost || !statTotalDist) return;

    if (processedData.length < 2) {
        statAvgEconomy.textContent = "-- km/L";
        statAvgCost.textContent = "₱--";
        statMonthlyPesos.textContent = "₱--";
        statMonthlyLiters.textContent = "-- L / month";
        statTrueCost.textContent = "₱--";
        statTotalDist.textContent = "-- km";
        
        const latestPrice = processedData.length === 1 ? (processedData[0].pricePerLiter || 0) : 0;
        updateVehicleSpecsAndRange(0, latestPrice);
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

    // Estimated 30-Day Monthly Fuel Consumption (Liters and Pesos)
    const firstDate = new Date(firstRecord.date);
    const latestDate = new Date(latestRecord.date);
    const totalDays = Math.max(1, Math.round(Math.abs(latestDate - firstDate) / (1000 * 60 * 60 * 24)));
    
    let monthlyLiters = 0;
    let monthlyPesos = 0;

    if (totalDays > 0 && avgEconomy > 0) {
        const dailyKm = totalTripKm / totalDays;
        const monthlyKm = dailyKm * 30;
        monthlyLiters = monthlyKm / avgEconomy;
        const avgPricePerLiter = totalLiters > 0 ? (totalAmount / totalLiters) : (latestRecord.pricePerLiter || 0);
        monthlyPesos = monthlyLiters * avgPricePerLiter;
    } else if (latestRecord.pesosIn30Days) {
        monthlyPesos = latestRecord.pesosIn30Days;
        monthlyLiters = latestRecord.litersIn30Days || 0;
    }

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileMaint = maintRecords.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));
    const totalMaintAmount = profileMaint.reduce((sum, r) => sum + (r.cost || 0), 0);
    const trueCostPerKm = totalDistance > 0 ? (totalAmount + totalMaintAmount) / totalDistance : 0;

    statAvgEconomy.textContent = `${formatNumber(avgEconomy)} km/L`;
    statAvgCost.textContent = `${formatCurrency(fuelCostPerKm)}/km`;
    statMonthlyPesos.textContent = formatCurrency(monthlyPesos);
    statMonthlyLiters.textContent = `~${formatNumber(monthlyLiters)} L / month (30d)`;
    statTrueCost.textContent = `${formatCurrency(trueCostPerKm)}/km`;
    statTotalDist.textContent = `${formatNumber(totalDistance, 0)} km`;

    // Update Tank Specs & Range Estimator Bar
    const latestPrice = latestRecord.pricePerLiter || 0;
    updateVehicleSpecsAndRange(avgEconomy, latestPrice);
};

// Render Tables
const renderTable = () => {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileRecords = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const tableEl = document.querySelector('#view-fuel table');
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);
    
    if (profileRecords.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableEl) tableEl.classList.add('hidden');
        updateStats([]);
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        updateOdometerHints();
        updateVehicleSpecsAndRange(0, 0);
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

        const pctTank = (row.liters > 0 && specs.tankCapacity > 0) ? `${((row.liters / specs.tankCapacity) * 100).toFixed(0)}% tank` : '';
        const economyToUse = row.kmPerLiter || avgEconomy;
        const rangeAddedVal = (row.liters > 0 && economyToUse > 0) ? (row.liters * economyToUse) : null;
        const rangeAddedStr = rangeAddedVal ? `+${formatNumber(rangeAddedVal, 0)} km` : '';

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-bold bg-yellow-50">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${row.tripKm !== null ? row.tripKm : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right bg-amber-50/50">
                <div class="text-amber-700 font-bold">${formatNumber(row.liters)} L</div>
                <div class="text-[11px] flex items-center justify-end space-x-1 mt-0.5">
                    ${pctTank ? `<span class="text-[10px] text-gray-400 font-medium">${pctTank}</span>` : ''}
                    ${rangeAddedStr ? `<span class="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">${rangeAddedStr}</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-700 font-medium bg-amber-50/50">${formatCurrency(row.pricePerLiter)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">${formatCurrency(row.amount)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700 font-medium bg-blue-50">${row.pesoPerKm !== null ? formatCurrency(row.pesoPerKm) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 font-medium bg-green-50">${row.kmPerLiter !== null ? formatNumber(row.kmPerLiter) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right bg-amber-50">
                <div class="text-amber-900 font-bold">${row.pesosIn30Days !== null ? formatCurrency(row.pesosIn30Days) : '-'}</div>
                <div class="text-[11px] text-gray-500 font-medium">${row.litersIn30Days !== null ? formatNumber(row.litersIn30Days) + ' L' : ''}</div>
            </td>
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
            if (calculatedRange) calculatedRange.textContent = '+0 km';
            dateInput.valueAsDate = new Date();
            updateLitersPercentHint();

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

// REAL-TIME LISTENERS
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
updateVehicleSpecsAndRange(0, 0);
