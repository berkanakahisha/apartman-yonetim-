// ---------------------------------------------------
//  APARTMAN YÖNETİMİ – MUHASEBE MODÜLLÜ SÜRÜM
// ---------------------------------------------------

const STORAGE_KEY = "apartmanYonetim_v2";

// Veriler
let residents = [];
let expenses = []; // 🔹 Yeni: gider listesi
let currentRole = null;

// Kullanıcılar (Rol Sistemi)
const users = [
    { username: "yonetici", password: "6161", role: "admin" },
    { username: "denetci", password: "1234", role: "viewer" }
];

// Toplamları hafızada tutmak (gelir hesapları için)
let summaryTotals = {
    totalMonthly: 0,
    totalPaid: 0,
    totalRemaining: 0
};

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

// Seçili ayı "YYYY-MM" formatında verir
function getSelectedMonthKey() {
    const input = document.getElementById("monthSelect");
    return input ? (input.value || "") : "";
}

// Ay label (Örn: "2025-12" → "Aralık 2025")
function monthKeyToLabel(key) {
    if (!key) return "";
    const [year, month] = key.split("-");
    const m = [
        "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
        "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
    ];
    const idx = Number(month) - 1;
    return (m[idx] || "") + " " + year;
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
        if (Array.isArray(obj.expenses)) {
            expenses = obj.expenses;
        }
    } catch (e) {
        console.error("Veri okunamadı:", e);
    }
}

