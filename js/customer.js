document.addEventListener('DOMContentLoaded', () => {
    const user = API.checkAuth();
    if (user.role !== 'CUSTOMER') API.logout();
    document.getElementById('customerName').textContent = `Halo, ${user.nama}`;
});
async function bukaFormOrder() {
    const user = JSON.parse(localStorage.getItem('r22_user'));
    const { value: orderData } = await Swal.fire({
        title: 'Form Order LPG',
        html: `<select id="ord-barang" class="input-elegant w-full mb-3"><option value="LPG 50 Kg">LPG 50 Kg</option><option value="LPG 12 Kg" selected>LPG 12 Kg</option><option value="LPG 5.5 Kg">LPG 5.5 Kg</option></select><input type="number" id="ord-qty" class="input-elegant w-full mb-3" placeholder="Jumlah"><textarea id="ord-alamat" class="input-elegant w-full mb-3" placeholder="Alamat"></textarea><input type="tel" id="ord-hp" class="input-elegant w-full" placeholder="HP">`,
        focusConfirm: false, showCancelButton: true, confirmButtonColor: '#ff4fa3', confirmButtonText: 'Kirim Order',
        preConfirm: () => {
            const barang = document.getElementById('ord-barang').value; const qty = document.getElementById('ord-qty').value; const alamat = document.getElementById('ord-alamat').value; const hp = document.getElementById('ord-hp').value;
            if(!qty || !alamat || !hp) Swal.showValidationMessage('Isi semua kolom');
            return { customer: user.nama, barang, qty, alamat, noHP: hp };
        }
    });
    if (orderData) { Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() }); try { const res = await API.request('order/create', orderData); Swal.fire('Berhasil!', res.message, 'success'); } catch (error) {} }
}
async function uploadBuktiTransfer(orderId) {
    const { value: file } = await Swal.fire({ title: 'Upload Bukti Transfer', input: 'file', confirmButtonColor: '#ff4fa3', showCancelButton: true });
    if (file) {
        Swal.fire({ title: 'Mengupload...', didOpen: () => Swal.showLoading() });
        const reader = new FileReader();
        reader.onload = async (e) => { try { await API.request('upload', { base64: e.target.result.split(',')[1], filename: `TF_${orderId}_${file.name}`, type: 'BUKTI_TRANSFER' }); Swal.fire('Terkirim!', 'Bukti diupload.', 'success'); } catch (error) {} };
        reader.readAsDataURL(file);
    }
}
