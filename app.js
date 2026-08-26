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

// ==================== FIREBASE INITIALIZATION ====================
const firebaseConfig = {
  apiKey: "AIzaSyD4UD0AEyWMaQrJhicTBd-_162zMRjOG58",
  authDomain: "fuel-tracker-c565c.firebaseapp.com",
  projectId: "fuel-tracker-c565c",
  storageBucket: "fuel-tracker-c565c.firebasestorage.app",
  messagingSenderId: "758052138447",
  appId: "1:758052138447:web:650d2fe9a99d474bfab6ba"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable Firestore Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence warning: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence is not supported in this browser.');
    }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope);
        }).catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
}

// ==================== GLOBAL STATE ====================
let records = [];
let maintRecords = [];
let tripRecords = [];
let editingId = null;
let editingMaintId = null;
let chartInstance = null;

// Leaflet Map Global State
let leafletMap = null;
let currentTileLayer = null;
let currentMapMode = 'radius'; // 'radius' or 'route'
let radiusOrigin = [14.5995, 120.9842]; // Default Manila coordinates
let radiusCircle = null;
let radiusMarker = null;

let routePinA = null;
let routePinB = null;
let markerPinA = null;
let markerPinB = null;
let routeGeoJsonLayer = null;

// Route & Travel Time Calculation State
let currentRouteData = null;
let stopwatchInterval = null;
let tripStartTime = null;
let recordedActualSec = 0;
let isTripRunning = false;

// Profiles
let loadedProfiles = JSON.parse(localStorage.getItem('fuelProfiles')) || ['ADV 150'];
let profiles = [...new Set(loadedProfiles.map(p => p === 'Cherry' ? 'Chery' : p))];
if (!profiles.includes('ADV 150')) profiles.unshift('ADV 150');

let activeProfile = localStorage.getItem('activeProfile') || 'ADV 150';
if (activeProfile === 'Cherry') activeProfile = 'Chery';

localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
localStorage.setItem('activeProfile', activeProfile);

// ==================== DOM ELEMENTS ====================
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');
const installPwaBtn = document.getElementById('install-pwa-btn');
const networkStatus = document.getElementById('network-status');
const offlineBanner = document.getElementById('offline-banner');

// Fuel Elements
const form = document.getElementById('add-record-form');
const dateInput = document.getElementById('date');
const odometerInput = document.getElementById('odometer');
const litersInput = document.getElementById('liters');
const priceInput = document.getElementById('price');
const calculatedTotal = document.getElementById('calculated-total');
const calculatedRange = document.getElementById('calculated-range');
const calculatedCostPerKm = document.getElementById('calculated-cost-per-km');
const historyTableBody = document.getElementById('history-table-body');
const emptyState = document.getElementById('empty-state');
const clearDataBtn = document.getElementById('clear-data-btn');
const profileSelect = document.getElementById('profile-select');
const addProfileBtn = document.getElementById('add-profile-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const submitBtn = document.getElementById('submit-btn');

// Hints
const lastOdoHint = document.getElementById('last-odo-hint');
const lastDateHint = document.getElementById('last-date-hint');
const maintLastOdoHint = document.getElementById('maint-last-odo-hint');
const maintLastDateHint = document.getElementById('maint-last-date-hint');

// Specs Header
const navbarVehicleLogo = document.getElementById('navbar-vehicle-logo');
const vehicleLogoBadge = document.getElementById('vehicle-logo-badge');
const specVehicleName = document.getElementById('spec-vehicle-name');
const specFuelBadge = document.getElementById('spec-fuel-badge');
const specFuelDesc = document.getElementById('spec-fuel-desc');
const specTankSize = document.getElementById('spec-tank-size');
const specFullRange = document.getElementById('spec-full-range');
const specFullCost = document.getElementById('spec-full-cost');
const specCostPerKm = document.getElementById('spec-cost-per-km');
const editSpecsBtn = document.getElementById('edit-specs-btn');
const litersPercentHint = document.getElementById('liters-percent-hint');

// Dashboard Stat Cards
const statAvgEconomy = document.getElementById('stat-avg-economy');
const statAvgCost = document.getElementById('stat-avg-cost');
const statMonthlyPesos = document.getElementById('stat-monthly-pesos');
const statMonthlyLiters = document.getElementById('stat-monthly-liters');
const statTrueCost = document.getElementById('stat-true-cost');
const statTotalDist = document.getElementById('stat-total-dist');

// Tabs & Views
const tabFuel = document.getElementById('tab-fuel');
const tabMaintenance = document.getElementById('tab-maintenance');
const tabMap = document.getElementById('tab-map');
const viewFuel = document.getElementById('view-fuel');
const viewMaintenance = document.getElementById('view-maintenance');
const viewMap = document.getElementById('view-map');

// Maintenance Elements
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

// Service Reminders
const serviceRemindersGrid = document.getElementById('service-reminders-grid');
const reminderCurrentOdo = document.getElementById('reminder-current-odo');
const addCustomServiceBtn = document.getElementById('add-custom-service-btn');

// Map Mode Elements
const modeBtnRadius = document.getElementById('mode-btn-radius');
const modeBtnRoute = document.getElementById('mode-btn-route');
const panelRadius = document.getElementById('panel-radius');
const panelRoute = document.getElementById('panel-route');
const mapLocateBtn = document.getElementById('map-locate-btn');
const radiusSlider = document.getElementById('radius-slider');
const radiusValLabel = document.getElementById('radius-val-label');
const radiusTargetVehicle = document.getElementById('radius-target-vehicle');
const radiusAvgEcon = document.getElementById('radius-avg-econ');
const radiusFuelNeeded = document.getElementById('radius-fuel-needed');
const radiusRefuelCost = document.getElementById('radius-refuel-cost');
const mapStatusHint = document.getElementById('map-status-hint');

// Google Maps Search & Autocomplete Elements
const radiusSearchInput = document.getElementById('radius-search-input');
const radiusClearSearchBtn = document.getElementById('radius-clear-search-btn');
const radiusSearchResults = document.getElementById('radius-search-results');

const routeOriginInput = document.getElementById('route-origin-input');
const routeOriginClear = document.getElementById('route-origin-clear');
const routeOriginResults = document.getElementById('route-origin-results');
const routeLocateStartBtn = document.getElementById('route-locate-start-btn');

const swapRouteBtn = document.getElementById('swap-route-btn');

const routeDestInput = document.getElementById('route-dest-input');
const routeDestClear = document.getElementById('route-dest-clear');
const routeDestResults = document.getElementById('route-dest-results');

const presetRouteSelect = document.getElementById('preset-route-select');
const resetRouteBtn = document.getElementById('reset-route-btn');
const routeRoundTripCheck = document.getElementById('route-roundtrip-check');
const routeDistanceVal = document.getElementById('route-distance-val');
const routeTimeVal = document.getElementById('route-time-val');
const routeTrafficTimeVal = document.getElementById('route-traffic-time-val');
const routeEtaVal = document.getElementById('route-eta-val');
const routeFuelVal = document.getElementById('route-fuel-val');
const routeTankPctVal = document.getElementById('route-tank-pct-val');
const routeCostVal = document.getElementById('route-cost-val');
const routeRefuelWarning = document.getElementById('route-refuel-warning');

// Live Trip Tracker & Actual Travel Time Elements
const tripLiveStatusBadge = document.getElementById('trip-live-status-badge');
const tripStopwatchDisplay = document.getElementById('trip-stopwatch-display');
const tripStopwatchHint = document.getElementById('trip-stopwatch-hint');
const startTripBtn = document.getElementById('start-trip-btn');
const finishTripBtn = document.getElementById('finish-trip-btn');
const actualTripSummary = document.getElementById('actual-trip-summary');
const actualRecordedTimeVal = document.getElementById('actual-recorded-time-val');
const actualTimeDiffVal = document.getElementById('actual-time-diff-val');
const manualActualHrs = document.getElementById('manual-actual-hrs');
const manualActualMins = document.getElementById('manual-actual-mins');
const saveTripLogBtn = document.getElementById('save-trip-log-btn');

// Trips History Table Elements
const tripsTableBody = document.getElementById('trips-table-body');
const tripsEmptyState = document.getElementById('trips-empty-state');

// Floating Canvas Search
const mapQuickSearchInput = document.getElementById('map-quick-search-input');
const mapQuickSearchClear = document.getElementById('map-quick-search-clear');
const mapQuickSearchResults = document.getElementById('map-quick-search-results');
const mapCanvasLocateBtn = document.getElementById('map-canvas-locate-btn');

// ==================== FORMATTERS & HELPERS ====================
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '₱0.00';
    return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatDuration = (totalSec) => {
    if (!totalSec || totalSec <= 0) return '0 min';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.round((totalSec % 3600) / 60);
    if (hrs > 0) {
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    return `${Math.max(1, mins)}m`;
};

const formatDurationFull = (totalSec) => {
    if (!totalSec || totalSec <= 0) return '0 min';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.round((totalSec % 3600) / 60);
    if (hrs > 0) {
        return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
    }
    return `${Math.max(1, mins)} min`;
};

const formatTimeOfDay = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// ==================== VEHICLE LOGOS ====================
const getVehicleLogo = (profileName, cssClass = 'h-6 w-6') => {
    const p = (profileName || '').toLowerCase();
    
    // Honda
    if (p.includes('honda') || p.includes('adv') || p.includes('pcx') || p.includes('click') || p.includes('beat') || p.includes('wave') || p.includes('civic') || p.includes('city') || p.includes('crv')) {
        return `
            <svg class="${cssClass} text-red-500 hover:text-red-400 transition-colors" viewBox="0 0 100 82" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Honda">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M50 0C32.5 0 16.5 2.1 7.2 5.8 5.1 6.6 4 8.7 4.2 10.9l4.5 48.6c.5 5.5 4.8 9.8 10.3 10.4 8.6 1 20 1.6 31 1.6s22.4-.6 31-1.6c5.5-.6 9.8-4.9 10.3-10.4l4.5-48.6c.2-2.2-.9-4.3-3-5.1C83.5 2.1 67.5 0 50 0zm0 7.8c15.8 0 30.1 1.8 37.8 4.7l-3.8 41.5c-.2 2.2-2 3.9-4.2 4.1-7.2.8-17.7 1.4-29.8 1.4s-22.6-.6-29.8-1.4c-2.2-.2-4-1.9-4.2-4.1L12.2 12.5C19.9 9.6 34.2 7.8 50 7.8zm-22.5 13.5l5.5 35.8h7.5l-3.2-20.8h25.4l-3.2 20.8h7.5l5.5-35.8h-7.6l-2.4 15.6H37.5l-2.4-15.6H27.5z"/>
            </svg>
        `;
    }

    // Chery
    if (p.includes('chery') || p.includes('cherry') || p.includes('tiggo') || p.includes('arrizo') || p.includes('omoda') || p.includes('jaecoo')) {
        return `
            <svg class="${cssClass} text-red-500 hover:text-red-400 transition-colors" viewBox="0 0 100 68" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Chery">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M50 4C26.5 4 7 15.5 7 29.5c0 10 9.8 18.7 24.2 22.8l3.9-7C23.8 41.8 16.8 36.1 16.8 29.5c0-8.6 14.9-15.7 33.2-15.7s33.2 7.1 33.2 15.7c0 6.6-7 12.3-18.3 15.8l3.9 7C83.2 48.2 93 39.5 93 29.5 93 15.5 73.5 4 50 4zm0 17.5l-15.6 27.5h8.3l7.3-13.2 7.3 13.2h8.3L50 21.5zm0 11.8l3.9 6.8h-7.8l3.9-6.8z"/>
            </svg>
        `;
    }

    // Yamaha
    if (p.includes('yamaha') || p.includes('nmax') || p.includes('aerox') || p.includes('mio') || p.includes('sniper') || p.includes('tracer')) {
        return `
            <svg class="${cssClass} text-red-600" viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Yamaha">
                <circle cx="50" cy="50" r="44" stroke="currentColor" stroke-width="8" fill="none"/>
                <path d="M50 6v88M6 50h88M19 19l62 62M81 19L19 81" stroke="currentColor" stroke-width="6"/>
            </svg>
        `;
    }

    // Toyota
    if (p.includes('toyota') || p.includes('vios') || p.includes('fortuner') || p.includes('innova') || p.includes('hilux') || p.includes('raize') || p.includes('wigo') || p.includes('rush')) {
        return `
            <svg class="${cssClass} text-red-600" viewBox="0 0 100 70" fill="none" stroke="currentColor" stroke-width="6" xmlns="http://www.w3.org/2000/svg" title="Toyota">
                <ellipse cx="50" cy="35" rx="46" ry="30"/>
                <ellipse cx="50" cy="24" rx="26" ry="14"/>
                <ellipse cx="50" cy="40" rx="13" ry="24"/>
            </svg>
        `;
    }

    // Mitsubishi
    if (p.includes('mitsubishi') || p.includes('montero') || p.includes('xpander') || p.includes('mirage') || p.includes('strada') || p.includes('l300')) {
        return `
            <svg class="${cssClass} text-red-600" viewBox="0 0 100 87" fill="currentColor" xmlns="http://www.w3.org/2000/svg" title="Mitsubishi">
                <polygon points="50,0 35,26 65,26"/>
                <polygon points="35,26 20,52 50,52"/>
                <polygon points="65,26 80,52 50,52"/>
                <polygon points="20,52 5,78 35,78"/>
                <polygon points="80,52 95,78 65,78"/>
                <polygon points="50,52 35,78 65,78"/>
            </svg>
        `;
    }

    // Default Vehicle Icon
    return `<i data-lucide="car" class="${cssClass} text-blue-500"></i>`;
};

// ==================== THEME MANAGEMENT ====================
const applyTheme = (theme) => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'sun');
            if (window.lucide) lucide.createIcons();
        }
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'moon');
            if (window.lucide) lucide.createIcons();
        }
    }

    if (leafletMap && currentMapMode) {
        updateMapTileLayer();
    }
};

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
    });
}

