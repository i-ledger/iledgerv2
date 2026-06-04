/**
 * js/driver.js - Full Integrated Version (Portrait Camera & Optimized UI)
 * UPDATED: Auto-Filter Fixed & Date Normalization Stabilized
 */

// ==========================================
// CONFIGURATION
// ==========================================
const cameras = {
    Laporan: { videoEl: 'videoReport', canvasEl: 'photoCanvas', previewEl: 'previewReport' }
};

const constraints = {
    audio: false,
    video: { facingMode: { ideal: 'environment' } }
};

let currentTab = 'pribadi';
let allDeliveries = [];
let activeDeliveryId = null;
let currentCoords = { lat: "0", lng: "0" };

// ==========================================
// INIT & AUTO FILTER EVENT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const user = API.checkAuth();
    if (!user || user.role !== 'DRIVER') return API.logout();

    document.getElementById('userName').textContent = user.nama || user.name || "Driver";
    document.getElementById('companyName').textContent = user.perusahaan || "R22 NPSO";

    // Set default tanggal hari ini (Format: YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const filterInput = document.getElementById('filterTanggal');
    if (filterInput) {
        filterInput.value = today;
        
        // Pemicu otomatis pas ganti tanggal via Event Listener
        filterInput.addEventListener('change', () => {
            renderDeliveries();
        });
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                currentCoords.lat = pos.coords.latitude.toString();
                currentCoords.lng = pos.coords.longitude.toString();
            },
            (err) => console.warn("GPS tidak diaktifkan"),
            { enableHighAccuracy: true }
        );
    }

    loadDeliveryData();
});

/**
 * Jembatan penghubung untuk onchange="loadDeliveries()" di tag HTML
 */
window.loadDeliveries = function() {
    renderDeliveries();
};

// ==========================================
// CAMERA LOGIC (Portrait Proporsional)
// ==========================================
async function startCamera(key) {
    const cam = cameras[key];
    const video = document.getElementById(cam.videoEl);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' } }
        });
        video.srcObject = stream;
        video.play();
    } catch (err) {
        console.error('Kamera gagal:', err);
        Swal.fire('Error', 'Tidak bisa mengakses kamera: ' + err.message, 'error');
    }
}

function stopCamera(key) {
    const video = document.getElementById(cameras[key].videoEl);
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function takeSnapshot(key) {
    const cam = cameras[key];
    const video = document.getElementById(cam.videoEl);
    const canvas = document.getElementById(cam.canvasEl);
    const preview = document.getElementById(cam.previewEl);

    canvas.width = 768;
    canvas.height = 1024;
    
    const ctx = canvas.getContext('2d');
    
    const ratio = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const centerShift_x = (canvas.width - video.videoWidth * ratio) / 2;
    const centerShift_y = (canvas.height - video.videoHeight * ratio) / 2;

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 
                  centerShift_x, centerShift_y, 
                  video.videoWidth * ratio, video.videoHeight * ratio);

    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
    preview.src = dataURL;
    preview.classList.remove('hidden');
    video.classList.add('hidden');

    window[`foto${key}Base64`] = dataURL.split(',')[1];
    stopCamera(key);
}

window.resetKamera = function() {
    document.getElementById('previewReport').classList.add('hidden');
    document.getElementById('videoReport').classList.remove('hidden');
    window.fotoLaporanBase64 = null;
    startCamera('Laporan');
};

// ==========================================
// TAB MANAGEMENT
// ==========================================
window.switchTab = function(tabName) {
    currentTab = tabName;
    const tabs = ['pribadi', 'global', 'riwayat'];
    
    tabs.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        const defaultClass = "w-1/3 py-2.5 text-[11px] font-bold rounded-lg transition text-gray-500 text-center hover:bg-gray-50";
        if (t === tabName) {
            const colors = { pribadi: 'pink', global: 'blue', riwayat: 'emerald' };
            el.className = `w-1/3 py-2.5 text-[11px] font-bold rounded-lg transition text-center bg-${colors[t]}-50 text-${colors[t]}-600 shadow-sm`;
        } else {
            el.className = defaultClass;
        }
    });

    renderDeliveries();
};

