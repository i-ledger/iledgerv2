document.addEventListener('DOMContentLoaded', async () => {
    const user = API.checkAuth();
    // Proteksi Hak Akses Halaman Manajemen User
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return API.logout();
    
    // Setel Identitas Profil Aman
    const userNameElem = document.getElementById('userName');
    const userRoleElem = document.getElementById('userRole');
    if (userNameElem) userNameElem.textContent = user.nama;
    if (userRoleElem) userRoleElem.textContent = user.role;
    
    // Tarik data antrean saat halaman pertama kali dibuka
    loadPendingUsers();
});

/**
 * AMBIL & RENDER ANTREAN USER STATUS PENDING
 */
async function loadPendingUsers() {
    const container = document.getElementById('pendingContainer');
    if (!container) return; 
    
    container.innerHTML = '<div class="col-span-3 text-center py-10"><p class="text-pink-500 font-medium animate-pulse">Memuat data antrean pangkalan...</p></div>';
    
    try {
        const users = await API.request('users/pending');
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="col-span-3 text-center py-10 text-gray-400 font-bold bg-white/50 backdrop-blur rounded-xl border border-dashed border-pink-200">
                    🎉 Semua bersih! Tidak ada antrean pendaftaran akun baru.
                </div>`;
            return;
        }
        
        let html = '';
        users.forEach(u => {
            html += `
            <div class="glass-card p-6 bg-white/80 border border-pink-100 hover:shadow-md transition" data-aos="fade-up">
                <div class="flex justify-between items-start mb-4">
                    <span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm">PENDING</span>
                    <span class="bg-pink-100 text-pink-600 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shadow-sm">${u.role}</span>
                </div>
                <h3 class="font-bold text-lg text-gray-800">${u.nama}</h3>
                <p class="text-sm text-gray-500 mb-5 font-medium truncate" title="${u.email}">${u.email}</p>
                <div class="flex space-x-2">
                    <button onclick="approveUser('${u.id}', '${u.email}')" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold transition shadow-sm">
                        Setujui
                    </button>
                    <button onclick="modalEditPending('${u.id}', '${u.nama}', '${u.role}')" class="bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-2 rounded-lg transition border border-gray-200 shadow-sm" title="Edit">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onclick="rejectUser('${u.id}', '${u.email}')" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-lg transition shadow-sm" title="Tolak">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
        
    } catch (error) { 
        container.innerHTML = '<div class="col-span-3 text-center py-10 text-rose-500 font-bold bg-rose-50 rounded-xl border border-dashed border-rose-200">Gagal memuat data antrean akun. Silakan refresh halaman.</div>'; 
    }
}

/**
 * APPROVE USER (Sesi Dikunci dari Klik Luar)
 */
