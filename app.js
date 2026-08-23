import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc, 
    doc, 
    deleteDoc, 
    setDoc, 
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4UD0AEyWMaQrJhicTBd-_162zMRjOG58",
  authDomain: "fuel-tracker-c565c.firebaseapp.com",
  projectId: "fuel-tracker-c565c",
  storageBucket: "fuel-tracker-c565c.firebasestorage.app",
  messagingSenderId: "758052138447",
  appId: "1:758052138447:web:650d2fe9a99d474bfab6ba"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// State
let records = [];
let maintRecords = [];
let profiles = JSON.parse(localStorage.getItem('fuelProfiles')) || ['ADV 150'];
let activeProfile = localStorage.getItem('activeProfile') || 'ADV 150';

if (maintDateInput) maintDateInput.valueAsDate = new Date();
if (dateInput) dateInput.valueAsDate = new Date();

// Tab Switching Logic
if (tabFuel && tabMaintenance && viewFuel && viewMaintenance) {
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
}

// Ensure active profile is in list
if (!profiles.includes(activeProfile)) {
    profiles.push(activeProfile);
    localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
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
    });
}

// Handle Add Profile
if (addProfileBtn) {
    addProfileBtn.addEventListener('click', () => {
        const newProfile = prompt('Enter new vehicle name (e.g. Civic, NMAX):');
        if (newProfile && newProfile.trim() !== '') {
            const trimmed = newProfile.trim();
            if (!profiles.includes(trimmed)) {
                profiles.push(trimmed);
                localStorage.setItem('fuelProfiles', JSON.stringify(profiles));
            }
            activeProfile = trimmed;
            localStorage.setItem('activeProfile', activeProfile);
            renderProfiles();
            renderTable();
            renderMaintenanceTable();
        }
    });
}

// Cancel Edit
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
        await deleteDoc(doc(db, "fuelRecords", id));
    }
};

window.deleteMaintRecord = async (id) => {
    if (confirm('Are you sure you want to delete this maintenance record?')) {
        await deleteDoc(doc(db, "maintRecords", id));
    }
};

// Update Chart
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

    const profileMaint = maintRecords.filter(r => r.profile === activeProfile);
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
    const profileRecords = records.filter(r => r.profile === activeProfile);
    const tableEl = document.querySelector('#view-fuel table');
    
    if (profileRecords.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableEl) tableEl.classList.add('hidden');
        updateStats([]);
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
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
};

const renderMaintenanceTable = () => {
    if (!maintTableBody) return;
    maintTableBody.innerHTML = '';
    const profileMaint = maintRecords.filter(r => r.profile === activeProfile);
    const tableContainer = maintTableBody.closest('table');
    
    if (profileMaint.length === 0) {
        if (maintEmptyState) maintEmptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        return;
    }

    if (maintEmptyState) maintEmptyState.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');

    const displayData = [...profileMaint].sort((a, b) => new Date(b.date) - new Date(a.date));

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-bold bg-yellow-50">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.type}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${row.notes || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-orange-700 font-medium bg-orange-50">${formatCurrency(row.cost)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="deleteMaintRecord('${row.id}')" class="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors" title="Delete">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        maintTableBody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
    
    const profileRecords = records.filter(r => r.profile === activeProfile);
    const processedData = processRecords(profileRecords);
    updateStats(processedData);
};

// Handle Form Submits
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const recordData = {
            date: dateInput.value,
            odometer: parseFloat(odometerInput.value),
            liters: parseFloat(litersInput.value),
            pricePerLiter: parseFloat(priceInput.value),
            profile: activeProfile
        };

        if (editingId) {
            await setDoc(doc(db, "fuelRecords", editingId), recordData);
            editingId = null;
            submitBtn.textContent = 'Save Record';
            cancelEditBtn.classList.add('hidden');
        } else {
            await addDoc(collection(db, "fuelRecords"), recordData);
        }

        odometerInput.value = '';
        litersInput.value = '';
        priceInput.value = '';
        calculatedTotal.textContent = '₱0.00';
    });
}

if (maintForm) {
    maintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newRecord = {
            date: maintDateInput.value,
            odometer: parseFloat(maintOdoInput.value),
            type: maintTypeInput.value,
            cost: parseFloat(maintCostInput.value),
            notes: maintNotesInput.value,
            profile: activeProfile
        };

        await addDoc(collection(db, "maintRecords"), newRecord);
        
        maintOdoInput.value = '';
        maintCostInput.value = '';
        maintNotesInput.value = '';
    });
}

// Clear All Data
if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete ALL records for ${activeProfile}? This cannot be undone.`)) {
            const batch = writeBatch(db);
            
            const profileFuel = records.filter(r => r.profile === activeProfile);
            profileFuel.forEach(r => {
                batch.delete(doc(db, "fuelRecords", r.id));
            });

            const profileMaint = maintRecords.filter(r => r.profile === activeProfile);
            profileMaint.forEach(r => {
                batch.delete(doc(db, "maintRecords", r.id));
            });

            await batch.commit();
        }
    });
}

// REAL-TIME LISTENERS
onSnapshot(collection(db, "fuelRecords"), (snapshot) => {
    records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderTable();
});

onSnapshot(collection(db, "maintRecords"), (snapshot) => {
    maintRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMaintenanceTable();
});

renderProfiles();
