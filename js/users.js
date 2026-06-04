document.addEventListener('DOMContentLoaded', async () => {
    const user = API.checkAuth();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return API.logout();

    // Setup identitas di Header
    document.getElementById('userName').textContent = user.nama;
    document.getElementById('userRole').textContent = user.role;
    if(document.getElementById('companyName')) {
        document.getElementById('companyName').textContent = user.perusahaan || "Perusahaan Saya";
    }

    // Cek Notifikasi Approval
    try {
        const pending = await API.request('users/pending');
        if (pending && pending.length > 0) {
            const badge = document.getElementById('notifBadge');
            if(badge) badge.classList.remove('hidden');
        }
    } catch (e) {
        console.log("Gagal cek notifikasi");
    }

    // Load data tabel
    loadUsers();
});

// ==========================================
// 1. RENDER DATA PENGGUNA
// ==========================================
window.loadUsers = async function() {
    const driverBody = document.getElementById('driverBody');
    const customerBody = document.getElementById('customerBody');
    
    try {
        const users = await API.request('users/approved');
        
        const drivers = users.filter(u => u.role === 'DRIVER');
        const customers = users.filter(u => u.role === 'CUSTOMER');

        // Fungsi bantu (helper) untuk mengamankan string dari tanda kutip dan enter
        // agar tidak merusak sintaks onclick pada tombol HTML
        const escapeStr = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '&quot;')
                .replace(/\n/g, ' ')
                .replace(/\r/g, '');
        };

        // Helper untuk render baris
        // isDriver = true/false untuk menentukan apakah kolom peta ditampilkan
        const renderRow = (u, colorClass, isDriver) => {
            // Memperbaiki format URL Google Maps yang sebelumnya typo di latitude
            const mapLink = (u.latitude && u.longitude) 
                ? `<a href="https://maps.google.com/?q=${u.latitude},${u.longitude}" 
                     target="_blank" 
                     class="text-blue-600 font-bold hover:underline">📍 Buka Peta</a>` 
                : '<span class="text-gray-400">-</span>';

            // Amankan data teks untuk dikirim via inline onClick
            const safeNama = escapeStr(u.nama);
            const safeEmail = escapeStr(u.email);
            const safeHp = escapeStr(u.noHp || '-');
            const safeAlamat = escapeStr(u.alamat || '');

            return `
            <tr class="border-b border-gray-100 hover:bg-${colorClass}-50 transition">
                <td class="p-3 text-center">
                    <input type="checkbox" value="${u.id}" class="${colorClass === 'blue' ? 'driver' : 'customer'}-checkbox w-4 h-4 ${colorClass === 'blue' ? 'text-blue-600' : 'text-purple-600'} rounded">
                </td>
                <td class="p-3 font-bold text-gray-800">${u.nama}</td>
                <td class="p-3">
                    <p class="text-gray-600">${u.email}</p>
                    <p class="text-xs font-bold text-gray-400">${u.noHp || '-'}</p>
                </td>
                <td class="p-3 text-sm text-gray-600 truncate max-w-[150px]" title="${u.alamat || '-'}">${u.alamat || '-'}</td>
                
                ${!isDriver ? `<td class="p-3 text-sm">${mapLink}</td>` : ''}
                
                <td class="p-3 text-center space-x-2">
                    <button onclick="bukaEditModal('${u.id}', '${safeNama}', '${safeEmail}', '${safeHp}', '${safeAlamat}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded transition" title="Edit">
                        ✏️ Edit
                    </button>
                    <button onclick="hapusUser('${u.id}', '${safeNama}')" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded transition" title="Hapus">
                        🗑️ Hapus
                    </button>
                </td>
            </tr>`;
        };

        // RENDER DRIVER (Tanpa Peta -> colspan 5)
        if (drivers.length === 0) {
            driverBody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-500 font-bold">Belum ada Driver aktif.</td></tr>`;
        } else {
            driverBody.innerHTML = drivers.map(u => renderRow(u, 'blue', true)).join('');
        }

        // RENDER CUSTOMER (Dengan Peta -> colspan 6)
        if (customers.length === 0) {
            customerBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-500 font-bold">Belum ada Customer aktif.</td></tr>`;
        } else {
            customerBody.innerHTML = customers.map(u => renderRow(u, 'purple', false)).join('');
        }

        // Reset checkbox Check All
        if(document.getElementById('checkAllDriver')) document.getElementById('checkAllDriver').checked = false;
        if(document.getElementById('checkAllCustomer')) document.getElementById('checkAllCustomer').checked = false;

    } catch (error) {
        driverBody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-500 font-bold">Gagal memuat data.</td></tr>`;
        customerBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-red-500 font-bold">Gagal memuat data.</td></tr>`;
    }
};

