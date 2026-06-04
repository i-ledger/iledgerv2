// ==========================================
// GLOBAL VARIABLE UNTUK FILTER
// ==========================================
let globalSalesData = []; 
let globalPembelianData = []; // Menampung data historis dari sheet PEMBELIAN
let salesChartObj = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = API.checkAuth();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return API.logout();
    
    document.getElementById('userName').textContent = user.nama;
    document.getElementById('userRole').textContent = user.role;
    if(document.getElementById('companyName')) {
        document.getElementById('companyName').textContent = user.perusahaan || "PT. SINARAPI JATAYU PERMAI";
    }

    try {
        // Tembak API Stats Utama
        const stats = await API.request('dashboard/stats');
        
        // Tampilkan Stok Per Tabung
        document.getElementById('stok50').textContent = stats.stok50 || 0;
        document.getElementById('stok12').textContent = stats.stok12 || 0;
        document.getElementById('stok5').textContent = stats.stok5 || 0;
        
        // Tampilkan Pengiriman Pending
        document.getElementById('statDeliv').textContent = stats.pendingDeliveries || 0;

        // Tarik Data Pembelian Pertama Kali (Untuk Sinkronisasi Modal/Laba)
        try {
            const pembelianData = await API.request('pembelian/get');
            if (pembelianData) {
                globalPembelianData = pembelianData;
            }
        } catch (errPembelian) {
            console.error("Gagal menarik statistik dari sheet pembelian:", errPembelian);
        }

        // Tarik Data Transaksi untuk Grafik & Kalkulasi Dinamis
        const salesData = await API.request('penjualan/get');
        if(salesData) {
            globalSalesData = salesData;
            
            // Inisialisasi Setting Tahun Otomatis
            initFilterTahun(); 
            
            // Set Default Filter (Semua Bulan, Tahun Saat Ini)
            const currentYear = new Date().getFullYear().toString();
            
            if(document.getElementById('filterTahun')) document.getElementById('filterTahun').value = currentYear;
            if(document.getElementById('filterBulan')) document.getElementById('filterBulan').value = "ALL";
            
            // Render Grafik & Angka Keuangan Pertama Kali
            applyChartFilter(); 
        }

    } catch (error) {
        console.error("Gagal menarik statistik dashboard:", error);
    }
});

// ==========================================
// HELPER: PARSING TANGGAL ANTI-GAGAL
// ==========================================
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
    
    // 1. Update Grafik
    renderSalesChart(fMonth, fYear);
    
    // 2. Update Nominal Pendapatan & Laba
    updateRevenueDisplay(fMonth, fYear);
};

