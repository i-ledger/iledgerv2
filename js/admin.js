// ==========================================
// GLOBAL STATE & VARIABLE UNTUK FILTER
// ==========================================
let globalSalesData = []; 
let globalPembelianData = []; // Menampung data historis dari sheet PEMBELIAN ter-optimasi
let salesChartObj = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = API.checkAuth();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return API.logout();
    
    // Set Informasi Profil & Perusahaan
    setElementText('userName', user.nama);
    setElementText('userRole', user.role);
    setElementText('companyName', user.perusahaan || "PT. SINARAPI JATAYU PERMAI");

    try {
        // 1. Tembak API Stats Utama & Tampilkan Stok
        const stats = await API.request('dashboard/stats');
        if (stats) {
            setElementText('stok50', stats.stok50 || 0);
            setElementText('stok12', stats.stok12 || 0);
            setElementText('stok5', stats.stok5 || 0);
            setElementText('statDeliv', stats.pendingDeliveries || 0);
        }

        // 2. Tarik Data Pembelian Pertama Kali (Pre-processed untuk Efisiensi Pencarian)
        try {
            const pembelianData = await API.request('pembelian/get');
            if (pembelianData && Array.isArray(pembelianData)) {
                // Optimasi: Mapping & urutkan descending berdasarkan tanggal dari awal
                globalPembelianData = pembelianData.map(p => ({
                    barangNormal: bersihkanNamaBarang(p.Barang),
                    waktuBeli: p.Tanggal ? new Date(p.Tanggal).getTime() : 0,
                    hargaBeli: parseFloat(p.HargaBeli || 0)
                })).sort((a, b) => b.waktuBeli - a.waktuBeli);
            }
        } catch (errPembelian) {
            console.error("Gagal menarik statistik dari sheet pembelian:", errPembelian);
        }

        // 3. Tarik Data Transaksi untuk Grafik & Kalkulasi Dinamis
        const salesData = await API.request('penjualan/get');
        if (salesData) {
            globalSalesData = salesData;
            
            // Inisialisasi Setting Tahun Otomatis
            initFilterTahun(); 
            
            // Set Default Filter (Semua Bulan, Tahun Saat Ini)
            const currentYear = new Date().getFullYear().toString();
            setElementValue('filterTahun', currentYear);
            setElementValue('filterBulan', "ALL");
            
            // Render Grafik & Angka Keuangan Pertama Kali
            applyChartFilter(); 
        }

    } catch (error) {
        console.error("Gagal menarik statistik dashboard:", error);
    }
});

// ==========================================
// UTILITIES / HELPER FUNCTIONS
// ==========================================
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setElementValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function bersihkanNamaBarang(str) {
    return str ? str.toLowerCase().replace(/[\s,.]/g, '') : '';
}

function parseDateToYMD(rawDateStr) {
    if (!rawDateStr || rawDateStr === "-") return { y: "1970", m: "01", d: "01" };
    
    const dt = new Date(rawDateStr);
    if (!isNaN(dt.getTime())) {
        return {
            y: dt.getFullYear().toString(),
            m: String(dt.getMonth() + 1).padStart(2, '0'),
            d: String(dt.getDate()).padStart(2, '0')
        };
    }
    
    const parts = rawDateStr.split(/[\/\-\sT]/); 
    if (parts.length >= 3) {
        if (parts[0].length === 4) { 
            return { y: parts[0], m: parts[1].padStart(2, '0'), d: parts[2].padStart(2, '0') };
        } else if (parts[2].length === 4) { 
            return { y: parts[2], m: parts[1].padStart(2, '0'), d: parts[0].padStart(2, '0') };
        }
    }
    return { y: "1970", m: "01", d: "01" };
}

// Helper Ekstraksi Item Transaksi (DRY Principle)
function ekstrakItemsDariTransaksi(item) {
    let items = [];
    try {
        const itemsArr = JSON.parse(item.json_items || item.JSON_Items || "[]");
        if (itemsArr.length > 0) {
            return itemsArr.map(it => ({
                nama: it.barang || '',
                qty: parseInt(it.qty) || 0,
                hargaJual: parseFloat(it.harga || it.harga_jual || it.price || 0)
            }));
        }
    } catch (e) {}

    // Fallback parsing teks manual (contoh: "2x LPG 50 KG")
    if (item.barang) {
        const parts = item.barang.split(',');
        parts.forEach(p => {
            const match = p.trim().match(/(\d+)x\s+(.*)/i);
            if (match) {
                items.push({
                    nama: match[2].trim(),
                    qty: parseInt(match[1]) || 0,
                    hargaJual: 0 // Tidak tersedia di fallback teks, di-handle via item.total nantinya
                });
            }
        });
    }
    return items;
}

