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
const routeFuelVal = document.getElementById('route-fuel-val');
const routeTankPctVal = document.getElementById('route-tank-pct-val');
const routeCostVal = document.getElementById('route-cost-val');
const routeRefuelWarning = document.getElementById('route-refuel-warning');

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
                <ellipse cx="50" cy="35" rx="14" ry="29"/>
            </svg>
        `;
    }

    // Default Motorcycle vs Car
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

// ==================== VEHICLE SPECS & PRESETS ====================
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
const updateChart = (processedData) => {
    const ctx = document.getElementById('efficiencyChart');
    if (!ctx) return;
    
    const chartData = (processedData || []).filter(d => d.kmPerLiter !== null && !isNaN(d.kmPerLiter));
    const labels = chartData.map(d => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    const dataPoints = chartData.map(d => d.kmPerLiter);

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (chartData.length === 0) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const tickColor = isDarkMode ? '#94a3b8' : '#64748b';
    const lineColor = isDarkMode ? '#3b82f6' : '#2563eb';
    const bgColor = isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)';
    const pointColor = isDarkMode ? '#60a5fa' : '#2563eb';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Efficiency (km/L)',
                data: dataPoints,
                borderColor: lineColor,
                backgroundColor: bgColor,
                borderWidth: 2.5,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: pointColor,
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
                    backgroundColor: isDarkMode ? '#0f172a' : '#1e293b',
                    titleColor: isDarkMode ? '#f8fafc' : '#ffffff',
                    bodyColor: isDarkMode ? '#cbd5e1' : '#f1f5f9',
                    borderColor: isDarkMode ? '#334155' : 'transparent',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) { return ' ' + context.parsed.y.toFixed(2) + ' km/L'; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: tickColor }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: tickColor },
                    title: { display: true, text: 'km/L', color: tickColor }
                }
            }
        }
    });
};

// ==================== DASHBOARD STATS ====================
const updateStats = (processedData) => {
    if (!statAvgEconomy || !statAvgCost || !statMonthlyPesos || !statMonthlyLiters || !statTrueCost || !statTotalDist) return;

    if (!processedData || processedData.length < 2) {
        statAvgEconomy.textContent = "-- km/L";
        statAvgCost.textContent = "₱--";
        statMonthlyPesos.textContent = "₱--";
        statMonthlyLiters.textContent = "-- L / month";
        statTrueCost.textContent = "₱--";
        statTotalDist.textContent = "-- km";
        
        const latestPrice = (processedData && processedData.length === 1) ? (processedData[0].pricePerLiter || 0) : 0;
        updateVehicleSpecsAndRange(0, latestPrice, 0);
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

    const latestPrice = latestRecord.pricePerLiter || 0;
    updateVehicleSpecsAndRange(avgEconomy, latestPrice, fuelCostPerKm);
};

// ==================== RENDER TABLES ====================
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
                <button onclick="editMaintRecord('${row.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors mr-1" title="Edit">
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
    
    const currentProfileRecords = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    const processedData = processRecords(currentProfileRecords);
    updateStats(processedData);
    updateOdometerHints();
    renderServiceReminders();
};

// ==================== SERVICE REMINDERS ====================
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
        try { return JSON.parse(stored); } catch (e) { }
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
            statusBadgeClass = 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900';
            progressBarColor = 'bg-rose-600';
            statusIcon = 'alert-triangle';
        } else if (remainingKm <= interval * 0.25) {
            statusText = `Due soon! (${formatNumber(remainingKm, 0)} km left)`;
            statusBadgeClass = 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900';
            progressBarColor = 'bg-amber-500';
            statusIcon = 'clock';
        } else {
            statusText = `Due in ${formatNumber(remainingKm, 0)} km`;
            statusBadgeClass = 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
            progressBarColor = 'bg-emerald-500';
            statusIcon = 'shield-check';
        }

        const card = document.createElement('div');
        card.className = 'bg-gray-50 dark:bg-slate-950 rounded-xl p-4 border border-gray-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-sm transition-all';
        card.innerHTML = `
            <div>
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center space-x-2">
                        <div class="p-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xs text-gray-700 dark:text-slate-300">
                            <i data-lucide="${service.icon || 'wrench'}" class="h-4 w-4 text-orange-600 dark:text-orange-400"></i>
                        </div>
                        <h4 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">${service.name}</h4>
                    </div>
                    <button onclick="editServiceInterval('${service.id}')" class="text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 p-1 rounded-md transition-colors" title="Adjust interval (current: every ${formatNumber(interval, 0)} km)">
                        <i data-lucide="settings" class="h-3.5 w-3.5"></i>
                    </button>
                </div>

                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
                    <span>Interval: <strong class="text-gray-700 dark:text-slate-200">${formatNumber(interval, 0)} km</strong></span>
                    <span class="text-[11px] ${hasLogged ? 'text-gray-600 dark:text-slate-400' : 'text-gray-400 dark:text-slate-500'}">
                        ${hasLogged ? `Last: ${formatNumber(lastServiceOdo, 0)} km` : 'No logs yet'}
                    </span>
                </div>

                <div class="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2 mb-2.5 overflow-hidden">
                    <div class="${progressBarColor} h-2 rounded-full transition-all duration-500" style="width: ${percentUsed}%;"></div>
                </div>

                <div class="flex items-center justify-between mb-3">
                    <span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${statusBadgeClass}">
                        <i data-lucide="${statusIcon}" class="h-3 w-3 mr-1"></i>
                        ${statusText}
                    </span>
                    <span class="text-[11px] font-medium text-gray-500 dark:text-slate-400">${formatNumber(kmSinceLast, 0)} / ${formatNumber(interval, 0)} km</span>
                </div>
            </div>

            <button onclick="quickLogService('${service.name}')" class="w-full mt-2 text-xs bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-semibold py-1.5 px-3 rounded-lg border border-orange-200 dark:border-orange-900/60 transition-colors flex items-center justify-center shadow-2xs">
                <i data-lucide="plus" class="h-3.5 w-3.5 mr-1"></i> Log Service
            </button>
        `;
        serviceRemindersGrid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
};

// ==================== GEOCODING & AUTOCOMPLETE (GOOGLE MAPS STYLE) ====================
const geocodeCache = new Map();

const searchNominatim = async (query) => {
    if (!query || query.trim().length < 2) return [];
    const clean = query.trim();
    if (geocodeCache.has(clean)) return geocodeCache.get(clean);

    try {
        // Query Philippines results first
        const phUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&countrycodes=ph&limit=6&addressdetails=1`;
        const res = await fetch(phUrl, { headers: { 'Accept-Language': 'en' } });
        let data = await res.json();

        // If no results in PH, search globally
        if (!data || data.length === 0) {
            const globalUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=5&addressdetails=1`;
            const gRes = await fetch(globalUrl, { headers: { 'Accept-Language': 'en' } });
            data = await gRes.json();
        }

        geocodeCache.set(clean, data || []);
        return data || [];
    } catch (err) {
        console.warn('Geocoding search error:', err);
        return [];
    }
};

const reverseGeocode = async (lat, lng) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (data && data.display_name) {
            const parts = data.display_name.split(', ');
            return parts.slice(0, 3).join(', ');
        }
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (e) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
};

// Generic Search Dropdown Binder
const setupLocationSearch = (inputEl, clearBtnEl, resultsEl, onSelectCallback) => {
    if (!inputEl || !resultsEl) return;

    let debounceTimer = null;

    const renderResults = (items) => {
        resultsEl.innerHTML = '';
        if (!items || items.length === 0) {
            resultsEl.classList.add('hidden');
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex items-start space-x-2.5';
            
            const parts = (item.display_name || '').split(', ');
            const mainTitle = parts[0] || item.name || 'Location';
            const subTitle = parts.slice(1, 4).join(', ');

            div.innerHTML = `
                <div class="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 shrink-0 mt-0.5">
                    <i data-lucide="map-pin" class="h-4 w-4 text-red-500"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">${mainTitle}</p>
                    <p class="text-[11px] text-gray-500 dark:text-slate-400 truncate">${subTitle}</p>
                </div>
            `;

            div.addEventListener('click', () => {
                inputEl.value = mainTitle;
                resultsEl.classList.add('hidden');
                if (clearBtnEl) clearBtnEl.classList.remove('hidden');
                onSelectCallback(parseFloat(item.lat), parseFloat(item.lon), mainTitle);
            });

            resultsEl.appendChild(div);
        });

        resultsEl.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    };

    inputEl.addEventListener('input', () => {
        const query = inputEl.value;
        if (clearBtnEl) {
            if (query.length > 0) clearBtnEl.classList.remove('hidden');
            else clearBtnEl.classList.add('hidden');
        }

        clearTimeout(debounceTimer);
        if (query.trim().length < 2) {
            resultsEl.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            const results = await searchNominatim(query);
            renderResults(results);
        }, 280);
    });

    if (clearBtnEl) {
        clearBtnEl.addEventListener('click', () => {
            inputEl.value = '';
            clearBtnEl.classList.add('hidden');
            resultsEl.classList.add('hidden');
            inputEl.focus();
        });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !resultsEl.contains(e.target)) {
            resultsEl.classList.add('hidden');
        }
    });
};

// ==================== LEAFLET MAP ENGINE ====================
const initMap = () => {
    if (leafletMap) return;
    const mapEl = document.getElementById('map');
    if (!mapEl || !window.L) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    
    leafletMap = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView(radiusOrigin, 9);

    updateMapTileLayer(isDarkMode);

    leafletMap.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        
        if (currentMapMode === 'radius') {
            radiusOrigin = [lat, lng];
            renderRadiusCircle();
            const placeName = await reverseGeocode(lat, lng);
            if (radiusSearchInput) {
                radiusSearchInput.value = placeName;
                if (radiusClearSearchBtn) radiusClearSearchBtn.classList.remove('hidden');
            }
        } else if (currentMapMode === 'route') {
            handleRouteMapClick(lat, lng);
        }
    });

    renderRadiusCircle();
};

const updateMapTileLayer = (isDark) => {
    if (!leafletMap || !window.L) return;
    
    if (currentTileLayer) {
        leafletMap.removeLayer(currentTileLayer);
    }

    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    currentTileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(leafletMap);
};

// ==================== MAP: DYNAMIC RANGE RADIUS ====================
const updateMapPanelDefaults = () => {
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);
    const fullRange = avgEconomy > 0 ? (specs.tankCapacity * avgEconomy) : 360;

    if (radiusTargetVehicle) radiusTargetVehicle.textContent = currentProfileName;
    if (radiusAvgEcon) radiusAvgEcon.textContent = `${formatNumber(avgEconomy, 1)} km/L`;
    
    if (radiusSlider) {
        radiusSlider.max = Math.max(600, Math.round(fullRange * 1.3));
        if (parseFloat(radiusSlider.value) > parseFloat(radiusSlider.max)) {
            radiusSlider.value = fullRange;
        }
    }

    renderRadiusCircle();
};

const renderRadiusCircle = () => {
    if (!leafletMap || !window.L) return;
    
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const specs = getVehicleSpecs(currentProfileName);
    const avgEconomy = getVehicleAvgEconomy(currentProfileName);
    const latestPrice = getLatestFuelPrice(currentProfileName);

    const rangeKm = radiusSlider ? parseFloat(radiusSlider.value) : (specs.tankCapacity * avgEconomy);
    const radiusMeters = rangeKm * 1000;

    if (radiusCircle) leafletMap.removeLayer(radiusCircle);
    if (radiusMarker) leafletMap.removeLayer(radiusMarker);

    if (currentMapMode === 'radius') {
        radiusCircle = L.circle(radiusOrigin, {
            radius: radiusMeters,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.16,
            weight: 2
        }).addTo(leafletMap);

        const customPinHtml = `
            <div class="relative flex items-center justify-center">
                <span class="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-blue-400 opacity-75"></span>
                <div class="relative inline-flex rounded-full h-8 w-8 bg-blue-600 text-white items-center justify-center border-2 border-white shadow-lg text-xs font-bold">
                    📍
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

// ==================== MAP: TRIP ROUTE & COST CALCULATOR ====================
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

// Floating Quick Search Setup
setupLocationSearch(mapQuickSearchInput, mapQuickSearchClear, mapQuickSearchResults, (lat, lng, name) => {
    if (leafletMap) {
        leafletMap.setView([lat, lng], 12);
    }
    if (currentMapMode === 'radius') {
        radiusOrigin = [lat, lng];
        if (radiusSearchInput) radiusSearchInput.value = name;
        renderRadiusCircle();
    } else {
        if (!routePinA) {
            routePinA = [lat, lng];
            if (routeOriginInput) routeOriginInput.value = name;
            renderRouteMarkers();
        } else {
            routePinB = [lat, lng];
            if (routeDestInput) routeDestInput.value = name;
            renderRouteMarkers();
            calculateAndDrawRoute();
        }
    }
});

// Swap Route Origin & Destination
if (swapRouteBtn) {
    swapRouteBtn.addEventListener('click', () => {
        const tempPin = routePinA;
        routePinA = routePinB;
        routePinB = tempPin;

        if (routeOriginInput && routeDestInput) {
            const tempVal = routeOriginInput.value;
            routeOriginInput.value = routeDestInput.value;
            routeDestInput.value = tempVal;
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
        // Reset and set new Pin A
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

    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.round((totalSec % 3600) / 60);
    const timeStr = hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;

    if (routeDistanceVal) routeDistanceVal.textContent = `${formatNumber(totalKm, 1)} km ${isRoundTrip ? '(Round Trip)' : ''}`;
    if (routeTimeVal) routeTimeVal.textContent = `~${timeStr}`;
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
};

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
        if (routeFuelVal) routeFuelVal.textContent = '-- L';
        if (routeTankPctVal) routeTankPctVal.textContent = '--%';
        if (routeCostVal) routeCostVal.textContent = '₱0.00';
        if (routeRefuelWarning) routeRefuelWarning.classList.add('hidden');
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
    });
}

// ==================== THEME MANAGEMENT ====================
const applyTheme = (theme) => {
    const isDark = theme === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'sun');
            if (themeToggleBtn) themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
        }
    } else {
        document.documentElement.classList.remove('dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'moon');
            if (themeToggleBtn) themeToggleBtn.setAttribute('title', 'Switch to Dark / AMOLED Mode');
        }
    }
    localStorage.setItem('theme', theme);
    if (window.lucide) lucide.createIcons();
    
    const currentProfileName = activeProfile === 'Cherry' ? 'Chery' : activeProfile;
    const profileRecords = records.filter(r => r.profile === currentProfileName || (currentProfileName === 'Chery' && r.profile === 'Cherry'));
    if (profileRecords.length > 0) {
        updateChart(processRecords(profileRecords));
    }

    updateMapTileLayer(isDark);
};

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isCurrentlyDark = document.documentElement.classList.contains('dark');
        applyTheme(isCurrentlyDark ? 'light' : 'dark');
    });
}

