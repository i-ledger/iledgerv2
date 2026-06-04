const API_URL = "https://script.google.com/macros/s/AKfycbzM5qH1NynabIXbcKGzrL73aZBRZpyyA8LoxBVFvUM7XH1jCX0xFpJ72UqWitp4GPdB/exec";

const API = {
    request: async function(action, payload = {}) {
        const token = localStorage.getItem('r22_token');
        
        // PERBAIKAN PENTING: Hanya masukkan token login JIKA payload.token belum diisi manual
        // Ini mencegah Token Reset dari email tertimpa oleh token login lama
        if (token && !payload.token) {
            payload.token = token;
        }
        
        payload.action = action;
        try {
            const response = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
            const result = await response.json();
            if (result.status !== 200) throw new Error(result.message || "Terjadi kesalahan pada server.");
            return result.data;
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Request Gagal', text: error.message, confirmButtonColor: '#ff4fa3' });
            throw error;
        }
    },

    // FUNGSI BARU: LUPA KATA SANDI
    forgotPassword: async function(email) {
        try {
            Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
            const response = await this.request('auth/forgot-password', { email });
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Instruksi pemulihan kata sandi telah dikirim ke email Anda.', confirmButtonColor: '#ff4fa3' });
            return response;
        } catch (error) {
            // Error sudah ditangani di fungsi request
            return null;
        }
    },

    // FUNGSI BARU: RESET KATA SANDI (DIPANGGIL DI HALAMAN RESET)
    resetPassword: async function(tokenReset, newPassword) {
        try {
            Swal.fire({ title: 'Menyimpan Sandi Baru...', didOpen: () => Swal.showLoading() });
            
            // Kita kirim token reset secara manual ke dalam payload
            const response = await this.request('auth/reset-password', { 
                token: tokenReset, 
                newPassword: newPassword 
            });
            
            Swal.fire({ 
                icon: 'success', 
                title: 'Berhasil!', 
                text: 'Kata sandi berhasil diperbarui. Silakan login dengan sandi baru.', 
                confirmButtonColor: '#ff4fa3' 
            }).then(() => {
                window.location.href = "index.html"; // Arahkan kembali ke halaman login
            });
            return response;
        } catch (error) {
            return null;
        }
    },

    checkAuth: function() {
        const token = localStorage.getItem('r22_token');
        const user = localStorage.getItem('r22_user');
        if (!token || !user) { window.location.href = 'index.html'; return null; }
        return JSON.parse(user);
    },
    
    logout: function() {
        localStorage.removeItem('r22_token');
        localStorage.removeItem('r22_user');
        window.location.href = 'index.html';
    }
};

// ==========================================
// FUNGSI PENCARIAN / FILTER TABEL REALTIME
// ==========================================
function filterTable(inputId, tbodyId) {
    const input = document.getElementById(inputId);
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById(tbodyId);
    const trs = tbody.getElementsByTagName('tr');

    for (let i = 0; i < trs.length; i++) {
        // Abaikan baris yang isinya "Loading..." atau "Data Kosong" (biasanya punya colSpan)
        if (trs[i].cells.length === 1 && trs[i].cells[0].colSpan > 1) continue;

        // Ambil semua teks dalam satu baris, jadikan huruf kecil
        let rowText = trs[i].textContent.toLowerCase();
        
        // Sembunyikan jika tidak cocok, tampilkan jika cocok
        if (rowText.includes(filter)) {
            trs[i].style.display = '';
        } else {
            trs[i].style.display = 'none';
        }
    }
}

async function genericDelete(action, id, refreshFunc) {
    const r = await Swal.fire({ title: 'Hapus data ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if (r.isConfirmed) {
        await API.request(action, { id });
        Swal.fire('Terhapus!', '', 'success');
        refreshFunc();
    }
}
