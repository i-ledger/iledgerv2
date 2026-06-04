document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('btnLogin');
            btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-3 text-white inline-block" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Memproses...`;
            btn.disabled = true;

            try {
                const data = await API.request('login', { email, password });
                localStorage.setItem('r22_token', data.token);
                localStorage.setItem('r22_user', JSON.stringify(data.user));
                Swal.fire({ icon: 'success', title: 'Login Berhasil', text: `Selamat datang, ${data.user.nama}!`, timer: 1500, showConfirmButton: false }).then(() => {
                    if(data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN') window.location.href = 'dashboard-admin.html';
                    else if(data.user.role === 'DRIVER') window.location.href = 'dashboard-driver.html';
                    else window.location.href = 'dashboard-customer.html';
                });
            } catch (error) {
                btn.innerHTML = `<span>Sign In</span>`; btn.disabled = false;
            }
        });
    }
});
// Tambahkan di bagian paling bawah auth.js
window.lupaPassword = async function() {
    const { value: email } = await Swal.fire({
        title: 'Lupa Kata Sandi?',
        text: 'Masukkan email Anda untuk menerima link reset kata sandi.',
        input: 'email',
        inputPlaceholder: 'nama@email.com',
        showCancelButton: true,
        confirmButtonColor: '#ff4fa3',
        cancelButtonText: 'Batal',
        confirmButtonText: 'Kirim Link'
    });

    if (email) {
        // Panggil fungsi API yang ada di api.js
        await API.forgotPassword(email);
    }
};
