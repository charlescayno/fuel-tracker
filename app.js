// DOM Elements
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

const maintForm = document.getElementById('add-maintenance-form');
const maintDateInput = document.getElementById('maint-date');
const maintOdoInput = document.getElementById('maint-odometer');
const maintTypeInput = document.getElementById('maint-type');
const maintCostInput = document.getElementById('maint-cost');
const maintNotesInput = document.getElementById('maint-notes');
const maintTableBody = document.getElementById('maint-table-body');
const maintEmptyState = document.getElementById('maint-empty-state');

// Maintenance State
let maintRecords = JSON.parse(localStorage.getItem('fuelMaintRecords')) || [];

maintDateInput.valueAsDate = new Date();

// Tab Switching Logic
tabFuel.addEventListener('click', () => {
    tabFuel.classList.replace('border-transparent', 'border-blue-600');
    tabFuel.classList.replace('text-gray-500', 'text-blue-600');
    tabMaintenance.classList.replace('border-blue-600', 'border-transparent');
    tabMaintenance.classList.replace('text-blue-600', 'text-gray-500');
    
    viewFuel.classList.remove('hidden');
    viewMaintenance.classList.add('hidden');
});

tabMaintenance.addEventListener('click', () => {
    tabMaintenance.classList.replace('border-transparent', 'border-blue-600');
    tabMaintenance.classList.replace('text-gray-500', 'text-blue-600');
    tabFuel.classList.replace('border-blue-600', 'border-transparent');
    tabFuel.classList.replace('text-blue-600', 'text-gray-500');
    
    viewMaintenance.classList.remove('hidden');
    viewFuel.classList.add('hidden');
});

// Default Initial Data from Spreadsheet
const initialData = [
    { id: '1', date: '2025-11-01', odometer: 3950, liters: 0, pricePerLiter: 0, profile: 'ADV 150' },
    { id: '2', date: '2025-11-08', odometer: 4084, liters: 4.57, pricePerLiter: 55.90, profile: 'ADV 150' },
    { id: '3', date: '2025-11-22', odometer: 4226, liters: 5.34, pricePerLiter: 57.60, profile: 'ADV 150' },
    { id: '4', date: '2025-12-06', odometer: 4346, liters: 4.35, pricePerLiter: 55.40, profile: 'ADV 150' },
    { id: '5', date: '2025-12-19', odometer: 4494, liters: 5.28, pricePerLiter: 56.60, profile: 'ADV 150' },
    { id: '6', date: '2026-01-02', odometer: 4634, liters: 4.61, pricePerLiter: 53.90, profile: 'ADV 150' },
    { id: '7', date: '2026-01-15', odometer: 4788, liters: 4.86, pricePerLiter: 54.10, profile: 'ADV 150' },
    { id: '8', date: '2026-01-27', odometer: 4939, liters: 4.76, pricePerLiter: 53.60, profile: 'ADV 150' },
    { id: '9', date: '2026-02-15', odometer: 5110, liters: 6.11, pricePerLiter: 53.60, profile: 'ADV 150' },
    { id: '10', date: '2026-03-03', odometer: 5280, liters: 5.31, pricePerLiter: 54.90, profile: 'ADV 150' },
    { id: '11', date: '2026-03-13', odometer: 5394, liters: 3.99, pricePerLiter: 67.70, profile: 'ADV 150' },
    { id: '12', date: '2026-03-25', odometer: 5546, liters: 4.69, pricePerLiter: 91.20, profile: 'ADV 150' },
    { id: '13', date: '2026-04-17', odometer: 5710, liters: 4.92, pricePerLiter: 84.40, profile: 'ADV 150' },
    { id: '14', date: '2026-05-03', odometer: 5875, liters: 5.10, pricePerLiter: 78.50, profile: 'ADV 150' },
    { id: '15', date: '2026-05-20', odometer: 6044, liters: 5.08, pricePerLiter: 80.40, profile: 'ADV 150' }
];

// Profile State
let profiles = JSON.parse(localStorage.getItem('fuelProfiles')) || ['ADV 150'];
let activeProfile = localStorage.getItem('activeProfile') || 'ADV 150';

// Data State & Migration
let records = JSON.parse(localStorage.getItem('fuelRecords'));
if (!records || records.length === 0) {
    records = initialData;
    localStorage.setItem('fuelRecords', JSON.stringify(records));
} else {
    // Migration: add 'ADV 150' profile to old records that don't have a profile yet
    let migrated = false;
    records = records.map(r => {
        if (!r.profile) {
            migrated = true;
            return { ...r, profile: 'ADV 150' };
        }
        return r;
    });
    if (migrated) {
        localStorage.setItem('fuelRecords', JSON.stringify(records));
    }
}

// Ensure active profile is in list
if (!profiles.includes(activeProfile)) {
    profiles.push(activeProfile);
    localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
}

// Set default date to today
dateInput.valueAsDate = new Date();

// Helper: Format Currency
const formatCurrency = (amount) => {
    return `₱${Number(amount).toFixed(2)}`;
};

// Helper: Format Number
const formatNumber = (num, decimals = 2) => {
    return Number(num).toFixed(decimals);
};

// Render Profiles Dropdown
const renderProfiles = () => {
    profileSelect.innerHTML = '';
    profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === activeProfile) opt.selected = true;
        profileSelect.appendChild(opt);
    });
};

// Calculate total amount in form on input change
const calculateFormTotal = () => {
    const liters = parseFloat(litersInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = liters * price;
    calculatedTotal.textContent = formatCurrency(total);
};

litersInput.addEventListener('input', calculateFormTotal);
priceInput.addEventListener('input', calculateFormTotal);

// Handle Profile Change
profileSelect.addEventListener('change', (e) => {
    activeProfile = e.target.value;
    localStorage.setItem('activeProfile', activeProfile);
    renderTable();
    renderMaintenanceTable();
});

// Handle Add Profile
addProfileBtn.addEventListener('click', () => {
    const newProfile = prompt('Enter new vehicle name (e.g. Civic, NMAX):');
    if (newProfile && newProfile.trim() !== '') {
        const trimmed = newProfile.trim();
        if (!profiles.includes(trimmed)) {
            profiles.push(trimmed);
            localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
            activeProfile = trimmed;
            localStorage.setItem('activeProfile', activeProfile);
            renderProfiles();
            renderTable();
            renderMaintenanceTable();
        } else {
            alert('This vehicle profile already exists!');
            activeProfile = trimmed;
            localStorage.setItem('activeProfile', activeProfile);
            renderProfiles();
            renderTable();
            renderMaintenanceTable();
        }
    }
});

// Initial Render
renderProfiles();
renderTable();
renderMaintenanceTable();
