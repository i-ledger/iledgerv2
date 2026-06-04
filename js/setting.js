document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Akses
    const user = API.checkAuth();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return API.logout();
    }

    // 2. Isi Form dengan data dari Local Storage (Sesi Login Saat Ini)
    document.getElementById('setNama').value = user.perusahaan || user.nama || "";
    document.getElementById('setHp').value = user.hp || user.noHp || user.NoHP || "";
    document.getElementById('setAlamat').value = user.alamat || "";
    document.getElementById('setRekening').value = user.rekening || "";
    document.getElementById('setPrefixInv').value = user.prefixInv || "INV";
    document.getElementById('setPrefixSj').value = user.prefixSj || "SJ";
});

// ==========================================
// FUNGSI SIMPAN PENGATURAN
// ==========================================
window.simpanPengaturan = async function() {
    const user = JSON.parse(localStorage.getItem('r22_user'));
    
    // 3. Kumpulkan data dari form (Nama variabel HARUS sesuai dengan Code.gs)
    const payload = {
        id: user.id, // Wajib dikirim agar backend tahu punya siapa
        nama: document.getElementById('setNama').value,
        hp: document.getElementById('setHp').value,
        alamat: document.getElementById('setAlamat').value,
        rekening: document.getElementById('setRekening').value,
        prefixInv: document.getElementById('setPrefixInv').value,
        prefixSj: document.getElementById('setPrefixSj').value
    };

    if (!payload.nama || !payload.hp) {
        return Swal.fire('Oops!', 'Nama Pangkalan dan Nomor HP tidak boleh kosong.', 'warning');
    }

    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });

    try {
        // 4. Tembak API aslinya (bukan dummy loading lagi)
        await API.request('users/update-profile', payload);
        
        // 5. Update data di Local Storage agar tampilan berubah tanpa perlu login ulang
        user.perusahaan = payload.nama;
        user.nama = payload.nama; 
        user.hp = payload.hp;
        user.noHp = payload.hp;
        user.alamat = payload.alamat;
        user.rekening = payload.rekening;
        user.prefixInv = payload.prefixInv;
        user.prefixSj = payload.prefixSj;
        
        localStorage.setItem('r22_user', JSON.stringify(user));

        Swal.fire('Berhasil!', 'Pengaturan Pangkalan telah disimpan.', 'success').then(() => {
            window.location.reload(); // Refresh halaman agar data baru ter-render
        });
    } catch (error) {
        Swal.fire('Error', error.message || 'Gagal menyimpan pengaturan ke database.', 'error');
    }
};
