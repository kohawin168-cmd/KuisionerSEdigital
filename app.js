// ============================================
// SENSUS EKONOMI 2026 - DESA SUKADAMAI
// ============================================

const DB_NAME = 'SensusEkonomi2026';
const DB_VERSION = 1;
const STORE_KELUARGA = 'draftKeluarga';
const STORE_USAHA = 'draftUsaha';
const WA_NUMBER = '6285791111335';

let db = null;
let currentMode = '';
let currentDraftId = null;
let autoSaveTimer = null;
let anggotaCount = 0;

// ============================================
// DATABASE
// ============================================
function initDB() {
    return new Promise(function(resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = function() { reject(req.error); };
        req.onsuccess = function() { db = req.result; resolve(db); };
        req.onupgradeneeded = function(e) {
            var d = e.target.result;
            if (!d.objectStoreNames.contains(STORE_KELUARGA)) {
                d.createObjectStore(STORE_KELUARGA, { keyPath: 'id', autoIncrement: true });
            }
            if (!d.objectStoreNames.contains(STORE_USAHA)) {
                d.createObjectStore(STORE_USAHA, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function saveToStore(store, data) {
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var st = tx.objectStore(store);
        data.updatedAt = new Date().toISOString();
        var req = st.put(data);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

function getAllFromStore(store) {
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readonly');
        var st = tx.objectStore(store);
        var req = st.getAll();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

function getFromStore(store, id) {
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readonly');
        var st = tx.objectStore(store);
        var req = st.get(id);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

function deleteFromStore(store, id) {
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var st = tx.objectStore(store);
        var req = st.delete(id);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
    });
}

// ============================================
// NAVIGATION
// ============================================
function showScreen(screenId) {
    var screens = ['modeSelection', 'draftListSection', 'formKeluarga', 'formUsaha'];
    for (var i = 0; i < screens.length; i++) {
        var el = document.getElementById(screens[i]);
        if (el) {
            if (screens[i] === screenId) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    }
}

function selectMode(mode) {
    currentMode = mode;
    currentDraftId = null;

    // Highlight selected card
    var cards = document.querySelectorAll('.mode-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('active');
    }
    var cardId = mode === 'keluarga' ? 'modeKeluarga' : 'modeUsaha';
    var card = document.getElementById(cardId);
    if (card) card.classList.add('active');

    // Go directly to form
    showNewForm();
}

function showNewForm() {
    anggotaCount = 0;
    currentDraftId = null;

    if (currentMode === 'keluarga') {
        showScreen('formKeluarga');
        clearFormKeluarga();
    } else if (currentMode === 'usaha') {
        showScreen('formUsaha');
        clearFormUsaha();
    }
}

function showDraftList() {
    if (!currentMode) {
        showScreen('modeSelection');
        return;
    }
    showScreen('draftListSection');
    renderDraftList();
}

function backToHome() {
    currentMode = '';
    currentDraftId = null;
    showScreen('modeSelection');
}

// ============================================
// FORM CLEARING
// ============================================
function clearFormKeluarga() {
    var ids = [
        'k_no_bangunan','k_no_urut','k_gps','k_alamat','k_no_kk','k_wa',
        'k_kk_nama','k_kk_nik','k_kk_tgl_lahir','k_kk_jk','k_kk_pendidikan',
        'k_kk_pekerjaan','k_kk_status_kawin','k_pasangan_nama','k_pasangan_pekerjaan',
        'k_gaji','k_listrik','k_internet','k_no_meter','k_daya',
        'k_pengeluaran_listrik','k_pengeluaran_internet',
        'k_makanan_minggu','k_nonmakanan_bulan','k_rutin_tahun',
        'k_status_rumah','k_harga_sewa','k_jenis_surat',
        'k_p_bangunan','k_l_bangunan','k_p_tanah','k_l_tanah',
        'k_harga_rumah','k_harga_tanah',
        'k_harga_mobil','k_harga_motor',
        'k_ada_usaha','k_usaha_jenis','k_usaha_lokasi','k_usaha_pekerja',
        'k_biaya_produksi','k_biaya_operasional','k_omzet_bulan'
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        }
    }

    var container = document.getElementById('anggotaContainer');
    if (container) container.innerHTML = '';

    var fields = ['k_makanan_tahun','k_nonmakanan_tahun','k_total_pengeluaran',
                  'k_luas_bangunan','k_luas_tanah'];
    for (var j = 0; j < fields.length; j++) {
        var f = document.getElementById(fields[j]);
        if (f) f.value = '';
    }

    var mapsLink = document.getElementById('k_maps_link');
    if (mapsLink) { mapsLink.href = '#'; mapsLink.classList.add('disabled'); }

    var gpsStatus = document.getElementById('gpsStatus');
    if (gpsStatus) {
        gpsStatus.textContent = 'Belum mengambil koordinat';
        gpsStatus.className = 'gps-status waiting';
    }

    var detailUsaha = document.getElementById('detailUsahaKeluarga');
    if (detailUsaha) detailUsaha.classList.add('hidden');
}

function clearFormUsaha() {
    var ids = [
        'u_nama','u_wa','u_nib','u_gps','u_alamat',
        'u_pengusaha','u_jk','u_nik','u_umur',
        'u_kegiatan','u_produksi','u_satuan',
        'u_karyawan_pria','u_karyawan_wanita',
        'u_gaji_harian','u_biaya_produksi','u_biaya_operasional','u_omzet_bulan'
    ];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.value = '';
    }

    var fields = ['u_karyawan_total','u_gaji_mingguan','u_gaji_bulanan',
                  'u_gaji_tahunan','u_omzet_tahun'];
    for (var j = 0; j < fields.length; j++) {
        var f = document.getElementById(fields[j]);
        if (f) f.value = '';
    }

    var mapsLink = document.getElementById('u_maps_link');
    if (mapsLink) { mapsLink.href = '#'; mapsLink.classList.add('disabled'); }
}

// ============================================
// DRAFT LIST
// ============================================
async function renderDraftList() {
    var store = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    var drafts = await getAllFromStore(store);
    var container = document.getElementById('draftList');
    if (!container) return;

    if (drafts.length === 0) {
        container.innerHTML = '<div class="alert alert-info text-center">Belum ada draft. Klik "+ Buat Baru" untuk mulai mengisi.</div>';
        return;
    }

    drafts.sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });

    var html = '';
    for (var i = 0; i < drafts.length; i++) {
        var draft = drafts[i];
        var date = new Date(draft.updatedAt).toLocaleString('id-ID');
        var title, subtitle;
        if (currentMode === 'keluarga') {
            title = (draft.k_kk_nama || 'Draft ' + (i+1)) + ' - ' + (draft.k_no_bangunan || '-');
            subtitle = draft.k_alamat || '-';
        } else {
            title = draft.u_nama || 'Draft ' + (i+1);
            subtitle = draft.u_kegiatan || '-';
        }

        html += '<div class="card mb-2"><div class="card-body"><div class="d-flex justify-content-between align-items-start"><div><h6 class="mb-1 fw-bold">' + title + '</h6><p class="mb-1 text-muted small">' + subtitle + '</p><small class="text-secondary">' + date + '</small></div><div class="btn-group btn-group-sm"><button class="btn btn-primary" onclick="loadDraft(' + draft.id + ')">✏️ Edit</button><button class="btn btn-success" onclick="kirimDraftWA(' + draft.id + ')">📤 WA</button><button class="btn btn-danger" onclick="hapusDraft(' + draft.id + ')">🗑️</button></div></div></div></div>';
    }

    container.innerHTML = html;
}

async function loadDraft(id) {
    var store = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    var draft = await getFromStore(store, id);
    if (!draft) { toast('Draft tidak ditemukan!', 'danger'); return; }

    currentDraftId = id;

    if (currentMode === 'keluarga') {
        showScreen('formKeluarga');
        clearFormKeluarga();

        var keys = Object.keys(draft);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key === 'id' || key === 'updatedAt' || key === 'anggota') continue;
            var el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') el.checked = !!draft[key];
                else el.value = draft[key] || '';
            }
        }

        if (draft.anggota && draft.anggota.length > 0) {
            for (var j = 0; j < draft.anggota.length; j++) {
                tambahAnggota(draft.anggota[j]);
            }
        }

        hitungPengeluaran();
        hitungLuasBangunan();
        hitungLuasTanah();
        toggleDetailUsaha();
        toggleStatusRumah();
        toggleAsetHarga('mobil');
        toggleAsetHarga('motor');
        updateMapsLink('k_gps', 'k_maps_link');

    } else {
        showScreen('formUsaha');
        clearFormUsaha();

        var keys2 = Object.keys(draft);
        for (var k = 0; k < keys2.length; k++) {
            var key2 = keys2[k];
            if (key2 === 'id' || key2 === 'updatedAt') continue;
            var el2 = document.getElementById(key2);
            if (el2) el2.value = draft[key2] || '';
        }

        hitungTotalKaryawan();
        hitungGaji();
        hitungOmzet();
        updateMapsLink('u_gps', 'u_maps_link');
    }

    toast('Draft dimuat!', 'success');
}

async function hapusDraft(id) {
    if (!confirm('Yakin hapus draft ini?')) return;
    var store = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    await deleteFromStore(store, id);
    await renderDraftList();
    await updateDraftCounts();
    toast('Draft dihapus!', 'success');
}

async function updateDraftCounts() {
    var k = await getAllFromStore(STORE_KELUARGA);
    var u = await getAllFromStore(STORE_USAHA);
    var dk = document.getElementById('draftKeluarga');
    var du = document.getElementById('draftUsaha');
    if (dk) dk.textContent = k.length + ' Draft';
    if (du) du.textContent = u.length + ' Draft';
}

// ============================================
// AUTO SAVE
// ============================================
function autoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function() { doAutoSave(); }, 2000);
}

