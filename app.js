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

// Stats Elements
const statAvgEconomy = document.getElementById('stat-avg-economy');
const statAvgCost = document.getElementById('stat-avg-cost');
const stat30dCost = document.getElementById('stat-30d-cost');
const statTotalDist = document.getElementById('stat-total-dist');

// Default Initial Data from Spreadsheet
const initialData = [
    { id: '1', date: '2025-11-01', odometer: 3950, liters: 0, pricePerLiter: 0 },
    { id: '2', date: '2025-11-08', odometer: 4084, liters: 4.57, pricePerLiter: 55.90 },
    { id: '3', date: '2025-11-22', odometer: 4226, liters: 5.34, pricePerLiter: 57.60 },
    { id: '4', date: '2025-12-06', odometer: 4346, liters: 4.35, pricePerLiter: 55.40 },
    { id: '5', date: '2025-12-19', odometer: 4494, liters: 5.28, pricePerLiter: 56.60 },
    { id: '6', date: '2026-01-02', odometer: 4634, liters: 4.61, pricePerLiter: 53.90 },
    { id: '7', date: '2026-01-15', odometer: 4788, liters: 4.86, pricePerLiter: 54.10 },
    { id: '8', date: '2026-01-27', odometer: 4939, liters: 4.76, pricePerLiter: 53.60 },
    { id: '9', date: '2026-02-15', odometer: 5110, liters: 6.11, pricePerLiter: 53.60 },
    { id: '10', date: '2026-03-03', odometer: 5280, liters: 5.31, pricePerLiter: 54.90 },
    { id: '11', date: '2026-03-13', odometer: 5394, liters: 3.99, pricePerLiter: 67.70 },
    { id: '12', date: '2026-03-25', odometer: 5546, liters: 4.69, pricePerLiter: 91.20 },
    { id: '13', date: '2026-04-17', odometer: 5710, liters: 4.92, pricePerLiter: 84.40 },
    { id: '14', date: '2026-05-03', odometer: 5875, liters: 5.10, pricePerLiter: 78.50 },
    { id: '15', date: '2026-05-20', odometer: 6044, liters: 5.08, pricePerLiter: 80.40 }
];

// State
let records = JSON.parse(localStorage.getItem('fuelRecords'));
if (!records || records.length === 0) {
    records = initialData;
    localStorage.setItem('fuelRecords', JSON.stringify(records));
}

// Set default date to today
dateInput.valueAsDate = new Date();

// Helper: Format Currency
const formatCurrency = (amount) => {
    return `?${Number(amount).toFixed(2)}`;
};