// ----------------------------------
// Veri kaydetme
// ----------------------------------
function saveData() {
    const obj = { residents, expenses };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// ----------------------------------
// TABLOYU YENİDEN ÇİZ (DAİRELER)
// ----------------------------------
function renderTable() {
    const tbody = document.getElementById("residentTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    let totalMonthly = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    const monthKey = getSelectedMonthKey();

    residents.forEach((r) => {
        const monthly = Number(r.monthlyFee || 0);

        // 🔹 Çok ayılı ödeme desteği:
        let paid = 0;
        if (r.payments && r.payments[monthKey]) {
            paid = Number(r.payments[monthKey].paid || 0);
        } else {
            // Eski sürümle uyumluluk (tek alanlı)
            paid = Number(r.paidThisMonth || 0);
        }

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

        const historyBtn = document.createElement("button");
        historyBtn.className = "icon-btn history-btn";
        historyBtn.title = "Ödeme Geçmişi";
        historyBtn.textContent = "📅";
        historyBtn.addEventListener("click", () => openHistoryModal(r.id));

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

        tdActions.appendChild(historyBtn);
        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    // Toplam hesaplar
    summaryTotals = { totalMonthly, totalPaid, totalRemaining };

    document.getElementById("summaryMonthlyFee").textContent =
        formatMoney(totalMonthly);
    document.getElementById("summaryPaid").textContent =
        formatMoney(totalPaid);
    document.getElementById("summaryRemaining").textContent =
        formatMoney(totalRemaining);

    // Denetçi ise butonlar gizlenecek (yeniden çizimde)
    if (currentRole === "viewer") disableAdminFeatures();

    // 💰 Gelir–gider özetini de yenile
    renderExpenses();
}

// ----------------------------------
// GELİR – GİDER TABLOSU
// ----------------------------------
function renderExpenses() {
    const tbody = document.getElementById("expenseTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const monthKey = getSelectedMonthKey();
    let totalExpense = 0;

    expenses
        .filter(e => !monthKey || (e.date && e.date.startsWith(monthKey)))
        .forEach(e => {
            const tr = document.createElement("tr");

            const tdDate = document.createElement("td");
            tdDate.textContent = e.date || "";
            tr.appendChild(tdDate);

            const tdCat = document.createElement("td");
            tdCat.textContent = e.category || "";
            tr.appendChild(tdCat);

            const tdDesc = document.createElement("td");
            tdDesc.textContent = e.description || "";
            tr.appendChild(tdDesc);

            const tdAmount = document.createElement("td");
            tdAmount.className = "amount";
            tdAmount.textContent = formatMoney(e.amount);
            tr.appendChild(tdAmount);

            totalExpense += Number(e.amount || 0);

            const tdActions = document.createElement("td");
            tdActions.className = "actions";

            const editBtn = document.createElement("button");
            editBtn.className = "icon-btn expense-edit-btn";
            editBtn.textContent = "✎";
            editBtn.title = "Gideri düzenle";
            editBtn.addEventListener("click", () => openEditExpenseModal(e.id));

            const delBtn = document.createElement("button");
            delBtn.className = "icon-btn danger expense-delete-btn";
            delBtn.textContent = "🗑";
            delBtn.title = "Gideri sil";
            delBtn.addEventListener("click", () => deleteExpense(e.id));

            tdActions.appendChild(editBtn);
            tdActions.appendChild(delBtn);

            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });

    const incomeEl = document.getElementById("summaryIncome");
    const expenseEl = document.getElementById("summaryExpense");
    const netEl = document.getElementById("summaryNet");

    const income = summaryTotals.totalPaid || 0;
    const net = income - totalExpense;

    if (incomeEl) incomeEl.textContent = formatMoney(income);
    if (expenseEl) expenseEl.textContent = formatMoney(totalExpense);
    if (netEl) {
        netEl.textContent = formatMoney(net);
        netEl.parentElement.classList.toggle("negative-text", net < 0);
        netEl.parentElement.classList.toggle("positive-text", net >= 0);
    }

    if (currentRole === "viewer") disableAdminFeatures();
}

// ----------------------------------
// Yeni kullanıcı ekle
// ----------------------------------
function addResident(data, paymentForCurrentMonth) {
    const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const monthKey = getSelectedMonthKey();
    const payments = {};

    if (paymentForCurrentMonth > 0 && monthKey) {
        payments[monthKey] = { paid: paymentForCurrentMonth };
    }

    residents.push({ id, ...data, payments });
    saveData();
    renderTable();
}

// ----------------------------------
// Güncelle
// ----------------------------------
function updateResident(id, data, paymentForCurrentMonth) {
    const idx = residents.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const monthKey = getSelectedMonthKey();
    const existing = residents[idx];
    const payments = { ...(existing.payments || {}) };

    if (monthKey) {
        payments[monthKey] = { paid: paymentForCurrentMonth };
    }

    residents[idx] = { ...existing, ...data, payments };
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
// ÖDEME GEÇMİŞİ MODALI
// ----------------------------------
function openHistoryModal(id) {
    const r = residents.find((x) => x.id === id);
    if (!r) return;

    const titleEl = document.getElementById("historyModalTitle");
    const listEl = document.getElementById("historyList");

    if (!titleEl || !listEl) return;

    titleEl.textContent = `${r.flatNo} - ${r.fullName} | Ödeme Geçmişi`;
    listEl.innerHTML = "";

    const payments = r.payments || {};

    const entries = Object.entries(payments).sort((a, b) => {
        // tarih string kıyaslama (YYYY-MM)
        if (a[0] < b[0]) return 1;
        if (a[0] > b[0]) return -1;
        return 0;
    });

    if (!entries.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.textContent = "Bu kullanıcı için henüz kayıtlı ödeme bulunmuyor.";
        tr.appendChild(td);
        listEl.appendChild(tr);
    } else {
        entries.forEach(([monthKey, info]) => {
            const tr = document.createElement("tr");

            const tdMonth = document.createElement("td");
            tdMonth.textContent = monthKeyToLabel(monthKey);
            tr.appendChild(tdMonth);

            const monthly = Number(r.monthlyFee || 0);
            const paid = Number(info.paid || 0);
            const remaining = Math.max(monthly - paid, 0);

            const tdMonthly = document.createElement("td");
            tdMonthly.className = "amount";
            tdMonthly.textContent = formatMoney(monthly);
            tr.appendChild(tdMonthly);

            const tdPaid = document.createElement("td");
            tdPaid.className = "amount";
            tdPaid.textContent = formatMoney(paid);
            tr.appendChild(tdPaid);

            const tdRemain = document.createElement("td");
            tdRemain.className = "amount";
            tdRemain.textContent = formatMoney(remaining);
            tr.appendChild(tdRemain);

            listEl.appendChild(tr);
        });
    }

    document.getElementById("historyModal").classList.add("open");
}

function closeHistoryModal() {
    document.getElementById("historyModal").classList.remove("open");
}

// ----------------------------------
// Modallar (DAİRE MODAL)
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

    const monthKey = getSelectedMonthKey();
    let paid = 0;
    if (r.payments && r.payments[monthKey]) {
        paid = Number(r.payments[monthKey].paid || 0);
    } else {
        paid = Number(r.paidThisMonth || 0);
    }

    document.getElementById("residentId").value = r.id;
    document.getElementById("flatNo").value = r.flatNo;
    document.getElementById("fullName").value = r.fullName;
    document.getElementById("monthlyFee").value = r.monthlyFee;
    document.getElementById("paidThisMonth").value = paid;
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
// GİDER MODALI
// ----------------------------------
function openNewExpenseModal() {
    document.getElementById("expenseModalTitle").textContent = "Yeni Gider";
    document.getElementById("expenseId").value = "";
    document.getElementById("expenseDate").value = getSelectedMonthKey()
        ? getSelectedMonthKey() + "-01"
        : "";
    document.getElementById("expenseCategory").value = "";
    document.getElementById("expenseDescription").value = "";
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseModal").classList.add("open");
}

function openEditExpenseModal(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;

    document.getElementById("expenseModalTitle").textContent = "Gideri Düzenle";
    document.getElementById("expenseId").value = e.id;
    document.getElementById("expenseDate").value = e.date || "";
    document.getElementById("expenseCategory").value = e.category || "";
    document.getElementById("expenseDescription").value = e.description || "";
    document.getElementById("expenseAmount").value = e.amount || "";

    document.getElementById("expenseModal").classList.add("open");
}

function closeExpenseModal() {
    document.getElementById("expenseModal").classList.remove("open");
}

function addExpense(data) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    expenses.push({ id, ...data });
    saveData();
    renderExpenses();
}

function updateExpense(id, data) {
    const idx = expenses.findIndex(x => x.id === id);
    if (idx === -1) return;
    expenses[idx] = { ...expenses[idx], ...data };
    saveData();
    renderExpenses();
}

function deleteExpense(id) {
    const e = expenses.find(x => x.id === id);
    const name = e ? `${e.date} - ${e.description}` : "";
    if (!confirm(`${name} kaydını silmek istiyor musunuz?`)) return;
    expenses = expenses.filter(x => x.id !== id);
    saveData();
    renderExpenses();
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

    const monthKey = getSelectedMonthKey();
    const monthLabel = monthKeyToLabel(monthKey);

    doc.setFontSize(16);
    doc.text("Apartman Aidat Raporu", 14, 16);
    doc.setFontSize(11);
    doc.text("Ay: " + monthLabel, 14, 24);

    const body = residents.map((r) => {
        const monthly = Number(r.monthlyFee || 0);

        let paid = 0;
        if (r.payments && r.payments[monthKey]) {
            paid = Number(r.payments[monthKey].paid || 0);
        } else {
            paid = Number(r.paidThisMonth || 0);
        }

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

    doc.save(`Aidat_Raporu_${monthKey || "Ay"}.pdf`);
}

// ----------------------------------
// EXCEL ÇIKTI
// ----------------------------------
function exportExcel() {
    if (!residents.length) {
        alert("Önce en az bir kullanıcı ekleyin.");
        return;
    }
    const monthKey = getSelectedMonthKey();

    const rows = residents.map((r) => {
        const monthly = Number(r.monthlyFee || 0);

        let paid = 0;
        if (r.payments && r.payments[monthKey]) {
            paid = Number(r.payments[monthKey].paid || 0);
        } else {
            paid = Number(r.paidThisMonth || 0);
        }

        const remaining = monthly - paid;

        return {
            "Daire": r.flatNo,
            "İsim": r.fullName,
            "Aidat (₺)": monthly,
            "Ödenen (₺)": paid,
            "Kalan (₺)": remaining,
            "Not": r.note || ""
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aidat");

    XLSX.writeFile(wb, `Aidat_Listesi_${monthKey || "Ay"}.xlsx`);
}

// ----------------------------------
// TÜM VERİLERİ TEMİZLE
// ----------------------------------
function clearAllData() {
    if (!confirm("Tüm veriler (daireler + giderler) silinecek! Emin misiniz?")) return;
    residents = [];
    expenses = [];
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

    // Gider ekleme
    const expBtn = document.getElementById("btnAddExpense");
    if (expBtn) expBtn.style.display = "none";

    // Düzenleme butonları
    document.querySelectorAll(".edit-btn, .expense-edit-btn")
        .forEach(btn => btn.style.display = "none");

    // Silme butonları
    document.querySelectorAll(".delete-btn, .expense-delete-btn, .icon-btn.danger")
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

    if (currentRole === "viewer") {
        disableAdminFeatures();
    }
}

// ----------------------------------
// DOM YÜKLENDİĞİNDE
// ----------------------------------
// ---------------------------------------------------
// YIL GENELİ ÖZETİ HESAPLAMA
// ---------------------------------------------------
function renderYearSummary() {
    const tbody = document.getElementById("yearSummaryTableBody");
    if (!tbody) return;

    const select = document.getElementById("yearSelect");
    const year = select.value;

    tbody.innerHTML = "";

    const months = [
        "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
        "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
    ];

    let yearIncome = 0;
    let yearExpense = 0;

    months.forEach((m, i) => {
        const monthKey = `${year}-${String(i + 1).padStart(2, "0")}`;

        // Aidat toplamı
        let income = 0;
        residents.forEach(r => {
            if (r.payments && r.payments[monthKey]) {
                income += Number(r.payments[monthKey].paid || 0);
            }
        });

        // Gider toplamı
        let expense = 0;
        expenses.forEach(e => {
            if (e.date && e.date.startsWith(monthKey)) {
                expense += Number(e.amount || 0);
            }
        });

        const net = income - expense;

        yearIncome += income;
        yearExpense += expense;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${m}</td>
            <td class="amount">${formatMoney(income)}</td>
            <td class="amount">${formatMoney(expense)}</td>
            <td class="amount">${formatMoney(net)}</td>
        `;

        tbody.appendChild(tr);
    });

    document.getElementById("yearIncome").textContent = formatMoney(yearIncome);
    document.getElementById("yearExpense").textContent = formatMoney(yearExpense);
    document.getElementById("yearNet").textContent = formatMoney(yearIncome - yearExpense);
}

document.addEventListener("DOMContentLoaded", () => {
    // Login olay bağlama
    document.getElementById("loginBtn").addEventListener("click", handleLogin);

    // Ay varsayılan
    const now = new Date();
    const monthInput = document.getElementById("monthSelect");
    if (monthInput) {
        monthInput.value =
            now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
        monthInput.addEventListener("change", () => {
            renderTable();
        });
    }
document.addEventListener("DOMContentLoaded", () => {

    // LOGIN
    document.getElementById("loginBtn").addEventListener("click", handleLogin);

    // AY SEÇİCİYİ AYARLA
    const now = new Date();
    document.getElementById("monthSelect").value =
        now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

    // YIL SEÇİCİYİ AYARLA ← BURAYA EKLE
    const yearSelect = document.getElementById("yearSelect");
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 5; y <= currentYear + 1; y++) {
            const opt = document.createElement("option");
            opt.value = y;
            opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }

        yearSelect.addEventListener("change", renderYearSummary);
    }

    // VERİLERİ YÜKLE
    loadData();
    renderTable();
    renderYearSummary(); // Yıl özeti ilk açılışta hesaplansın

    // Gerisi (butonlar, modal eventleri vs.)
});

    // Veri yükle
    loadData();
    renderTable();

    // Butonlar
    document.getElementById("btnAddResident").addEventListener("click", openNewModal);
    document.getElementById("btnExportPDF").addEventListener("click", exportPDF);
    document.getElementById("btnExportExcel").addEventListener("click", exportExcel);
    document.getElementById("btnClearData").addEventListener("click", clearAllData);

    const addExpBtn = document.getElementById("btnAddExpense");
    if (addExpBtn) {
        addExpBtn.addEventListener("click", openNewExpenseModal);
    }

    // Daire modal kapanış
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);

    // Form gönderme (DAİRE)
    document.getElementById("residentForm").addEventListener("submit", (e) => {
        e.preventDefault();

        const id = document.getElementById("residentId").value || null;

        const data = {
            flatNo: document.getElementById("flatNo").value.trim(),
            fullName: document.getElementById("fullName").value.trim(),
            monthlyFee: Number(document.getElementById("monthlyFee").value || 0),
            note: document.getElementById("note").value.trim()
        };

        const paidAmount = Number(document.getElementById("paidThisMonth").value || 0);

        if (id) updateResident(id, data, paidAmount);
        else addResident(data, paidAmount);

        closeModal();
    });

    // Daire modal dışına tıklayınca kapat
    document.getElementById("residentModal").addEventListener("click", (e) => {
        if (e.target.id === "residentModal") closeModal();
    });

    // Gider modal kapanış
    document.getElementById("expenseModalCloseBtn").addEventListener("click", closeExpenseModal);

    // Gider form submit
    document.getElementById("expenseForm").addEventListener("submit", (e) => {
        e.preventDefault();

        const id = document.getElementById("expenseId").value || null;
        const data = {
            date: document.getElementById("expenseDate").value,
            category: document.getElementById("expenseCategory").value.trim(),
            description: document.getElementById("expenseDescription").value.trim(),
            amount: Number(document.getElementById("expenseAmount").value || 0)
        };

        if (!data.date) {
            alert("Lütfen gider tarihini girin.");
            return;
        }

        if (id) updateExpense(id, data);
        else addExpense(data);

        closeExpenseModal();
    });

    // Gider modal dışına tıklayınca kapat
    document.getElementById("expenseModal").addEventListener("click", (e) => {
        if (e.target.id === "expenseModal") closeExpenseModal();
    });

    // Geçmiş modal kapatma
    document.getElementById("historyModalCloseBtn").addEventListener("click", closeHistoryModal);
    document.getElementById("historyModal").addEventListener("click", (e) => {
        if (e.target.id === "historyModal") closeHistoryModal();
    });
});