// Network Status
const updateOnlineStatus = () => {
    if (navigator.onLine) {
        if (networkStatus) {
            networkStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span> Online';
            networkStatus.className = 'flex items-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5';
        }
        if (offlineBanner) offlineBanner.classList.add('hidden');
    } else {
        if (networkStatus) {
            networkStatus.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></span> Offline';
            networkStatus.className = 'flex items-center text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5';
        }
        if (offlineBanner) offlineBanner.classList.remove('hidden');
    }
};
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installPwaBtn) installPwaBtn.classList.remove('hidden');
});

if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installPwaBtn.classList.add('hidden');
            }
            deferredPrompt = null;
        }
    });
}

// ==================== VEHICLE SPECS & PRESETS ====================
const defaultVehicleSpecs = {
    'ADV 150': {
        tankCapacity: 8.0,
        fuelGrade: '91 RON Unleaded',
        fuelDesc: 'Recommended: Regular Unleaded 91 (Petron Xtra, Shell FuelSave 91, Caltex Silver)'
    },
    'Chery': {
        tankCapacity: 51.0,
        fuelGrade: '95 RON Premium',
        fuelDesc: 'Recommended: Premium Gasoline 95+ (Petron XCS, Shell V-Power, Caltex Platinum)'
    },
    'Cherry': {
        tankCapacity: 51.0,
        fuelGrade: '95 RON Premium',
        fuelDesc: 'Recommended: Premium Gasoline 95+ (Petron XCS, Shell V-Power, Caltex Platinum)'
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

// ==================== PROCESS RECORDS ====================
const processRecords = (data) => {
    if (!data || data.length === 0) return [];
    
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

const getLatestFuelPrice = (profileName) => {
    const p = (profileName === 'Cherry') ? 'Chery' : profileName;
    const profileRecords = records.filter(r => r.profile === p || (p === 'Chery' && r.profile === 'Cherry'));
    if (profileRecords.length > 0) {
        const sorted = [...profileRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
        return sorted[sorted.length - 1].pricePerLiter || 58.0;
    }
    return 58.0;
};

const updateVehicleSpecsAndRange = (avgEconomy, latestPrice, fuelCostPerKm = 0) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);

    if (navbarVehicleLogo) navbarVehicleLogo.innerHTML = getVehicleLogo(currentProfileName, 'h-4 w-4');
    if (vehicleLogoBadge) vehicleLogoBadge.innerHTML = getVehicleLogo(currentProfileName, 'h-7 w-7 sm:h-8 sm:w-8');
    if (specVehicleName) specVehicleName.textContent = currentProfileName;
    if (specFuelBadge) specFuelBadge.innerHTML = `<i data-lucide="check-circle-2" class="h-3 w-3 mr-1 inline"></i> ${specs.fuelGrade}`;
    if (specFuelDesc) specFuelDesc.textContent = specs.fuelDesc;
    if (specTankSize) specTankSize.textContent = `${formatNumber(specs.tankCapacity, 1)} L`;

    const fullRange = avgEconomy > 0 ? (specs.tankCapacity * avgEconomy) : 0;

    if (specFullRange) {
        specFullRange.textContent = fullRange > 0 ? `~${formatNumber(fullRange, 0)} km` : '-- km';
    }

    if (specFullCost) {
        specFullCost.textContent = latestPrice > 0 ? formatCurrency(specs.tankCapacity * latestPrice) : '₱--';
    }

    if (specCostPerKm) {
        if (fuelCostPerKm > 0) {
            specCostPerKm.textContent = `${formatCurrency(fuelCostPerKm)}/km`;
        } else if (latestPrice > 0 && avgEconomy > 0) {
            specCostPerKm.textContent = `${formatCurrency(latestPrice / avgEconomy)}/km`;
        } else {
            specCostPerKm.textContent = '₱--/km';
        }
    }

    updateLitersPercentHint();
    updateMapPanelDefaults();
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
        litersPercentHint.className = 'text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1 block';
    } else {
        litersPercentHint.textContent = `Tank capacity: ${specs.tankCapacity} L`;
        litersPercentHint.className = 'text-[11px] text-gray-500 dark:text-slate-400 mt-1 block';
    }
};

const calculateFormTotal = () => {
    const liters = parseFloat(litersInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = liters * price;
    if (calculatedTotal) calculatedTotal.textContent = formatCurrency(total);

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);

    if (calculatedRange) {
        if (liters > 0 && avgEconomy > 0) {
            const rangeAdded = liters * avgEconomy;
            calculatedRange.textContent = `+${formatNumber(rangeAdded, 1)} km`;
        } else {
            calculatedRange.textContent = '+0 km';
        }
    }

    if (calculatedCostPerKm) {
        if (price > 0 && avgEconomy > 0) {
            const costPerKm = price / avgEconomy;
            calculatedCostPerKm.textContent = `${formatCurrency(costPerKm)}/km`;
        } else {
            calculatedCostPerKm.textContent = '₱0.00/km';
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
    tripRecords.forEach(r => {
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

const getCurrentVehicleOdometer = (profileName) => {
    const profileFuel = records.filter(r => r.profile === profileName || (profileName === 'Chery' && r.profile === 'Cherry'));
    const profileMaint = maintRecords.filter(r => r.profile === profileName || (profileName === 'Chery' && r.profile === 'Cherry'));
    const allOdos = [
        ...profileFuel.map(r => Number(r.odometer)),
        ...profileMaint.map(r => Number(r.odometer))
    ].filter(v => v && !isNaN(v));
    return allOdos.length > 0 ? Math.max(...allOdos) : 0;
};

const updateOdometerHints = () => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileFuel = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const profileMaint = maintRecords.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));

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

// ==================== CHART ====================
const updateChart = (data) => {
    const ctx = document.getElementById('efficiencyChart');
    if (!ctx) return;

    const chartData = data.filter(r => r.kmPerLiter !== null);

    if (chartData.length === 0) {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    const labels = chartData.map(r => {
        const d = new Date(r.date);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });
    
    const values = chartData.map(r => r.kmPerLiter);

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = values;
        chartInstance.options.scales.x.grid.color = gridColor;
        chartInstance.options.scales.y.grid.color = gridColor;
        chartInstance.options.scales.x.ticks.color = textColor;
        chartInstance.options.scales.y.ticks.color = textColor;
        chartInstance.update();
    } else {
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Fuel Economy (km/L)',
                    data: values,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
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
                            label: (context) => `${context.parsed.y.toFixed(2)} km/L`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: (value) => `${value} km/L`
                        }
                    },
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }
};

// ==================== STATS & DASHBOARD ====================
const updateStats = (processedData) => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    
    if (processedData.length <= 1) {
        statAvgEconomy.textContent = '-- km/L';
        statAvgCost.textContent = '₱--';
        statMonthlyPesos.textContent = '₱--';
        statMonthlyLiters.textContent = '-- L / month';
        statTrueCost.textContent = '₱--';
        statTotalDist.textContent = '-- km';
        updateVehicleSpecsAndRange(0, 0, 0);
        return;
    }

    let totalTripKm = 0;
    let totalLiters = 0;
    let totalFuelAmount = 0;

    for (let i = 1; i < processedData.length; i++) {
        if (processedData[i].tripKm) totalTripKm += processedData[i].tripKm;
        if (processedData[i].liters) {
            totalLiters += processedData[i].liters;
            totalFuelAmount += (processedData[i].liters * processedData[i].pricePerLiter);
        }
    }

    const avgEconomy = totalLiters > 0 ? (totalTripKm / totalLiters) : 0;
    const fuelCostPerKm = totalTripKm > 0 ? (totalFuelAmount / totalTripKm) : 0;

    const profileMaint = maintRecords.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const totalMaintCost = profileMaint.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const trueCostPerKm = totalTripKm > 0 ? ((totalFuelAmount + totalMaintCost) / totalTripKm) : fuelCostPerKm;

    statAvgEconomy.textContent = avgEconomy > 0 ? `${formatNumber(avgEconomy)} km/L` : '-- km/L';
    statAvgCost.textContent = fuelCostPerKm > 0 ? `${formatCurrency(fuelCostPerKm)}/km` : '₱--';
    statTrueCost.textContent = trueCostPerKm > 0 ? `${formatCurrency(trueCostPerKm)}/km` : '₱--';
    statTotalDist.textContent = `${formatNumber(totalTripKm, 0)} km`;

    const sortedByDate = [...processedData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstDate = new Date(sortedByDate[0].date);
    const lastDate = new Date(sortedByDate[sortedByDate.length - 1].date);
    const diffDays = Math.max(1, Math.ceil(Math.abs(lastDate - firstDate) / (1000 * 60 * 60 * 24)));

    const kmPerDay = totalTripKm / diffDays;
    const monthlyKm = kmPerDay * 30;
    const monthlyLiters = avgEconomy > 0 ? (monthlyKm / avgEconomy) : 0;
    
    const latestPrice = sortedByDate[sortedByDate.length - 1].pricePerLiter || 0;
    const monthlyPesos = monthlyLiters * latestPrice;

    statMonthlyPesos.textContent = monthlyPesos > 0 ? formatCurrency(monthlyPesos) : '₱--';
    statMonthlyLiters.textContent = monthlyLiters > 0 ? `${formatNumber(monthlyLiters, 1)} L / month` : '-- L / month';

    updateVehicleSpecsAndRange(avgEconomy, latestPrice, fuelCostPerKm);
};

// ==================== PREVENTATIVE MAINTENANCE METERS ====================
const defaultServiceSchedules = {
    'Oil Change': { intervalKm: 2000, icon: 'droplet', color: 'blue' },
    'Gear Oil': { intervalKm: 4000, icon: 'shield', color: 'indigo' },
    'CVT Cleaning / Belt': { intervalKm: 8000, icon: 'cog', color: 'orange' },
    'Spark Plug / Air Filter': { intervalKm: 6000, icon: 'zap', color: 'amber' }
};

const renderServiceReminders = () => {
    if (!serviceRemindersGrid) return;
    serviceRemindersGrid.innerHTML = '';

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const currentOdo = getCurrentVehicleOdometer(currentProfileName);

    if (reminderCurrentOdo) {
        reminderCurrentOdo.textContent = currentOdo > 0 ? `${formatNumber(currentOdo, 0)} km` : 'No odometer logged';
    }

    const profileMaint = maintRecords.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));

    const customKey = `custom_services_${currentProfileName}`;
    const customList = JSON.parse(localStorage.getItem(customKey)) || [];

    const allSchedules = { ...defaultServiceSchedules };
    customList.forEach(c => {
        allSchedules[c.type] = { intervalKm: c.intervalKm, icon: 'wrench', color: 'purple' };
    });

    Object.keys(allSchedules).forEach(serviceType => {
        const schedule = allSchedules[serviceType];
        const matchingLogs = profileMaint
            .filter(r => r.type && r.type.toLowerCase() === serviceType.toLowerCase())
            .sort((a, b) => Number(b.odometer) - Number(a.odometer));

        const lastServiceOdo = matchingLogs.length > 0 ? Number(matchingLogs[0].odometer) : 0;
        const kmSinceLast = currentOdo >= lastServiceOdo ? (currentOdo - lastServiceOdo) : 0;
        const kmRemaining = schedule.intervalKm - kmSinceLast;
        const percentUsed = Math.min(100, Math.max(0, (kmSinceLast / schedule.intervalKm) * 100));

        let healthColorClass = 'bg-emerald-500';
        let badgeBg = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300';
        let statusText = `${formatNumber(Math.max(0, kmRemaining), 0)} km left`;

        if (percentUsed >= 100) {
            healthColorClass = 'bg-red-500 animate-pulse';
            badgeBg = 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300';
            statusText = `Overdue by ${formatNumber(Math.abs(kmRemaining), 0)} km!`;
        } else if (percentUsed >= 80) {
            healthColorClass = 'bg-amber-500';
            badgeBg = 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300';
            statusText = `Due soon: ${formatNumber(kmRemaining, 0)} km left`;
        }

        const card = document.createElement('div');
        card.className = 'bg-gray-50 dark:bg-slate-950 rounded-xl p-4 border border-gray-200/80 dark:border-slate-800 flex flex-col justify-between hover:shadow-xs transition-shadow';
        card.innerHTML = `
            <div>
                <div class="flex items-start justify-between mb-2">
                    <span class="text-xs font-bold text-gray-900 dark:text-white">${serviceType}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}">${statusText}</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2 mt-2 mb-2 overflow-hidden">
                    <div class="${healthColorClass} h-2 rounded-full transition-all duration-500" style="width: ${percentUsed}%"></div>
                </div>
            </div>
            <div class="flex justify-between items-center text-[11px] text-gray-500 dark:text-slate-400 mt-2 pt-2 border-t border-gray-200/60 dark:border-slate-800/80">
                <span>Last: ${lastServiceOdo > 0 ? formatNumber(lastServiceOdo, 0) + ' km' : 'Never'}</span>
                <span>Every: ${formatNumber(schedule.intervalKm, 0)} km</span>
            </div>
        `;
        serviceRemindersGrid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
};

if (addCustomServiceBtn) {
    addCustomServiceBtn.addEventListener('click', () => {
        const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
        const name = prompt(`Enter custom service name for "${currentProfileName}" (e.g. Brake Fluid, Coolant, Tire Rotation):`);
        if (!name || !name.trim()) return;

        const interval = prompt(`Every how many km should "${name}" be performed? (e.g. 10000):`, '10000');
        if (!interval || isNaN(interval) || parseFloat(interval) <= 0) return;

        const customKey = `custom_services_${currentProfileName}`;
        const customList = JSON.parse(localStorage.getItem(customKey)) || [];
        customList.push({ type: name.trim(), intervalKm: parseFloat(interval) });
        localStorage.setItem(customKey, JSON.stringify(customList));

        renderServiceReminders();
    });
}

// ==================== TABLES RENDERERS ====================
const renderTable = () => {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileRecords = records.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);

    const tableEl = historyTableBody.closest('table');
    if (profileRecords.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableEl) tableEl.classList.add('hidden');
        updateStats([]);
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        updateOdometerHints();
        updateVehicleSpecsAndRange(0, 0, 0);
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableEl) tableEl.classList.remove('hidden');

    const processedData = processRecords(profileRecords);
    const displayData = [...processedData].sort((a, b) => new Date(b.date) - new Date(a.date));

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors';
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        const pctTank = (row.liters > 0 && specs.tankCapacity > 0) ? `${((row.liters / specs.tankCapacity) * 100).toFixed(0)}% tank` : '';
        const economyToUse = row.kmPerLiter || avgEconomy;
        const rangeAddedVal = (row.liters > 0 && economyToUse > 0) ? (row.liters * economyToUse) : null;
        const rangeAddedStr = rangeAddedVal ? `+${formatNumber(rangeAddedVal, 0)} km` : '';

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-50 dark:bg-yellow-950/25">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-slate-400">${row.tripKm !== null ? row.tripKm : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right bg-amber-50/50 dark:bg-amber-950/20">
                <div class="text-amber-700 dark:text-amber-400 font-bold">${formatNumber(row.liters)} L</div>
                <div class="text-[11px] flex items-center justify-end space-x-1 mt-0.5">
                    ${pctTank ? `<span class="text-[10px] text-gray-400 dark:text-slate-500 font-medium">${pctTank}</span>` : ''}
                    ${rangeAddedStr ? `<span class="inline-flex items-center text-[10px] bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">${rangeAddedStr}</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-700 dark:text-amber-400 font-medium bg-amber-50/50 dark:bg-amber-950/20">${formatCurrency(row.pricePerLiter)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-slate-100 font-medium">${formatCurrency(row.amount)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right bg-blue-50/70 dark:bg-blue-950/30 border-x border-blue-100/60 dark:border-blue-900/40">
                ${row.pesoPerKm !== null ? `<span class="inline-flex items-center text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-2xs border border-blue-200 dark:border-blue-800">${formatCurrency(row.pesoPerKm)}/km</span>` : '<span class="text-gray-400 dark:text-slate-500">-</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 dark:text-emerald-400 font-medium bg-green-50 dark:bg-emerald-950/20">${row.kmPerLiter !== null ? formatNumber(row.kmPerLiter) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right bg-amber-50 dark:bg-amber-950/20">
                <div class="text-amber-900 dark:text-amber-300 font-bold">${row.pesosIn30Days !== null ? formatCurrency(row.pesosIn30Days) : '-'}</div>
                <div class="text-[11px] text-gray-500 dark:text-slate-400 font-medium">${row.litersIn30Days !== null ? formatNumber(row.litersIn30Days) + ' L' : ''}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="editRecord('${row.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors mr-1" title="Edit">
                    <i data-lucide="edit-2" class="h-4 w-4"></i>
                </button>
                <button onclick="deleteRecord('${row.id}')" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors" title="Delete">
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
        tr.className = 'hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors';
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-50 dark:bg-yellow-950/25">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100 font-medium">${row.type}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">${row.notes || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-700 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-950/20">${formatCurrency(row.cost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="editMaintRecord('${row.id}')" class="text-orange-600 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300 p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-950/50 transition-colors mr-1" title="Edit">
                    <i data-lucide="edit-2" class="h-4 w-4"></i>
                </button>
                <button onclick="deleteMaintRecord('${row.id}')" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors" title="Delete">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        maintTableBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
    updateOdometerHints();
    renderServiceReminders();
};

// ==================== RENDER RECORDED TRIPS & TRAVEL TIMES TABLE ====================
const renderTripsTable = () => {
    if (!tripsTableBody) return;
    tripsTableBody.innerHTML = '';

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileTrips = tripRecords.filter(r => (r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry')));
    const tableContainer = tripsTableBody.closest('table');

    if (profileTrips.length === 0) {
        if (tripsEmptyState) tripsEmptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        return;
    }

    if (tripsEmptyState) tripsEmptyState.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');

    const displayTrips = [...profileTrips].sort((a, b) => new Date(b.date) - new Date(a.date));

    displayTrips.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors';
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        const estSec = row.estimatedSec || 0;
        const actualSec = row.actualSec || 0;
        const diffSec = actualSec - estSec;

        let diffHtml = '<span class="text-gray-400 dark:text-slate-500">-</span>';
        if (actualSec > 0 && estSec > 0) {
            const diffMin = Math.round(diffSec / 60);
            if (diffMin > 1) {
                const pct = Math.round((diffSec / estSec) * 100);
                diffHtml = `<span class="inline-flex items-center text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">+${diffMin}m (+${pct}%)</span>`;
            } else if (diffMin < -1) {
                diffHtml = `<span class="inline-flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/60">${diffMin}m (Faster)</span>`;
            } else {
                diffHtml = `<span class="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/60">On Time</span>`;
            }
        }

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                <div class="font-medium">${formattedDate}</div>
                <div class="text-[11px] text-gray-400 dark:text-slate-500">${formattedTime}</div>
            </td>
            <td class="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                <div class="flex items-center space-x-1.5">
                    <span>${row.origin || 'Start'}</span>
                    <i data-lucide="arrow-right" class="h-3.5 w-3.5 text-blue-500 shrink-0 inline"></i>
                    <span>${row.destination || 'Destination'}</span>
                    ${row.isRoundTrip ? '<span class="ml-1 text-[10px] bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold">2-Way</span>' : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">${formatNumber(row.distanceKm, 1)} km</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700 dark:text-blue-300 font-medium bg-blue-50/50 dark:bg-blue-950/20">${formatDuration(estSec)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border-x border-emerald-100 dark:border-emerald-900/40">
                ${actualSec > 0 ? formatDuration(actualSec) : '<span class="text-gray-400 font-normal">--</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${diffHtml}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                <div class="font-bold text-blue-600 dark:text-blue-400">${formatCurrency(row.tripCost)}</div>
                <div class="text-[11px] text-gray-400 dark:text-slate-500">${formatNumber(row.fuelConsumed, 2)} L</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="deleteTripRecord('${row.id}')" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors" title="Delete Trip Record">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        tripsTableBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
};

window.deleteTripRecord = async (id) => {
    if (confirm('Delete this trip record?')) {
        try {
            await deleteDoc(doc(db, "tripRecords", id));
        } catch (err) {
            alert('Failed to delete trip record: ' + err.message);
        }
    }
};

// ==================== MAP MODULE (LEAFLET + NOMINATIM + OSRM) ====================
const initMap = () => {
    if (leafletMap) return;
    const mapContainer = document.getElementById('map');
    if (!mapContainer || !window.L) return;

    leafletMap = L.map('map', {
        center: radiusOrigin,
        zoom: 9,
        zoomControl: true
    });

    updateMapTileLayer();
    renderRadiusCircle();

    leafletMap.on('click', (e) => {
        if (currentMapMode === 'radius') {
            radiusOrigin = [e.latlng.lat, e.latlng.lng];
            renderRadiusCircle();
            reverseGeocode(e.latlng.lat, e.latlng.lng).then(name => {
                if (radiusSearchInput) {
                    radiusSearchInput.value = name;
                    if (radiusClearSearchBtn) radiusClearSearchBtn.classList.remove('hidden');
                }
            });
        } else if (currentMapMode === 'route') {
            handleRouteMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
};

const updateMapTileLayer = () => {
    if (!leafletMap || !window.L) return;
    const isDark = document.documentElement.classList.contains('dark');

    if (currentTileLayer) {
        leafletMap.removeLayer(currentTileLayer);
    }

    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const subdomains = 'abcd';
    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    const tileOptions = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    currentTileLayer = L.tileLayer(tileOptions, {
        attribution: attribution,
        maxZoom: 19,
        subdomains: subdomains
    }).addTo(leafletMap);
};

// ==================== GEOCODING & AUTOCOMPLETE ====================
let geocodeCache = {};

const searchNominatim = async (query) => {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();
    if (geocodeCache[q]) return geocodeCache[q];

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ph&limit=6&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        
        if (data.length === 0) {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
            const fallbackRes = await fetch(fallbackUrl, { headers: { 'Accept-Language': 'en' } });
            const fallbackData = await fallbackRes.json();
            geocodeCache[q] = fallbackData;
            return fallbackData;
        }

        geocodeCache[q] = data;
        return data;
    } catch (e) {
        console.warn('Geocoding error:', e);
        return [];
    }
};

const reverseGeocode = async (lat, lon) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (data && data.display_name) {
            const parts = data.display_name.split(',');
            return parts.slice(0, 3).join(',').trim();
        }
    } catch (e) {
        console.warn('Reverse geocode error:', e);
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
};

const setupLocationSearch = (inputEl, clearBtn, dropdownEl, onSelectCallback) => {
    if (!inputEl || !dropdownEl) return;

    let debounceTimer = null;

    inputEl.addEventListener('input', () => {
        const val = inputEl.value;
        if (clearBtn) {
            if (val.length > 0) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
        }

        clearTimeout(debounceTimer);
        if (val.trim().length < 2) {
            dropdownEl.classList.add('hidden');
            dropdownEl.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            dropdownEl.innerHTML = '<div class="p-3 text-xs text-gray-500 dark:text-slate-400 text-center flex items-center justify-center"><i data-lucide="loader-2" class="h-3.5 w-3.5 mr-1.5 animate-spin"></i> Searching locations...</div>';
            dropdownEl.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();

            const results = await searchNominatim(val);
            if (results.length === 0) {
                dropdownEl.innerHTML = '<div class="p-3 text-xs text-gray-500 dark:text-slate-400 text-center">No locations found. Try another city or landmark.</div>';
                return;
            }

            dropdownEl.innerHTML = '';
            results.forEach(place => {
                const item = document.createElement('div');
                item.className = 'px-3.5 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer text-xs flex items-start space-x-2 transition-colors';
                
                const parts = place.display_name.split(',');
                const title = parts[0];
                const subtitle = parts.slice(1, 4).join(',').trim();

                item.innerHTML = `
                    <i data-lucide="map-pin" class="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0"></i>
                    <div class="min-w-0">
                        <strong class="block text-gray-900 dark:text-white font-semibold truncate">${title}</strong>
                        <span class="text-[11px] text-gray-500 dark:text-slate-400 truncate block">${subtitle}</span>
                    </div>
                `;

                item.addEventListener('click', () => {
                    const lat = parseFloat(place.lat);
                    const lon = parseFloat(place.lon);
                    inputEl.value = `${title}, ${subtitle}`;
                    dropdownEl.classList.add('hidden');
                    if (clearBtn) clearBtn.classList.remove('hidden');
                    if (onSelectCallback) onSelectCallback(lat, lon, title);
                });

                dropdownEl.appendChild(item);
            });

            if (window.lucide) lucide.createIcons();
        }, 320);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            inputEl.value = '';
            clearBtn.classList.add('hidden');
            dropdownEl.classList.add('hidden');
            inputEl.focus();
        });
    }

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });
};

// ==================== MAP: RADIUS VISUALIZER ====================
const updateMapPanelDefaults = () => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);
    const fullRange = avgEconomy > 0 ? (specs.tankCapacity * avgEconomy) : 360;

    if (radiusTargetVehicle) radiusTargetVehicle.textContent = currentProfileName;
    if (radiusAvgEcon) radiusAvgEcon.textContent = `${formatNumber(avgEconomy, 1)} km/L`;

    if (radiusSlider && !radiusSlider.dataset.userModified) {
        radiusSlider.max = Math.max(800, Math.round(fullRange * 1.5));
        radiusSlider.value = Math.round(fullRange);
    }

    renderRadiusCircle();
};

const renderRadiusCircle = () => {
    if (!leafletMap || !window.L) return;

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);
    const latestPrice = getLatestFuelPrice(currentProfileName);

    const rangeKm = radiusSlider ? parseFloat(radiusSlider.value) : 360;
    const radiusMeters = rangeKm * 1000;

    if (radiusCircle) {
        radiusCircle.setLatLng(radiusOrigin);
        radiusCircle.setRadius(radiusMeters);
    } else {
        radiusCircle = L.circle(radiusOrigin, {
            radius: radiusMeters,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.18,
            weight: 2
        }).addTo(leafletMap);
    }

    if (radiusMarker) {
        radiusMarker.setLatLng(radiusOrigin);
    } else {
        const customPinHtml = `
            <div class="relative flex items-center justify-center">
                <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-75"></span>
                <div class="relative inline-flex rounded-full h-8 w-8 bg-blue-600 text-white items-center justify-center border-2 border-white shadow-lg">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
            </div>
        `;
        
        const pinIcon = L.divIcon({
            html: customPinHtml,
            className: 'custom-map-pin',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        radiusMarker = L.marker(radiusOrigin, { icon: pinIcon, draggable: true }).addTo(leafletMap);
        
        radiusMarker.on('dragend', async (e) => {
            const pos = e.target.getLatLng();
            radiusOrigin = [pos.lat, pos.lng];
            renderRadiusCircle();
            const placeName = await reverseGeocode(pos.lat, pos.lng);
            if (radiusSearchInput) {
                radiusSearchInput.value = placeName;
                if (radiusClearSearchBtn) radiusClearSearchBtn.classList.remove('hidden');
            }
        });

        radiusMarker.bindPopup(`
            <div class="p-1 text-xs">
                <strong class="text-blue-600 font-bold block mb-0.5">${currentProfileName} Origin</strong>
                <span>Driving reach radius: <strong>~${formatNumber(rangeKm, 0)} km</strong></span>
            </div>
        `);
    }

    if (radiusValLabel) radiusValLabel.textContent = `~${formatNumber(rangeKm, 0)} km`;
    
    const fuelNeeded = avgEconomy > 0 ? (rangeKm / avgEconomy) : 0;
    if (radiusFuelNeeded) radiusFuelNeeded.textContent = `${formatNumber(fuelNeeded, 1)} L (${formatNumber((fuelNeeded / specs.tankCapacity) * 100, 0)}% Tank)`;
    
    const refuelCost = fuelNeeded * latestPrice;
    if (radiusRefuelCost) radiusRefuelCost.textContent = formatCurrency(refuelCost);
};

// Range slider input
if (radiusSlider) {
    radiusSlider.addEventListener('input', () => {
        document.querySelectorAll('.radius-preset-btn').forEach(b => b.classList.remove('active-preset', 'border-blue-600', 'bg-blue-50', 'text-blue-700', 'dark:bg-blue-950/70', 'dark:text-blue-300'));
        renderRadiusCircle();
    });
}

// Range Preset Buttons
document.querySelectorAll('.radius-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.radius-preset-btn').forEach(b => {
            b.classList.remove('active-preset', 'border-blue-600', 'bg-blue-50', 'text-blue-700', 'dark:bg-blue-950/70', 'dark:text-blue-300');
            b.classList.add('border-gray-200', 'text-gray-700', 'dark:border-slate-700', 'dark:text-slate-300');
        });
        btn.classList.add('active-preset', 'border-blue-600', 'bg-blue-50', 'text-blue-700', 'dark:bg-blue-950/70', 'dark:text-blue-300');
        btn.classList.remove('border-gray-200', 'text-gray-700', 'dark:border-slate-700', 'dark:text-slate-300');

        const fraction = parseFloat(btn.dataset.fraction) || 1.0;
        const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
        const specs = getVehicleSpecs(currentProfileName);
        const avgEconomy = getVehicleAvgEconomy(currentProfileName);
        const fullRange = avgEconomy > 0 ? (specs.tankCapacity * avgEconomy) : 360;

        const targetRange = Math.round(fullRange * fraction);
        if (radiusSlider) {
            radiusSlider.value = targetRange;
        }
        renderRadiusCircle();
        if (leafletMap && radiusCircle) {
            leafletMap.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
        }
    });
});

// Radius Location Search Setup
setupLocationSearch(radiusSearchInput, radiusClearSearchBtn, radiusSearchResults, (lat, lng, name) => {
    radiusOrigin = [lat, lng];
    if (leafletMap) {
        leafletMap.setView(radiusOrigin, 10);
    }
    renderRadiusCircle();
});

// Locate Me button
const handleLocateMe = (btnEl) => {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }
    if (btnEl) {
        btnEl.innerHTML = '<i data-lucide="loader-2" class="h-3.5 w-3.5 mr-1 animate-spin"></i> Locating...';
        if (window.lucide) lucide.createIcons();
    }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            radiusOrigin = [pos.coords.latitude, pos.coords.longitude];
            if (leafletMap) {
                leafletMap.setView(radiusOrigin, 11);
            }
            renderRadiusCircle();
            const placeName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            if (radiusSearchInput) {
                radiusSearchInput.value = placeName;
                if (radiusClearSearchBtn) radiusClearSearchBtn.classList.remove('hidden');
            }
            if (btnEl) {
                btnEl.innerHTML = '<i data-lucide="crosshair" class="h-3.5 w-3.5 mr-1"></i> My Location';
                if (window.lucide) lucide.createIcons();
            }
        },
        (err) => {
            console.warn('Geolocation error:', err);
            alert('Could not retrieve your location. Setting to Manila.');
            if (btnEl) {
                btnEl.innerHTML = '<i data-lucide="crosshair" class="h-3.5 w-3.5 mr-1"></i> My Location';
                if (window.lucide) lucide.createIcons();
            }
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
};

if (mapLocateBtn) mapLocateBtn.addEventListener('click', () => handleLocateMe(mapLocateBtn));
if (mapCanvasLocateBtn) mapCanvasLocateBtn.addEventListener('click', () => handleLocateMe(mapCanvasLocateBtn));

// Quick Search on Map Canvas
setupLocationSearch(mapQuickSearchInput, mapQuickSearchClear, mapQuickSearchResults, (lat, lng, name) => {
    if (currentMapMode === 'radius') {
        radiusOrigin = [lat, lng];
        if (leafletMap) leafletMap.setView(radiusOrigin, 11);
        renderRadiusCircle();
        if (radiusSearchInput) {
            radiusSearchInput.value = name;
            if (radiusClearSearchBtn) radiusClearSearchBtn.classList.remove('hidden');
        }
    } else {
        if (!routePinA) {
            routePinA = [lat, lng];
            if (routeOriginInput) routeOriginInput.value = name;
            if (routeOriginClear) routeOriginClear.classList.remove('hidden');
        } else {
            routePinB = [lat, lng];
            if (routeDestInput) routeDestInput.value = name;
            if (routeDestClear) routeDestClear.classList.remove('hidden');
        }
        renderRouteMarkers();
        if (routePinA && routePinB) {
            calculateAndDrawRoute();
        } else if (leafletMap) {
            leafletMap.setView([lat, lng], 11);
        }
    }
});

// ==================== MAP: TRIP ROUTE & TRAVEL TIME ENGINE ====================
const popularRoutes = {
    'tagaytay': { start: [14.5995, 120.9842], startName: 'Manila', end: [14.1153, 120.9621], endName: 'Tagaytay City' },
    'baguio': { start: [14.5995, 120.9842], startName: 'Manila', end: [16.4023, 120.5960], endName: 'Baguio City' },
    'launion': { start: [14.5995, 120.9842], startName: 'Manila', end: [16.6710, 120.3340], endName: 'San Juan, La Union' },
    'subic': { start: [14.5995, 120.9842], startName: 'Manila', end: [14.8236, 120.2796], endName: 'Subic Bay' },
    'batangas': { start: [14.5995, 120.9842], startName: 'Manila', end: [13.7565, 121.0450], endName: 'Batangas Port' },
    'baler': { start: [14.5995, 120.9842], startName: 'Manila', end: [15.7594, 121.5624], endName: 'Baler, Aurora' },
    'lucban': { start: [14.5995, 120.9842], startName: 'Manila', end: [14.1141, 121.5544], endName: 'Lucban, Quezon' },
    'naga': { start: [14.5995, 120.9842], startName: 'Manila', end: [13.6218, 123.1948], endName: 'Naga City' }
};

// Route Origin Location Search Setup
setupLocationSearch(routeOriginInput, routeOriginClear, routeOriginResults, (lat, lng, name) => {
    routePinA = [lat, lng];
    renderRouteMarkers();
    if (routePinB) {
        calculateAndDrawRoute();
    } else if (leafletMap) {
        leafletMap.setView(routePinA, 11);
    }
});

// Route Destination Location Search Setup
setupLocationSearch(routeDestInput, routeDestClear, routeDestResults, (lat, lng, name) => {
    routePinB = [lat, lng];
    renderRouteMarkers();
    if (routePinA) {
        calculateAndDrawRoute();
    } else if (leafletMap) {
        leafletMap.setView(routePinB, 11);
    }
});

// Swap Route Button
if (swapRouteBtn) {
    swapRouteBtn.addEventListener('click', () => {
        const tempPin = routePinA;
        routePinA = routePinB;
        routePinB = tempPin;

        const tempVal = routeOriginInput ? routeOriginInput.value : '';
        if (routeOriginInput && routeDestInput) {
            routeOriginInput.value = routeDestInput.value;
            routeDestInput.value = tempVal;
        }

        if (routeOriginClear && routeDestClear) {
            if (routeOriginInput.value) routeOriginClear.classList.remove('hidden');
            else routeOriginClear.classList.add('hidden');
            if (routeDestInput.value) routeDestClear.classList.remove('hidden');
            else routeDestClear.classList.add('hidden');
        }

        renderRouteMarkers();
        if (routePinA && routePinB) {
            calculateAndDrawRoute();
        }
    });
}

// Route Start GPS Locate
if (routeLocateStartBtn) {
    routeLocateStartBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        routeLocateStartBtn.innerHTML = '<i data-lucide="loader-2" class="h-3 w-3 mr-0.5 animate-spin"></i> Locating...';
        if (window.lucide) lucide.createIcons();

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                routePinA = [pos.coords.latitude, pos.coords.longitude];
                const placeName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                if (routeOriginInput) {
                    routeOriginInput.value = placeName;
                    if (routeOriginClear) routeOriginClear.classList.remove('hidden');
                }
                renderRouteMarkers();
                if (routePinB) {
                    calculateAndDrawRoute();
                } else if (leafletMap) {
                    leafletMap.setView(routePinA, 11);
                }
                routeLocateStartBtn.innerHTML = '<i data-lucide="crosshair" class="h-3 w-3 mr-0.5"></i> My GPS';
                if (window.lucide) lucide.createIcons();
            },
            (err) => {
                alert('Could not retrieve your GPS location.');
                routeLocateStartBtn.innerHTML = '<i data-lucide="crosshair" class="h-3 w-3 mr-0.5"></i> My GPS';
                if (window.lucide) lucide.createIcons();
            }
        );
    });
}

const handleRouteMapClick = async (lat, lng) => {
    const placeName = await reverseGeocode(lat, lng);

    if (!routePinA) {
        routePinA = [lat, lng];
        if (routeOriginInput) {
            routeOriginInput.value = placeName;
            if (routeOriginClear) routeOriginClear.classList.remove('hidden');
        }
        renderRouteMarkers();
    } else if (!routePinB) {
        routePinB = [lat, lng];
        if (routeDestInput) {
            routeDestInput.value = placeName;
            if (routeDestClear) routeDestClear.classList.remove('hidden');
        }
        renderRouteMarkers();
        calculateAndDrawRoute();
    } else {
        routePinA = [lat, lng];
        routePinB = null;
        if (routeOriginInput) {
            routeOriginInput.value = placeName;
            if (routeOriginClear) routeOriginClear.classList.remove('hidden');
        }
        if (routeDestInput) {
            routeDestInput.value = '';
            if (routeDestClear) routeDestClear.classList.add('hidden');
        }
        if (routeGeoJsonLayer && leafletMap) leafletMap.removeLayer(routeGeoJsonLayer);
        renderRouteMarkers();
    }
};

const renderRouteMarkers = () => {
    if (!leafletMap || !window.L) return;

    if (markerPinA) leafletMap.removeLayer(markerPinA);
    if (markerPinB) leafletMap.removeLayer(markerPinB);

    if (routePinA) {
        const pinAHtml = `
            <div class="relative inline-flex rounded-full h-8 w-8 bg-blue-600 text-white items-center justify-center border-2 border-white shadow-lg text-xs font-bold">
                A
            </div>
        `;
        markerPinA = L.marker(routePinA, {
            icon: L.divIcon({ html: pinAHtml, className: 'custom-pin-a', iconSize: [32, 32], iconAnchor: [16, 16] }),
            draggable: true
        }).addTo(leafletMap).bindPopup('<b>Starting Point (A)</b>');

        markerPinA.on('dragend', async (e) => {
            const pos = e.target.getLatLng();
            routePinA = [pos.lat, pos.lng];
            const name = await reverseGeocode(pos.lat, pos.lng);
            if (routeOriginInput) routeOriginInput.value = name;
            if (routePinB) calculateAndDrawRoute();
        });
    }

    if (routePinB) {
        const pinBHtml = `
            <div class="relative inline-flex rounded-full h-8 w-8 bg-orange-600 text-white items-center justify-center border-2 border-white shadow-lg text-xs font-bold">
                B
            </div>
        `;
        markerPinB = L.marker(routePinB, {
            icon: L.divIcon({ html: pinBHtml, className: 'custom-pin-b', iconSize: [32, 32], iconAnchor: [16, 16] }),
            draggable: true
        }).addTo(leafletMap).bindPopup('<b>Destination Point (B)</b>');

        markerPinB.on('dragend', async (e) => {
            const pos = e.target.getLatLng();
            routePinB = [pos.lat, pos.lng];
            const name = await reverseGeocode(pos.lat, pos.lng);
            if (routeDestInput) routeDestInput.value = name;
            if (routePinA) calculateAndDrawRoute();
        });
    }
};

const calculateAndDrawRoute = async () => {
    if (!routePinA || !routePinB) return;

    if (routeDistanceVal) routeDistanceVal.textContent = 'Calculating...';
    if (routeCostVal) routeCostVal.textContent = '₱--';

    const lon1 = routePinA[1];
    const lat1 = routePinA[0];
    const lon2 = routePinB[1];
    const lat2 = routePinB[0];

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceKm = route.distance / 1000;
            const durationSec = route.duration;
            
            if (routeGeoJsonLayer && leafletMap) {
                leafletMap.removeLayer(routeGeoJsonLayer);
            }

            routeGeoJsonLayer = L.geoJSON(route.geometry, {
                style: {
                    color: '#2563eb',
                    weight: 5,
                    opacity: 0.85
                }
            }).addTo(leafletMap);

            leafletMap.fitBounds(routeGeoJsonLayer.getBounds(), { padding: [40, 40] });

            updateRouteResults(distanceKm, durationSec);
        } else {
            fallbackStraightLineRoute(lat1, lon1, lat2, lon2);
        }
    } catch (e) {
        console.warn('OSRM routing fetch failed, calculating straight line:', e);
        fallbackStraightLineRoute(lat1, lon1, lat2, lon2);
    }
};

const fallbackStraightLineRoute = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightKm = (R * c) * 1.35;
    const durationSec = (straightKm / 45) * 3600;

    if (routeGeoJsonLayer && leafletMap) leafletMap.removeLayer(routeGeoJsonLayer);
    
    routeGeoJsonLayer = L.polyline([[lat1, lon1], [lat2, lon2]], {
        color: '#2563eb',
        weight: 4,
        dashArray: '6, 8'
    }).addTo(leafletMap);

    leafletMap.fitBounds(routeGeoJsonLayer.getBounds(), { padding: [40, 40] });
    updateRouteResults(straightKm, durationSec);
};

const updateRouteResults = (distanceKm, durationSec) => {
    const isRoundTrip = routeRoundTripCheck ? routeRoundTripCheck.checked : false;
    const totalKm = isRoundTrip ? distanceKm * 2 : distanceKm;
    const totalSec = isRoundTrip ? durationSec * 2 : durationSec;

    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);
    const latestPrice = getLatestFuelPrice(currentProfileName);
    const fullRange = avgEconomy > 0 ? (specs.tankCapacity * avgEconomy) : 360;

    const fuelConsumed = avgEconomy > 0 ? (totalKm / avgEconomy) : 0;
    const tripCost = fuelConsumed * latestPrice;
    const tankPctUsed = specs.tankCapacity > 0 ? ((fuelConsumed / specs.tankCapacity) * 100) : 0;

    // Traffic calculation: Philippine congestion models (free-flow + 25% to 55% buffer)
    const trafficLowSec = Math.round(totalSec * 1.25);
    const trafficHighSec = Math.round(totalSec * 1.55);

    // Current Time & ETA Window
    const now = new Date();
    const etaLow = new Date(now.getTime() + trafficLowSec * 1000);
    const etaHigh = new Date(now.getTime() + trafficHighSec * 1000);

    // Update Global Calculation Object
    currentRouteData = {
        distanceKm: totalKm,
        estimatedSec: totalSec,
        trafficLowSec: trafficLowSec,
        trafficHighSec: trafficHighSec,
        fuelConsumed: fuelConsumed,
        tripCost: tripCost,
        isRoundTrip: isRoundTrip
    };

    if (routeDistanceVal) routeDistanceVal.textContent = `${formatNumber(totalKm, 1)} km ${isRoundTrip ? '(Round Trip)' : ''}`;
    if (routeTimeVal) routeTimeVal.textContent = `~${formatDurationFull(totalSec)}`;
    if (routeTrafficTimeVal) routeTrafficTimeVal.textContent = `~${formatDuration(trafficLowSec)} – ${formatDuration(trafficHighSec)}`;
    if (routeEtaVal) routeEtaVal.textContent = `~${formatTimeOfDay(etaLow)} – ${formatTimeOfDay(etaHigh)}`;
    
    if (routeFuelVal) routeFuelVal.textContent = `${formatNumber(fuelConsumed, 2)} Liters`;
    if (routeTankPctVal) routeTankPctVal.textContent = `${formatNumber(tankPctUsed, 1)}% of ${specs.tankCapacity}L Tank`;
    if (routeCostVal) routeCostVal.textContent = formatCurrency(tripCost);

    if (routeRefuelWarning) {
        if (fuelConsumed > specs.tankCapacity || totalKm > fullRange) {
            routeRefuelWarning.classList.remove('hidden');
        } else {
            routeRefuelWarning.classList.add('hidden');
        }
    }

    if (recordedActualSec > 0) {
        updateActualTimeComparison();
    }
};

// ==================== LIVE ACTUAL TRIP TRACKER & STOPWATCH ====================
const updateStopwatchDisplay = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (tripStopwatchDisplay) tripStopwatchDisplay.textContent = formatted;
};

const updateActualTimeComparison = () => {
    if (!currentRouteData || recordedActualSec <= 0) return;

    if (actualRecordedTimeVal) {
        actualRecordedTimeVal.textContent = formatDurationFull(recordedActualSec);
    }

    const estSec = currentRouteData.estimatedSec || 0;
    const diffSec = recordedActualSec - estSec;
    const diffMin = Math.round(diffSec / 60);

    if (actualTimeDiffVal) {
        if (estSec === 0) {
            actualTimeDiffVal.textContent = 'Logged without route estimate';
            actualTimeDiffVal.className = 'font-semibold text-gray-600 dark:text-slate-400';
        } else if (diffMin > 1) {
            const pct = Math.round((diffSec / estSec) * 100);
            actualTimeDiffVal.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-bold">+${diffMin} min slower (+${pct}% delay)</span>`;
        } else if (diffMin < -1) {
            actualTimeDiffVal.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">${diffMin} min faster than estimate</span>`;
        } else {
            actualTimeDiffVal.innerHTML = `<span class="text-blue-600 dark:text-blue-400 font-bold">On Schedule (±1 min)</span>`;
        }
    }
};