// Helper: Format Number
const formatNumber = (num, decimals = 2) => {
    return Number(num).toFixed(decimals);
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

// Process records to calculate derived values (like the spreadsheet)
const processRecords = (data) => {
    if (data.length === 0) return [];
    
    // Sort by date ascending to process correctly
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return sortedData.map((record, index) => {
        const amount = record.liters * record.pricePerLiter;
        
        if (index === 0) {
            // First record has no previous data for trip/economy calculations
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
        
        // Calculations mirroring spreadsheet
        const tripKm = record.odometer - prevRecord.odometer;
        const pesoPerKm = amount / tripKm;
        const kmPerLiter = tripKm / record.liters;
        
        // Date diff in days
        const diffTime = Math.abs(new Date(record.date) - new Date(prevRecord.date));
        const daysInterval = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // 30-day projections
        const avgKmPerDay = daysInterval > 0 ? tripKm / daysInterval : 0;
        const kmIn30Days = avgKmPerDay * 30;
        const litersIn30Days = (kmIn30Days / kmPerLiter);
        const pesosIn30Days = (litersIn30Days * record.pricePerLiter);

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
    if (processedData.length < 2) {
        statAvgEconomy.textContent = "-- km/L";
        statAvgCost.textContent = "?--";
        stat30dCost.textContent = "?--";
        statTotalDist.textContent = "-- km";
        return;
    }

    let totalTripKm = 0;
    let totalLiters = 0;
    let totalAmount = 0;
    
    // Sum up starting from index 1 (since index 0 has no trip data)
    for (let i = 1; i < processedData.length; i++) {
        totalTripKm += processedData[i].tripKm;
        totalLiters += processedData[i].liters;
        totalAmount += processedData[i].amount;
    }

    const avgEconomy = totalTripKm / totalLiters;
    const avgCostPerKm = totalAmount / totalTripKm;
    
    // Use the latest 30-day estimate for the dashboard, or an average
    const latestRecord = processedData[processedData.length - 1];
    
    const firstRecord = processedData[0];
    const totalDistance = latestRecord.odometer - firstRecord.odometer;

    statAvgEconomy.textContent = `${formatNumber(avgEconomy)} km/L`;
    statAvgCost.textContent = formatCurrency(avgCostPerKm);
    stat30dCost.textContent = formatCurrency(latestRecord.pesosIn30Days);
    statTotalDist.textContent = `${formatNumber(totalDistance, 0)} km`;
};

// Render Table
const renderTable = () => {
    historyTableBody.innerHTML = '';
    
    if (records.length === 0) {
        emptyState.classList.remove('hidden');
        document.querySelector('table').classList.add('hidden');
        updateStats([]);
        return;
    }

    emptyState.classList.add('hidden');
    document.querySelector('table').classList.remove('hidden');

    const processedData = processRecords(records);
    
    // Sort descending for display (newest first)
    const displayData = [...processedData].sort((a, b) => new Date(b.date) - new Date(a.date));

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        const dateObj = new Date(row.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600 font-bold bg-yellow-50">${row.odometer}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${row.tripKm ? row.tripKm : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-600 font-medium bg-amber-50">${formatNumber(row.liters)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-amber-600 font-medium bg-amber-50">${formatCurrency(row.pricePerLiter)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">${formatCurrency(row.amount)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700 font-medium bg-blue-50">${row.pesoPerKm ? formatCurrency(row.pesoPerKm) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700 font-medium bg-green-50">${row.kmPerLiter ? formatNumber(row.kmPerLiter) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${row.pesosIn30Days ? formatCurrency(row.pesosIn30Days) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="deleteRecord('${row.id}')" class="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        historyTableBody.appendChild(tr);
    });

    lucide.createIcons();
    updateStats(processedData);
};

// Handle Form Submit
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const newRecord = {
        id: Date.now().toString(),
        date: dateInput.value,
        odometer: parseFloat(odometerInput.value),
        liters: parseFloat(litersInput.value),
        pricePerLiter: parseFloat(priceInput.value)
    };

    records.push(newRecord);
    localStorage.setItem('fuelRecords', JSON.stringify(records));
    
    // Reset inputs but keep date
    odometerInput.value = '';
    litersInput.value = '';
    priceInput.value = '';
    calculatedTotal.textContent = '?0.00';
    
    renderTable();
});

// Delete Record
window.deleteRecord = (id) => {
    if(confirm('Are you sure you want to delete this record?')) {
        records = records.filter(r => r.id !== id);
        localStorage.setItem('fuelRecords', JSON.stringify(records));
        renderTable();
    }
};

// Clear All Data
clearDataBtn.addEventListener('click', () => {
    if(confirm('Are you sure you want to delete ALL records? This cannot be undone.')) {
        records = [];
        localStorage.removeItem('fuelRecords');
        renderTable();
    }
});

// Load sample data for testing if requested
const loadSampleData = () => {
    const sampleData = [
        { id: '1', date: '2025-11-01', odometer: 3950, liters: 0, pricePerLiter: 0 },
        { id: '2', date: '2025-11-08', odometer: 4084, liters: 4.57, pricePerLiter: 55.90 },
        { id: '3', date: '2025-11-22', odometer: 4226, liters: 5.34, pricePerLiter: 57.60 },
        { id: '4', date: '2025-12-06', odometer: 4346, liters: 4.35, pricePerLiter: 55.40 },
        { id: '5', date: '2025-12-19', odometer: 4494, liters: 5.28, pricePerLiter: 56.60 }
    ];
    records = sampleData;
    localStorage.setItem('fuelRecords', JSON.stringify(records));
    renderTable();
};

// Uncomment line below to load sample data automatically
// loadSampleData();

// Initial Render
renderTable();
