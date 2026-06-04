let isEditMode = false;
let currentEditId = null;
let globalDataCache = []; 

// Auto load data saat halaman siap diakses
document.addEventListener('DOMContentLoaded', function() {
  if(typeof API !== 'undefined' && API.checkAuth) {
    API.checkAuth();
  }
  loadData();
});

// Event handler handling Form Submit
document.getElementById('formPendapatan').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const btn = document.getElementById('btnSubmit');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Memproses...";
  }
  
  const fileInput = document.getElementById('buktiTransfer');
  const file = fileInput ? fileInput.files[0] : null;
  
  const payload = {
    nama: document.getElementById('nama').value,
    nominal: document.getElementById('nominal').value,
    uraian: document.getElementById('uraian').value,
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

// Eksekusi penembakan data ke API terpusat
async function executeSubmit(payload) {
  const action = isEditMode ? 'pendapatan/update' : 'pendapatan/add';
  const btn = document.getElementById('btnSubmit');
  if (isEditMode) payload.idPembelian = currentEditId;
  
  try {
    await API.request(action, payload);
    
    Swal.fire({ 
      icon: 'success', 
      title: 'Berhasil!', 
      text: isEditMode ? 'Data berhasil diperbarui.' : 'Data pendapatan berhasil disimpan.', 
      confirmButtonColor: '#2563EB' 
    });
    
    resetFormMode();
    loadData();
  } catch (error) {
    if (btn) {
      btn.disabled = false;
      btn.innerText = isEditMode ? "Update Pendapatan" : "Simpan Data Jurnal Pendapatan";
    }
  }
}

// Fetch data dan render ke dalam tabel UI
async function loadData() {
  const tbody = document.getElementById('tabelBody');
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-xs font-semibold text-slate-400">Memuat data ritme kas...</td></tr>`;
  
  try {
    const data = await API.request('pendapatan/get');
    tbody.innerHTML = "";
    globalDataCache = data;
    
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs font-semibold text-slate-400">Belum ada data riwayat pendapatan.</td></tr>`;
      return;
    }
    
    data.forEach(function(item) {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50/80 transition-colors border-b border-slate-50 text-slate-600 font-medium";
      
      const formattedNominal = new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
      }).format(item.nominal);
      
      let linkBukti = `<span class="text-xs text-slate-400 font-normal">-</span>`;
      if (item.buktiTransfer && item.buktiTransfer !== "-") {
        linkBukti = `<a href="${item.buktiTransfer}" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline font-bold">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
          Lihat File
        </a>`;
      }

      tr.innerHTML = `
        <td class="py-4 px-4 font-mono text-[11px] text-slate-400 font-bold">#${item.idPembelian}</td>
        <td class="py-4 px-4 text-xs text-slate-400 font-normal">${item.timestamp}</td>
        <td class="py-4 px-4 text-slate-800 font-extrabold text-xs max-w-[140px] truncate">${item.nama}</td>
        <td class="py-4 px-4 text-xs text-slate-500 max-w-[180px] truncate">${item.uraian}</td>
        <td class="py-4 px-4 text-right text-emerald-600 font-extrabold">${formattedNominal}</td>
        <td class="py-4 px-4 text-center">${linkBukti}</td>
        <td class="py-4 px-4 text-center space-x-1.5 whitespace-nowrap">
          <button onclick="triggerEdit('${item.idPembelian}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] py-1.5 px-3 rounded-xl font-bold transition-colors">Edit</button>
          <button onclick="triggerDelete('${item.idPembelian}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] py-1.5 px-3 rounded-xl font-bold transition-colors">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-xs font-bold text-rose-500">Gagal memuat data riwayat dari server.</td></tr>`;
  }
}

// Set form ke mode edit dengan visual feedback senada
function triggerEdit(idPembelian) {
  const item = globalDataCache.find(x => x.idPembelian == idPembelian);
  if (!item) return;

  isEditMode = true;
  currentEditId = idPembelian;

  const formTitle = document.getElementById('formTitle');
  const formContainer = document.getElementById('formContainer');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnBatal = document.getElementById('btnBatal');

  if (formTitle) formTitle.innerHTML = `<span class="text-amber-500">✏️</span> Edit Pendapatan <span class="font-mono text-xs text-amber-600">(${idPembelian})</span>`;
  if (formContainer) {
    formContainer.classList.remove('border-slate-100');
    formContainer.classList.add('border-amber-400', 'shadow-[0_4px_20px_rgba(245,158,11,0.1)]');
  }
  if (btnSubmit) {
    btnSubmit.innerText = "Update Pendapatan";
    btnSubmit.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    btnSubmit.classList.add('bg-amber-500', 'hover:bg-amber-600');
  }
  if (btnBatal) btnBatal.classList.remove('hidden');

  // Mapping values ke field form
  document.getElementById('nama').value = item.nama;
  document.getElementById('nominal').value = item.nominal;
  document.getElementById('uraian').value = item.uraian;
  
  if (formContainer) formContainer.scrollIntoView({ behavior: 'smooth' });
}

// Reset form kembali ke mode create semula
function resetFormMode() {
  isEditMode = false;
  currentEditId = null;

  const formTitle = document.getElementById('formTitle');
  const formContainer = document.getElementById('formContainer');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnBatal = document.getElementById('btnBatal');

  if (formTitle) formTitle.innerText = "Catat Pendapatan Baru";
  if (formContainer) {
    formContainer.classList.remove('border-amber-400', 'shadow-[0_4px_20px_rgba(245,158,11,0.1)]');
    formContainer.classList.add('border-slate-100');
  }
  if (btnSubmit) {
    btnSubmit.innerText = "Simpan Data Jurnal Pendapatan";
    btnSubmit.disabled = false;
    btnSubmit.classList.remove('bg-amber-500', 'hover:bg-amber-600');
    btnSubmit.classList.add('bg-blue-600', 'hover:bg-blue-700');
  }
  if (btnBatal) btnBatal.classList.add('hidden');
  
  document.getElementById('formPendapatan').reset();
}

// Trigger hapus data memakai genericDelete bawaan api.js
async function triggerDelete(idPembelian) {
  if (typeof genericDelete === 'function') {
    await genericDelete('pendapatan/delete', idPembelian, function() {
      if(currentEditId === idPembelian) resetFormMode();
      loadData();
    });
  }
}