if (startTripBtn) {
    startTripBtn.addEventListener('click', () => {
        isTripRunning = true;
        tripStartTime = Date.now();
        
        if (stopwatchInterval) clearInterval(stopwatchInterval);
        
        stopwatchInterval = setInterval(() => {
            const elapsedSec = Math.floor((Date.now() - tripStartTime) / 1000);
            updateStopwatchDisplay(elapsedSec);
        }, 1000);

        if (tripLiveStatusBadge) {
            tripLiveStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1 inline-block"></span> In Progress';
            tripLiveStatusBadge.className = 'text-[11px] bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800';
        }

        if (tripStopwatchHint) {
            tripStopwatchHint.textContent = `Trip started at ${formatTimeOfDay(new Date())}`;
        }

        startTripBtn.disabled = true;
        startTripBtn.classList.add('opacity-50', 'cursor-not-allowed');

        if (finishTripBtn) {
            finishTripBtn.disabled = false;
            finishTripBtn.classList.remove('bg-gray-200', 'dark:bg-slate-800', 'text-gray-400', 'dark:text-slate-600', 'cursor-not-allowed');
            finishTripBtn.classList.add('bg-orange-600', 'hover:bg-orange-700', 'text-white');
        }

        if (actualTripSummary) actualTripSummary.classList.add('hidden');
    });
}