// Fungsi Timeline harga beli ter-optimasi ($O(1)$ s/d $O(N)$ lookup)
function cariHargaBeliSesuaiTanggal(namaBarang, tanggalJualStr) {
    if (!globalPembelianData || globalPembelianData.length === 0) return 0;
    
    const waktuJual = tanggalJualStr ? new Date(tanggalJualStr).getTime() : 0;
    const targetNama = bersihkanNamaBarang(namaBarang);

    // Karena globalPembelianData sudah di-sort descending, pencarian pertama yang lolos adalah yang paling terbaru/valid
    const cocok = globalPembelianData.find(p => p.barangNormal === targetNama && p.waktuBeli <= waktuJual);
    if (cocok) return cocok.hargaBeli;

    // Fallback Kasar: ambil log pembelian pertama yang cocok tanpa peduli tanggal
    const fallback = globalPembelianData.find(p => p.barangNormal === targetNama);
    return fallback ? fallback.hargaBeli : 0;
}

// ==========================================
// SETTING TAHUN OTOMATIS (DINAMIS)
// ==========================================
function initFilterTahun() {
    const yearSelect = document.getElementById('filterTahun');
    if (!yearSelect) return;
    
    const years = new Set();
    const currentYear = new Date().getFullYear();
    
    for(let i = currentYear - 3; i <= currentYear + 3; i++) {
        years.add(i.toString());
    }
    
    globalSalesData.forEach(item => {
        const dateObj = parseDateToYMD(item.tanggal || item.CreatedAt);
        if (dateObj.y && dateObj.y !== "1970") {
            years.add(dateObj.y);
        }
    });

    let html = '<option value="ALL">Semua Tahun</option>';
    Array.from(years).sort().forEach(y => {
        html += `<option value="${y}">${y}</option>`;
    });
    yearSelect.innerHTML = html;
}

// ==========================================
// FUNGSI TRIGGER SAAT DROPDOWN DIUBAH
// ==========================================
window.applyChartFilter = function() {
    const fMonth = document.getElementById('filterBulan') ? document.getElementById('filterBulan').value : "ALL";
    const fYear = document.getElementById('filterTahun') ? document.getElementById('filterTahun').value : new Date().getFullYear().toString();
    
    renderSalesChart(fMonth, fYear);
    updateRevenueDisplay(fMonth, fYear);
};

