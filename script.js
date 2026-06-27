// 1. 設定 Google 後台連線網址
const GAS_URL = "https://script.google.com/macros/s/AKfycbxXry9UVvQIrdZq63_2xSXizF36e2DJdHwF6Ehp79-VxYUGG0kdcqoijm_KQofibR9HNg/exec";

// 預設分類選單
const CATEGORIES = {
    expense: ["飲食", "交通", "服飾", "住家", "學習", "休閒娛樂", "購物", "醫療"],
    income: ["薪資", "股息", "利息", "副業", "獎金", "中獎", "投資獲利", "退貨", "保險"],
    transfer: ["帳戶戶轉", "繳信用卡費", "代墊"]
};

// 儲存目前所有帳務資料
let allRecords = [];
let currentTab = 'expense'; // 預設為支出分頁

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

    // ==========================================
    // 1. 分頁切換事件
    // ==========================================
    const tabIncome = document.getElementById('tabIncome');
    const tabExpense = document.getElementById('tabExpense');

    tabIncome.addEventListener('click', () => {
        currentTab = 'income';
        updateTabStyles();
        renderApp();
    });

    tabExpense.addEventListener('click', () => {
        currentTab = 'expense';
        updateTabStyles();
        renderApp();
    });

    function updateTabStyles() {
        if (currentTab === 'income') {
            tabIncome.className = "flex-1 py-4 transition-all border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/30";
            tabExpense.className = "flex-1 py-4 transition-all border-b-2 border-transparent text-slate-400";
        } else {
            tabExpense.className = "flex-1 py-4 transition-all border-b-2 border-rose-500 text-rose-600 bg-rose-50/30";
            tabIncome.className = "flex-1 py-4 transition-all border-b-2 border-transparent text-slate-400";
        }
    }

    // ==========================================
    // 2. AI 掃描 PDF 事件
    // ==========================================
    const aiScanBtn = document.getElementById('aiScanBtn');
    const pdfUpload = document.getElementById('pdfUpload');
    const aiStatus = document.getElementById('aiStatus');

    if (aiScanBtn && pdfUpload) {
        aiScanBtn.addEventListener('click', async () => {
            const file = pdfUpload.files[0];
            if (!file) {
                alert('請選擇 PDF 帳單檔案');
                return;
            }

            aiStatus.classList.remove('hidden');
            aiScanBtn.disabled = true;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result.split(',')[1];
                
                try {
                    const response = await fetch(GAS_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'scanPdf',
                            pdfData: base64Data,
                            password: 'H224855427'
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        if (result.data.amount) document.getElementById('txAmount').value = result.data.amount;
                        if (result.data.item) document.getElementById('txDesc').value = result.data.item;
                        if (result.data.category) {
                            document.getElementById('categorySelect').value = result.data.category;
                        }
                        alert('AI 帳單辨識成功');
                    } else {
                        alert('AI 辨識失敗：' + (result.message || '未知錯誤'));
                    }
                } catch (error) {
                    console.error(error);
                    alert('連線失敗，請檢查網路或後端設定');
                } finally {
                    aiStatus.classList.add('hidden');
                    aiScanBtn.disabled = false;
                }
            };
            reader.readAsDataURL(file);
        });
    }
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
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(newRecord)
        });
        
        const result = await response.json();
        if (result.status === "success") {
            showStatus(" 記帳成功！已安全儲存至雲端");
            document.getElementById('txDesc').value = "";
            document.getElementById('txAmount').value = "";
            document.getElementById('calcPreview').classList.add('hidden');
            fetchRecords();
        }
    } catch (err) {
        showStatus("儲存失敗，但資料可能已寫入，請重新編譯平台", true);
    }
}

// 渲染畫面與資料計算
function renderApp() {
    const container = document.getElementById('recordsContainer');
    if (!container) return;

    const filteredRecords = allRecords.filter(r => r.type === currentTab);

    let tabTotal = 0;
    filteredRecords.forEach(r => {
        const amt = parseFloat(r.amount) || 0;
        tabTotal += amt;
    });

    if (currentTab === 'income') {
        document.getElementById('totalIncome').innerText = `$${tabTotal.toLocaleString()}`;
        document.getElementById('totalExpense').innerText = `$0`;
    } else {
        document.getElementById('totalExpense').innerText = `$${tabTotal.toLocaleString()}`;
        document.getElementById('totalIncome').innerText = `$0`;
    }

    const tabName = currentTab === 'income' ? '收入' : '支出';
    document.getElementById('itemsCountText').innerText = `本月共 ${filteredRecords.length} 筆${tabName}明細`;

    if (filteredRecords.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <p class="text-sm">目前沒有任何${tabName}紀錄</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredRecords.map(r => {
        const isInc = r.type === 'income';
        const isTfr = r.type === 'transfer';
        const colorClass = isInc ? 'text-emerald-600' : isTfr ? 'text-blue-600' : 'text-rose-600';
        const sign = isInc ? '+' : isTfr ? '' : '-';
        
        const cleanDate = r.date ? r.date.split('T')[0] : '';
        
        return `
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:border-slate-200">
                <div class="flex flex-col gap-1">
                    <span class="text-sm font-black text-slate-800">${r.item}</span>
                    <div class="flex gap-2 text-[10px] font-bold text-slate-400">
                        <span class="bg-slate-100 px-2 py-0.5 rounded-md">${cleanDate}</span>
                        <span class="bg-slate-100 px-2 py-0.5 rounded-md">${r.category || '未分類'}</span>
                    </div>
                </div>
                <div class="text-right flex flex-col items-end gap-1">
                    <span class="text-base font-black ${colorClass}">${sign}${(parseFloat(r.amount) || 0).toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
}