if (finishTripBtn) {
    finishTripBtn.addEventListener('click', () => {
        isTripRunning = false;
        if (stopwatchInterval) clearInterval(stopwatchInterval);

        const elapsedSec = tripStartTime ? Math.max(1, Math.floor((Date.now() - tripStartTime) / 1000)) : 0;
        recordedActualSec = elapsedSec;

        updateStopwatchDisplay(elapsedSec);

        if (tripLiveStatusBadge) {
            tripLiveStatusBadge.innerHTML = '<i data-lucide="check" class="h-3 w-3 inline mr-0.5"></i> Completed';
            tripLiveStatusBadge.className = 'text-[11px] bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-800';
        }

        if (tripStopwatchHint) {
            tripStopwatchHint.textContent = `Finished at ${formatTimeOfDay(new Date())}`;
        }

        startTripBtn.disabled = false;
        startTripBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        startTripBtn.innerHTML = '<i data-lucide="play" class="h-3.5 w-3.5 mr-1.5 fill-white"></i> Restart Trip';

        finishTripBtn.disabled = true;
        finishTripBtn.classList.add('bg-gray-200', 'dark:bg-slate-800', 'text-gray-400', 'dark:text-slate-600', 'cursor-not-allowed');
        finishTripBtn.classList.remove('bg-orange-600', 'hover:bg-orange-700', 'text-white');

        if (manualActualHrs) manualActualHrs.value = Math.floor(elapsedSec / 3600);
        if (manualActualMins) manualActualMins.value = Math.round((elapsedSec % 3600) / 60);

        updateActualTimeComparison();
        if (actualTripSummary) actualTripSummary.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    });
}

