let isEditMode = false;
let currentEditId = null;
let globalDataCache = []; 

// Listener Inisialisasi DOM & Interface Sidebar/Menu
document.addEventListener('DOMContentLoaded', function() {
    const btnHamburger = document.getElementById('btnHamburger');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const btnActionMenu = document.getElementById('btnActionMenu');
    const actionContainer = document.getElementById('actionContainer');

    if (btnHamburger && sidebar && sidebarOverlay) {
        btnHamburger.addEventListener('click', () => {
            sidebarOverlay.classList.remove('hidden');
            setTimeout(() => sidebarOverlay.classList.remove('opacity-0'), 10);
            sidebar.classList.remove('-translate-x-full');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebarOverlay.classList.add('opacity-0');
            sidebar.classList.add('-translate-x-full');
            setTimeout(() => sidebarOverlay.classList.add('hidden'), 300);
        });
    }

    if (btnActionMenu && actionContainer) {
        btnActionMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            actionContainer.classList.toggle('hidden');
            actionContainer.classList.toggle('flex');
        });
        document.addEventListener('click', (e) => {
            if (!actionContainer.contains(e.target) && e.target !== btnActionMenu) {
                actionContainer.classList.add('hidden');
                actionContainer.classList.remove('flex');
            }
        });
    }

    // Menggunakan proteksi & sync profile dari api.js milik lu
    const userRow = API.checkAuth(); 
    if (userRow) {
        document.getElementById('userName').textContent = userRow.nama || "User";
        document.getElementById('userRole').textContent = userRow.role || "Finance Admin";
        if (userRow.nama) {
            document.getElementById('userInitial').textContent = userRow.nama.charAt(0).toUpperCase();
        }
        if (document.getElementById('companyName')) {
            document.getElementById('companyName').textContent = userRow.perusahaan || "PT. INDO LEDGER TEKNOLOGI";
        }
    }

    loadData();
});

// Handler Submit Form Utama (Create & Update)
document.getElementById('formPendapatan').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerText = "Memproses...";
    
    const fileInput = document.getElementById('buktiTransfer');
    const file = fileInput ? fileInput.files[0] : null;
    
    // Payload disesuaikan dengan kebutuhan GAS lu
    const payload = {
        nama: document.getElementById('nama').value,
        uraian: document.getElementById('uraian').value,
        nominal: document.getElementById('nominal').value,
        fileData: null,
        fileName: null,
        fileType: null
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            payload.fileData = e.target.result;
            payload.fileName = file.name;
            payload.fileType = file.type;
            await executeSubmit(payload);
        };
        reader.readAsDataURL(file);
    } else {
        await executeSubmit(payload);
    }
});

// Eksekutor API Request Simpan data
async function executeSubmit(payload) {
    const action = isEditMode ? 'pendapatan/update' : 'pendapatan/create';
    const btn = document.getElementById('btnSubmit');
    
    // Sesuaikan parameter ID sesuai penamaan properti di Google Script lu (misal: id atau idPembelian)
    if (isEditMode) payload.id = currentEditId; 
    
    try {
        // Swal loading di-handle manual karena api.js lu ga pake didOpen loading saat request biasa
        Swal.fire({ title: 'Menyimpan data...', didOpen: () => Swal.showLoading() });
        
        await API.request(action, payload);
        
        Swal.fire({ 
            icon: 'success', 
            title: 'Berhasil!', 
            text: isEditMode ? 'Data berhasil diperbarui.' : 'Data pendapatan berhasil disimpan.', 
            confirmButtonColor: '#ff4fa3', // Menyesuaikan selera warna pink/magenta di api.js lu
            customClass: { popup: 'rounded-3xl text-slate-900' }
        });
        
        resetFormMode();
        loadData();
    } catch (error) {
        console.error("Gagal memproses transaksi:", error);
        if (btn) {
            btn.disabled = false;
            btn.innerText = isEditMode ? "Update Pendapatan" : "Simpan Data Jurnal Pendapatan";
        }
    }
}