async function doAutoSave() {
    if (!currentMode) return;
    var store = currentMode === 'keluarga' ? STORE_KELUARGA : STORE_USAHA;
    var data = collectData();
    if (currentDraftId) data.id = currentDraftId;

    try {
        var id = await saveToStore(store, data);
        currentDraftId = id;
        await updateDraftCounts();
        toast('💾 Auto-saved', 'info', 1500);
    } catch(e) {
        console.error('Auto-save failed:', e);
    }
}

function simpanDraft() {
    doAutoSave();
    toast('✅ Draft disimpan!', 'success');
}

function collectData() {
    var data = {};
    var prefix = currentMode === 'keluarga' ? 'k_' : 'u_';
    var formId = currentMode === 'keluarga' ? 'formKeluarga' : 'formUsaha';
    var form = document.getElementById(formId);
    if (!form) return data;

    var inputs = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        if (!el.id || el.id.indexOf(prefix) !== 0) continue;
        if (el.type === 'checkbox') data[el.id] = el.checked;
        else if (el.type === 'number') data[el.id] = el.value ? parseFloat(el.value) : '';
        else data[el.id] = el.value;
    }

    if (currentMode === 'keluarga') {
        data.anggota = [];
        var cards = document.querySelectorAll('.anggota-item');
        for (var j = 0; j < cards.length; j++) {
            var idx = cards[j].dataset.index;
            data.anggota.push({
                nama: val('anggota_nama_' + idx),
                nik: val('anggota_nik_' + idx),
                jk: val('anggota_jk_' + idx),
                umur: val('anggota_umur_' + idx),
                pekerjaan: val('anggota_pekerjaan_' + idx),
                status: val('anggota_status_' + idx)
            });
        }
    }

    return data;
}

