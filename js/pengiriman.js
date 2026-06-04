// Inisialisasi variabel global
let dataPengiriman = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 100;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Autentikasi Admin
    const user = API.checkAuth();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return API.logout();
    }

    // 2. Setel Identitas Header
    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = user.nama || "Admin";
    }
    if (document.getElementById('companyName')) {
        document.getElementById('companyName').textContent = user.perusahaan || "R22 NPSO";
    }

    // 3. Event Listener Filter
    ['searchDeliv', 'filterDriver', 'filterCustomer', 'dateStart', 'dateEnd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                currentPage = 1;
                applyFilters();
            });
        }
    });

    // 4. Muat Data
    loadDataPengiriman();
});

async function loadDataPengiriman() {
    const tbody = document.getElementById('pengirimanBody');
    tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8">Sedang memuat data...</td></tr>`;

    try {
        const response = await API.request('pengiriman/get');
        dataPengiriman = response || [];
        
        populateFilters();
        applyFilters();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-red-500">Gagal memuat data.</td></tr>`;
    }
}

function populateFilters() {
    const dSelect = document.getElementById('filterDriver');
    const cSelect = document.getElementById('filterCustomer');
    
    const drivers = [...new Set(dataPengiriman.map(d => d.driver).filter(Boolean))];
    const customers = [...new Set(dataPengiriman.map(c => c.customer).filter(Boolean))];
    
    dSelect.innerHTML = '<option value="">Driver: Semua</option>' + drivers.map(d => `<option value="${d}">${d}</option>`).join('');
    cSelect.innerHTML = '<option value="">Cust: Semua</option>' + customers.map(c => `<option value="${c}">${c}</option>`).join('');
}

function applyFilters() {
    const search = document.getElementById('searchDeliv').value.toLowerCase();
    const driver = document.getElementById('filterDriver').value;
    const customer = document.getElementById('filterCustomer').value;
    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;

    filteredData = dataPengiriman.filter(item => {
        const itemDate = item.tanggal ? item.tanggal.split(' ')[0] : '';
        const matchSearch = (item.idPengiriman || '').toLowerCase().includes(search) || (item.driver || '').toLowerCase().includes(search);
        const matchDriver = driver === "" || item.driver === driver;
        const matchCust = customer === "" || item.customer === customer;
        const matchDate = (!start || itemDate >= start) && (!end || itemDate <= end);
        
        return matchSearch && matchDriver && matchCust && matchDate;
    });

    renderTable();
}

function cleanImageUrl(url) {
    if (!url) return '';
    
    // Jika sudah format direct link, biarkan saja
    if (url.includes('uc?export=view')) return url;
    
    // Jika format lama, baru kita konversi
    if (url.includes('drive.google.com')) {
        return url.replace('/view?usp=sharing', '/uc?export=view')
                  .replace('/file/d/', '/uc?id=')
                  .replace('/view', '');
    }
    return url;
}
function extractFileId(url) {
    if (!url) return null;
    const directId = url.match(/id=([A-Za-z0-9_-]+)/);
    const fileId = url.match(/\/d\/([A-Za-z0-9_-]+)/);
    return directId ? directId[1] : (fileId ? fileId[1] : null);
}

function renderThumb(url) {
    const id = extractFileId(url);
    if (!id) return '-';
    // Link thumbnail untuk preview, Link uc?export=view untuk full image
    const thumbUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w300`;
    const fullUrl = `https://drive.google.com/uc?export=view&id=${id}`;
    
    return `<a href="${fullUrl}" target="_blank" class="hover:opacity-80 transition">
                <img src="${thumbUrl}" class="h-12 w-12 object-cover rounded shadow mx-auto border border-gray-200" loading="lazy" />
            </a>`;
}
function renderTable() {
    const tbody = document.getElementById('pengirimanBody');
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filteredData.slice(startIdx, startIdx + itemsPerPage);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8">Data tidak ditemukan</td></tr>`;
        renderPagination();
        return;
    }

    tbody.innerHTML = paginatedItems.map(item => `
        <tr class="border-b hover:bg-pink-50/50">
            <td class="p-3 text-[10px]">${item.tanggal || '-'}</td>
            <td class="p-3 font-bold text-gray-800">${item.idPengiriman || '-'}</td>
            <td class="p-3">${item.driver || '-'}</td>
            <td class="p-3">${item.customer || '-'}</td>
            <td class="p-3 text-center font-bold text-pink-600">${item.cyl5_5kg || 0}</td>
            <td class="p-3 text-center font-bold text-blue-600">${item.cyl12kg || 0}</td>
            <td class="p-3 text-center font-bold text-gray-600">${item.cyl50kg || 0}</td>
<td class="p-3 text-center">
    ${(item.lat && item.lng && item.lat !== "0" && item.lat !== "0") ? 
        `<a href="https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}" 
            target="_blank" 
            class="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-600 rounded-lg text-[10px] font-bold hover:bg-pink-200 transition-colors shadow-sm">
            📍 Peta
        </a>` 
        : '<span class="text-gray-300">-</span>'
    }
</td>
            <td class="p-3 text-center">
                ${item.foto ? renderThumb(item.foto) : '-'}
            </td>
            <td class="p-3 text-center">
                <span class="px-2 py-1 rounded bg-gray-100 text-[9px] uppercase font-bold">${item.status || 'PROSES'}</span>
            </td>
        </tr>
    `).join('');

    renderPagination();
}
function renderPagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const pagDiv = document.getElementById('pagination');
    
    pagDiv.innerHTML = `
        <button onclick="changePage(${currentPage-1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50">Prev</button>
        <span class="px-3 text-sm font-bold">Hal ${currentPage} / ${totalPages}</span>
        <button onclick="changePage(${currentPage+1})" ${currentPage >= totalPages ? 'disabled' : ''} class="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50">Next</button>
    `;
}

window.changePage = (page) => {
    currentPage = page;
    renderTable();
    const container = document.getElementById('pengirimanBody');
    if (container) container.scrollIntoView({ behavior: 'smooth' });
};

window.bukaModalGambar = function(url) {
    const modal = document.getElementById('modalGambar');
    const img = document.getElementById('gambarBukti');
    if (modal && img) {
        img.src = url;
        modal.classList.remove('hidden');
    }
};
