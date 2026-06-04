document.addEventListener('DOMContentLoaded', () => {
    const user = API.checkAuth();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return API.logout();
    loadDataStok();
    loadHistoryStok();
});

// --- HELPER FUNCTIONS ---
function formatTanggal(isoString) {
    if (!isoString) return "-";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${hh}:${mm}`;
}

const toRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

// --- LOAD DATA ---
async function loadDataStok() {
    const tbody = document.getElementById('stokBody');
    try {
        const dataStok = await API.request('stok/get');
        if (!dataStok || dataStok.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-500 font-bold">Data kosong.</td></tr>`;
            return;
        }
        let html = '';
        dataStok.forEach(item => {
            const stokAkhir = parseInt(item.StokAkhir) || 0;
            const textClass = stokAkhir < 10 ? 'text-red-500 font-bold' : 'text-gray-800 font-bold';
            html += `
            <tr class="border-b border-gray-100 hover:bg-pink-50 transition">
                <td class="p-3">${item.IDBarang}</td>
                <td class="p-3 font-bold text-pink-500">${item.NamaBarang}</td>
                <td class="p-3">${item.StokMasuk || 0}</td>
                <td class="p-3">${item.StokKeluar || 0}</td>
                <td class="p-3 ${textClass}">${stokAkhir} Tabung</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Gagal load stok:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-500 font-bold">Error: ${error.message}</td></tr>`;
    }
}

async function loadHistoryStok() {
    const tbody = document.getElementById('historyBody');
    try {
        const historyData = await API.request('stok/history');
        if (!historyData || historyData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-gray-500 font-bold">Belum ada riwayat.</td></tr>`;
            return;
        }
        let html = '';
        historyData.forEach(item => {
            const harga = parseFloat(item.harga) || 0;
            const qty = parseInt(item.qty) || 0;
            const total = harga * qty;
            html += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                <td class="p-3 text-xs font-bold text-gray-500">${formatTanggal(item.tanggal)}</td>
                <td class="p-3 text-xs font-bold text-pink-500">${item.id}</td>
                <td class="p-3 font-medium">${item.supplier}</td>
                <td class="p-3 font-bold text-gray-700">${item.barang}</td>
                <td class="p-3 font-bold text-green-600">+ ${qty}</td>
                <td class="p-3 font-medium">${toRupiah(harga)}</td>
                <td class="p-3 font-bold text-blue-600">${toRupiah(total)}</td>
                <td class="p-3 text-center space-x-2">
                    <button onclick="bukaEditRiwayat('${item.id}', '${item.supplier}', ${qty}, ${harga})" class="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded transition">✏️</button>
                    <button onclick="hapusRiwayat('${item.id}')" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded transition">🗑️</button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Gagal load history:", error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-red-500 font-bold">Error: ${error.message}</td></tr>`;
    }
}

// --- MODALS & ACTIONS ---
window.modalTambahStok = async function() {
    const { value: formValues } = await Swal.fire({
        title: 'Input Pembelian',
        html: `<input id="swal-supplier" class="input-elegant w-full mb-3" placeholder="Supplier"><select id="swal-barang" class="input-elegant w-full mb-3"><option>LPG 50 Kg</option><option>LPG 12 Kg</option><option>LPG 5.5 Kg</option></select><input type="number" id="swal-qty" class="input-elegant w-full mb-3" placeholder="Jumlah"><input type="number" id="swal-harga" class="input-elegant w-full" placeholder="Harga Beli">`,
        preConfirm: () => ({ supplier: document.getElementById('swal-supplier').value, barang: document.getElementById('swal-barang').value, qty: document.getElementById('swal-qty').value, hargaBeli: document.getElementById('swal-harga').value })
    });
    if (formValues) {
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
        try {
            await API.request('stok/add', formValues);
            Swal.fire('Berhasil!', 'Stok bertambah.', 'success');
            loadDataStok(); loadHistoryStok();
        } catch (e) { Swal.fire('Gagal!', e.message, 'error'); }
    }
};

window.bukaEditRiwayat = function(id, supplier, qty, harga) {
    document.getElementById('editRiwayatId').value = id;
    document.getElementById('editRiwayatSupplier').value = supplier;
    document.getElementById('editRiwayatQty').value = qty;
    document.getElementById('editRiwayatHarga').value = harga;
    document.getElementById('modalEditRiwayat').classList.remove('hidden');
};

window.tutupModalRiwayat = function() {
    document.getElementById('modalEditRiwayat').classList.add('hidden');
};

window.simpanEditRiwayat = async function(e) {
    e.preventDefault();
    const payload = {
        id: document.getElementById('editRiwayatId').value,
        supplier: document.getElementById('editRiwayatSupplier').value,
        qty: document.getElementById('editRiwayatQty').value,
        hargaBeli: document.getElementById('editRiwayatHarga').value
    };
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    try {
        await API.request('stok/update-riwayat', payload);
        tutupModalRiwayat();
        Swal.fire('Berhasil!', 'Data diupdate.', 'success');
        loadDataStok(); loadHistoryStok();
    } catch (e) { Swal.fire('Gagal!', e.message, 'error'); }
};

window.hapusRiwayat = async function(id) {
    const result = await Swal.fire({ title: 'Hapus Riwayat?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya!' });
    if (result.isConfirmed) {
        try {
            await API.request('stok/delete-riwayat', { id: id });
            Swal.fire('Terhapus!', '', 'success');
            loadDataStok(); loadHistoryStok();
        } catch (e) { Swal.fire('Gagal!', e.message, 'error'); }
    }
};