// ==================== NAVIGATION TABS ====================
const setTabActive = (activeTab, inactiveTabs, activeView, inactiveViews) => {
    activeTab.classList.replace('border-transparent', 'border-blue-600');
    activeTab.classList.replace('text-gray-500', 'text-blue-600');
    activeTab.classList.replace('dark:text-slate-400', 'dark:text-blue-400');
    activeTab.classList.add('font-semibold');

    inactiveTabs.forEach(tab => {
        tab.classList.replace('border-blue-600', 'border-transparent');
        tab.classList.replace('text-blue-600', 'text-gray-500');
        tab.classList.replace('dark:text-blue-400', 'dark:text-slate-400');
        tab.classList.remove('font-semibold');
    });

    activeView.classList.remove('hidden');
    inactiveViews.forEach(v => v.classList.add('hidden'));
};

if (tabFuel && tabMaintenance && tabMap && viewFuel && viewMaintenance && viewMap) {
    tabFuel.addEventListener('click', () => {
        setTabActive(tabFuel, [tabMaintenance, tabMap], viewFuel, [viewMaintenance, viewMap]);
    });

    tabMaintenance.addEventListener('click', () => {
        setTabActive(tabMaintenance, [tabFuel, tabMap], viewMaintenance, [viewFuel, viewMap]);
        renderServiceReminders();
    });

    tabMap.addEventListener('click', () => {
        setTabActive(tabMap, [tabFuel, tabMaintenance], viewMap, [viewFuel, viewMaintenance]);
        initMap();
        setTimeout(() => {
            if (leafletMap) {
                leafletMap.invalidateSize();
                if (currentMapMode === 'radius' && radiusCircle) {
                    leafletMap.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
                }
            }
        }, 200);
    });
}

// Profile Select
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
        updateMapPanelDefaults();
    });
}

// Add Profile
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
            updateMapPanelDefaults();
        }
    });
}

// Fuel Form Submit
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

// Cancel Fuel Edit
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

// Window Global Action Handlers
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

// Maintenance Form Submit
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
