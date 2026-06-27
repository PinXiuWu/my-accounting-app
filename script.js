// 1. 設定 Google 後台連線網址
const GAS_URL = "https://script.google.com/macros/s/AKfycbxXry9UVvQIrdZq63_2xSXizF36e2DJdHwF6Ehp79-VxYUGG0kdcqoijm_KQofibR9HNg/exec";

// 預設分類選單
const CATEGORIES = {
    expense: ["飲食", "交通", "服飾", "住家", "學習", "休閒娛樂", "購物", "醫療"],
    income: ["薪資", "股息", "利息", "副業", "獎金", "中獎", "投資獲利", "退貨", "保險"    ],
    transfer: ["帳戶戶轉", "繳信用卡費", "代墊"]
};

// 儲存目前所有帳務資料
let allRecords = [];

// 網頁初始化載入
window.addEventListener('DOMContentLoaded', () => {
    initApp();
    fetchRecords();
});

// 初始化介面與事件綁定
function initApp() {
    // 設定預設日期為今天
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
    
    // 設定預設月份標題
    const now = new Date();
    document.getElementById('currentMonthYear').innerText = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;

    // 表單展開/收合
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    const manualFormContainer = document.getElementById('manualFormContainer');
    const formArrowIcon = document.getElementById('formArrowIcon');
    
    toggleFormBtn.addEventListener('click', () => {
        manualFormContainer.classList.toggle('hidden');
        formArrowIcon.classList.toggle('rotate-180');
    });

    // 交易類型切換 (支出/收入/移轉)
    const typeBtns = {
        expense: document.getElementById('typeExpenseBtn'),
        income: document.getElementById('typeIncomeBtn'),
        transfer: document.getElementById('typeTransferBtn')
    };
    
    Object.keys(typeBtns).forEach(type => {
        typeBtns[type].addEventListener('click', () => {
            document.getElementById('txType').value = type;
            updateTypeButtons(type, typeBtns);
            updateCategorySelect(type);
        });
    });

    // 初始載入分類
    updateCategorySelect('expense');

    // 金額輸入框即時計算公式 (例如輸入 100+50)
    const txAmountInput = document.getElementById('txAmount');
    const calcPreview = document.getElementById('calcPreview');
    
    txAmountInput.addEventListener('input', () => {
        const val = txAmountInput.value.trim();
        if (/^[0-9+\-*/().\s]+$/.test(val) && (val.includes('+') || val.includes('-') || val.includes('*') || val.includes('/'))) {
            try {
                const res = Function(`"use strict"; return (${val})`)();
                if (!isNaN(res) && isFinite(res) && res >= 0) {
                    calcPreview.innerText = `= ${Math.round(res * 100) / 100}`;
                    calcPreview.classList.remove('hidden');
                    return;
                }
            } catch (e) {}
        }
        calcPreview.classList.add('hidden');
    });

    // 表單送出監聽
    document.getElementById('transactionForm').addEventListener('submit', handleFormSubmit);
}

// 更新按鈕樣式
function updateTypeButtons(activeType, btns) {
    Object.keys(btns).forEach(type => {
        if (type === activeType) {
            btns[type].className = `flex-1 py-2 rounded-lg transition-all text-center bg-white shadow-sm ${type === 'income' ? 'text-emerald-600' : type === 'transfer' ? 'text-blue-600' : 'text-rose-600'}`;
        } else {
            btns[type].className = "flex-1 py-2 rounded-lg transition-all text-center text-slate-400 hover:text-slate-600";
        }
    });
    
    // 同步更改儲存按鈕顏色
    const submitBtn = document.getElementById('submitBtn');
    if (activeType === 'income') {
        submitBtn.className = "w-full py-4 text-white rounded-xl text-sm font-black shadow-xl active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-700";
    } else if (activeType === 'transfer') {
        submitBtn.className = "w-full py-4 text-white rounded-xl text-sm font-black shadow-xl active:scale-95 transition-all bg-blue-600 hover:bg-blue-700";
    } else {
        submitBtn.className = "w-full py-4 text-white rounded-xl text-sm font-black shadow-xl active:scale-95 transition-all bg-rose-600 hover:bg-rose-700";
    }
}