// Manual Hours and Mins Input listeners
const handleManualActualTimeChange = () => {
    const hrs = parseInt(manualActualHrs.value) || 0;
    const mins = parseInt(manualActualMins.value) || 0;
    recordedActualSec = (hrs * 3600) + (mins * 60);
    updateStopwatchDisplay(recordedActualSec);
    updateActualTimeComparison();
};

if (manualActualHrs) manualActualHrs.addEventListener('input', handleManualActualTimeChange);
if (manualActualMins) manualActualMins.addEventListener('input', handleManualActualTimeChange);

// Save Trip Record to Firestore Log
if (saveTripLogBtn) {
    saveTripLogBtn.addEventListener('click', async () => {
        const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
        const originStr = (routeOriginInput && routeOriginInput.value) ? routeOriginInput.value.split(',')[0].trim() : 'Point A';
        const destStr = (routeDestInput && routeDestInput.value) ? routeDestInput.value.split(',')[0].trim() : 'Point B';

        const tripData = {
            date: new Date().toISOString(),
            profile: currentProfileName,
            origin: originStr,
            destination: destStr,
            originFull: routeOriginInput ? routeOriginInput.value : '',
            destFull: routeDestInput ? routeDestInput.value : '',
            distanceKm: currentRouteData ? currentRouteData.distanceKm : 0,
            estimatedSec: currentRouteData ? currentRouteData.estimatedSec : 0,
            actualSec: recordedActualSec > 0 ? recordedActualSec : (currentRouteData ? currentRouteData.estimatedSec : 0),
            fuelConsumed: currentRouteData ? currentRouteData.fuelConsumed : 0,
            tripCost: currentRouteData ? currentRouteData.tripCost : 0,
            isRoundTrip: routeRoundTripCheck ? routeRoundTripCheck.checked : false
        };

        const origBtnText = saveTripLogBtn.innerHTML;
        saveTripLogBtn.disabled = true;
        saveTripLogBtn.innerHTML = '<i data-lucide="loader-2" class="h-3.5 w-3.5 mr-1.5 animate-spin"></i> Saving...';
        if (window.lucide) lucide.createIcons();

        try {
            await addDoc(collection(db, "tripRecords"), tripData);
            
            saveTripLogBtn.innerHTML = '<i data-lucide="check" class="h-3.5 w-3.5 mr-1.5"></i> Saved to Trip Log!';
            saveTripLogBtn.classList.replace('bg-blue-600', 'bg-emerald-600');
            if (window.lucide) lucide.createIcons();

            setTimeout(() => {
                saveTripLogBtn.disabled = false;
                saveTripLogBtn.innerHTML = origBtnText;
                saveTripLogBtn.classList.replace('bg-emerald-600', 'bg-blue-600');
                if (window.lucide) lucide.createIcons();
            }, 1800);
        } catch (err) {
            console.error('Error saving trip log:', err);
            alert('Error saving trip: ' + err.message);
            saveTripLogBtn.disabled = false;
            saveTripLogBtn.innerHTML = origBtnText;
            if (window.lucide) lucide.createIcons();
        }
    });
}

