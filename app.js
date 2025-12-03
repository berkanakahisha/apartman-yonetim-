// ---------------------------------------------------
//  BASİT APARTMAN YÖNETİMİ – TAM DÜZENLENMİŞ APP.JS
// ---------------------------------------------------

const STORAGE_KEY = "apartmanYonetim_v1";

// Veriler
let residents = [];
let currentRole = null;

// Kullanıcılar (Rol Sistemi)
const users = [
    { username: "yonetici", password: "6161", role: "admin" },
    { username: "denetci", password: "1234", role: "viewer" }
];

// ----------------------------------
// Yardımcı: Para formatı
// ----------------------------------
function formatMoney(value) {
    const num = Number(value || 0);
    return num.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ----------------------------------
// Veri yükleme
// ----------------------------------
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (Array.isArray(obj.residents)) {
            residents = obj.residents;
        }
    } catch (e) {
        console.error("Veri okunamadı:", e);
    }
}

// ----------------------------------
// Veri kaydetme
// ----------------------------------
function saveData() {
    const obj = { residents };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// ----------------------------------
// TABLOYU YENİDEN ÇİZ
// ----------------------------------
function renderTable() {
    const tbody = document.getElementById("residentTableBody");
    tbody.innerHTML = "";

    let totalMonthly = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    residents.forEach((r) => {
        const monthly = Number(r.monthlyFee || 0);
        const paid = Number(r.paidThisMonth || 0);
        const remaining = Math.max(monthly - paid, 0);

        totalMonthly += monthly;
        totalPaid += paid;
        totalRemaining += remaining;

        const tr = document.createElement("tr");

        // Daire
        const tdFlat = document.createElement("td");
        tdFlat.textContent = r.flatNo;
        tr.appendChild(tdFlat);

        // İsim
        const tdName = document.createElement("td");
        tdName.textContent = r.fullName;
        tr.appendChild(tdName);

        // Aidat
        const tdMonthly = document.createElement("td");
        tdMonthly.className = "amount";
        tdMonthly.textContent = formatMoney(monthly);
        tr.appendChild(tdMonthly);

        // Ödenen
        const tdPaid = document.createElement("td");
        tdPaid.className = "amount";
        tdPaid.textContent = formatMoney(paid);
        tr.appendChild(tdPaid);

        // Kalan
        const tdRemaining = document.createElement("td");
        tdRemaining.className = "amount";
        const badge = document.createElement("span");
        badge.classList.add("badge");

        if (remaining === 0 && (monthly > 0 || paid > 0)) {
            badge.classList.add("positive");
            badge.textContent = "Yok";
        } else if (remaining > 0) {
            badge.classList.add("negative");
            badge.textContent = formatMoney(remaining) + " ₺";
        } else {
            badge.classList.add("neutral");
            badge.textContent = "—";
        }
        tdRemaining.appendChild(badge);
        tr.appendChild(tdRemaining);

        // Not
        const tdNote = document.createElement("td");
        tdNote.textContent = r.note || "";
        tr.appendChild(tdNote);

        // Aksiyonlar
        const tdActions = document.createElement("td");
        tdActions.className = "actions";

        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn edit-btn";
        editBtn.title = "Düzenle";
        editBtn.textContent = "✎";
        editBtn.addEventListener("click", () => openEditModal(r.id));

        const delBtn = document.createElement("button");
        delBtn.className = "icon-btn danger delete-btn";
        delBtn.title = "Sil";
        delBtn.textContent = "🗑";
        delBtn.addEventListener("click", () => deleteResident(r.id));

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    // Toplam hesaplar
    document.getElementById("summaryMonthlyFee").textContent =
        formatMoney(totalMonthly);
    document.getElementById("summaryPaid").textContent =
        formatMoney(totalPaid);
    document.getElementById("summaryRemaining").textContent =
        formatMoney(totalRemaining);

    // Eğer denetçi ise butonlar gizlenecek (yeniden çizimde)
    if (currentRole === "viewer") disableAdminFeatures();
}

// ----------------------------------
// Yeni kullanıcı ekle
// ----------------------------------
function addResident(data) {
    const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    residents.push({ id, ...data });
    saveData();
    renderTable();
}

// ----------------------------------
// Güncelle
// ----------------------------------
function updateResident(id, data) {
    const idx = residents.findIndex((r) => r.id === id);
    if (idx === -1) return;

    residents[idx] = { ...residents[idx], ...data };
    saveData();
    renderTable();
}

// ----------------------------------
// Sil
// ----------------------------------
function deleteResident(id) {
    const r = residents.find((x) => x.id === id);
    const name = r ? `${r.flatNo} - ${r.fullName}` : "";

    if (!confirm(`${name} kaydını silmek istiyor musunuz?`)) return;

    residents = residents.filter((r) => r.id !== id);
    saveData();
    renderTable();
}

// ----------------------------------
// Modallar
// ----------------------------------
function openNewModal() {
    document.getElementById("residentModalTitle").textContent =
        "Yeni Kullanıcı / Daire";

    document.getElementById("residentId").value = "";
    document.getElementById("flatNo").value = "";
    document.getElementById("fullName").value = "";
    document.getElementById("monthlyFee").value = "";
    document.getElementById("paidThisMonth").value = "0";
    document.getElementById("note").value = "";

    openModal();
}

function openEditModal(id) {
    const r = residents.find((x) => x.id === id);
    if (!r) return;

    document.getElementById("residentModalTitle").textContent =
        "Kullanıcı / Daire Düzenle";

    document.getElementById("residentId").value = r.id;
    document.getElementById("flatNo").value = r.flatNo;
    document.getElementById("fullName").value = r.fullName;
    document.getElementById("monthlyFee").value = r.monthlyFee;
    document.getElementById("paidThisMonth").value = r.paidThisMonth || 0;
    document.getElementById("note").value = r.note || "";

    openModal();
}

function openModal() {
    document.getElementById("residentModal").classList.add("open");
}

function closeModal() {
    document.getElementById("residentModal").classList.remove("open");
}

// ----------------------------------
// PDF ÇIKTI
// ----------------------------------
function exportPDF() {
    if (!residents.length) {
        alert("Önce en az bir kullanıcı ekleyin.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const monthLabel = getCurrentMonthLabel();

    doc.setFontSize(16);
    doc.text("Apartman Aidat Raporu", 14, 16);
    doc.setFontSize(11);
    doc.text("Ay: " + monthLabel, 14, 24);

    const body = residents.map((r) => {
        const monthly = Number(r.monthlyFee || 0);
        const paid = Number(r.paidThisMonth || 0);
        const remaining = Math.max(monthly - paid, 0);

        return [
            r.flatNo,
            r.fullName,
            formatMoney(monthly) + " ₺",
            formatMoney(paid) + " ₺",
            formatMoney(remaining) + " ₺",
            (r.note || "").slice(0, 40)
        ];
    });

    doc.autoTable({
        head: [
            ["Daire", "İsim", "Aidat", "Ödenen", "Kalan", "Not"]
        ],
        body,
        startY: 30,
        styles: { fontSize: 9 }
    });

    doc.save(`Aidat_Raporu_${monthLabel}.pdf`);
}

// ----------------------------------
// EXCEL ÇIKTI
// ----------------------------------
function exportExcel() {
    if (!residents.length) {
        alert("Önce en az bir kullanıcı ekleyin.");
        return;
    }
    const monthLabel = getCurrentMonthLabel();

    const rows = residents.map((r) => ({
        "Daire": r.flatNo,
        "İsim": r.fullName,
        "Aidat (₺)": Number(r.monthlyFee),
        "Ödenen (₺)": Number(r.paidThisMonth),
        "Kalan (₺)": Number(r.monthlyFee - r.paidThisMonth),
        "Not": r.note
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aidat");

    XLSX.writeFile(wb, `Aidat_Listesi_${monthLabel}.xlsx`);
}

// ----------------------------------
// Ay formatı
// ----------------------------------
function getCurrentMonthLabel() {
    const input = document.getElementById("monthSelect").value;
    if (!input) return "";
    const [year, month] = input.split("-");
    const m = [
        "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
        "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
    ];
    return m[Number(month) - 1] + " " + year;
}

// ----------------------------------
// TÜM VERİLERİ TEMİZLE
// ----------------------------------
function clearAllData() {
    if (!confirm("Tüm veriler silinecek! Emin misiniz?")) return;
    residents = [];
    saveData();
    renderTable();
}

// ----------------------------------
// YETKİ SİSTEMİ (ADMIN / DENETÇİ)
// ----------------------------------
function disableAdminFeatures() {
    // Yeni daire ekleme
    const addBtn = document.getElementById("btnAddResident");
    if (addBtn) addBtn.style.display = "none";

    // Düzenleme butonları
    document.querySelectorAll(".edit-btn").forEach(btn => btn.style.display = "none");

    // Silme butonları
    document.querySelectorAll(".delete-btn, .icon-btn.danger")
        .forEach(btn => btn.style.display = "none");
}

// ----------------------------------
// LOGIN SİSTEMİ
// ----------------------------------
function handleLogin() {
    const u = document.getElementById("loginUsername").value.trim();
    const p = document.getElementById("loginPassword").value.trim();

    const found = users.find(x => x.username === u && x.password === p);

    if (!found) {
        document.getElementById("loginError").textContent =
            "Hatalı kullanıcı adı veya şifre!";
        return;
    }

    currentRole = found.role;

    // Login ekranını kapat
    document.getElementById("loginScreen").style.display = "none";

    // Eğer görüntüleyici ise bazı özellikleri kapat
    if (currentRole === "viewer") {
        disableAdminFeatures();
    }
}

// ----------------------------------
// DOM YÜKLENDİĞİNDE
// ----------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Login olay bağlama
    document.getElementById("loginBtn").addEventListener("click", handleLogin);

    // Ay varsayılan
    const now = new Date();
    document.getElementById("monthSelect").value =
        now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

    // Veri yükle
    loadData();
    renderTable();

    // Butonlar
    document.getElementById("btnAddResident").addEventListener("click", openNewModal);
    document.getElementById("btnExportPDF").addEventListener("click", exportPDF);
    document.getElementById("btnExportExcel").addEventListener("click", exportExcel);
    document.getElementById("btnClearData").addEventListener("click", clearAllData);

    // Modal kapanış
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);

    // Form gönderme
    document.getElementById("residentForm").addEventListener("submit", (e) => {
        e.preventDefault();

        const id = document.getElementById("residentId").value || null;

        const data = {
            flatNo: document.getElementById("flatNo").value.trim(),
            fullName: document.getElementById("fullName").value.trim(),
            monthlyFee: Number(document.getElementById("monthlyFee").value || 0),
            paidThisMonth: Number(document.getElementById("paidThisMonth").value || 0),
            note: document.getElementById("note").value.trim()
        };

        if (id) updateResident(id, data);
        else addResident(data);

        closeModal();
    });

    // Modal dışına tıklayınca kapat
    document.getElementById("residentModal").addEventListener("click", (e) => {
        if (e.target.id === "residentModal") closeModal();
    });
});