// 更新下拉選單分類
function updateCategorySelect(type) {
    const select = document.getElementById('categorySelect');
    select.innerHTML = CATEGORIES[type].map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

// 顯示上方狀態訊息
function showStatus(msg, isError = false) {
    const box = document.getElementById('statusMessage');
    box.innerText = msg;
    box.className = `bg-sky-50 text-sky-700 text-xs py-3 px-4 rounded-xl text-center font-bold animate-in`;
    if (isError) box.className = box.className.replace('bg-sky-50 text-sky-700', 'bg-rose-50 text-rose-700');
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 4000);
}

// 從 Google 試算表抓取歷史紀錄 (GET)
async function fetchRecords() {
    try {
        document.getElementById('recordsContainer').innerHTML = `<div class="text-center text-xs text-slate-400 font-bold py-10">讀取中...</div>`;
        const res = await fetch(GAS_URL);
        allRecords = await res.json();
        renderApp();
    } catch (e) {
        showStatus("無法同步雲端資料庫，請檢查網路或 GAS 設定", true);
        document.getElementById('recordsContainer').innerHTML = `<div class="text-center text-xs text-rose-400 font-bold py-10">讀取失敗</div>`;
    }
}

// 儲存全新帳務到雲端 (POST)
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // 解析金額 (如果輸入 100+50 自動算好數值)
    let amountStr = document.getElementById('txAmount').value.trim();
    let finalAmount = parseFloat(amountStr);
    try {
        const res = Function(`"use strict"; return (${amountStr})`)();
        if (!isNaN(res) && isFinite(res)) finalAmount = Math.round(res * 100) / 100;
    } catch(err) {}

    if (isNaN(finalAmount) || finalAmount <= 0) {
        showStatus("請輸入正確金額", true);
        return;
    }

    const newRecord = {
        date: document.getElementById('txDate').value,
        item: document.getElementById('txDesc').value.trim() || document.getElementById('categorySelect').value,
        amount: finalAmount,
        category: document.getElementById('categorySelect').value,
        type: document.getElementById('txType').value
    };

    showStatus("正同步至 Google 試算表...");
    
    try {
        // 使用 text/plain 技術繞過瀏覽器 CORS 安全限制問題
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(newRecord)
        });
        
        const result = await response.json();
        if (result.status === "success") {
            showStatus(" 記帳成功！已安全儲存至雲端");
            // 表單重設
            document.getElementById('txDesc').value = "";
            document.getElementById('txAmount').value = "";
            document.getElementById('calcPreview').classList.add('hidden');
            // 重新載入最新帳目明細
            fetchRecords();
        }
    } catch (err) {
        showStatus("儲存失敗，但資料可能已寫入，請重新編譯平台", true);
    }
}

// 計算並將資料畫在手機網頁畫面上
function renderApp() {
    let totalIncome = 0;
    let totalExpense = 0;
    const container = document.getElementById('recordsContainer');
    
    if (allRecords.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-slate-300 py-10">目前尚無任何對應明細</div>`;
        return;
    }

    // 計算收支
    allRecords.forEach(r => {
        const amt = parseFloat(r.amount) || 0;
        if (r.type === 'income') totalIncome += amt;
        if (r.type === 'expense') totalExpense += amt;
    });

    document.getElementById('totalIncome').innerText = `$${totalIncome.toLocaleString()}`;
    document.getElementById('totalExpense').innerText = `$${totalExpense.toLocaleString()}`;
    document.getElementById('itemsCountText').innerText = `本月共 ${allRecords.length} 筆明細`;

    // 生成卡片清單 HTML
    container.innerHTML = allRecords.map(r => {
        const isInc = r.type === 'income';
        const isTfr = r.type === 'transfer';
        const colorClass = isInc ? 'text-emerald-600' : isTfr ? 'text-blue-600' : 'text-rose-600';
        const sign = isInc ? '+' : isTfr ? '' : '-';
        
        return `
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:border-slate-200">
                <div class="flex flex-col gap-1">
                    <span class="text-sm font-black text-slate-800">${r.item}</span>
                    <div class="flex gap-2 text-[10px] font-bold text-slate-400">
                        <span class="bg-slate-100 px-2 py-0.5 rounded-md">${r.category}</span>
                        <span>${r.date}</span>
                    </div>
                </div>
                <span class="text-base font-black ${colorClass}">${sign}$${parseFloat(r.amount).toLocaleString()}</span>
            </div>
        `;
    }).join('');
}