function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
}

// ============================================
// CALCULATIONS
// ============================================
function formatRp(num) {
    if (!num || isNaN(num)) return 'Rp 0';
    return 'Rp ' + parseFloat(num).toLocaleString('id-ID');
}

function hitungPengeluaran() {
    var m = parseFloat(val('k_makanan_minggu')) || 0;
    var n = parseFloat(val('k_nonmakanan_bulan')) || 0;
    var r = parseFloat(val('k_rutin_tahun')) || 0;
    var mt = m * 52;
    var nt = n * 12;
    var total = mt + nt + r;

    var e1 = document.getElementById('k_makanan_tahun');
    var e2 = document.getElementById('k_nonmakanan_tahun');
    var e3 = document.getElementById('k_total_pengeluaran');
    if (e1) e1.value = formatRp(mt);
    if (e2) e2.value = formatRp(nt);
    if (e3) e3.value = formatRp(total);
}

function hitungLuasBangunan() {
    var p = parseFloat(val('k_p_bangunan')) || 0;
    var l = parseFloat(val('k_l_bangunan')) || 0;
    var el = document.getElementById('k_luas_bangunan');
    if (el) el.value = (p * l).toLocaleString('id-ID') + ' m²';
}

function hitungLuasTanah() {
    var p = parseFloat(val('k_p_tanah')) || 0;
    var l = parseFloat(val('k_l_tanah')) || 0;
    var el = document.getElementById('k_luas_tanah');
    if (el) el.value = (p * l).toLocaleString('id-ID') + ' m²';
}

