let activeDrivers = [];

document.addEventListener('DOMContentLoaded', () => {
    const user = API.checkAuth();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return API.logout();
    
    loadDataOrder();
    loadDrivers(); // Tarik data driver untuk dropdown
});

async function loadDrivers() {
    try {
        const users = await API.request('users/approved');
        activeDrivers = users.filter(u => u.role === 'DRIVER');
    } catch (error) {}
}

async function loadDataOrder() {
    const tbody = document.getElementById('orderBody');
    try {
        const dataOrder = await API.request('order/get');
        if (!dataOrder || dataOrder.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-500 font-bold">Belum ada order masuk dari customer.</td></tr>`;
            return;
        }

        let html = '';
        dataOrder.forEach(item => {
            let buktiHtml = item.buktiTf && item.buktiTf !== '-' && item.buktiTf !== '' 
                ? `<button onclick="lihatBukti('${item.buktiTf}')" class="text-blue-500 hover:underline font-bold">Lihat Resi</button>` : `<span class="text-red-400 text-xs">Belum Upload</span>`;
            
            let statusHtml = item.status === 'PENDING' 
                ? `<span class="bg-yellow-100 text-yellow-600 px-2 py-1 rounded text-xs font-bold">PENDING</span>` : `<span class="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold">${item.status}</span>`;

            let aksiHtml = item.status === 'PENDING'
                ? `<button onclick="prosesOrder('${item.idOrder}')" class="bg-pink-500 text-white px-3 py-1 rounded text-xs font-bold shadow hover:bg-pink-600 transition">Proses ke Driver</button>` : `<span class="text-gray-400 text-xs">Selesai Diproses</span>`;

            html += `
            <tr class="border-b border-gray-100 hover:bg-pink-50 transition">
                <td class="p-3 text-pink-500 font-bold">${item.idOrder}</td>
                <td class="p-3"><p class="font-bold text-gray-800">${item.customer}</p><p class="text-xs text-gray-500">${item.noHp}</p><p class="text-xs text-gray-400 truncate max-w-[150px]" title="${item.alamat}">${item.alamat}</p></td>
                <td class="p-3 font-medium">${item.qty}x ${item.barang}</td>
                <td class="p-3">${buktiHtml}</td>
                <td class="p-3">${statusHtml}</td>
                <td class="p-3 text-center">${aksiHtml}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (error) { tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-red-500 font-bold">Gagal menarik data order.</td></tr>`; }
}

function lihatBukti(url) {
    Swal.fire({ title: 'Bukti Transfer', imageUrl: url, imageWidth: 300, imageAlt: 'Bukti TF', confirmButtonColor: '#ff4fa3', text: 'Pastikan resi valid sebelum memproses.' });
}

function prosesOrder(idOrder) {
    // Bangun opsi Dropdown
    let driverOptions = {};
    if(activeDrivers.length === 0) {
        return Swal.fire('Peringatan', 'Anda belum memiliki Driver yang disetujui (Approved). Silakan setujui akun Driver terlebih dahulu.', 'warning');
    }
    
    activeDrivers.forEach(d => { driverOptions[d.nama] = d.nama; });

    Swal.fire({
        title: 'Verifikasi & Proses', 
        text: "Pilih Driver yang akan mengirim pesanan ini:", 
        input: 'select',
        inputOptions: driverOptions,
        inputPlaceholder: 'Pilih Driver...',
        showCancelButton: true, 
        confirmButtonColor: '#ff4fa3', 
        confirmButtonText: 'Proses Surat Jalan',
        inputValidator: (value) => {
            return new Promise((resolve) => {
                if (value !== '') resolve(); else resolve('Anda harus memilih driver!');
            });
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire({ title: 'Memproses Order...', didOpen: () => Swal.showLoading() });
            try {
                await API.request('order/process', { idOrder: idOrder, driver: result.value });
                Swal.fire('Sukses', `Order berhasil diproses. SJ diteruskan ke ${result.value}.`, 'success').then(() => loadDataOrder());
            } catch (error) {}
        }
    });
}