async function approveUser(userId, email) {
    try {
        // REVISI: allowOutsideClick di-set false agar eksekusi database aman
        Swal.fire({ title: 'Menyetujui...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await API.request('users/approve', { userId: userId, email: email });
        
        Swal.fire({ icon: 'success', title: 'Disetujui!', text: 'Akun pendaftar telah aktif di sistem.', confirmButtonColor: '#ff4fa3' })
            .then(() => loadPendingUsers());
    } catch (error) {
        console.error("Gagal menyetujui user:", error);
    }
}

/**
 * REJECT USER
 */
async function rejectUser(userId, email) {
    const result = await Swal.fire({
        title: 'Tolak Pendaftaran?',
        text: `Data pendaftaran ${email} akan dihapus permanen. Yakin?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f43f5e',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Tolak!',
        cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({ title: 'Menghapus data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await API.request('users/reject', { userId: userId, email: email });
            
            Swal.fire({ icon: 'success', title: 'Ditolak!', text: 'Pendaftaran akun berhasil dihapus.', confirmButtonColor: '#ff4fa3' })
                .then(() => loadPendingUsers());
        } catch (error) {
            console.error("Gagal menolak user:", error);
        }
    }
}

/**
 * 1. TAMBAH PENGGUNA MANUAL (OTOMATIS LANGSUNG AKTIF)
 */
async function modalTambahUserManual() {
    const u = JSON.parse(localStorage.getItem('r22_user')) || {};
    const { value: formValues } = await Swal.fire({
        title: 'Tambah Pengguna Langsung',
        html: `
            <input id="tm-nama" class="input-elegant w-full mb-3" placeholder="Nama Lengkap / Nama Toko">
            <input id="tm-email" type="email" class="input-elegant w-full mb-3" placeholder="Email Login">
            <input id="tm-pass" type="password" class="input-elegant w-full mb-3" placeholder="Password Akun">
            <input id="tm-hp" class="input-elegant w-full mb-3" placeholder="Nomor HP Aktif (WhatsApp)">
            <textarea id="tm-alamat" class="input-elegant w-full mb-3" placeholder="Alamat Lengkap Pengiriman"></textarea>
            <select id="tm-role" class="input-elegant w-full">
                <option value="DRIVER">DRIVER (Armada Logistik)</option>
                <option value="CUSTOMER">CUSTOMER (Retail/Pangkalan)</option>
            </select>
        `,
        showCancelButton: true, 
        confirmButtonColor: '#ff4fa3', 
        confirmButtonText: 'Buat & Aktifkan',
        cancelButtonText: 'Batal',
        preConfirm: () => ({
            namaPerusahaan: u.perusahaan || "PT. SINARAPI JATAYU PERMAI", 
            nama: document.getElementById('tm-nama').value.trim(),
            email: document.getElementById('tm-email').value.trim(), 
            password: document.getElementById('tm-pass').value,
            noHP: document.getElementById('tm-hp').value.trim(), 
            alamat: document.getElementById('tm-alamat').value.trim(),
            role: document.getElementById('tm-role').value
        })
    });

    if (formValues) {
        if (!formValues.nama || !formValues.email || !formValues.password) {
            return Swal.fire({ icon: 'error', title: 'Data Tidak Lengkap', text: 'Data utama (Nama, Email, dan Password) wajib diisi!', confirmButtonColor: '#ff4fa3' });
        }
        
        Swal.fire({ title: 'Memproses data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            await API.request('users/create-direct', formValues);
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Akun baru berhasil dibuat dan langsung berstatus aktif.', confirmButtonColor: '#ff4fa3' });
            // Opsional: Jika ada fungsi reload daftar user aktif di halaman ini, panggil di sini
        } catch (e) {
            console.error("Gagal membuat user langsung:", e);
        }
    }
}

/**
 * 2. DOWNLOAD TEMPLATE EXCEL BULK INITIALIZER
 */
function downloadTemplateExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
        { Nama: "Budi Santoso", Email: "budi@email.com", Password: "password123", NoHP: "0812345678", Alamat: "Bandung Barat", Role: "DRIVER" },
        { Nama: "Toko Berkah Gas", Email: "berkahgas@email.com", Password: "password123", NoHP: "0877123456", Alamat: "Banjaran Indah", Role: "CUSTOMER" },
        { Nama: "[PANDUAN]", Email: "[Hapus baris panduan ini sebelum diupload]", Password: "", NoHP: "", Alamat: "", Role: "DRIVER/CUSTOMER" }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Pengguna");
    XLSX.writeFile(wb, "Template_Bulk_User_R22.xlsx");
}

/**
 * 3. IMPORT DATA DARI EXCEL (DENGAN SANITASI & FILTER PROTEKSI DATA KOSONG)
 */
function importTemplateExcel(event) {
    const file = event.target.files[0];
    const fileInput = event.target;
    if (!file) return;
    
    const u = JSON.parse(localStorage.getItem('r22_user')) || {};
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);

            // SANITASI DATA: Buang baris panduan / baris kosong yang tidak sengaja dikirim user
            const validUsers = jsonRows.filter(row => {
                // Pastikan properti ada dan bukan baris panduan dummy
                const hasEmail = row.Email && typeof row.Email === 'string' && !row.Email.includes('[Hapus');
                const hasNama = row.Nama && typeof row.Nama === 'string' && !row.Nama.includes('[PANDUAN]');
                return hasEmail && hasNama && row.Password;
            });

            if (validUsers.length === 0) {
                fileInput.value = '';
                return Swal.fire({ icon: 'warning', title: 'Data Tidak Valid', text: 'Tidak ada data pengguna baru yang valid untuk diimpor. Periksa kembali isi file Excel Anda.', confirmButtonColor: '#ff4fa3' });
            }

            Swal.fire({ title: 'Mengimpor Massal...', text: `Memproses ${validUsers.length} akun...`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            await API.request('users/bulk-import', { 
                namaPerusahaan: u.perusahaan || "PT. SINARAPI JATAYU PERMAI", 
                users: validUsers 
            });
            
            Swal.fire({
                icon: 'success',
                title: 'Impor Selesai!',
                text: `${validUsers.length} Akun berhasil didaftarkan ke database pangkalan secara otomatis.`,
                confirmButtonColor: '#ff4fa3'
            }).then(() => {
                fileInput.value = '';
                loadPendingUsers(); // Refresh antrean jika ada logic sinkronisasi
            });
            
        } catch (err) {
            fileInput.value = '';
            console.error("[IMPORT EXCEL CRASH]:", err);
            Swal.fire({ icon: 'error', title: 'Impor Gagal', text: 'Gagal memproses susunan file Excel. Pastikan format kolom tidak diubah.', confirmButtonColor: '#ff4fa3' });
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * PLACEHOLDER EDIT MODAL PENDING
 */
window.modalEditPending = function(id, nama, role) {
    Swal.fire({
        title: 'Pengembangan Komponen',
        text: `Fitur modifikasi data antrean untuk ${nama} (${role}) sedang disiapkan di modul modal-editor.`,
        icon: 'info',
        confirmButtonColor: '#ff4fa3'
    });
}