function hitungTotalKaryawan() {
    var p = parseInt(val('u_karyawan_pria')) || 0;
    var w = parseInt(val('u_karyawan_wanita')) || 0;
    var el = document.getElementById('u_karyawan_total');
    if (el) el.value = (p + w).toLocaleString('id-ID') + ' orang';
}

function hitungGaji() {
    var h = parseFloat(val('u_gaji_harian')) || 0;
    var e1 = document.getElementById('u_gaji_mingguan');
    var e2 = document.getElementById('u_gaji_bulanan');
    var e3 = document.getElementById('u_gaji_tahunan');
    if (e1) e1.value = formatRp(h * 7);
    if (e2) e2.value = formatRp(h * 26);
    if (e3) e3.value = formatRp(h * 26 * 12);
}

function hitungOmzet() {
    var b = parseFloat(val('u_omzet_bulan')) || 0;
    var el = document.getElementById('u_omzet_tahun');
    if (el) el.value = formatRp(b * 12);
}

function toggleDetailUsaha() {
    var v = val('k_ada_usaha');
    var el = document.getElementById('detailUsahaKeluarga');
    if (!el) return;
    if (v === 'Ya') el.classList.remove('hidden');
    else el.classList.add('hidden');
}

function toggleStatusRumah() {
    var v = val('k_status_rumah');
    var sewaContainer = document.getElementById('harga_sewa_container');
    var suratContainer = document.getElementById('jenis_surat_container');
    if (sewaContainer) {
        if (v === 'Kontrak/Sewa') sewaContainer.classList.remove('hidden');
        else sewaContainer.classList.add('hidden');
    }
    if (suratContainer) {
        if (v === 'Milik Sendiri') suratContainer.classList.remove('hidden');
        else suratContainer.classList.add('hidden');
    }
}