// Ambil Data dari GAS
async function loadData() {
    const tbody = document.getElementById('tabelBody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-xs font-semibold text-slate-500">Memuat data ritme kas...</td></tr>`;
    
    try {
        // Menembak action get pendapatan ke Google Script
        const data = await API.request('pendapatan/get');
        globalDataCache = data || [];
        
        buildMonthFilterOptions();
        renderData();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-xs font-bold text-rose-500">Gagal memuat data dari server Google Sheets.</td></tr>`;
    }
}

// Menghasilkan Opsi Dropdown Filter Bulan Dinamis
function buildMonthFilterOptions() {
    const filterSelect = document.getElementById('filterBulan');
    if (!filterSelect) return;

    const selectedValue = filterSelect.value; 
    filterSelect.innerHTML = '<option value="all">Semua Periode</option>';

    const uniqueMonths = [];
    const namaBulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    globalDataCache.forEach(item => {
        if (item.timestamp && item.timestamp.length >= 7) {
            const yyyyMM = item.timestamp.substring(0, 7); 
            if (!uniqueMonths.includes(yyyyMM)) {
                uniqueMonths.push(yyyyMM);
            }
        }
    });

    uniqueMonths.sort().reverse();

    uniqueMonths.forEach(ym => {
        const [year, month] = ym.split('-');
        const labelBulan = `${namaBulanIndo[parseInt(month) - 1]} ${year}`;
        const option = document.createElement('option');
        option.value = ym;
        option.textContent = labelBulan;
        filterSelect.appendChild(option);
    });

    if ([...filterSelect.options].some(opt => opt.value === selectedValue)) {
        filterSelect.value = selectedValue;
    }
}

// Render Data ke UI Tabel
function renderData() {
    const tbody = document.getElementById('tabelBody');
    const filterValue = document.getElementById('filterBulan').value;
    const labelCard = document.getElementById('incomeLabel');
    
    if (!tbody) return;
    tbody.innerHTML = "";

    const filteredData = globalDataCache.filter(item => {
        if (filterValue === "all") return true;
        return item.timestamp && item.timestamp.startsWith(filterValue);
    });

    if (filterValue === "all") {
        labelCard.textContent = "Total Pendapatan (Semua)";
    } else {
        const filterSelect = document.getElementById('filterBulan');
        labelCard.textContent = `Pendapatan ${filterSelect.options[filterSelect.selectedIndex].text}`;
    }

    document.getElementById('totalEntries').textContent = `${filteredData.length} Entri`;

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs font-semibold text-slate-500">Tidak ada data pendapatan di periode ini.</td></tr>`;
        document.getElementById('incomeMonth').textContent = "Rp 0";
        return;
    }

    let totalNominalTerfilter = 0;

    filteredData.forEach(function(item) {
        totalNominalTerfilter += parseFloat(item.nominal || 0);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/60 transition-colors border-b border-slate-900/40 text-slate-300 font-medium";
        
        const formattedNominal = new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        }).format(item.nominal);
        
        let linkBukti = `<span class="text-xs text-slate-600 font-normal">-</span>`;
        if (item.buktiTransfer && item.buktiTransfer !== "-") {
            linkBukti = `<a href="${item.buktiTransfer}" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline font-bold">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                Lihat Bukti
            </a>`;
        }

        // GAS biasanya mereturn properti id langsung atau menyesuaikan baris sheet
        const rowId = item.id || item.idPembelian || '';

        tr.innerHTML = `
            <td class="py-3 px-4 text-xs font-bold text-slate-500">#${rowId}</td>
            <td class="py-3 px-4 text-xs">${item.timestamp ? item.timestamp.replace('T', ' ').substring(0, 19) : '-'}</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-200">${item.nama || '-'}</td>
            <td class="py-3 px-4 text-xs max-w-[200px] truncate" title="${item.uraian || ''}">${item.uraian || '-'}</td>
            <td class="py-3 px-4 text-xs font-extrabold text-emerald-400 text-right">${formattedNominal}</td>
            <td class="py-3 px-4 text-center">${linkBukti}</td>
            <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="editData('${rowId}')" class="p-1.5 text-blue-400 hover:bg-slate-900 rounded-xl transition-colors" title="Ubah Data">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button onclick="deleteData('${rowId}')" class="p-1.5 text-rose-400 hover:bg-slate-900 rounded-xl transition-colors" title="Hapus Data">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const formattedTotal = new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(totalNominalTerfilter);
    
    document.getElementById('incomeMonth').textContent = formattedTotal;
}

// Masuk ke Mode Ubah Data
function editData(id) {
    const item = globalDataCache.find(i => (i.id == id || i.idPembelian == id));
    if (!item) return;

    isEditMode = true;
    currentEditId = id;

    document.getElementById('formTitle').innerHTML = `Ubah Jurnal Pendapatan <span class="text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-md ml-1 border border-blue-500/20">#${id}</span>`;
    document.getElementById('nama').value = item.nama || '';
    document.getElementById('uraian').value = item.uraian || '';
    document.getElementById('nominal').value = item.nominal || '';
    
    document.getElementById('btnBatal').classList.remove('hidden');
    document.getElementById('btnSubmit').innerText = "Update Pendapatan";
    
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' });
}

// Eliminasi Data memanfaatkan fungsi genericDelete bawaan atau via API.request langsung
async function deleteData(id) {
    // Di sini kita pakai cara manual agar setelah dihapus otomatis mentrigger loadData() milik halaman ini
    const result = await Swal.fire({
        title: 'Apakah Anda yakin?',
        text: "Data transaksi pendapatan ini akan dihapus secara permanen dari spreadsheet.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Ya, Hapus Data',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl bg-slate-900 text-slate-900' }
    });

    if (result.isConfirmed) {
        try {
            // Menembak action delete ke backend GAS lu
            await API.request('pendapatan/delete', { id: id });
            Swal.fire('Terhapus!', 'Data pendapatan berhasil dibersihkan.', 'success');
            loadData();
        } catch (error) {
            console.error("Gagal menghapus data:", error);
        }
    }
}

// Reset Form
function resetFormMode() {
    isEditMode = false;
    currentEditId = null;

    document.getElementById('formPendapatan').reset();
    document.getElementById('formTitle').innerText = 'Catat Pendapatan Baru';
    document.getElementById('btnBatal').classList.add('hidden');
    
    const btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Simpan Data Jurnal Pendapatan";
    }
}
