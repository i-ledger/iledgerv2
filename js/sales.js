// ==========================================
// GLOBAL VARIABLE
// ==========================================
let selectedPenjualan = null;
let salesDataGlobal = [];
let deliveryDataGlobal = [];
let filteredData = [];
let currentPage = 1;
let isSearching = false; // PENTING: Untuk membedakan status pencarian
const itemsPerPage = 100;

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const user = API.checkAuth();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) return API.logout();
    
    if(user){
        if(document.getElementById('companyName')) document.getElementById('companyName').textContent = user.perusahaan || "PT. SINARAPI JATAYU PERMAI";
        if(document.getElementById('userName')) document.getElementById('userName').textContent = user.nama || "Admin";
        if(document.getElementById('userRole')) document.getElementById('userRole').textContent = user.role || "ADMIN";
    }
    loadDataPenjualan();
});

// ==========================================
// FILTER LOGIC
// ==========================================
window.toggleFilter = function() {
    const el = document.getElementById('filterSection');
    el.classList.toggle('hidden');
};

window.applyFilters = function() {
    const tglVal = document.getElementById('filterTgl').value; 
    const custVal = document.getElementById('filterCust').value.toLowerCase();
    const driverVal = document.getElementById('filterDriver').value.toLowerCase();
    const searchVal = document.getElementById('searchSales').value.toLowerCase();
    const mismatchVal = document.getElementById('filterMismatch') ? document.getElementById('filterMismatch').checked : false;

    // Set isSearching jadi true jika ada filter aktif
    isSearching = (tglVal || custVal || driverVal || searchVal || mismatchVal);

    filteredData = salesDataGlobal.filter(item => {
        let matchTgl = true;
        if (tglVal) {
            // tglVal dari kalender berformat YYYY-MM-DD
            // item.tanggal dari sheet berformat DD/MM/YYYY
            const strTgl = String(item.tanggal || "");
            let itemDateInYMD = "";
            
            if (strTgl.includes('/')) {
                const parts = strTgl.split('/'); // [DD, MM, YYYY]
                if (parts.length === 3) {
                    itemDateInYMD = `${parts[2]}-${parts[1]}-${parts[0]}`; // Hasil: YYYY-MM-DD
                }
            } else {
                const dateObj = new Date(item.tanggal);
                if (!isNaN(dateObj.getTime())) {
                    itemDateInYMD = dateObj.toISOString().split('T')[0];
                }
            }
            matchTgl = (itemDateInYMD === tglVal);
        }
        const matchCust = (item.customer || "").toLowerCase().includes(custVal);
        const matchDriver = (item.driver || "").toLowerCase().includes(driverVal);
        const matchSearch = (item.id + " " + item.customer).toLowerCase().includes(searchVal);
        const matchMismatch = mismatchVal ? isMismatch(item) : true;

        return matchTgl && matchCust && matchDriver && matchSearch && matchMismatch;
    });

    currentPage = 1;
    renderTable();
};

window.resetFilters = function() {
    document.querySelectorAll('#filterSection input').forEach(i => i.value = '');
    const checkboxMismatch = document.getElementById('filterMismatch');
    if(checkboxMismatch) checkboxMismatch.checked = false;
    
    document.getElementById('searchSales').value = '';
    isSearching = false; 
    filteredData = [...salesDataGlobal];
    currentPage = 1;
    renderTable();
};

