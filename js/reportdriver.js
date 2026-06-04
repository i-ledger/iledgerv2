// js/reportdriver.js - Logika Kamera, GPS & Pengiriman Form Via API Utama
let videoStream = null;
let base64PhotoData = null;
let userLocation = { lat: "", lng: "" };

const video = document.getElementById('videoFeed');
const canvas = document.getElementById('photoCanvas');
const capturedImage = document.getElementById('capturedImage');
const captureBtn = document.getElementById('captureBtn');
const retakeBtn = document.getElementById('retakeBtn');
const deliveryForm = document.getElementById('deliveryForm');

document.addEventListener('DOMContentLoaded', () => {
    // Validasi Auth Driver
    const activeUser = API.checkAuth();
    if (!activeUser) return;

    loadActiveSession();
    startCamera();
    getLiveLocation();
    document.getElementById('backBtn').addEventListener('click', backToDashboard);
});

function loadActiveSession() {
    const idPengiriman = sessionStorage.getItem('active_id_pengiriman');
    const pangkalan = sessionStorage.getItem('active_pangkalan');

    if (!idPengiriman) {
        Swal.fire({ icon: 'error', title: 'Sesi Hilang', text: 'Sesi tugas pengiriman tidak ditemukan.', confirmButtonColor: '#ff4fa3' });
        backToDashboard();
        return;
    }
    document.getElementById('idPengiriman').value = idPengiriman;
    document.getElementById('targetPangkalan').value = pangkalan;
}

function backToDashboard() {
    stopCamera();
    window.location.href = 'dashboard-driver.html';
}

async function startCamera() {
    video.classList.remove('hidden');
    capturedImage.classList.add('hidden');
    captureBtn.classList.remove('hidden');
    retakeBtn.classList.add('hidden');
    base64PhotoData = null;

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        video.srcObject = videoStream;
    } catch (err) {
        Swal.fire({ icon: 'warning', title: 'Kamera Gagal', text: 'Gagal mengakses hardware kamera device Anda.', confirmButtonColor: '#ff4fa3' });
    }
}

function stopCamera() {
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
}

captureBtn.addEventListener('click', () => {
    if (!videoStream) return;
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    base64PhotoData = canvas.toDataURL('image/jpeg', 0.85);
    capturedImage.src = base64PhotoData;
    capturedImage.classList.remove('hidden');
    video.classList.add('hidden');
    captureBtn.classList.add('hidden');
    retakeBtn.classList.remove('hidden');
});

retakeBtn.addEventListener('click', startCamera);

function getLiveLocation() {
    const geoStatus = document.getElementById('geoStatus');
    if (!navigator.geolocation) {
        geoStatus.innerText = "GPS Tidak Didukung";
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation.lat = position.coords.latitude.toFixed(6);
            userLocation.lng = position.coords.longitude.toFixed(6);
            geoStatus.innerText = `${userLocation.lat}, ${userLocation.lng}`;
            geoStatus.className = "text-green-600 font-mono font-bold";
        },
        (error) => {
            geoStatus.innerText = "Gagal Mengunci GPS";
            geoStatus.className = "text-red-500 font-bold";
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

deliveryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!base64PhotoData) {
        Swal.fire({ icon: 'warning', title: 'Foto Kosong', text: 'Silakan ambil foto bukti di lokasi terlebih dahulu!', confirmButtonColor: '#ff4fa3' });
        return;
    }

    const submitBtn = document.getElementById('submitReportBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "MENGIRIM DATA LAPORAN...";

    const reportPayload = {
        idPengiriman: document.getElementById('idPengiriman').value,
        status: "SELESAI",
        catatan: document.getElementById('catatanDriver').value || "Pengiriman Selesai",
        cyl5_5kg: parseInt(document.getElementById('cyl5_5kg').value) || 0,
        cyl12kg: parseInt(document.getElementById('cyl12kg').value) || 0,
        cyl50kg: parseInt(document.getElementById('cyl50kg').value) || 0,
        lat: userLocation.lat,
        lng: userLocation.lng,
        fotoBase64: base64PhotoData
    };

    try {
        Swal.fire({ title: 'Menyimpan Laporan...', didOpen: () => Swal.showLoading() });
        
        // Eksekusi pengiriman data bersih melalui API utama milik lo
        await API.request('delivery/update', reportPayload);

        Swal.fire({ 
            icon: 'success', 
            title: 'Berhasil!', 
            text: 'Laporan pengiriman berhasil disimpan ke R22 NPSO Backend!', 
            confirmButtonColor: '#ff4fa3' 
        }).then(() => {
            sessionStorage.clear();
            backToDashboard();
        });
        
    } catch (err) {
        // Error otomatis ditangani oleh modal Swal merah di dalam api.js lo
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "KIRIM LAPORAN PENGIRIMAN";
    }
});