// ==========================================
// RENDER GRAFIK DINAMIS (3 PRODUK)
// ==========================================
function renderSalesChart(filterMonth, filterYear) {
    const chartCanvas = document.getElementById('salesChart');
    if (!globalSalesData || !chartCanvas) return;

    const dataAgregat = {};
    const isYearlyView = (filterMonth === "ALL"); 

    globalSalesData.forEach(item => {
        if(item.status === 'BATAL') return; 
        
        const dateObj = parseDateToYMD(item.tanggal || item.CreatedAt);
        if (filterYear !== "ALL" && dateObj.y !== filterYear) return;
        if (filterMonth !== "ALL" && dateObj.m !== filterMonth) return;

        let key = isYearlyView ? `${dateObj.y}-${dateObj.m}` : `${dateObj.y}-${dateObj.m}-${dateObj.d}`;
        
        if (!dataAgregat[key]) {
            dataAgregat[key] = { qty50: 0, qty12: 0, qty5: 0 };
        }

        const listItems = ekstrakItemsDariTransaksi(item);
        listItems.forEach(it => {
            const bNama = it.nama.toLowerCase();
            if (bNama.includes("50")) dataAgregat[key].qty50 += it.qty;
            else if (bNama.includes("12")) dataAgregat[key].qty12 += it.qty;
            else if (bNama.includes("5.5") || bNama.includes("5,5")) dataAgregat[key].qty5 += it.qty;
        });
    });

    const sortedKeys = Object.keys(dataAgregat).sort();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

    const labels = sortedKeys.map(k => {
        if (isYearlyView) {
            const [y, m] = k.split('-');
            return filterYear === "ALL" ? `${monthNames[parseInt(m)-1]} ${y}` : monthNames[parseInt(m)-1];
        } else {
            const [,, d] = k.split('-');
            return `${parseInt(d)} ${monthNames[parseInt(k.split('-')[1])-1]}`; 
        }
    });

    const dataset50 = sortedKeys.map(k => dataAgregat[k].qty50);
    const dataset12 = sortedKeys.map(k => dataAgregat[k].qty12);
    const dataset5 = sortedKeys.map(k => dataAgregat[k].qty5);

    const ctx = chartCanvas.getContext('2d');
    if (salesChartObj) {
        salesChartObj.destroy();
    }

    let grad50 = ctx.createLinearGradient(0, 0, 0, 400);
    grad50.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    grad50.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    
    let grad12 = ctx.createLinearGradient(0, 0, 0, 400);
    grad12.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    grad12.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    
    let grad5 = ctx.createLinearGradient(0, 0, 0, 400);
    grad5.addColorStop(0, 'rgba(236, 72, 153, 0.4)');
    grad5.addColorStop(1, 'rgba(236, 72, 153, 0.0)');

    salesChartObj = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : ['Belum Ada Transaksi'],
            datasets: [
                {
                    label: 'LPG 50 KG',
                    data: dataset50.length > 0 ? dataset50 : [0],
                    backgroundColor: grad50, borderColor: '#ef4444', borderWidth: 3, fill: true, tension: 0.4,
                    pointBackgroundColor: '#ffffff', pointBorderColor: '#ef4444', pointBorderWidth: 2, pointRadius: 5
                },
                {
                    label: 'LPG 12 KG',
                    data: dataset12.length > 0 ? dataset12 : [0],
                    backgroundColor: grad12, borderColor: '#3b82f6', borderWidth: 3, fill: true, tension: 0.4,
                    pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 5
                },
                {
                    label: 'LPG 5,5 KG',
                    data: dataset5.length > 0 ? dataset5 : [0],
                    backgroundColor: grad5, borderColor: '#ec4899', borderWidth: 3, fill: true, tension: 0.4,
                    pointBackgroundColor: '#ffffff', pointBorderColor: '#ec4899', pointBorderWidth: 2, pointRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { weight: 'bold' } } },
                tooltip: { callbacks: { label: function(context) { return ` ${context.dataset.label}: ${context.raw} Tabung`; } } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ==========================================
// HITUNG & UPDATE DISPLAY PENDAPATAN AND LABA
// ==========================================
function updateRevenueDisplay(filterMonth, filterYear) {
    let totalRevenue = 0;
    let totalProfit = 0;

    globalSalesData.forEach(item => {
        if (item.status !== 'LUNAS') return; 

        const dateObj = parseDateToYMD(item.tanggal || item.CreatedAt);
        if (filterYear !== "ALL" && dateObj.y !== filterYear) return;
        if (filterMonth !== "ALL" && dateObj.m !== filterMonth) return;

        try {
            const tanggalTransaksiAsli = item.tanggal || item.CreatedAt;
            const jsonItemsValid = item.json_items || item.JSON_Items;
            
            if (jsonItemsValid && jsonItemsValid !== "[]") {
                const listItems = ekstrakItemsDariTransaksi(item);
                listItems.forEach(it => {
                    const hargaBeli = cariHargaBeliSesuaiTanggal(it.nama, tanggalTransaksiAsli);
                    
                    totalRevenue += (it.hargaJual * it.qty);
                    totalProfit += ((it.hargaJual - hargaBeli) * it.qty);
                });
            } else {
                // Fallback aman jika data json_items kosong namun baris utama memiliki total global
                const fallbackRevenue = parseFloat(item.total || item.Total || 0);
                let totalEstimasiModal = 0;
                
                const fallbackItems = ekstrakItemsDariTransaksi(item);
                fallbackItems.forEach(it => {
                    const hBeli = cariHargaBeliSesuaiTanggal(it.nama, tanggalTransaksiAsli);
                    totalEstimasiModal += (hBeli * it.qty);
                });
                
                totalRevenue += fallbackRevenue;
                totalProfit += (fallbackRevenue - totalEstimasiModal);
            }
        } catch (e) {
            console.error("Gagal kalkulasi laba/pendapatan pada item:", e);
        }
    });

    // Render ke HTML dengan format Rupiah Indonesia
    setElementText('statSales', "Rp " + totalRevenue.toLocaleString('id-ID'));
    setElementText('statProfit', "Rp " + totalProfit.toLocaleString('id-ID'));
}