// Preset destination routes dropdown
if (presetRouteSelect) {
    presetRouteSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val || !popularRoutes[val]) return;

        const p = popularRoutes[val];
        routePinA = p.start;
        routePinB = p.end;
        if (routeOriginInput) routeOriginInput.value = p.startName;
        if (routeDestInput) routeDestInput.value = p.endName;
        if (routeOriginClear) routeOriginClear.classList.remove('hidden');
        if (routeDestClear) routeDestClear.classList.remove('hidden');

        renderRouteMarkers();
        calculateAndDrawRoute();
    });
}

if (routeRoundTripCheck) {
    routeRoundTripCheck.addEventListener('change', () => {
        if (routePinA && routePinB) {
            calculateAndDrawRoute();
        }
    });
}

if (resetRouteBtn) {
    resetRouteBtn.addEventListener('click', () => {
        routePinA = null;
        routePinB = null;
        currentRouteData = null;
        recordedActualSec = 0;
        if (markerPinA && leafletMap) leafletMap.removeLayer(markerPinA);
        if (markerPinB && leafletMap) leafletMap.removeLayer(markerPinB);
        if (routeGeoJsonLayer && leafletMap) leafletMap.removeLayer(routeGeoJsonLayer);
        if (routeOriginInput) routeOriginInput.value = '';
        if (routeDestInput) routeDestInput.value = '';
        if (routeOriginClear) routeOriginClear.classList.add('hidden');
        if (routeDestClear) routeDestClear.classList.add('hidden');
        if (presetRouteSelect) presetRouteSelect.value = '';
        if (routeDistanceVal) routeDistanceVal.textContent = '-- km';
        if (routeTimeVal) routeTimeVal.textContent = '--';
        if (routeTrafficTimeVal) routeTrafficTimeVal.textContent = '--';
        if (routeEtaVal) routeEtaVal.textContent = '--';
        if (routeFuelVal) routeFuelVal.textContent = '-- L';
        if (routeTankPctVal) routeTankPctVal.textContent = '--%';
        if (routeCostVal) routeCostVal.textContent = '₱0.00';
        if (routeRefuelWarning) routeRefuelWarning.classList.add('hidden');
        if (actualTripSummary) actualTripSummary.classList.add('hidden');
        updateStopwatchDisplay(0);
    });
}

