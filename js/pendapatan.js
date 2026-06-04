<script>
  let isEditMode = false;
  let currentEditId = null;
  let globalDataCache = []; 

  // Auto load data saat halaman siap diakses
  document.addEventListener('DOMContentLoaded', function() {
    // Memastikan user sudah login terautentikasi sebelum load data
    if(typeof API !== 'undefined' && API.checkAuth) {
      API.checkAuth();
    }
    loadData();
  });

  document.getElementById('formPendapatan').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerText = "Memproses...";
    
    const fileInput = document.getElementById('buktiTransfer');
    const file = fileInput.files[0];
    
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

  async function executeSubmit(payload) {
    const action = isEditMode ? 'pendapatan/update' : 'pendapatan/create';
    if (isEditMode) payload.idPembelian = currentEditId;
    
    try {
      // Menembak terpusat ke API.request (otomatis menyuntikkan r22_token di payload)
      await API.request(action, payload);
      
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: isEditMode ? 'Data berhasil diperbarui.' : 'Data pendapatan berhasil disimpan.', confirmButtonColor: '#ff4fa3' });
      resetFormMode();
      loadData();
    } catch (error) {
      // Error alert otomatis ditangani oleh interseptor di api.js
      btn.disabled = false;
      btn.innerText = isEditMode ? "Update Pendapatan" : "Simpan Pendapatan";
    }
  }

  async function loadData() {
    const tbody = document.getElementById('tabelBody');
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">Memuat data...</td></tr>`;
    
    try {
      const data = await API.request('pendapatan/get');
      tbody.innerHTML = "";
      globalDataCache = data;
      
      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">Belum ada data riwayat pendapatan.</td></tr>`;
        return;
      }
      
      data.forEach(function(item) {
        const tr = document.createElement('tr');
        const formattedNominal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.nominal);
        
        let linkBukti = "-";
        if (item.buktiTransfer && item.buktiTransfer !== "-") {
          linkBukti = `<a href="${item.buktiTransfer}" target="_blank" class="text-blue-600 hover:underline font-medium">Lihat File</a>`;
        }

        tr.innerHTML = `
          <td class="px-4 py-3 font-mono text-xs text-gray-600">${item.idPembelian}</td>
          <td class="px-4 py-3 text-gray-500 text-xs">${item.timestamp}</td>
          <td class="px-4 py-3 font-semibold text-gray-800">${item.nama}</td>
          <td class="px-4 py-3 text-gray-600">${item.uraian}</td>
          <td class="px-4 py-3 text-green-600 font-bold">${formattedNominal}</td>
          <td class="px-4 py-3">${linkBukti}</td>
          <td class="px-4 py-3 text-center space-x-1 whitespace-nowrap">
            <button onclick="triggerEdit('${item.idPembelian}')" class="bg-amber-500 hover:bg-amber-600 text-white text-xs py-1 px-2.5 rounded shadow-sm font-medium">Edit</button>
            <button onclick="triggerDelete('${item.idPembelian}')" class="bg-rose-500 hover:bg-rose-600 text-white text-xs py-1 px-2.5 rounded shadow-sm font-medium">Hapus</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-red-500">Gagal memuat data riwayat dari server.</td></tr>`;
    }
  }

  function triggerEdit(idPembelian) {
    const item = globalDataCache.find(x => x.idPembelian === idPembelian);
    if (!item) return;

    isEditMode = true;
    currentEditId = idPembelian;

    document.getElementById('formTitle').innerText = `✏️ Edit Pendapatan (${idPembelian})`;
    document.getElementById('formContainer').classList.replace('border-blue-600', 'border-amber-500');
    document.getElementById('btnSubmit').innerText = "Update Pendapatan";
    document.getElementById('btnSubmit').classList.replace('bg-blue-600', 'bg-amber-500');
    document.getElementById('btnSubmit').classList.replace('hover:bg-blue-700', 'hover:bg-amber-600');
    document.getElementById('btnBatal').classList.remove('hidden');

    document.getElementById('nama').value = item.nama;
    document.getElementById('nominal').value = item.nominal;
    document.getElementById('uraian').value = item.uraian;
    
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' });
  }

  function resetFormMode() {
    isEditMode = false;
    currentEditId = null;

    document.getElementById('formTitle').innerText = "Input Pendapatan Baru";
    document.getElementById('formContainer').classList.replace('border-amber-500', 'border-blue-600');
    document.getElementById('btnSubmit').innerText = "Simpan Pendapatan";
    document.getElementById('btnSubmit').classList.replace('bg-amber-500', 'bg-blue-600');
    document.getElementById('btnSubmit').classList.replace('hover:bg-amber-600', 'hover:bg-blue-700');
    document.getElementById('btnBatal').classList.add('hidden');
    
    document.getElementById('formPendapatan').reset();
    document.getElementById('btnSubmit').disabled = false;
  }

  async function triggerDelete(idPembelian) {
    // Memanfaatkan fungsi genericDelete bawaan api.js kamu agar standarisasi animasi seragam
    await genericDelete('pendapatan/delete', idPembelian, function() {
      if(currentEditId === idPembelian) resetFormMode();
      loadData();
    });
  }
</script>
