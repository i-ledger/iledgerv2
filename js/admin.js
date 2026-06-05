// ==========================================
// 1. Inisialisasi & Efek Animasi (AOS)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({ once: true });
    }
});

// ==========================================
// 2. Fungsi Dropdown Menu Sidebar (Data Armada)
// ==========================================
function toggleDropdown(dropdownId, arrowId) {
    const dropdown = document.getElementById(dropdownId);
    const arrow = document.getElementById(arrowId);
    
    if (dropdown && arrow) {
        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            arrow.classList.add('rotate-180');
        } else {
            dropdown.classList.add('hidden');
            arrow.classList.remove('rotate-180');
        }
    }
}

// ==========================================
// 3. Logic Responsive Sidebar (Mobile Hamburger)
// ==========================================
const btnHamburger = document.getElementById('btnHamburger');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (btnHamburger && sidebar && sidebarOverlay) {
    btnHamburger.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
        setTimeout(() => sidebarOverlay.classList.add('opacity-100'), 10);
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.opacity-100;
        sidebarOverlay.classList.remove('opacity-100');
        setTimeout(() => sidebarOverlay.classList.add('hidden'), 300);
    });
}

// ==========================================
// 4. Logic Action Menu Header (Kebab Menu di Mobile)
// ==========================================
const btnActionMenu = document.getElementById('btnActionMenu');
const actionContainer = document.getElementById('actionContainer');

if (btnActionMenu && actionContainer) {
    btnActionMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        actionContainer.classList.toggle('hidden');
        actionContainer.classList.toggle('flex');
    });

    // Otomatis tutup kebab menu jika klik di luar area menu
    document.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
            actionContainer.classList.add('hidden');
            actionContainer.classList.remove('flex');
        }
    });
}

// ==========================================
// 5. Handling Form Pos Akun Baru & SweetAlert2
// ==========================================
function handleTambahPos(event) {
    event.preventDefault();
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Berhasil!',
            text: 'Pos akun baru berhasil ditambahkan.',
            icon: 'success',
            confirmButtonText: 'OK',
            buttonsStyling: false,
            customClass: {
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl text-sm'
            }
        });
    } else {
        alert('Pos akun baru berhasil ditambahkan.');
    }
}

// ==========================================
// 6. Handling Dropzone & Upload Transaksi Cepat
// ==========================================
const dropzone = document.getElementById('dropzoneTransaksi');
if (dropzone) {
    dropzone.addEventListener('click', () => {
        const fileInput = document.getElementById('fileTransaksiInput');
        if (fileInput) fileInput.click();
    });
}

function prosesUploadCepat() {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Parsing Data...',
            text: 'Sedang memproses dokumen mutasi.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Simulasi proses parsing data 2 detik
        setTimeout(() => {
            Swal.fire({
                title: 'Selesai!',
                text: 'Data mutasi berhasil di-parsing ke sistem.',
                icon: 'success',
                confirmButtonText: 'Mantap',
                buttonsStyling: false,
                customClass: {
                    confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl text-sm'
                }
            });
        }, 2000);
    } else {
        alert('Data mutasi berhasil diproses.');
    }
}