// Mode Switcher (Radius vs Route)
if (modeBtnRadius && modeBtnRoute && panelRadius && panelRoute) {
    modeBtnRadius.addEventListener('click', () => {
        currentMapMode = 'radius';
        modeBtnRadius.className = 'flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center bg-blue-600 text-white shadow-xs';
        modeBtnRoute.className = 'flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white';
        
        panelRadius.classList.remove('hidden');
        panelRoute.classList.add('hidden');
        
        if (mapStatusHint) mapStatusHint.textContent = 'Range Radius: Active';

        if (markerPinA && leafletMap) leafletMap.removeLayer(markerPinA);
        if (markerPinB && leafletMap) leafletMap.removeLayer(markerPinB);
        if (routeGeoJsonLayer && leafletMap) leafletMap.removeLayer(routeGeoJsonLayer);
        renderRadiusCircle();
    });

    modeBtnRoute.addEventListener('click', () => {
        currentMapMode = 'route';
        modeBtnRoute.className = 'flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center bg-blue-600 text-white shadow-xs';
        modeBtnRadius.className = 'flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white';
        
        panelRoute.classList.remove('hidden');
        panelRadius.classList.add('hidden');
        
        if (mapStatusHint) mapStatusHint.textContent = 'Google Maps Route Planner: Active';

        if (radiusCircle && leafletMap) leafletMap.removeLayer(radiusCircle);
        if (radiusMarker && leafletMap) leafletMap.removeLayer(radiusMarker);
        renderRouteMarkers();
        if (routePinA && routePinB) {
            calculateAndDrawRoute();
        }
    });
}

