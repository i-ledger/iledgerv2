let map;
let markerLayer = L.layerGroup();
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Peta (Default ke Jakarta)
    map = L.map('map').setView([-6.200000, 106.816666], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markerLayer.addTo(map);

    // 2. Minta akses lokasi user
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Pindahkan peta ke lokasi user, zoom level 15
                map.setView([latitude, longitude], 15);
                
                // Opsional: Tambah marker buat nunjukin lokasi kamu
                L.marker([latitude, longitude]).addTo(map)
                 .bindPopup("📍 Lokasi Anda")
                 .openPopup();
            },
            (error) => {
                console.warn("Lokasi tidak diizinkan atau tidak tersedia:", error.message);
                // Tetap di koordinat default kalau user menolak
            }
        );
    }

    // 3. Load Data Customer
    await loadData();
});

// Fungsi Switch Tab
window.switchView = function(view) {
    if (view === 'table') {
        document.getElementById('viewTable').classList.remove('hidden');
        document.getElementById('viewMap').classList.add('hidden');
    } else {
        document.getElementById('viewTable').classList.add('hidden');
        document.getElementById('viewMap').classList.remove('hidden');
        setTimeout(() => map.invalidateSize(), 100);
    }
};

// Ambil Data
async function loadData() {
    try {
        allUsers = await API.request('users/approved');
        renderTable();
        renderMarkers();
    } catch (e) {
        console.error("Gagal load data", e);
    }
}

// Render Tabel (Hanya Customer)
function renderTable() {
    const tbody = document.getElementById('userBody');
    if (!tbody) return;
    
    const customers = allUsers.filter(u => u.role === 'CUSTOMER');
    
    tbody.innerHTML = customers.map(u => `
        <tr class="hover:bg-gray-50 border-b">
            <td class="p-3 font-bold">${u.nama}</td>
            <td class="p-3">${u.noHp || '-'}</td>
            <td class="p-3">${(u.latitude && u.longitude) ? '📍 Terdeteksi' : '-'}</td>
        </tr>
    `).join('');
}

// Render Peta
function renderMarkers() {
    markerLayer.clearLayers();
    allUsers.filter(u => u.role === 'CUSTOMER' && u.latitude && u.longitude).forEach(u => {
        const marker = L.marker([parseFloat(u.latitude), parseFloat(u.longitude)]);
        marker.on('click', () => showDetails(u));
        marker.addTo(markerLayer);
    });
}

// Menampilkan Detail di Sidebar
function showDetails(u) {
    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div class="space-y-4">
            <div class="p-4 bg-white rounded-lg shadow border border-blue-100">
                <h3 class="text-lg font-bold text-blue-600">${u.nama}</h3>
                <p class="text-xs text-gray-400 font-bold uppercase">${u.role}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase font-bold">Nomor HP</p>
                <p class="text-gray-700">${u.noHp || '-'}</p>
            </div>
            <div>
                <p class="text-xs text-gray-400 uppercase font-bold">Alamat</p>
                <p class="text-gray-700">${u.alamat || 'Tidak ada alamat'}</p>
            </div>
        </div>
    `;
}