// ==========================================
// RENDER GRAFIK DINAMIS (3 PRODUK)
// ==========================================
function renderSalesChart(filterMonth, filterYear) {
    if (!globalSalesData) return;

    const dataAgregat = {};
    const isYearlyView = (filterMonth === "ALL"); 

    globalSalesData.forEach(item => {
        if(item.status === 'BATAL') return; 
        
        const dateObj = parseDateToYMD(item.tanggal || item.CreatedAt);
        const y = dateObj.y;
        const m = dateObj.m;
        const d = dateObj.d;
        
        if (filterYear !== "ALL" && y !== filterYear) return;
        if (filterMonth !== "ALL" && m !== filterMonth) return;

        let key = isYearlyView ? `${y}-${m}` : `${y}-${m}-${d}`;
        
        if (!dataAgregat[key]) {
            dataAgregat[key] = { qty50: 0, qty12: 0, qty5: 0 };
        }

        try {
            const itemsArr = JSON.parse(item.json_items || item.JSON_Items || "[]");
            if (itemsArr.length > 0) {
                itemsArr.forEach(it => {
                    const q = parseInt(it.qty) || 0;
                    if(it.barang.includes("50")) dataAgregat[key].qty50 += q;
                    else if(it.barang.includes("12")) dataAgregat[key].qty12 += q;
                    else if(it.barang.includes("5.5") || it.barang.includes("5,5")) dataAgregat[key].qty5 += q;
                });
            } else {
                if(item.barang) {
                    const parts = item.barang.split(',');
                    parts.forEach(p => {
                        const match = p.trim().match(/(\d+)x\s+(.*)/i);
                        if(match) {
                            const q = parseInt(match[1]);
                            const b = match[2].toLowerCase();
                            if(b.includes("50")) dataAgregat[key].qty50 += q;
                            else if(b.includes("12")) dataAgregat[key].qty12 += q;
                            else if(b.includes("5.5") || b.includes("5,5")) dataAgregat[key].qty5 += q;
                        }
                    });
                }
            }
        } catch(e) {}
    });

    const sortedKeys = Object.keys(dataAgregat).sort();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

    const labels = sortedKeys.map(k => {
        if (isYearlyView) {
            const [y, m] = k.split('-');
            return filterYear === "ALL" ? `${monthNames[parseInt(m)-1]} ${y}` : monthNames[parseInt(m)-1];
        } else {
            const [y, m, d] = k.split('-');
            return `${parseInt(d)} ${monthNames[parseInt(m)-1]}`; 
        }
    });

    const dataset50 = sortedKeys.map(k => dataAgregat[k].qty50);
    const dataset12 = sortedKeys.map(k => dataAgregat[k].qty12);
    const dataset5 = sortedKeys.map(k => dataAgregat[k].qty5);

    const ctx = document.getElementById('salesChart').getContext('2d');
    
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

    // Helper internal: Mencari HargaBeli terakhir sebelum/pas tanggal penjualan terjadi
    function cariHargaBeliSesuaiTanggal(namaBarang, tanggalJualStr) {
        if (!globalPembelianData || globalPembelianData.length === 0) return 0;
        
        const waktuJual = new Date(tanggalJualStr).getTime();
        
        // Fungsi standarisasi string penamaan biar aman dari typo tanda koma/titik/spasi
        const bersihkanNama = (str) => str ? str.toLowerCase().replace(/[\s,.]/g, '') : '';
        const targetNama = bersihkanNama(namaBarang);

        // Filter: Barang harus pas & tanggal beli harus lebih lama atau sama dengan tanggal jual
        const opsiPembelian = globalPembelianData.filter(p => {
            const namaMatch = bersihkanNama(p.Barang) === targetNama;
            const waktuBeli = p.Tanggal ? new Date(p.Tanggal).getTime() : 0;
            return namaMatch && waktuBeli <= waktuJual;
        });

        if (opsiPembelian.length > 0) {
            // Urutkan berdasarkan Tanggal pembelian terbaru (descending)
            opsiPembelian.sort((a, b) => new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime());
            return parseFloat(opsiPembelian[0].HargaBeli || 0);
        }

        // Fallback Kasar: Jika tanggal penjualan mendahului semua log pembelian, ambil harga manapun yang pertama cocok
        const fallback = globalPembelianData.find(p => bersihkanNama(p.Barang) === targetNama);
        return fallback ? parseFloat(fallback.HargaBeli || 0) : 0;
    }

    globalSalesData.forEach(item => {
        // HANYA hitung transaksi yang berstatus LUNAS
        if (item.status !== 'LUNAS') return; 

        // Parsing tanggal untuk filter dropdown dashboard
        const dateObj = parseDateToYMD(item.tanggal || item.CreatedAt);
        if (filterYear !== "ALL" && dateObj.y !== filterYear) return;
        if (filterMonth !== "ALL" && dateObj.m !== filterMonth) return;

        try {
            const itemsArr = JSON.parse(item.json_items || item.JSON_Items || "[]");
            const tanggalTransaksiAsli = item.tanggal || item.CreatedAt;
            
            if (itemsArr.length > 0) {
                itemsArr.forEach(it => {
                    const qty = parseInt(it.qty) || 0;
                    const hargaJual = parseFloat(it.harga || it.harga_jual || it.price || 0);
                    
                    // Ambil harga beli berdasarkan histori timeline log pembelian
                    const hargaBeli = cariHargaBeliSesuaiTanggal(it.barang, tanggalTransaksiAsli);
                    
                    // Akumulasi rumus akuntansi
                    totalRevenue += (hargaJual * qty);
                    totalProfit += ((hargaJual - hargaBeli) * qty);
                });
            } else {
                // Fallback aman jika data json_items kosong namun baris utama memiliki nilai total
                const fallbackRevenue = parseFloat(item.total || item.Total || 0);
                let totalEstimasiModal = 0;
                
                if (item.barang) {
                    const parts = item.barang.split(',');
                    parts.forEach(p => {
                        const match = p.trim().match(/(\d+)x\s+(.*)/i);
                        if (match) {
                            const q = parseInt(match[1]);
                            const namaB = match[2].trim();
                            const hBeli = cariHargaBeliSesuaiTanggal(namaB, tanggalTransaksiAsli);
                            totalEstimasiModal += (hBeli * q);
                        }
                    });
                }
                
                totalRevenue += fallbackRevenue;
                totalProfit += (fallbackRevenue - totalEstimasiModal);
            }
        } catch (e) {
            console.error("Gagal kalkulasi laba/pendapatan pada item:", e);
        }
    });

    // Tampilkan data ke dokumen HTML
    const statSalesEl = document.getElementById('statSales');
    if (statSalesEl) {
        statSalesEl.textContent = "Rp " + totalRevenue.toLocaleString('id-ID');
    }

    // Target id baru untuk box Laba Bersih / Profit
    const statProfitEl = document.getElementById('statProfit');
    if (statProfitEl) {
        statProfitEl.textContent = "Rp " + totalProfit.toLocaleString('id-ID');
    }
}