// ==========================================
// UTILS
// ==========================================
function formatTanggal(input) {
    if (!input) return "-";
    const str = String(input);
    
    // 📅 JIKA SUDAH FORMAT DD/MM/YYYY, LANGSUNG KEMBALIKAN
    if (str.includes('/') && str.split('/').length === 3) {
        return str;
    }
    
    // Fallback jika berupa objek Date atau string ISO dari server
    let dateObj = new Date(input);
    if (isNaN(dateObj.getTime())) return str;
    
    const y = dateObj.getFullYear(), m = String(dateObj.getMonth() + 1).padStart(2, '0'), d = String(dateObj.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
}

function rupiah(angka) { return new Intl.NumberFormat("id-ID").format(parseInt(angka) || 0); }

// ==========================================
// LOAD DATA DARI SERVER
// ==========================================
async function loadDataPenjualan() {
    const tbody = document.getElementById('salesBody');
    try {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8"><p class="animate-pulse">Memuat data...</p></td></tr>`;
        const [resPenjualan, resPengiriman] = await Promise.all([
            API.request('penjualan/get'),
            API.request('pengiriman/get').catch(() => ({ data: [] }))
        ]);
        
        salesDataGlobal = resPenjualan.data || resPenjualan || []; 
        deliveryDataGlobal = resPengiriman.data || resPengiriman || [];
        
        filteredData = [...salesDataGlobal];
        currentPage = 1; 
        isSearching = false;
        
        renderTable(); 
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-6 text-red-500 font-bold">Gagal memuat data</td></tr>`;
    }
}

// ==========================================
// RENDER TABEL & PAGINATION
// ==========================================
function renderTable() {
    const tbody = document.getElementById('salesBody');
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-6 text-gray-500 font-bold">Tidak ada data transaksi.</td></tr>`;
        renderPagination();
        return;
    }

    let itemsToRender = isSearching ? filteredData : filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    let html = '';
    itemsToRender.forEach((item) => {
        let statusClass = item.status === 'BELUM LUNAS' ? 'bg-red-100 text-red-700': 'bg-green-100 text-green-700' ;
        const safeItem = JSON.stringify(item).replace(/'/g, "&apos;");

        const qty50 = parseInt(item.Cyl50kg || item.cyl50kg || item.Cyl50Kg || 0);
        const qty12 = parseInt(item.Cyl12kg || item.cyl12kg || item.Cyl12Kg || 0);
        const qty5  = parseInt(item.Cyl5_5kg || item.cyl5_5kg || 0);

        let warningHtml = '';
        const tglPenjualan = formatTanggal(item.tanggal);
        const deliveryMatch = deliveryDataGlobal.find(d => 
            d.id === item.id || d.idPenjualan === item.id || 
            (d.customer === item.customer && formatTanggal(d.tanggal) === tglPenjualan)
        );

        if (deliveryMatch) {
            const dQty50 = parseInt(deliveryMatch.cyl50kg || deliveryMatch.Cyl50kg || 0);
            const dQty12 = parseInt(deliveryMatch.cyl12kg || deliveryMatch.Cyl12kg || 0);
            const dQty5  = parseInt(deliveryMatch.cyl5_5kg || deliveryMatch.Cyl5_5kg || 0);

            // Jika ada selisih, tampilkan badge merah
            if (qty50 !== dQty50 || qty12 !== dQty12 || qty5 !== dQty5) {
                warningHtml = `
                    <div class="mt-2 text-[10px] bg-red-50 text-red-600 font-bold px-2 py-1.5 rounded border border-red-200">
                        ⚠️ Tidak sesuai pengiriman!<br>
                        <span class="text-gray-600">Dikirim: 50Kg(${dQty50}), 12Kg(${dQty12}), 5.5Kg(${dQty5})</span><br>
                        <span class="text-red-500">>> Wajib Revisi Transaksi!</span>
                    </div>
                `;
            }
        }

        html += `
        <tr class="border-b border-gray-100 hover:bg-pink-50 transition">
            <td class="p-3 text-center"><input type="checkbox" name="pilihPenjualan" class="w-4 h-4 cursor-pointer" onchange='pilihPenjualan(this, ${safeItem})'></td>
            <td class="p-3 text-xs font-bold text-gray-500">${tglPenjualan}</td>
            <td class="p-3 text-xs font-bold text-gray-800">${item.id}</td>
            <td class="p-3 font-medium max-w-[200px]"><div class="truncate">${item.customer}</div>${warningHtml}</td>
            <td class="p-3 text-center font-bold text-gray-700">${qty50 > 0 ? qty50 : '-'}</td>
            <td class="p-3 text-center font-bold text-gray-700">${qty12 > 0 ? qty12 : '-'}</td>
            <td class="p-3 text-center font-bold text-gray-700">${qty5 > 0 ? qty5 : '-'}</td>
            <td class="p-3 font-bold">Rp ${rupiah(item.total)}</td>
            <td class="p-3"><span class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${statusClass}">${item.status}</span></td>
            <td class="p-3 text-center space-x-2">
                <button onclick="bukaEditPenjualan('${item.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded transition">✏️</button>
                <button onclick="hapusPenjualan('${item.id}')" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded transition">🗑️</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
    renderPagination();
}

function renderPagination() {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    if (isSearching) {
        container.innerHTML = `<div class="font-bold">Pencarian Global: Ditemukan <span class="text-pink-600">${filteredData.length}</span> Transaksi</div><div></div>`;
        return;
    }

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = `<div class="font-bold">Total: ${filteredData.length} Transaksi</div><div></div>`;
        return;
    }

    let buttons = `<button onclick="changePage(${currentPage - 1})" class="px-3 py-1 bg-gray-200 rounded mx-1 ${currentPage === 1 ? 'opacity-50' : ''}" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'bg-pink-500 text-white' : 'bg-gray-200';
        buttons += `<button onclick="changePage(${i})" class="px-3 py-1 rounded mx-1 font-bold ${activeClass}">${i}</button>`;
    }
    buttons += `<button onclick="changePage(${currentPage + 1})" class="px-3 py-1 bg-gray-200 rounded mx-1 ${currentPage === totalPages ? 'opacity-50' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;

    container.innerHTML = `<div class="font-bold">Hal ${currentPage} dari ${totalPages}</div><div class="flex items-center">${buttons}</div>`;
}

// ==========================================
// FUNGSI NAVIGASI & HELPERS
// ==========================================
window.changePage = function(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    const scrollContainer = document.querySelector('.overflow-y-auto.max-h-\\[60vh\\]');
    if(scrollContainer) scrollContainer.scrollTop = 0; 
};

function isMismatch(item) {
    const tglPenjualan = formatTanggal(item.tanggal);
    const deliveryMatch = deliveryDataGlobal.find(d => 
        d.id === item.id || d.idPenjualan === item.id || 
        (d.customer === item.customer && formatTanggal(d.tanggal) === tglPenjualan)
    );
    if (!deliveryMatch) return true; 

    const qty50 = parseInt(item.Cyl50kg || item.cyl50kg || item.Cyl50Kg || 0);
    const qty12 = parseInt(item.Cyl12kg || item.cyl12kg || item.Cyl12Kg || 0);
    const qty5  = parseInt(item.Cyl5_5kg || item.cyl5_5kg || 0);

    const dQty50 = parseInt(deliveryMatch.cyl50kg || deliveryMatch.Cyl50kg || 0);
    const dQty12 = parseInt(deliveryMatch.cyl12kg || deliveryMatch.Cyl12kg || 0);
    const dQty5  = parseInt(deliveryMatch.cyl5_5kg || deliveryMatch.Cyl5_5kg || 0);

    return (qty50 !== dQty50 || qty12 !== dQty12 || qty5 !== dQty5);
}


// ==========================================
// FUNGSI INJECT BARIS PRODUK
// ==========================================
window.tambahBarisProduk = function() {
    const container = document.getElementById('product-container');
    const newDiv = document.createElement('div');
    newDiv.className = "product-row flex gap-2 mb-2 items-center";
    newDiv.innerHTML = `
        <select class="input-elegant w-1/2 swal-barang text-xs p-2">
            <option value="LPG 50 Kg">LPG 50 Kg</option>
            <option value="LPG 12 Kg">LPG 12 Kg</option>
            <option value="LPG 5.5 Kg">LPG 5.5 Kg</option>
        </select>
        <input type="number" class="input-elegant w-1/4 swal-qty text-xs p-2" placeholder="Qty">
        <input type="number" class="input-elegant w-1/4 swal-harga text-xs p-2" placeholder="Harga">
    `;
    container.appendChild(newDiv);
};

window.tambahBarisProdukEdit = function() {
    const container = document.getElementById('edit-product-container');
    const newDiv = document.createElement('div');
    newDiv.className = "product-row-edit flex gap-2 mb-2 items-center";
    newDiv.innerHTML = `
        <select class="input-elegant w-1/2 edit-barang text-xs p-2">
            <option value="LPG 50 Kg">LPG 50 Kg</option>
            <option value="LPG 12 Kg">LPG 12 Kg</option>
            <option value="LPG 5.5 Kg">LPG 5.5 Kg</option>
        </select>
        <input type="number" class="input-elegant w-1/4 edit-qty text-xs p-2" placeholder="Qty">
        <input type="number" class="input-elegant w-1/4 edit-harga text-xs p-2" placeholder="Harga">
    `;
    container.appendChild(newDiv);
};

// ==========================================
// MODAL TRANSAKSI BARU & EDIT
// ==========================================
// ==========================================
// MODAL TRANSAKSI BARU (DEFAULT: BELUM LUNAS)
// ==========================================
window.modalBuatPenjualan = async function() {
    Swal.fire({ title: 'Memuat Data...', didOpen: () => Swal.showLoading() });
    let users = [];
    try {
        users = await API.request('users/approved');
    } catch(e) {
        Swal.fire('Error', 'Gagal memuat data relasi', 'error');
        return;
    }
    
    const customers = users.filter(u => u.role === 'CUSTOMER');
    const drivers = users.filter(u => u.role === 'DRIVER');
    Swal.close();

    const { value: formValues } = await Swal.fire({
        title: 'Buat Transaksi Baru',
        width: '600px',
        html: `
            <div class="text-left text-xs font-bold text-gray-500 mb-1">Customer</div>
            <select id="swal-customer" class="input-elegant w-full mb-3 p-2">
                <option value="">-- Pilih Customer --</option>
                ${customers.map(c => `<option value="${c.nama}">${c.nama}</option>`).join('')}
            </select>
            
            <div class="text-left text-xs font-bold text-gray-500 mb-1">Barang</div>
            <div id="product-container" class="mb-2">
                <div class="product-row flex gap-2 mb-2 items-center">
                    <select class="input-elegant w-1/2 swal-barang text-xs p-2">
                        <option value="LPG 50 Kg">LPG 50 Kg</option>
                        <option value="LPG 12 Kg">LPG 12 Kg</option>
                        <option value="LPG 5.5 Kg">LPG 5.5 Kg</option>
                    </select>
                    <input type="number" class="input-elegant w-1/4 swal-qty text-xs p-2" placeholder="Qty">
                    <input type="number" class="input-elegant w-1/4 swal-harga text-xs p-2" placeholder="Harga">
                </div>
            </div>
            
            <button type="button" class="text-xs bg-pink-100 text-pink-600 p-2 rounded mb-4 w-full font-bold hover:bg-pink-200 transition" 
                onclick="tambahBarisProduk()">
                + Tambah Baris Barang
            </button>

            <div class="grid grid-cols-2 gap-3">
                <input type="number" id="swal-ongkir" class="input-elegant w-full mb-3 p-2" placeholder="Ongkir (Rp)" value="0">
                <input type="date" id="swal-tgl-kirim" class="input-elegant w-full mb-3 p-2">
            </div>
            
            <div class="text-left text-xs font-bold text-gray-500 mb-1">Driver</div>
            <select id="swal-driver" class="input-elegant w-full p-2">
                <option value="">-- Pilih Driver --</option>
                ${drivers.map(d => `<option value="${d.nama}">${d.nama}</option>`).join('')}
            </select>
        `,
        confirmButtonColor: '#000',
        confirmButtonText: 'Simpan Transaksi',
        preConfirm: () => {
            const items = Array.from(document.querySelectorAll('.product-row')).map(row => ({
                barang: row.querySelector('.swal-barang').value,
                qty: row.querySelector('.swal-qty').value,
                harga: row.querySelector('.swal-harga').value
            }));
            return {
                customer: document.getElementById('swal-customer').value,
                items: items,
                ongkir: document.getElementById('swal-ongkir').value,
                tanggalKirim: document.getElementById('swal-tgl-kirim').value,
                driver: document.getElementById('swal-driver').value,
                status: 'BELUM LUNAS' // 🔒 DIKUNCI DI SINI AGAR OTOMATIS BELUM LUNAS
            }
        }
    });

    if (formValues && formValues.customer) {
        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
        try {
            await API.request('penjualan/create', formValues);
            Swal.fire('Berhasil!', 'Transaksi disimpan.', 'success').then(() => loadDataPenjualan());
        } catch(e) {
            Swal.fire('Error', e.message || 'Gagal menyimpan transaksi', 'error');
        }
    }
};

window.bukaEditPenjualan = async function(id) {
    const item = salesDataGlobal.find(x => x.id === id);
    if (!item) return;

    Swal.fire({ title: 'Memuat Data...', didOpen: () => Swal.showLoading() });
    let users = [];
    try { users = await API.request('users/approved'); } catch(e) {}
    const customers = users.filter(u => u.role === 'CUSTOMER');
    const drivers = users.filter(u => u.role === 'DRIVER');
    Swal.close();

    const tglPenjualan = formatTanggal(item.tanggal);
    const deliveryMatch = deliveryDataGlobal.find(d => 
        d.id === item.id || d.idPenjualan === item.id || 
        (d.customer === item.customer && formatTanggal(d.tanggal) === tglPenjualan)
    );
    
    // 📅 AMAN DARI BUG BULAN KEBALIK: FORMAT ULANG DD/MM/YYYY KE YYYY-MM-DD KALENDER HTML
    let existingTglKirim = "";
    if (deliveryMatch && deliveryMatch.tanggal) {
        const strTgl = String(deliveryMatch.tanggal);
        if (strTgl.includes("/")) {
            const parts = strTgl.split("/"); // [DD, MM, YYYY]
            if (parts.length === 3 && parts[2].length === 4) {
                existingTglKirim = `${parts[2]}-${parts[1]}-${parts[0]}`; // Hasil: YYYY-MM-DD
            }
        } else {
            const dObj = new Date(strTgl);
            if (!isNaN(dObj.getTime())) {
                const y = dObj.getFullYear();
                const m = String(dObj.getMonth() + 1).padStart(2, '0');
                const d = String(dObj.getDate()).padStart(2, '0');
                existingTglKirim = `${y}-${m}-${d}`;
            }
        }
    }

    let itemsArr = [];
    try { itemsArr = JSON.parse(item.json_items || item.JSON_Items || "[]"); } catch(e) {}
    if (itemsArr.length === 0) itemsArr = [{barang: 'LPG 50 Kg', qty: '', harga: ''}];

    const itemsHtml = itemsArr.map((it, idx) => `
        <div class="product-row-edit flex gap-2 mb-2 items-center" id="edit-row-${idx}">
            <select class="input-elegant w-1/2 edit-barang text-xs p-2">
                <option value="LPG 50 Kg" ${it.barang === 'LPG 50 Kg' ? 'selected' : ''}>LPG 50 Kg</option>
                <option value="LPG 12 Kg" ${it.barang === 'LPG 12 Kg' ? 'selected' : ''}>LPG 12 Kg</option>
                <option value="LPG 5.5 Kg" ${it.barang === 'LPG 5.5 Kg' ? 'selected' : ''}>LPG 5.5 Kg</option>
            </select>
            <input type="number" class="input-elegant w-1/4 edit-qty text-xs p-2" placeholder="Qty" value="${it.qty || ''}">
            <input type="number" class="input-elegant w-1/4 edit-harga text-xs p-2" placeholder="Harga" value="${it.harga || ''}">
        </div>
    `).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Edit Transaksi',
        width: '600px',
        html: `
            <div class="text-left text-xs font-bold text-gray-500 mb-1">Customer</div>
            <select id="edit-customer" class="input-elegant w-full mb-3 p-2">
                ${customers.map(c => `<option value="${c.nama}" ${c.nama === item.customer ? 'selected' : ''}>${c.nama}</option>`).join('')}
            </select>

            <div class="text-left text-xs font-bold text-gray-500 mb-1">Barang</div>
            <div id="edit-product-container" class="mb-2">${itemsHtml}</div>
            
            <button type="button" class="text-xs bg-pink-100 text-pink-600 p-2 rounded mb-4 w-full font-bold hover:bg-pink-200 transition" 
                onclick="tambahBarisProdukEdit()">
                + Tambah Baris Barang
            </button>

            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <div class="text-left text-xs font-bold text-gray-500 mb-1">Status Pembayaran</div>
                    <select id="edit-status" class="input-elegant w-full p-2">
                        <option value="BELUM LUNAS" ${item.status === 'BELUM LUNAS' ? 'selected' : ''}>BELUM LUNAS</option>
                        <option value="LUNAS" ${item.status === 'LUNAS' ? 'selected' : ''}>LUNAS</option>
                    </select>
                </div>
                <div>
                    <div class="text-left text-xs font-bold text-gray-500 mb-1">Tanggal Pengiriman</div>
                    <input type="date" id="edit-tgl-kirim" class="input-elegant w-full p-2" value="${existingTglKirim}">
                </div>
            </div>

            <div class="text-left text-xs font-bold text-gray-500 mb-1">Ubah Driver (Bila Perlu)</div>
            <select id="edit-driver" class="input-elegant w-full p-2">
                <option value="">-- Abaikan jika tidak ganti --</option>
                ${drivers.map(d => `<option value="${d.nama}">${d.nama}</option>`).join('')}
            </select>
        `,
        confirmButtonColor: '#000',
        confirmButtonText: 'Simpan Perubahan',
        preConfirm: () => {
            const updatedItems = Array.from(document.querySelectorAll('.product-row-edit')).map(row => ({
                barang: row.querySelector('.edit-barang').value,
                qty: row.querySelector('.edit-qty').value,
                harga: row.querySelector('.edit-harga').value
            }));
            return {
                id: item.id,
                customer: document.getElementById('edit-customer').value,
                status: document.getElementById('edit-status').value,
                driver: document.getElementById('edit-driver').value,
                tanggalKirim: document.getElementById('edit-tgl-kirim').value, 
                items: updatedItems
            }
        }
    });

    if (formValues) {
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
        try {
            await API.request('penjualan/update', formValues);
            Swal.fire('Berhasil!', 'Data telah diupdate.', 'success').then(() => loadDataPenjualan());
        } catch (e) {
            Swal.fire('Error', e.message || 'Gagal menyimpan.', 'error');
        }
    }
};

// ==========================================
// FUNGSI LAINNYA
// ==========================================
window.pilihPenjualan = function(checkbox, item) {
    document.querySelectorAll('input[name="pilihPenjualan"]').forEach(x => { if(x !== checkbox) x.checked = false; });
    selectedPenjualan = checkbox.checked ? item : null;
    if(document.getElementById('btnDownloadInvoice')) document.getElementById('btnDownloadInvoice').disabled = !checkbox.checked;
    if(document.getElementById('btnDownloadSJ')) document.getElementById('btnDownloadSJ').disabled = !checkbox.checked;
};

window.hapusPenjualan = async function(id) {
    const res = await Swal.fire({ 
        title: 'Yakin hapus data ini?', 
        text: "Data yang dihapus tidak bisa dikembalikan!",
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, hapus!'
    });

    if (res.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); 

            const result = await API.request('penjualan/delete', { id });
            
            clearTimeout(timeoutId);
            Swal.fire('Berhasil!', 'Data sudah dihapus.', 'success');
            loadDataPenjualan();
        } catch(e) {
            Swal.fire('Error', 'Gagal menghapus: ' + (e.message || 'Server lambat/Timeout'), 'error');
            console.error(e);
        }
    }
};

// ==========================================
// DOWNLOAD FAKTUR PENJUALAN & SURAT JALAN
// ==========================================
window.downloadInvoiceSelected = async function() {
    if (!selectedPenjualan) return Swal.fire('Pilih Transaksi', 'Silahkan pilih transaksi.', 'warning');
    
    Swal.fire({ title: 'Menarik Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let custAlamat = "-";
    let companyNama = "PT. Sinarapi Jatayu Permai"; 
    let companyAlamat = "-";

    try {
        const [resUsers, resSetting] = await Promise.all([
            API.request('users/approved').catch(() => []),
            API.request('setting_perusahaan/get').catch(() => null)
        ]);
        
        const matchCust = resUsers.find(u => u.nama === selectedPenjualan.customer);
        if (matchCust && matchCust.alamat) custAlamat = matchCust.alamat;

        const setting = (resSetting && resSetting.data) ? resSetting.data : resSetting;
        if (setting) {
            if (setting.namaPerusahaan) companyNama = setting.namaPerusahaan;
            if (setting.alamat) companyAlamat = setting.alamat;
        }

    } catch (e) {
        console.error("Gagal sinkronisasi data sheet:", e);
    }

    Swal.close();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a5' });
    const tgl = formatTanggal(selectedPenjualan.tanggal);

    doc.setFontSize(10);
    doc.text("Outlet NPSO", 15, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(companyNama, 15, 20); 
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Alamat: ${companyAlamat}`, 15, 25); 

    doc.setFontSize(10);
    doc.text(`Bandung, ${tgl}`, 130, 15);
    doc.text("Kepada Yth. Customer", 130, 20);
    doc.setFont("helvetica", "bold");
    doc.text(selectedPenjualan.customer, 130, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(custAlamat, 130, 30); 

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Faktur Penjualan", 105, 38, { align: 'center' });

    let items = [];
    try { items = JSON.parse(selectedPenjualan.json_items || "[]"); } catch(e) {}
    if(items.length === 0) items = [{ barang: selectedPenjualan.barang, qty: 1, harga: selectedPenjualan.total }];

    let tableBody = [];
    items.forEach((it, idx) => {
        const qty = parseInt(it.qty) || 0;
        const hrg = parseInt(it.harga) || 0;
        tableBody.push([
            idx + 1,
            it.barang + "      (Refill)",
            qty,
            "Rp " + rupiah(hrg),
            "Rp " + rupiah(qty * hrg)
        ]);
    });

    tableBody.push([{ content: "Total", colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: "Rp " + rupiah(selectedPenjualan.total), styles: { fontStyle: 'bold' } }]);

    doc.autoTable({
        startY: 48,
        head: [['No.', 'Nama Barang', 'Qty', 'Harga', 'Jumlah']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0,0,0], lineWidth: 0.2, halign: 'center' },
        bodyStyles: { lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
        columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { cellWidth: 78 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 35 },
            4: { halign: 'right', cellWidth: 40 }
        },
        margin: { left: 15, right: 15 }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Penerima", 35, finalY, { align: 'center' });
    doc.text("Hormat Kami,", 175, finalY, { align: 'center' });
    doc.text("..................................", 35, finalY + 22, { align: 'center' });
    doc.text("..................................", 175, finalY + 22, { align: 'center' });

    doc.save(`Faktur_${selectedPenjualan.id}.pdf`);
};

window.downloadSJSelected = async function() {
    if (!selectedPenjualan) return Swal.fire('Pilih Transaksi', 'Silahkan pilih transaksi.', 'warning');
    
    Swal.fire({ title: 'Menarik Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let custAlamat = "-";
    let companyNama = "PT. Sinarapi Jatayu Permai"; 
    let companyAlamat = "-";

    try {
        const [resUsers, resSetting] = await Promise.all([
            API.request('users/approved').catch(() => []),
            API.request('setting_perusahaan/get').catch(() => null)
        ]);
        
        const matchCust = resUsers.find(u => u.nama === selectedPenjualan.customer);
        if (matchCust && matchCust.alamat) custAlamat = matchCust.alamat;

        const setting = (resSetting && resSetting.data) ? resSetting.data : resSetting;
        if (setting) {
            if (setting.namaPerusahaan) companyNama = setting.namaPerusahaan;
            if (setting.alamat) companyAlamat = setting.alamat;
        }

    } catch (e) {
        console.error("Gagal sinkronisasi data sheet:", e);
    }

    Swal.close();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a5' });
    const tgl = formatTanggal(selectedPenjualan.tanggal);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Outlet NPSO", 105, 15, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(companyNama, 105, 20, { align: 'center' }); 
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Alamat: ${companyAlamat}`, 105, 25, { align: 'center' }); 

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Surat Jalan", 105, 38, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.line(88, 40, 122, 40); 

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nama Pelanggan", 15, 52); doc.text(": " + selectedPenjualan.customer, 45, 52);
    doc.text("Alamat", 15, 58); doc.text(": " + custAlamat, 45, 58); 
    doc.text("Tanggal", 130, 52); doc.text(": " + tgl, 155, 52);
    doc.text("Nomor inv", 130, 58); doc.text(": " + selectedPenjualan.id, 155, 58);

    let items = [];
    try { items = JSON.parse(selectedPenjualan.json_items || "[]"); } catch(e) {}
    if(items.length === 0) items = [{ barang: selectedPenjualan.barang, qty: 1 }];

    let tableBody = [];
    items.forEach((it, idx) => {
        tableBody.push([
            idx + 1,
            it.barang + "      (Refill)",
            it.qty,
            "Kondisi Baik"
        ]);
    });

    doc.autoTable({
        startY: 65,
        head: [['No.', 'Nama Barang', 'Jumlah', 'Keterangan']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0,0,0], lineWidth: 0.2, halign: 'center' },
        bodyStyles: { lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0], halign: 'center' },
        columnStyles: {
            0: { cellWidth: 15 },
            1: { halign: 'left', cellWidth: 75 },
            2: { cellWidth: 30 },
            3: { cellWidth: 60 }
        },
        margin: { left: 15, right: 15 }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Penerima", 35, finalY, { align: 'center' });
    doc.text("Hormat Kami,", 175, finalY, { align: 'center' });
    doc.text("..................................", 35, finalY + 22, { align: 'center' });
    doc.text("..................................", 175, finalY + 22, { align: 'center' });

    doc.save(`SuratJalan_${selectedPenjualan.id}.pdf`);
};