function toggleAsetHarga(jenis) {
    var checkbox = document.getElementById('k_aset_' + jenis);
    var container = document.getElementById('harga_' + jenis + '_container');
    if (!checkbox || !container) return;
    if (checkbox.checked) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

// ============================================
// ANGGOTA KELUARGA
// ============================================
function tambahAnggota(data) {
    anggotaCount++;
    var idx = anggotaCount;
    var container = document.getElementById('anggotaContainer');
    if (!container) return;

    var nama = data && data.nama ? data.nama : '';
    var nik = data && data.nik ? data.nik : '';
    var jk = data && data.jk ? data.jk : '';
    var umur = data && data.umur ? data.umur : '';
    var pekerjaan = data && data.pekerjaan ? data.pekerjaan : '';
    var status = data && data.status ? data.status : '';

    var selL = jk === 'Laki-laki' ? 'selected' : '';
    var selP = jk === 'Perempuan' ? 'selected' : '';
    var selA = status === 'Anak' ? 'selected' : '';
    var selC = status === 'Cucu' ? 'selected' : '';
    var selO = status === 'Orang Tua' ? 'selected' : '';
    var selM = status === 'Menantu' ? 'selected' : '';
    var selLain = status === 'Lainnya' ? 'selected' : '';

    var div = document.createElement('div');
    div.className = 'member-card anggota-item';
    div.dataset.index = idx;
    div.innerHTML = '<button type="button" class="btn btn-sm btn-outline-danger btn-remove" onclick="this.parentElement.remove(); autoSave();">✕</button>' +
        '<div class="row g-2">' +
        '<div class="col-md-6"><label class="form-label">Nama</label><input type="text" class="form-control" id="anggota_nama_' + idx + '" value="' + nama + '" onchange="autoSave()"></div>' +
        '<div class="col-md-6"><label class="form-label">NIK</label><input type="text" class="form-control" id="anggota_nik_' + idx + '" maxlength="16" value="' + nik + '" onchange="autoSave()"></div>' +
        '<div class="col-md-4"><label class="form-label">JK</label><select class="form-select" id="anggota_jk_' + idx + '" onchange="autoSave()">' +
        '<option value="">Pilih</option><option value="Laki-laki" ' + selL + '>Laki-laki</option><option value="Perempuan" ' + selP + '>Perempuan</option></select></div>' +
        '<div class="col-md-4"><label class="form-label">Umur</label><input type="number" class="form-control" id="anggota_umur_' + idx + '" value="' + umur + '" onchange="autoSave()"></div>' +
        '<div class="col-md-4"><label class="form-label">Status</label><select class="form-select" id="anggota_status_' + idx + '" onchange="autoSave()">' +
        '<option value="">Pilih</option><option value="Anak" ' + selA + '>Anak</option><option value="Cucu" ' + selC + '>Cucu</option>' +
        '<option value="Orang Tua" ' + selO + '>Orang Tua</option><option value="Menantu" ' + selM + '>Menantu</option>' +
        '<option value="Lainnya" ' + selLain + '>Lainnya</option></select></div>' +
        '<div class="col-12"><label class="form-label">Pekerjaan</label><input type="text" class="form-control" id="anggota_pekerjaan_' + idx + '" value="' + pekerjaan + '" onchange="autoSave()"></div>' +
        '</div>';
    container.appendChild(div);
    autoSave();
}

// ============================================
// GPS & MAPS
// ============================================
function getGPS(inputId, linkId) {
    if (!inputId) inputId = 'k_gps';
    if (!linkId) linkId = 'k_maps_link';

    var statusEl = document.getElementById('gpsStatus');
    if (statusEl) { statusEl.textContent = 'Mencari lokasi...'; statusEl.className = 'gps-status waiting'; }

    if (!navigator.geolocation) {
        if (statusEl) { statusEl.textContent = 'Geolocation tidak didukung'; statusEl.className = 'gps-status error'; }
        toast('Geolocation tidak didukung!', 'danger');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var coords = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
            var inp = document.getElementById(inputId);
            if (inp) inp.value = coords;
            updateMapsLink(inputId, linkId);
            if (statusEl) { statusEl.textContent = 'Lokasi: ' + coords; statusEl.className = 'gps-status ok'; }
            toast('GPS berhasil!', 'success');
            autoSave();
        },
        function(err) {
            var msg = 'Gagal mengambil lokasi';
            if (err.code === 1) msg = 'Izin lokasi ditolak';
            else if (err.code === 2) msg = 'Lokasi tidak tersedia';
            else if (err.code === 3) msg = 'Timeout';
            if (statusEl) { statusEl.textContent = msg; statusEl.className = 'gps-status error'; }
            toast(msg, 'danger');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function updateMapsLink(inputId, linkId) {
    var inp = document.getElementById(inputId);
    var link = document.getElementById(linkId);
    if (inp && link && inp.value) {
        link.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(inp.value);
        link.classList.remove('disabled');
    }
}

// ============================================
// WHATSAPP
// ============================================
function kirimWA_Keluarga() {
    var data = collectData();
    var msg = '*KUISIONER SENSUS EKONOMI 2026 - KELUARGA*%0A%0A';
    msg += '*📍 DATA BANGUNAN*%0A';
    msg += 'No Bangunan: ' + (data.k_no_bangunan || '-') + '%0A';
    msg += 'No Urut KK: ' + (data.k_no_urut || '-') + '%0A';
    msg += 'GPS: ' + (data.k_gps || '-') + '%0A';
    msg += 'Alamat: ' + (data.k_alamat || '-') + '%0A';
    msg += 'No KK: ' + (data.k_no_kk || '-') + '%0A';
    msg += 'WA: ' + (data.k_wa || '-') + '%0A%0A';

    msg += '*👤 KEPALA KELUARGA*%0A';
    msg += 'Nama: ' + (data.k_kk_nama || '-') + '%0A';
    msg += 'NIK: ' + (data.k_kk_nik || '-') + '%0A';
    msg += 'Tgl Lahir: ' + (data.k_kk_tgl_lahir || '-') + '%0A';
    msg += 'JK: ' + (data.k_kk_jk || '-') + '%0A';
    msg += 'Pendidikan: ' + (data.k_kk_pendidikan || '-') + '%0A';
    msg += 'Pekerjaan: ' + (data.k_kk_pekerjaan || '-') + '%0A';
    msg += 'Status Kawin: ' + (data.k_kk_status_kawin || '-') + '%0A%0A';

    if (data.k_pasangan_nama) {
        msg += '*💑 PASANGAN*%0A';
        msg += 'Nama: ' + data.k_pasangan_nama + '%0A';
        msg += 'Pekerjaan: ' + (data.k_pasangan_pekerjaan || '-') + '%0A%0A';
    }

    msg += '*💰 DATA EKONOMI*%0A';
    msg += 'Gaji/Bulan: ' + formatRp(data.k_gaji) + '%0A';
    msg += 'Listrik: ' + (data.k_listrik || '-') + '%0A';
    msg += 'Internet: ' + (data.k_internet || '-') + '%0A';
    msg += 'No Meter: ' + (data.k_no_meter || '-') + '%0A';
    msg += 'Daya: ' + (data.k_daya || '-') + ' VA%0A%0A';

    msg += '*💸 PENGELUARAN*%0A';
    msg += 'Makanan/Minggu: ' + formatRp(data.k_makanan_minggu) + '%0A';
    msg += 'Non-Makanan/Bulan: ' + formatRp(data.k_nonmakanan_bulan) + '%0A';
    msg += 'Rutin/Tahun: ' + formatRp(data.k_rutin_tahun) + '%0A';
    msg += '*Total: ' + (document.getElementById('k_total_pengeluaran') ? document.getElementById('k_total_pengeluaran').value : '-') + '*%0A%0A';

    msg += '*🏡 RUMAH & LAHAN*%0A';
    msg += 'Status: ' + (data.k_status_rumah || '-') + '%0A';
    msg += 'Luas Bangunan: ' + (document.getElementById('k_luas_bangunan') ? document.getElementById('k_luas_bangunan').value : '-') + '%0A';
    msg += 'Luas Tanah: ' + (document.getElementById('k_luas_tanah') ? document.getElementById('k_luas_tanah').value : '-') + '%0A%0A';

    msg += '*🚗 ASET*%0A';
    var aset = [];
    if (data.k_aset_mobil) aset.push('Mobil');
    if (data.k_aset_motor) aset.push('Motor');
    if (data.k_aset_sepeda) aset.push('Sepeda');
    if (data.k_aset_tv) aset.push('TV');
    if (data.k_aset_kulkas) aset.push('Kulkas');
    if (data.k_aset_ac) aset.push('AC');
    if (data.k_aset_laptop) aset.push('Laptop');
    if (data.k_aset_hewan) aset.push('Ternak');
    if (data.k_aset_lainnya) aset.push('Lainnya');
    msg += (aset.length > 0 ? aset.join(', ') : 'Tidak ada') + '%0A%0A';

    if (data.anggota && data.anggota.length > 0) {
        msg += '*👨‍👩‍👧‍👦 ANGGOTA (' + data.anggota.length + ' orang)*%0A';
        for (var i = 0; i < data.anggota.length; i++) {
            var a = data.anggota[i];
            msg += (i+1) + '. ' + (a.nama || '-') + ' (' + (a.status || '-') + ', ' + (a.umur || '-') + ' th, ' + (a.pekerjaan || '-') + ')%0A';
        }
        msg += '%0A';
    }

    msg += '*💡 PENGELUARAN LISTRIK & INTERNET*%0A';
    msg += 'Pengeluaran Listrik/Bulan: ' + formatRp(data.k_pengeluaran_listrik) + '%0A';
    msg += 'Pengeluaran WiFi/Internet/Bulan: ' + formatRp(data.k_pengeluaran_internet) + '%0A%0A';

    msg += '*🏡 RUMAH & TANAH - DETAIL*%0A';
    msg += 'Status: ' + (data.k_status_rumah || '-') + '%0A';
    if (data.k_status_rumah === 'Kontrak/Sewa') {
        msg += 'Harga Sewa/Bulan: ' + formatRp(data.k_harga_sewa) + '%0A';
    }
    if (data.k_status_rumah === 'Milik Sendiri') {
        msg += 'Jenis Surat: ' + (data.k_jenis_surat || '-') + '%0A';
    }
    msg += 'Harga Rumah Saat Ini: ' + formatRp(data.k_harga_rumah) + '%0A';
    msg += 'Harga Tanah Saat Ini: ' + formatRp(data.k_harga_tanah) + '%0A%0A';

    msg += '*🚗 ASET - NILAI*%0A';
    if (data.k_aset_mobil) msg += 'Nilai Mobil: ' + formatRp(data.k_harga_mobil) + '%0A';
    if (data.k_aset_motor) msg += 'Nilai Motor: ' + formatRp(data.k_harga_motor) + '%0A';
    msg += '%0A';

    msg += '*🏪 USAHA KELUARGA*%0A';
    msg += 'Ada Usaha: ' + (data.k_ada_usaha || '-') + '%0A';
    if (data.k_ada_usaha === 'Ya') {
        msg += 'Jenis: ' + (data.k_usaha_jenis || '-') + '%0A';
        msg += 'Lokasi: ' + (data.k_usaha_lokasi || '-') + '%0A';
        msg += 'Pekerja: ' + (data.k_usaha_pekerja || '-') + '%0A';
        msg += 'Biaya Produksi/Bulan: ' + formatRp(data.k_biaya_produksi) + '%0A';
        msg += 'Biaya Operasional/Bulan: ' + formatRp(data.k_biaya_operasional) + '%0A';
        msg += 'Omzet/Bulan: ' + formatRp(data.k_omzet_bulan) + '%0A';
    }

    msg += '%0A---%0A*Desa Sukadamai - SE2026*%0A';
    msg += 'Tgl: ' + new Date().toLocaleString('id-ID');

    window.open('https://wa.me/' + WA_NUMBER + '?text=' + msg, '_blank');
}

function kirimWA_Usaha() {
    var data = collectData();
    var msg = '*KUISIONER SENSUS EKONOMI 2026 - USAHA*%0A%0A';
    msg += '*🏢 IDENTITAS*%0A';
    msg += 'Nama: ' + (data.u_nama || '-') + '%0A';
    msg += 'WA: ' + (data.u_wa || '-') + '%0A';
    msg += 'NIB: ' + (data.u_nib || '-') + '%0A';
    msg += 'GPS: ' + (data.u_gps || '-') + '%0A';
    msg += 'Alamat: ' + (data.u_alamat || '-') + '%0A%0A';

    msg += '*👤 PENGUSAHA*%0A';
    msg += 'Nama: ' + (data.u_pengusaha || '-') + '%0A';
    msg += 'JK: ' + (data.u_jk || '-') + '%0A';
    msg += 'NIK: ' + (data.u_nik || '-') + '%0A';
    msg += 'Umur: ' + (data.u_umur || '-') + ' th%0A%0A';

    msg += '*🏭 KEGIATAN*%0A';
    msg += 'Usaha: ' + (data.u_kegiatan || '-') + '%0A';
    msg += 'Produksi: ' + (data.u_produksi || '-') + ' ' + (data.u_satuan || '') + '%0A%0A';

    msg += '*👷 KARYAWAN*%0A';
    msg += 'Pria: ' + (data.u_karyawan_pria || 0) + '%0A';
    msg += 'Wanita: ' + (data.u_karyawan_wanita || 0) + '%0A';
    msg += '*Total: ' + (document.getElementById('u_karyawan_total') ? document.getElementById('u_karyawan_total').value : '-') + '*%0A%0A';

    msg += '*💰 GAJI*%0A';
    msg += 'Harian: ' + formatRp(data.u_gaji_harian) + '%0A';
    msg += 'Mingguan: ' + (document.getElementById('u_gaji_mingguan') ? document.getElementById('u_gaji_mingguan').value : '-') + '%0A';
    msg += 'Bulanan: ' + (document.getElementById('u_gaji_bulanan') ? document.getElementById('u_gaji_bulanan').value : '-') + '%0A';
    msg += '*Tahunan: ' + (document.getElementById('u_gaji_tahunan') ? document.getElementById('u_gaji_tahunan').value : '-') + '*%0A%0A';

    msg += '*📊 BIAYA & OMZET*%0A';
    msg += 'Biaya Produksi/Bulan: ' + formatRp(data.u_biaya_produksi) + '%0A';
    msg += 'Biaya Operasional/Bulan: ' + formatRp(data.u_biaya_operasional) + '%0A';
    msg += 'Omzet/Bulan: ' + formatRp(data.u_omzet_bulan) + '%0A';
    msg += '*Omzet/Tahun: ' + (document.getElementById('u_omzet_tahun') ? document.getElementById('u_omzet_tahun').value : '-') + '*%0A';

    msg += '%0A---%0A*Desa Sukadamai - SE2026*%0A';
    msg += 'Tgl: ' + new Date().toLocaleString('id-ID');

    window.open('https://wa.me/' + WA_NUMBER + '?text=' + msg, '_blank');
}

async function kirimDraftWA(id) {
    await loadDraft(id);
    if (currentMode === 'keluarga') kirimWA_Keluarga();
    else kirimWA_Usaha();
}

// ============================================
// UTILS
// ============================================
function resetForm() {
    if (!confirm('Yakin reset form?')) return;
    if (currentMode === 'keluarga') clearFormKeluarga();
    else clearFormUsaha();
    toast('Form direset!', 'info');
}

function toast(message, type, duration) {
    duration = duration || 3000;
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var t = document.createElement('div');
    t.className = 'toast align-items-center text-white bg-' + type + ' border-0 show';
    t.innerHTML = '<div class="d-flex"><div class="toast-body">' + message + '</div></div>';
    container.appendChild(t);
    setTimeout(function() { t.remove(); }, duration);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initDB();
        await updateDraftCounts();
        console.log('SE2026 ready');
    } catch(e) {
        console.error('Init error:', e);
        toast('Gagal init database!', 'danger');
    }
});