// ==========================================
// 2. FUNGSI PENCARIAN
// ==========================================
window.filterTable = function(inputId, tbodyId) {
    const input = document.getElementById(inputId).value.toLowerCase();
    const rows = document.getElementById(tbodyId).getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        // Cek apakah ini row data (bukan row "Data kosong")
        if (rows[i].getElementsByTagName('td').length < 2) continue; 
        const text = rows[i].innerText.toLowerCase();
        rows[i].style.display = text.includes(input) ? '' : 'none';
    }
};

// ==========================================
// 3. FUNGSI HAPUS (SATUAN & BANYAK)
// ==========================================
window.hapusUser = async function(userId, nama) {
    const result = await Swal.fire({
        title: 'Hapus Permanen?',
        text: `Data ${nama} akan dihapus dari sistem.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#9CA3AF',
        confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
        try {
            await API.request('users/delete', { id: userId });
            Swal.fire('Berhasil!', `Data ${nama} telah dihapus.`, 'success').then(() => loadUsers());
        } catch (error) {}
    }
};

window.centangSemua = function(tipe) {
    const isChecked = document.getElementById(`checkAll${tipe.charAt(0).toUpperCase() + tipe.slice(1)}`).checked;
    const checkboxes = document.querySelectorAll(`.${tipe}-checkbox`);
    checkboxes.forEach(cb => cb.checked = isChecked);
};

window.hapusBanyakData = async function(tipe) {
    const checkboxes = document.querySelectorAll(`.${tipe}-checkbox:checked`);
    if (checkboxes.length === 0) return Swal.fire({icon: 'warning', title: 'Pilih Data', text: 'Pilih minimal satu data!'});

    const ids = Array.from(checkboxes).map(cb => cb.value);
    const konfirmasi = await Swal.fire({
        title: 'Hapus Terpilih?',
        text: `Menghapus ${ids.length} pengguna permanen!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!'
    });

    if (konfirmasi.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() });
        try {
            for (let id of ids) {
                await API.request('users/delete', { id: id });
            }
            Swal.fire('Terhapus!', `${ids.length} data berhasil dihapus.`, 'success');
            loadUsers();
        } catch (error) {
            Swal.fire('Gagal', 'Gagal menghapus beberapa data.', 'error');
        }
    }
};

// ==========================================
// 4. FUNGSI MODAL EDIT
// ==========================================
window.bukaEditModal = function(id, nama, email, hp, alamat) {
    document.getElementById('editId').value = id;
    document.getElementById('editNama').value = nama;
    document.getElementById('editEmail').value = email;
    document.getElementById('editHp').value = hp;
    
    // Pastikan modal punya field editAlamat jika ada, atau abaikan jika belum ditambah di HTML
    const inputAlamat = document.getElementById('editAlamat');
    if(inputAlamat) inputAlamat.value = alamat;
    
    document.getElementById('modalEdit').classList.remove('hidden');
    setTimeout(() => document.getElementById('modalContent').classList.remove('scale-95'), 10);
};

window.tutupModal = function() {
    document.getElementById('modalContent').classList.add('scale-95');
    setTimeout(() => document.getElementById('modalEdit').classList.add('hidden'), 200);
};

window.simpanEditUser = async function(e) {
    e.preventDefault();
    const payload = {
        id: document.getElementById('editId').value,
        nama: document.getElementById('editNama').value,
        hp: document.getElementById('editHp').value,
        alamat: document.getElementById('editAlamat') ? document.getElementById('editAlamat').value : ''
    };

    try {
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
        await API.request('users/update-profile', payload);
        tutupModal();
        Swal.fire('Berhasil!', 'Data diupdate.', 'success');
        loadUsers();
    } catch (error) {}
};