// 3-Tab View Switching
if (tabFuel && tabMaintenance && tabMap && viewFuel && viewMaintenance && viewMap) {
    tabFuel.addEventListener('click', () => {
        tabFuel.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-semibold text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';
        tabMaintenance.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 font-medium text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';
        tabMap.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 font-medium text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';

        viewFuel.classList.remove('hidden');
        viewMaintenance.classList.add('hidden');
        viewMap.classList.add('hidden');
    });

    tabMaintenance.addEventListener('click', () => {
        tabMaintenance.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 font-semibold text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';
        tabFuel.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 font-medium text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';
        tabMap.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 font-medium text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';

        viewMaintenance.classList.remove('hidden');
        viewFuel.classList.add('hidden');
        viewMap.classList.add('hidden');
    });

    tabMap.addEventListener('click', () => {
        tabMap.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-semibold text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';
        tabFuel.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 font-medium text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';
        tabMaintenance.className = 'py-2.5 px-4 sm:px-5 border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700 font-medium text-sm focus:outline-none transition-colors flex items-center whitespace-nowrap';

        viewMap.classList.remove('hidden');
        viewFuel.classList.add('hidden');
        viewMaintenance.classList.add('hidden');

        setTimeout(() => {
            initMap();
            if (leafletMap) {
                leafletMap.invalidateSize();
            }
        }, 100);
    });
}

// Profile Switcher
if (profileSelect) {
    profileSelect.addEventListener('change', (e) => {
        let val = e.target.value;
        if (val === 'Cherry') val = 'Chery';
        activeProfile = val;
        localStorage.setItem('activeProfile', activeProfile);
        
        if (navbarVehicleLogo) {
            navbarVehicleLogo.innerHTML = getVehicleLogo(activeProfile, 'h-4 w-4');
        }

        renderTable();
        renderMaintenanceTable();
        renderTripsTable();
        updateOdometerHints();
        renderServiceReminders();
        updateMapPanelDefaults();
    });
}

if (addProfileBtn) {
    addProfileBtn.addEventListener('click', () => {
        const newProfile = prompt("Enter new vehicle name (e.g. ADV 150, Chery Tiggo 8, NMAX, Vios):");
        if (newProfile && newProfile.trim()) {
            let cleanProfile = newProfile.trim();
            if (cleanProfile.toLowerCase() === 'cherry') cleanProfile = 'Chery';
            
            if (!profiles.includes(cleanProfile)) {
                profiles.push(cleanProfile);
                localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
            }
            activeProfile = cleanProfile;
            localStorage.setItem('activeProfile', activeProfile);
            renderProfiles();
            renderTable();
            renderMaintenanceTable();
            renderTripsTable();
            updateOdometerHints();
            renderServiceReminders();
            updateMapPanelDefaults();
        }
    });
}

// ==================== FUEL RECORD SUBMISSIONS ====================
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
            if (calculatedCostPerKm) calculatedCostPerKm.textContent = '₱0.00/km';
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

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        editingId = null;
        form.reset();
        dateInput.valueAsDate = new Date();
        calculatedTotal.textContent = '₱0.00';
        if (calculatedRange) calculatedRange.textContent = '+0 km';
        if (calculatedCostPerKm) calculatedCostPerKm.textContent = '₱0.00/km';
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

// ==================== MAINTENANCE RECORD SUBMISSIONS ====================
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
                if (maintFormTitle) maintFormTitle.innerHTML = '<i data-lucide="wrench" class="h-5 w-5 mr-2 text-orange-600 dark:text-orange-400"></i> Log Maintenance';
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

window.editMaintRecord = (id) => {
    const record = maintRecords.find(r => r.id === id);
    if (!record) return;

    editingMaintId = id;
    maintDateInput.value = record.date;
    maintOdoInput.value = record.odometer;
    maintTypeInput.value = record.type;
    maintCostInput.value = record.cost;
    maintNotesInput.value = record.notes || '';

    if (maintFormTitle) maintFormTitle.innerHTML = '<i data-lucide="edit" class="h-5 w-5 mr-2 text-orange-600 dark:text-orange-400"></i> Edit Maintenance';
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
        if (maintFormTitle) maintFormTitle.innerHTML = '<i data-lucide="wrench" class="h-5 w-5 mr-2 text-orange-600 dark:text-orange-400"></i> Log Maintenance';
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

                const profileTrips = tripRecords.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
                profileTrips.forEach(r => {
                    batch.delete(doc(db, "tripRecords", r.id));
                });

                await batch.commit();
            } catch (err) {
                alert("Failed to clear data: " + err.message);
            }
        }
    });
}

// ==================== FIRESTORE REAL-TIME LISTENERS ====================
onSnapshot(collection(db, "fuelRecords"), (snapshot) => {
    records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    syncProfilesFromRecords();
    renderTable();
    renderServiceReminders();
    updateMapPanelDefaults();
});

onSnapshot(collection(db, "maintRecords"), (snapshot) => {
    maintRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    syncProfilesFromRecords();
    renderMaintenanceTable();
    renderServiceReminders();
});

onSnapshot(collection(db, "tripRecords"), (snapshot) => {
    tripRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    syncProfilesFromRecords();
    renderTripsTable();
});

// ==================== INITIAL BOOTUP ====================
if (maintDateInput) maintDateInput.valueAsDate = new Date();
if (dateInput) dateInput.valueAsDate = new Date();

renderProfiles();
updateOdometerHints();
renderServiceReminders();
updateVehicleSpecsAndRange(0, 0, 0);

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    applyTheme(savedTheme);
} else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
}
