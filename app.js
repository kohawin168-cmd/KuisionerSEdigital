// ============================================
// SENSUS EKONOMI 2026 - DESA SUKADAMAI
// PWA with IndexedDB, Auto-save, WhatsApp
// ============================================

const DB_NAME = 'SensusEkonomi2026';
const DB_VERSION = 1;
const STORE_KELUARGA = 'draftKeluarga';
const STORE_USAHA = 'draftUsaha';
const WA_NUMBER = '085791111335';

let db = null;
let currentMode = '';
let currentDraftId = null;
let autoSaveTimer = null;
let anggotaCount = 0;

// ============================================
// INIT & DB
// ============================================

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_KELUARGA)) {
                database.createObjectStore(STORE_KELUARGA, { keyPath: 'id', autoIncrement: true });
            }
            if (!database.objectStoreNames.contains(STORE_USAHA)) {
                database.createObjectStore(STORE_USAHA, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function saveDraft(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        data.updatedAt = new Date().toISOString();
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllDrafts(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getDraft(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteDraft(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// UI NAVIGATION
// ============================================

function selectMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    document.getElementById('mode' + (mode === 'keluarga' ? 'Keluarga' : 'Usaha')).classList.add('active');
    setTimeout(() => showForm(), 300);
}

function backToMode() {
    hideAll();
    document.getElementById('modeSelection').classList.remove('hidden');
    currentMode = '';
    currentDraftId = null;
}

function backToDrafts() {
    showDrafts();
}

function hideAll() {
    document.getElementById('modeSelection').classList.add('hidden');
    document.getElementById('draftListSection').classList.add('hidden');
    document.getElementById('formKeluarga').classList.add('hidden');
    document.getElementById('formUsaha').classList.add('hidden');
    document.getElementById('summarySection').classList.add('hidden');
}

function showForm() {
    hideAll();
    currentDraftId = null;

    // Show the form FIRST, then reset it
    if (currentMode === 'keluarga') {
        document.getElementById('formKeluarga').classList.remove('hidden');
    } else if (currentMode === 'usaha') {
        document.getElementById('formUsaha').classList.remove('hidden');
    } else {
        backToMode();
        return;
    }

    // Now reset the form (form is visible, DOM elements are accessible)
    resetFormInternal();
}

async function showDrafts() {
    if (!currentMode) { backToMode(); return; }
    hideAll();
    document.getElementById('draftListSection').classList.remove('hidden');
    await renderDraftList();
}

async function renderDraftList() {
    const storeName = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    const drafts = await getAllDrafts(storeName);
    const container = document.getElementById('draftList');

    if (drafts.length === 0) {
        container.innerHTML = '<div class="alert alert-info text-center">Belum ada draft tersimpan. Klik "+ Buat Baru" untuk memulai.</div>';
        return;
    }

    let html = '';
    drafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    drafts.forEach((draft, index) => {
        const date = new Date(draft.updatedAt).toLocaleString('id-ID');
        const title = currentMode === 'keluarga' 
            ? (draft.k_kk_nama || 'Draft ' + (index + 1)) + ' - ' + (draft.k_no_bangunan || '-')
            : (draft.u_nama || 'Draft ' + (index + 1));
        const subtitle = currentMode === 'keluarga'
            ? (draft.k_alamat || '-')
            : (draft.u_kegiatan || '-');

        html += `<div class="card mb-2">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1 fw-bold">${title}</h6>
                        <p class="mb-1 text-muted small">${subtitle}</p>
                        <small class="text-secondary">${date}</small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary" onclick="loadDraft(${draft.id})">✏️ Edit</button>
                        <button class="btn btn-success" onclick="kirimDraftWhatsApp(${draft.id})">📤 WA</button>
                        <button class="btn btn-danger" onclick="hapusDraft(${draft.id})">🗑️</button>
                    </div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function loadDraft(id) {
    const storeName = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    const draft = await getDraft(storeName, id);
    if (!draft) { showToast('Draft tidak ditemukan!', 'danger'); return; }

    currentDraftId = id;
    hideAll();

    if (currentMode === 'keluarga') {
        document.getElementById('formKeluarga').classList.remove('hidden');
    } else {
        document.getElementById('formUsaha').classList.remove('hidden');
    }

    // Populate form fields - only target actual form inputs, not all elements
    const prefix = currentMode === 'keluarga' ? 'k_' : 'u_';
    const formInputs = document.querySelectorAll(`#form${currentMode === 'keluarga' ? 'Keluarga' : 'Usaha'} [id^="${prefix}"]`);

    formInputs.forEach(el => {
        if (draft[el.id] !== undefined) {
            if (el.type === 'checkbox') {
                el.checked = !!draft[el.id];
            } else {
                el.value = draft[el.id] || '';
            }
        }
    });

    // Handle anggota keluarga
    if (currentMode === 'keluarga' && draft.anggota && draft.anggota.length > 0) {
        document.getElementById('anggotaContainer').innerHTML = '';
        anggotaCount = 0;
        draft.anggota.forEach(anggota => {
            tambahAnggota(anggota);
        });
    }

    // Trigger calculations
    if (currentMode === 'keluarga') {
        hitungPengeluaran();
        hitungLuasBangunan();
        hitungLuasTanah();
        toggleDetailUsaha();
        updateMapsLink('k_gps', 'k_maps_link');
    } else {
        hitungTotalKaryawan();
        hitungGaji();
        hitungOmzet();
        updateMapsLink('u_gps', 'u_maps_link');
    }

    showToast('Draft berhasil dimuat!', 'success');
}

async function hapusDraft(id) {
    if (!confirm('Yakin ingin menghapus draft ini?')) return;
    const storeName = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    await deleteDraft(storeName, id);
    await renderDraftList();
    await updateDraftCounts();
    showToast('Draft dihapus!', 'success');
}

async function updateDraftCounts() {
    const keluarga = await getAllDrafts(STORE_KELUARGA);
    const usaha = await getAllDrafts(STORE_USAHA);
    document.getElementById('draftKeluarga').textContent = keluarga.length + ' Draft';
    document.getElementById('draftUsaha').textContent = usaha.length + ' Draft';
}

// ============================================
// AUTO SAVE
// ============================================

function autoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        doAutoSave();
    }, 2000);
}

async function doAutoSave() {
    if (!currentMode) return;
    const storeName = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    const data = collectFormData();

    if (currentDraftId) {
        data.id = currentDraftId;
    }

    const id = await saveDraft(storeName, data);
    currentDraftId = id;
    await updateDraftCounts();
    showToast('💾 Auto-saved', 'info', 1500);
}

function collectFormData() {
    const data = {};
    const prefix = currentMode === 'keluarga' ? 'k_' : 'u_';
    // Only collect from visible form inputs, not from draft list or other elements
    const formId = currentMode === 'keluarga' ? 'formKeluarga' : 'formUsaha';
    const inputs = document.querySelectorAll(`#${formId} [id^="${prefix}"]`);

    inputs.forEach(el => {
        if (el.type === 'checkbox') {
            data[el.id] = el.checked;
        } else if (el.type === 'number') {
            data[el.id] = el.value ? parseFloat(el.value) : '';
        } else {
            data[el.id] = el.value;
        }
    });

    // Collect anggota keluarga
    if (currentMode === 'keluarga') {
        data.anggota = [];
        const anggotaCards = document.querySelectorAll('.anggota-item');
        anggotaCards.forEach(card => {
            const idx = card.dataset.index;
            data.anggota.push({
                nama: document.getElementById(`anggota_nama_${idx}`)?.value || '',
                nik: document.getElementById(`anggota_nik_${idx}`)?.value || '',
                jk: document.getElementById(`anggota_jk_${idx}`)?.value || '',
                umur: document.getElementById(`anggota_umur_${idx}`)?.value || '',
                pekerjaan: document.getElementById(`anggota_pekerjaan_${idx}`)?.value || '',
                status: document.getElementById(`anggota_status_${idx}`)?.value || ''
            });
        });
    }

    return data;
}

function simpanDraft() {
    doAutoSave();
    showToast('✅ Draft berhasil disimpan!', 'success');
}

// ============================================
// CALCULATIONS
// ============================================

function formatRupiah(num) {
    if (!num || isNaN(num)) return 'Rp 0';
    return 'Rp ' + parseFloat(num).toLocaleString('id-ID');
}

function hitungPengeluaran() {
    const makananMinggu = parseFloat(document.getElementById('k_makanan_minggu')?.value) || 0;
    const nonmakananBulan = parseFloat(document.getElementById('k_nonmakanan_bulan')?.value) || 0;
    const rutinTahun = parseFloat(document.getElementById('k_rutin_tahun')?.value) || 0;

    const makananTahun = makananMinggu * 52;
    const nonmakananTahun = nonmakananBulan * 12;
    const total = makananTahun + nonmakananTahun + rutinTahun;

    const el1 = document.getElementById('k_makanan_tahun');
    const el2 = document.getElementById('k_nonmakanan_tahun');
    const el3 = document.getElementById('k_total_pengeluaran');
    if (el1) el1.value = formatRupiah(makananTahun);
    if (el2) el2.value = formatRupiah(nonmakananTahun);
    if (el3) el3.value = formatRupiah(total);
}

function hitungLuasBangunan() {
    const p = parseFloat(document.getElementById('k_p_bangunan')?.value) || 0;
    const l = parseFloat(document.getElementById('k_l_bangunan')?.value) || 0;
    const el = document.getElementById('k_luas_bangunan');
    if (el) el.value = (p * l).toLocaleString('id-ID') + ' m²';
}

function hitungLuasTanah() {
    const p = parseFloat(document.getElementById('k_p_tanah')?.value) || 0;
    const l = parseFloat(document.getElementById('k_l_tanah')?.value) || 0;
    const el = document.getElementById('k_luas_tanah');
    if (el) el.value = (p * l).toLocaleString('id-ID') + ' m²';
}

function hitungTotalKaryawan() {
    const pria = parseInt(document.getElementById('u_karyawan_pria')?.value) || 0;
    const wanita = parseInt(document.getElementById('u_karyawan_wanita')?.value) || 0;
    const el = document.getElementById('u_karyawan_total');
    if (el) el.value = (pria + wanita).toLocaleString('id-ID') + ' orang';
}

function hitungGaji() {
    const harian = parseFloat(document.getElementById('u_gaji_harian')?.value) || 0;
    const mingguan = harian * 7;
    const bulanan = harian * 26;
    const tahunan = bulanan * 12;

    const el1 = document.getElementById('u_gaji_mingguan');
    const el2 = document.getElementById('u_gaji_bulanan');
    const el3 = document.getElementById('u_gaji_tahunan');
    if (el1) el1.value = formatRupiah(mingguan);
    if (el2) el2.value = formatRupiah(bulanan);
    if (el3) el3.value = formatRupiah(tahunan);
}

function hitungOmzet() {
    const bulan = parseFloat(document.getElementById('u_omzet_bulan')?.value) || 0;
    const el = document.getElementById('u_omzet_tahun');
    if (el) el.value = formatRupiah(bulan * 12);
}

function toggleDetailUsaha() {
    const val = document.getElementById('k_ada_usaha')?.value;
    const detail = document.getElementById('detailUsahaKeluarga');
    if (!detail) return;
    if (val === 'Ya') {
        detail.classList.remove('hidden');
    } else {
        detail.classList.add('hidden');
    }
}

// ============================================
// ANGGOTA KELUARGA DINAMIS
// ============================================

function tambahAnggota(data = null) {
    anggotaCount++;
    const idx = anggotaCount;
    const container = document.getElementById('anggotaContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'member-card anggota-item';
    div.dataset.index = idx;
    div.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove" onclick="hapusAnggota(this)">✕</button>
        <div class="row g-2">
            <div class="col-md-6"><label class="form-label">Nama</label><input type="text" class="form-control" id="anggota_nama_${idx}" value="${data?.nama || ''}" onchange="autoSave()"></div>
            <div class="col-md-6"><label class="form-label">NIK</label><input type="text" class="form-control" id="anggota_nik_${idx}" maxlength="16" value="${data?.nik || ''}" onchange="autoSave()"></div>
            <div class="col-md-4"><label class="form-label">JK</label>
                <select class="form-select" id="anggota_jk_${idx}" onchange="autoSave()">
                    <option value="">Pilih</option>
                    <option value="Laki-laki" ${data?.jk === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
                    <option value="Perempuan" ${data?.jk === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
                </select>
            </div>
            <div class="col-md-4"><label class="form-label">Umur</label><input type="number" class="form-control" id="anggota_umur_${idx}" value="${data?.umur || ''}" onchange="autoSave()"></div>
            <div class="col-md-4"><label class="form-label">Status</label>
                <select class="form-select" id="anggota_status_${idx}" onchange="autoSave()">
                    <option value="">Pilih</option>
                    <option value="Anak" ${data?.status === 'Anak' ? 'selected' : ''}>Anak</option>
                    <option value="Cucu" ${data?.status === 'Cucu' ? 'selected' : ''}>Cucu</option>
                    <option value="Orang Tua" ${data?.status === 'Orang Tua' ? 'selected' : ''}>Orang Tua</option>
                    <option value="Menantu" ${data?.status === 'Menantu' ? 'selected' : ''}>Menantu</option>
                    <option value="Lainnya" ${data?.status === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
                </select>
            </div>
            <div class="col-12"><label class="form-label">Pekerjaan</label><input type="text" class="form-control" id="anggota_pekerjaan_${idx}" value="${data?.pekerjaan || ''}" onchange="autoSave()"></div>
        </div>
    `;
    container.appendChild(div);
    autoSave();
}

function hapusAnggota(btn) {
    if (btn && btn.closest) {
        btn.closest('.anggota-item').remove();
        autoSave();
    }
}

// ============================================
// GPS & MAPS
// ============================================

function getGPS(inputId = 'k_gps', linkId = 'k_maps_link') {
    const statusEl = document.getElementById('gpsStatus');
    if (statusEl) {
        statusEl.textContent = 'Mencari lokasi...';
        statusEl.className = 'gps-status waiting';
    }

    if (!navigator.geolocation) {
        if (statusEl) {
            statusEl.textContent = 'Geolocation tidak didukung browser ini';
            statusEl.className = 'gps-status error';
        }
        showToast('Geolocation tidak didukung!', 'danger');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            const inputEl = document.getElementById(inputId);
            if (inputEl) inputEl.value = coords;
            updateMapsLink(inputId, linkId);
            if (statusEl) {
                statusEl.textContent = `Lokasi: ${coords}`;
                statusEl.className = 'gps-status ok';
            }
            showToast('GPS berhasil diambil!', 'success');
            autoSave();
        },
        (error) => {
            let msg = 'Gagal mengambil lokasi';
            switch(error.code) {
                case error.PERMISSION_DENIED: msg = 'Izin lokasi ditolak'; break;
                case error.POSITION_UNAVAILABLE: msg = 'Informasi lokasi tidak tersedia'; break;
                case error.TIMEOUT: msg = 'Timeout mengambil lokasi'; break;
            }
            if (statusEl) {
                statusEl.textContent = msg;
                statusEl.className = 'gps-status error';
            }
            showToast(msg, 'danger');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function updateMapsLink(inputId, linkId) {
    const coords = document.getElementById(inputId)?.value;
    const link = document.getElementById(linkId);
    if (coords && link) {
        link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
        link.classList.remove('disabled');
    }
}

// ============================================
// WHATSAPP
// ============================================

function kirimWhatsAppKeluarga() {
    const data = collectFormData();

    let msg = `*KUISIONER SENSUS EKONOMI 2026 - KELUARGA*%0A%0A`;
    msg += `*📍 DATA BANGUNAN*%0A`;
    msg += `No Bangunan: ${data.k_no_bangunan || '-'}%0A`;
    msg += `No Urut KK: ${data.k_no_urut || '-'}%0A`;
    msg += `GPS: ${data.k_gps || '-'}%0A`;
    msg += `Alamat: ${data.k_alamat || '-'}%0A`;
    msg += `No KK: ${data.k_no_kk || '-'}%0A`;
    msg += `WA: ${data.k_wa || '-'}%0A%0A`;

    msg += `*👤 KEPALA KELUARGA*%0A`;
    msg += `Nama: ${data.k_kk_nama || '-'}%0A`;
    msg += `NIK: ${data.k_kk_nik || '-'}%0A`;
    msg += `Tgl Lahir: ${data.k_kk_tgl_lahir || '-'}%0A`;
    msg += `JK: ${data.k_kk_jk || '-'}%0A`;
    msg += `Pendidikan: ${data.k_kk_pendidikan || '-'}%0A`;
    msg += `Pekerjaan: ${data.k_kk_pekerjaan || '-'}%0A`;
    msg += `Status Kawin: ${data.k_kk_status_kawin || '-'}%0A%0A`;

    if (data.k_pasangan_nama) {
        msg += `*💑 PASANGAN*%0A`;
        msg += `Nama: ${data.k_pasangan_nama}%0A`;
        msg += `Pekerjaan: ${data.k_pasangan_pekerjaan || '-'}%0A%0A`;
    }

    msg += `*💰 DATA EKONOMI*%0A`;
    msg += `Gaji/Bulan: ${formatRupiah(data.k_gaji)}%0A`;
    msg += `Listrik: ${data.k_listrik || '-'}%0A`;
    msg += `Internet: ${data.k_internet || '-'}%0A`;
    msg += `No Meter: ${data.k_no_meter || '-'}%0A`;
    msg += `Daya: ${data.k_daya || '-'} VA%0A%0A`;

    msg += `*💸 PENGELUARAN*%0A`;
    msg += `Makanan/Minggu: ${formatRupiah(data.k_makanan_minggu)}%0A`;
    msg += `Non-Makanan/Bulan: ${formatRupiah(data.k_nonmakanan_bulan)}%0A`;
    msg += `Rutin/Tahun: ${formatRupiah(data.k_rutin_tahun)}%0A`;
    msg += `*Total Pengeluaran: ${document.getElementById('k_total_pengeluaran')?.value || '-'}*%0A%0A`;

    msg += `*🏡 RUMAH & LAHAN*%0A`;
    msg += `Status: ${data.k_status_rumah || '-'}%0A`;
    msg += `Luas Bangunan: ${document.getElementById('k_luas_bangunan')?.value || '-'}%0A`;
    msg += `Luas Tanah: ${document.getElementById('k_luas_tanah')?.value || '-'}%0A%0A`;

    msg += `*🚗 ASET*%0A`;
    const aset = [];
    if (data.k_aset_mobil) aset.push('Mobil');
    if (data.k_aset_motor) aset.push('Motor');
    if (data.k_aset_sepeda) aset.push('Sepeda');
    if (data.k_aset_tv) aset.push('TV');
    if (data.k_aset_kulkas) aset.push('Kulkas');
    if (data.k_aset_ac) aset.push('AC');
    if (data.k_aset_laptop) aset.push('Laptop');
    if (data.k_aset_hewan) aset.push('Ternak');
    if (data.k_aset_lainnya) aset.push('Lainnya');
    msg += aset.length > 0 ? aset.join(', ') : 'Tidak ada';
    msg += `%0A%0A`;

    if (data.anggota && data.anggota.length > 0) {
        msg += `*👨‍👩‍👧‍👦 ANGGOTA KELUARGA (${data.anggota.length} orang)*%0A`;
        data.anggota.forEach((a, i) => {
            msg += `${i+1}. ${a.nama || '-'} (${a.status || '-'}, ${a.umur || '-'} th, ${a.pekerjaan || '-'})%0A`;
        });
        msg += `%0A`;
    }

    msg += `*🏪 USAHA KELUARGA*%0A`;
    msg += `Ada Usaha: ${data.k_ada_usaha || '-'}%0A`;
    if (data.k_ada_usaha === 'Ya') {
        msg += `Jenis: ${data.k_usaha_jenis || '-'}%0A`;
        msg += `Lokasi: ${data.k_usaha_lokasi || '-'}%0A`;
        msg += `Pekerja: ${data.k_usaha_pekerja || '-'}%0A`;
        msg += `Omzet/Bulan: ${formatRupiah(data.k_usaha_omzet)}%0A`;
    }

    msg += `%0A---%0A*Desa Sukadamai - Sensus Ekonomi 2026*%0A`;
    msg += `Tgl: ${new Date().toLocaleString('id-ID')}`;

    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank');
}

function kirimWhatsAppUsaha() {
    const data = collectFormData();

    let msg = `*KUISIONER SENSUS EKONOMI 2026 - USAHA*%0A%0A`;
    msg += `*🏢 IDENTITAS USAHA*%0A`;
    msg += `Nama: ${data.u_nama || '-'}%0A`;
    msg += `WA: ${data.u_wa || '-'}%0A`;
    msg += `NIB: ${data.u_nib || '-'}%0A`;
    msg += `GPS: ${data.u_gps || '-'}%0A`;
    msg += `Alamat: ${data.u_alamat || '-'}%0A%0A`;

    msg += `*👤 PENGUSAHA*%0A`;
    msg += `Nama: ${data.u_pengusaha || '-'}%0A`;
    msg += `JK: ${data.u_jk || '-'}%0A`;
    msg += `NIK: ${data.u_nik || '-'}%0A`;
    msg += `Umur: ${data.u_umur || '-'} th%0A%0A`;

    msg += `*🏭 KEGIATAN*%0A`;
    msg += `Usaha: ${data.u_kegiatan || '-'}%0A`;
    msg += `Produksi: ${data.u_produksi || '-'} ${data.u_satuan || ''}%0A%0A`;

    msg += `*👷 KARYAWAN*%0A`;
    msg += `Pria: ${data.u_karyawan_pria || 0}%0A`;
    msg += `Wanita: ${data.u_karyawan_wanita || 0}%0A`;
    msg += `*Total: ${document.getElementById('u_karyawan_total')?.value || '-'}*%0A%0A`;

    msg += `*💰 GAJI KARYAWAN*%0A`;
    msg += `Harian: ${formatRupiah(data.u_gaji_harian)}%0A`;
    msg += `Mingguan: ${document.getElementById('u_gaji_mingguan')?.value || '-'}%0A`;
    msg += `Bulanan: ${document.getElementById('u_gaji_bulanan')?.value || '-'}%0A`;
    msg += `*Tahunan: ${document.getElementById('u_gaji_tahunan')?.value || '-'}*%0A%0A`;

    msg += `*📊 BIAYA & OMZET*%0A`;
    msg += `Biaya Produksi/Bulan: ${formatRupiah(data.u_biaya_produksi)}%0A`;
    msg += `Biaya Operasional/Bulan: ${formatRupiah(data.u_biaya_operasional)}%0A`;
    msg += `Omzet/Bulan: ${formatRupiah(data.u_omzet_bulan)}%0A`;
    msg += `*Omzet/Tahun: ${document.getElementById('u_omzet_tahun')?.value || '-'}*%0A`;

    msg += `%0A---%0A*Desa Sukadamai - Sensus Ekonomi 2026*%0A`;
    msg += `Tgl: ${new Date().toLocaleString('id-ID')}`;

    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank');
}

async function kirimDraftWhatsApp(id) {
    currentDraftId = id;
    await loadDraft(id);
    if (currentMode === 'keluarga') {
        kirimWhatsAppKeluarga();
    } else {
        kirimWhatsAppUsaha();
    }
}

// ============================================
// UTILS
// ============================================

function resetForm(confirmFirst = true) {
    if (confirmFirst && !confirm('Yakin reset form? Data belum tersimpan akan hilang.')) return;
    resetFormInternal();
}

function resetFormInternal() {
    const prefix = currentMode === 'keluarga' ? 'k_' : 'u_';
    const formId = currentMode === 'keluarga' ? 'formKeluarga' : 'formUsaha';

    // Only reset elements inside the active form
    const form = document.getElementById(formId);
    if (!form) return;

    const inputs = form.querySelectorAll(`[id^="${prefix}"]`);
    inputs.forEach(el => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });

    if (currentMode === 'keluarga') {
        const anggotaContainer = document.getElementById('anggotaContainer');
        if (anggotaContainer) anggotaContainer.innerHTML = '';
        anggotaCount = 0;

        const mapsLink = document.getElementById('k_maps_link');
        if (mapsLink) mapsLink.classList.add('disabled');

        const gpsStatus = document.getElementById('gpsStatus');
        if (gpsStatus) {
            gpsStatus.textContent = 'Belum mengambil koordinat';
            gpsStatus.className = 'gps-status waiting';
        }
        hitungPengeluaran();
        hitungLuasBangunan();
        hitungLuasTanah();
        toggleDetailUsaha();
    } else {
        const mapsLink = document.getElementById('u_maps_link');
        if (mapsLink) mapsLink.classList.add('disabled');
        hitungTotalKaryawan();
        hitungGaji();
        hitungOmzet();
    }

    currentDraftId = null;
    showToast('Form direset!', 'info');
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await updateDraftCounts();
        console.log('Sensus Ekonomi 2026 PWA initialized');
    } catch (e) {
        console.error('DB init failed:', e);
        showToast('Gagal menginisialisasi database!', 'danger');
    }
});