// ==========================================
// DATA LOADING & FILTERING
// ==========================================
async function loadDeliveryData() {
    try {
        document.getElementById('loadingState').classList.remove('hidden');
        const data = await API.request('pengiriman/get');
        allDeliveries = Array.isArray(data) ? data : (data.data || []);
        renderDeliveries();
    } catch (error) {
        console.error("Gagal sinkron data:", error);
    } finally {
        document.getElementById('loadingState').classList.add('hidden');
    }
}

// HELPER: Penyetaraan format tanggal pembanding (YYYY-MM-DD)
function getComparingDate(dateStr) {
    if (!dateStr || dateStr === "-") return "";
    
    if (dateStr.includes('-') && !dateStr.includes('/')) {
        return dateStr.split('T')[0]; 
    }
    
    if (dateStr.includes('/')) {
        const datePart = dateStr.split(' ')[0]; 
        const [d, m, y] = datePart.split('/');
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    
    return dateStr;
}

function renderDeliveries() {
    const container = document.getElementById('deliveryContainer');
    container.innerHTML = "";
    
    const user = JSON.parse(localStorage.getItem('r22_user')) || {};
    const myName = String(user.nama || user.name || "").trim().toUpperCase();
    const myEmail = String(user.email || "").trim().toLowerCase();
    
    const filterDate = document.getElementById('filterTanggal').value;

    const filtered = allDeliveries.filter(item => {
        // --- 1. FILTER TANGGAL OTOMATIS ---
        if (filterDate && item.tanggal && item.tanggal !== "-") {
            const dateInput = getComparingDate(filterDate);
            const dateItem = getComparingDate(item.tanggal);
            
            if (dateInput !== dateItem) return false;
        }

        // --- 2. FILTER TAB STATUS ---
        const isCompleted = ["SELESAI", "GAGAL"].includes(item.status);
        const isMyTask = (String(item.driver).toUpperCase() === myName) || (String(item.driverEmail).toLowerCase() === myEmail);

        if (currentTab === 'pribadi') return !isCompleted && isMyTask;
        if (currentTab === 'global') return !isCompleted;
        if (currentTab === 'riwayat') return isCompleted;
        return false;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm font-medium">Tidak ada jadwal pengiriman di tanggal ini.</div>`;
        return;
    }

// ... di dalam fungsi renderDeliveries ...
filtered.forEach(item => {
    const isCompleted = ["SELESAI", "GAGAL"].includes(item.status);
    const btnClass = currentTab === 'pribadi' ? 'bg-pink-600 shadow-pink-100' : 'bg-blue-600 shadow-blue-100';
    const btnText = currentTab === 'pribadi' ? 'Kirim Laporan' : 'Ambil Alih & Lapor';

    // Perhatikan bagian flex container di bawah ini:
    const card = `
        <div class="bg-white border rounded-2xl p-4 shadow-sm border-gray-100 hover:shadow-md transition">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <span class="text-[10px] font-bold font-mono bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">${item.idPengiriman}</span>
                    <div class="flex items-center gap-2 mt-1">
                        <h3 class="font-extrabold text-sm text-gray-900">${item.customer || "Tanpa Nama"}</h3>

                            ${(item.lat && item.lng) ? `
                            <a href="https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}" 
                           target="_blank" 
                               class="flex items-center justify-center w-7 h-7 rounded-full bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors ml-2"
                               title="Buka Peta Lokasi">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                </svg>
                                </a>
                                ` : ''}
                    </div>
                </div>
                <span class="text-[9px] font-extrabold px-2 py-1 rounded uppercase tracking-wider ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'} ml-2">${item.status || "PROSES"}</span>
            </div>
            
            <div class="bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-600 mb-2 border border-gray-100">
                <div class="flex justify-between mb-1 pb-1 border-b border-gray-200"><span>🗓️ Tanggal:</span> <span class="font-bold text-gray-800">${formatDisplayDate(item.tanggal)}</span></div>
                <div class="flex justify-between mb-1 mt-1"><span>👨‍✈️ Driver:</span> <span class="font-bold text-gray-800">${item.driver || "Belum ada"}</span></div>
                <div class="flex justify-between"><span>📦 Retur:</span> <span class="font-bold text-gray-800">${item.retur || "-"}</span></div>
            </div>
            ${!isCompleted ? `<button onclick="openReportModal('${item.idPengiriman}')" class="w-full mt-3 ${btnClass} hover:opacity-90 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md">${btnText}</button>` : ''}
        </div>
    `;
    container.insertAdjacentHTML('beforeend', card);
});
}

// ==========================================
// MODAL & SUBMISSION
// ==========================================
window.openReportModal = function(idPengiriman) {
    const item = allDeliveries.find(d => String(d.idPengiriman) === String(idPengiriman));
    if (!item) return Swal.fire('Error', 'Data tidak ditemukan', 'error');

    activeDeliveryId = idPengiriman;
    document.getElementById('formCustomer').textContent = item.customer || "-";
    document.getElementById('formIdPengiriman').textContent = item.idPengiriman || "-";
    
    // 🛠️ PERBAIKAN: Toleransi Casing Huruf Kapital / Kecil dari API Backend
    document.getElementById('input5k').value = item.cyl5_5kg ?? item.Cyl5_5kg ?? 0;
    document.getElementById('input12k').value = item.cyl12kg ?? item.Cyl12kg ?? 0;
    document.getElementById('input50k').value = item.cyl50kg ?? item.Cyl50kg ?? 0;
    
    document.getElementById('inputRetur').value = item.retur || "";
    document.getElementById('inputCatatan').value = ""; 
    
    document.getElementById('previewReport').classList.add('hidden');
    document.getElementById('videoReport').classList.remove('hidden');
    window.fotoLaporanBase64 = null; 
    
    document.getElementById('reportModal').classList.remove('hidden');
    startCamera('Laporan');
};

window.closeReportModal = function() {
    stopCamera('Laporan');
    document.getElementById('reportModal').classList.add('hidden');
};

window.submitDeliveryReport = async function(statusAkhir) {
    if (statusAkhir === 'SELESAI' && !window.fotoLaporanBase64) {
        return Swal.fire({ icon: 'error', title: 'Foto Wajib', text: 'Mohon ambil foto bukti sebelum klik Selesai.' });
    }

    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    
    const waktuLapor = `${d}/${m}/${y} ${hh}:${mm}:${ss}`; 

    const payload = {
        action: "pengiriman/update",
        idPengiriman: activeDeliveryId,
        status: statusAkhir,
        // 🛠️ OPTIMASI: Bungkus dengan parseInt untuk memastikan dikirim sebagai angka bersih
        cyl5_5kg: parseInt(document.getElementById('input5k').value) || 0,
        cyl12kg: parseInt(document.getElementById('input12k').value) || 0,
        cyl50kg: parseInt(document.getElementById('input50k').value) || 0,
        retur: document.getElementById('inputRetur').value,
        catatan: document.getElementById('inputCatatan').value,
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        fotoBase64: window.fotoLaporanBase64 || "",
        timestampLapor: waktuLapor
    };

    try {
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        const res = await API.request('pengiriman/update', payload);
        
        if (res.success || res.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Berhasil', timer: 2000, showConfirmButton: false });
            closeReportModal();
            loadDeliveryData();
        } else {
            throw new Error(res.message || "Gagal mengirim data.");
        }
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

function formatDisplayDate(dateStr) {
    if (!dateStr || dateStr === "-") return "-";

    if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }
    }
    return dateStr;
}
