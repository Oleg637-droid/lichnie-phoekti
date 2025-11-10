document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    //          --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
    // =================================================================
    let cart = [];
    let productCache = [];
    let counterpartyCache = [];
    const CURRENCY = 'KZT';

    let currentTotal = 0;
    let selectedPaymentMode = 'cash';
    let selectedOrganization = null;
    let selectedCounterpartyId = 'none';

    // УДАЛЕНО: window.isWakeWordDetected

    // =================================================================
    //            --- DOM-ЭЛЕМЕНТЫ ---
    // =================================================================

    // --- КАССА ---
    const scanInput = document.getElementById('scan-input');
    const cartTbody = document.getElementById('cart-tbody');
    const cartMessage = document.getElementById('cart-message');
    const totalAmountEl = document.getElementById('total-amount');
    const clearCartBtn = document.getElementById('clear-cart');
    const completeSaleBtn = document.getElementById('complete-sale');
    const productListButtons = document.getElementById('product-list');
    // УДАЛЕНО: voiceInputBtn
    // УДАЛЕНО: voiceStatusEl

    // --- УПРАВЛЕНИЕ (CRUD) ---
    const managementModal = document.getElementById('management-modal');
    const toggleManagementBtn = document.getElementById('toggle-management');
    const crudProductList = document.getElementById('crud-product-list');
    const productForm = document.getElementById('product-form');
    const formMessage = document.getElementById('form-message');
    const apiStatus = document.getElementById('api-status');
    const testApiBtn = document.getElementById('test-api'); 

    // --- РЕДАКТИРОВАНИЕ ---
    const editModal = document.getElementById('edit-modal');
    const editCloseBtn = document.querySelector('.edit-close-btn');
    const editForm = document.getElementById('edit-product-form');
    const editMessage = document.getElementById('edit-form-message');
    const deleteProductBtn = document.getElementById('delete-product-btn');
    const editProductIdEl = document.getElementById('edit-product-id'); 

    // --- БЫСТРОЕ ДОБАВЛЕНИЕ КОЛИЧЕСТВА ---
    const quickAddModal = document.getElementById('quick-add-modal');
    const quickAddForm = document.getElementById('quick-add-form');
    const quickAddCloseBtn = document.querySelector('.quick-add-close-btn');
    const quickAddMessage = document.getElementById('quick-add-message');

    // --- ОПЛАТА ---
    const paymentModal = document.getElementById('payment-modal');
    const paymentCloseBtn = document.querySelector('.payment-close-btn');
    const paymentOptionsGrid = document.getElementById('payment-mode-selection');
    const finalizePaymentBtn = document.getElementById('finalize-payment-btn');
    const paymentDueAmountEl = document.getElementById('payment-due-amount');
    const paymentMessageEl = document.getElementById('payment-message');
    const organizationSelect = document.getElementById('organization-select');

    // --- КОНТРАГЕНТЫ ---
    const counterpartyModal = document.getElementById('counterparty-modal');
    const counterpartyCloseBtn = document.querySelector('.counterparty-close-btn');
    const addCounterpartyBtn = document.getElementById('add-counterparty-btn');
    const counterpartyForm = document.getElementById('counterparty-form');
    const counterpartyMessageEl = document.getElementById('counterparty-message');
    const counterpartySelect = document.getElementById('counterparty-select');

    // --- СМЕШАННАЯ ОПЛАТА ---
    const mixedPaymentBlock = document.getElementById('mixed-payment-block');
    const mixedCashAmountInput = document.getElementById('mixed-cash-amount');
    const mixedSecondModeSelect = document.getElementById('mixed-second-mode');
    const mixedRemainingAmountEl = document.getElementById('mixed-remaining-amount');

    // =================================================================
    //          --- УТИЛИТЫ ---
    // =================================================================

    /** Гарантирует, что все модальные окна скрыты при инициализации скрипта. */
    function hideAllModals() {
        managementModal.style.display = 'none';
        editModal.style.display = 'none';
        quickAddModal.style.display = 'none';
        paymentModal.style.display = 'none';
        counterpartyModal.style.display = 'none';
    }

    /** Форматирует число в валютный формат (KZT). */
    function formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) return `0.00 ${CURRENCY}`;
        const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return `${formatted} ${CURRENCY}`;
    }

    // УДАЛЕНО: speak (Text-to-Speech)
    
    /** Отображение сообщений. */
    window.displayMessage = function(element, message, type = 'info') {
        element.innerHTML = message;
        element.classList.remove('success', 'error', 'info');
        element.classList.add(type);
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 3000);
    }
       
    // УДАЛЕНО: window.showVoiceStatus
    // УДАЛЕНО: window.executeVoiceCommand
    // УДАЛЕНО: window.sendTextToBackend


    // =================================================================
    //          --- ЛОГИКА КАССЫ ---
    // =================================================================

    /** Обновляет список товаров в корзине и пересчитывает итоги. */
    function renderCart() {
        currentTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        currentTotal = parseFloat(currentTotal.toFixed(2));

        if (cart.length === 0) {
            cartTbody.innerHTML = '<tr class="empty-cart-row"><td colspan="4" style="text-align: center; color: #777; padding: 20px;">Чек пуст.</td></tr>';
            totalAmountEl.textContent = formatCurrency(0);
            return;
        }

        cartTbody.innerHTML = cart.map((item, index) => {
            const sum = parseFloat((item.price * item.quantity).toFixed(2));
            const itemQuantity = item.quantity.toFixed(2);
             
            return `
                <tr data-id="${item.id}">
                    <td class="item-name" title="${item.name}">${item.name}</td>
                    <td>
                        <input type="number" min="0.01" step="0.01" value="${itemQuantity}" data-id="${item.id}" class="cart-quantity-input" title="${item.name}">
                    </td>
                    <td style="font-weight: 700;">${formatCurrency(sum)}</td>
                    <td><button class="remove-from-cart-btn" data-id="${item.id}" title="Удалить товар"><i class="fas fa-trash-alt"></i></button></td>
                </tr>
            `;
        }).join('');

        totalAmountEl.textContent = formatCurrency(currentTotal);
    }

    /** Добавляет товар в корзину по ID или SKU с заданным количеством. 
     * @returns {boolean} true при успехе, false при неудаче. */
    function addItemToCart(identifier, quantityRaw = 1.00) {
        const item = productCache.find(p => p.sku === identifier || p.id.toString() === identifier);

        if (!item) {
            displayMessage(cartMessage, `❌ Товар с "${identifier}" не найден.`, 'error');
            return false;
        }

        let quantity = parseFloat(quantityRaw);
        if (isNaN(quantity) || quantity <= 0) {
            displayMessage(cartMessage, `❌ Некорректное количество: ${quantityRaw}.`, 'error');
            return false;
        }
        quantity = parseFloat(quantity.toFixed(2)); 

        const existingItem = cart.find(i => i.id === item.id);

        if (existingItem) {
            existingItem.quantity = parseFloat((existingItem.quantity + quantity).toFixed(2));
            displayMessage(cartMessage, `✅ Количество "${item.name}" увеличено до ${existingItem.quantity}.`, 'success');
        } else {
            cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: quantity
            });
            displayMessage(cartMessage, `✅ "${item.name}" (x${quantity}) добавлен в чек.`, 'success');
        }

        renderCart();
        return true;
    }

    // =================================================================
    //          --- ОБРАБОТЧИКИ КАССЫ И ОПЛАТЫ ---
    // =================================================================

    // 1. Сканирование / Ввод и Поиск/Фильтрация
    scanInput.addEventListener('input', (e) => {
        const scanValue = e.target.value.trim();
         
        if (!scanValue) {
            renderQuickButtons(productCache);
            return;
        }

        const filterText = scanValue.toLowerCase();
         
        const filteredProducts = productCache.filter(p =>
            p.name.toLowerCase().includes(filterText) ||
            p.sku.toLowerCase().includes(filterText) ||
            p.id.toString().includes(filterText)
        );
         
        renderQuickButtons(filteredProducts);
    });
     
    // Событие 'change' для сканирования/Enter
    scanInput.addEventListener('change', (e) => {
        const scanValue = e.target.value.trim();
        e.target.value = ''; 

        if (scanValue) {
            if (addItemToCart(scanValue, 1.00)) {
                renderQuickButtons(productCache);
            }
        }
        scanInput.focus();
    });

    // 2. Изменение количества в корзине
    cartTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('cart-quantity-input')) {
            const id = parseInt(e.target.dataset.id);
            let newQuantity = parseFloat(e.target.value);
             
            if (isNaN(newQuantity) || newQuantity < 0.01) {
                newQuantity = 0;
            } else {
                newQuantity = parseFloat(newQuantity.toFixed(2));
            }
             
            if (newQuantity === 0) {
                cart = cart.filter(item => item.id !== id);
                displayMessage(cartMessage, `Товар удален из чека.`, 'info');
            } else {
                const item = cart.find(item => item.id === id);
                if (item) item.quantity = newQuantity;
            }
            renderCart();
            scanInput.focus();
        }
    });

    // 3. Удаление из корзины (по кнопке)
    cartTbody.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-from-cart-btn');
        if (removeBtn) {
            const id = parseInt(removeBtn.dataset.id);
            cart = cart.filter(item => item.id !== id);
            displayMessage(cartMessage, `Товар удален из чека.`, 'info');
            renderCart();
            scanInput.focus();
        }
    });
     
    // 4. Быстрое добавление кнопкой из Каталога (Открытие Quick-Add Modal)
    productListButtons.addEventListener('click', (e) => {
        const target = e.target.closest('.product-card');
        if (target) {
            const productId = target.dataset.id;
            const product = productCache.find(p => p.id.toString() === productId);
             
            if (!product) return;

            document.getElementById('quick-add-product-name').textContent = product.name;
            document.getElementById('quick-add-product-price').textContent = formatCurrency(product.price);
            document.getElementById('quick-add-product-id').value = productId;
            document.getElementById('quick-add-quantity').value = 1.00;
            quickAddMessage.style.display = 'none';
             
            quickAddModal.style.display = 'flex';
             
            document.getElementById('quick-add-quantity').focus();
        }
    });
     
    // 5. Обработчик формы быстрого добавления в чек
    quickAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
         
        const productId = document.getElementById('quick-add-product-id').value;
        const quantity = document.getElementById('quick-add-quantity').value;
         
        if (addItemToCart(productId, quantity)) {
            quickAddModal.style.display = 'none';
            scanInput.value = '';
            renderQuickButtons(productCache);
            scanInput.focus();
        } else {
            displayMessage(quickAddMessage, 'Ошибка при добавлении товара. Проверьте количество.', 'error');
        }
    });
     
    quickAddCloseBtn.addEventListener('click', () => { quickAddModal.style.display = 'none'; });


    // 6. Очистка чека
    clearCartBtn.addEventListener('click', () => {
        if (cart.length > 0 && confirm('Вы уверены, что хотите очистить весь чек?')) {
            cart = [];
            displayMessage(cartMessage, `Чек очищен.`, 'info');
            renderCart();
            scanInput.focus();
        }
    });
     
    // 7. Открытие модального окна оплаты
    completeSaleBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            displayMessage(cartMessage, "Нельзя завершить продажу: чек пуст!", 'error');
            return;
        }
         
        paymentDueAmountEl.textContent = formatCurrency(currentTotal);
         
        selectedPaymentMode = 'cash';
        mixedPaymentBlock.style.display = 'none';
        mixedCashAmountInput.value = currentTotal.toFixed(2);
        updateMixedPaymentDisplay();
        paymentMessageEl.style.display = 'none';
         
        document.querySelectorAll('.payment-option-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.payment-option-btn[data-mode="cash"]').classList.add('active');


        selectedOrganization = organizationSelect.value;
        counterpartySelect.value = selectedCounterpartyId;
         

        paymentModal.style.display = 'flex';
    });
     
    paymentCloseBtn.addEventListener('click', () => { paymentModal.style.display = 'none'; });


    // 8. Логика пересчета остатка для смешанной оплаты
    function updateMixedPaymentDisplay() {
        let cashPart = parseFloat(mixedCashAmountInput.value) || 0;
         
        if (cashPart < 0) {
            cashPart = 0;
            mixedCashAmountInput.value = 0;
        } else if (cashPart > currentTotal) {
            cashPart = currentTotal;
            mixedCashAmountInput.value = currentTotal.toFixed(2);
        }
         
        const remaining = currentTotal - cashPart;
         
        mixedRemainingAmountEl.textContent = formatCurrency(remaining);
    }
     
    // Обработка кликов по способам оплаты
    paymentOptionsGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.payment-option-btn');
        if (!btn) return;
         
        selectedPaymentMode = btn.dataset.mode;
         
        document.querySelectorAll('.payment-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
         
        if (selectedPaymentMode === 'mixed') {
            mixedPaymentBlock.style.display = 'block';
            mixedCashAmountInput.value = (currentTotal / 2).toFixed(2);
            updateMixedPaymentDisplay();
            mixedCashAmountInput.focus();
        } else {
            mixedPaymentBlock.style.display = 'none';
            mixedCashAmountInput.value = currentTotal.toFixed(2);
        }
        paymentMessageEl.style.display = 'none';
    });

    // Динамический пересчет при вводе наличной части
    mixedCashAmountInput.addEventListener('input', updateMixedPaymentDisplay);
    mixedSecondModeSelect.addEventListener('change', updateMixedPaymentDisplay);


    // 9. Логика завершения продажи (по нажатию "ЗАВЕРШИТЬ ПРОДАЖУ")
    finalizePaymentBtn.addEventListener('click', () => {
        if (!selectedPaymentMode) {
            displayMessage(paymentMessageEl, '❌ Выберите способ оплаты!', 'error');
            return;
        }
         
        const organizationName = organizationSelect.options[organizationSelect.selectedIndex].text;
        const counterpartyName = counterpartySelect.options[counterpartySelect.selectedIndex].text;
         
        let paymentDetails = [{ mode: selectedPaymentMode, amount: currentTotal }];
        let paymentInfo = `Орг: ${organizationName}. Контрагент: ${counterpartyName}. Оплата: ${selectedPaymentMode.toUpperCase()}. Сумма: ${formatCurrency(currentTotal)}.`;
         
        if (selectedPaymentMode === 'mixed') {
            const cashPart = parseFloat(mixedCashAmountInput.value);
            // Получаем оставшуюся часть, используя форматированный текст (более надежно)
            const remainingPart = parseFloat(mixedRemainingAmountEl.textContent.split(' ')[0].replace(/ /g, ''));
            const secondMode = mixedSecondModeSelect.value;
             
            if (cashPart <= 0 || remainingPart < 0.01 || Math.abs(cashPart + remainingPart - currentTotal) > 0.02) {
                displayMessage(paymentMessageEl, '❌ Введите корректные суммы для смешанной оплаты (часть 2 не может быть 0).', 'error');
                return;
            }
             
            paymentDetails = [
                { mode: 'cash', amount: cashPart },
                { mode: secondMode, amount: remainingPart }
            ];
             
            paymentInfo = `Орг: ${organizationName}. Контрагент: ${counterpartyName}. Смешанная: 1) Наличные: ${formatCurrency(cashPart)}; 2) ${secondMode.toUpperCase()}: ${formatCurrency(remainingPart)}.`;
        }

        // --- ФИНАЛИЗАЦИЯ (Имитация отправки данных на бэкенд) ---
        console.log("SALE COMPLETE DATA:", {
            organization_id: organizationSelect.value,
            counterparty_id: counterpartySelect.value,
            total_amount: currentTotal,
            cart_items: cart,
            payment_details: paymentDetails
        });
         
        displayMessage(paymentMessageEl, `✅ Продажа завершена!`, 'success');
         
        // Сброс чека и контрагента
        cart = [];
        renderCart();
        selectedCounterpartyId = 'none';
         
        setTimeout(() => {
            paymentModal.style.display = 'none';
            displayMessage(cartMessage, `✅ Чек закрыт: ${paymentInfo}`, 'success');
            scanInput.focus();
        }, 1500);
    });

    // 10. Логика работы с Контрагентами
     
    addCounterpartyBtn.addEventListener('click', () => {
        paymentModal.style.display = 'none';
        counterpartyModal.style.display = 'flex';
        counterpartyForm.reset();
        counterpartyMessageEl.style.display = 'none';
        document.getElementById('new-counterparty-name').focus();
    });

    counterpartyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
         
        const newCounterparty = {
            name: document.getElementById('new-counterparty-name').value,
            bin: document.getElementById('new-counterparty-bin').value || null,
            phone: document.getElementById('new-counterparty-phone').value || null,
        };
         
        displayMessage(counterpartyMessageEl, '<i class="fas fa-spinner fa-spin"></i> Сохранение...', 'info');

        try {
            const response = await fetch('/api/counterparties/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCounterparty)
            });
             
            if (response.ok) {
                const addedCounterparty = await response.json();
                 
                displayMessage(counterpartyMessageEl, `✅ Контрагент "${newCounterparty.name}" добавлен!`, 'success');
                 
                await fetchCounterparties();
                selectedCounterpartyId = addedCounterparty.id.toString();
                 
                setTimeout(() => {
                    counterpartyModal.style.display = 'none';
                    paymentModal.style.display = 'flex';
                    counterpartySelect.value = selectedCounterpartyId;
                }, 1000);

            } else {
                const errorData = await response.json().catch(() => ({ detail: `Сервер вернул ошибку ${response.status}.` }));
                displayMessage(counterpartyMessageEl, `❌ Ошибка: ${errorData.detail || 'Не удалось сохранить контрагента'}`, 'error');
            }
        } catch (error) {
            displayMessage(counterpartyMessageEl, `❌ Ошибка сети при добавлении: ${error.message}`, 'error');
        }
    });
     
    counterpartyCloseBtn.addEventListener('click', () => {
        counterpartyModal.style.display = 'none';
        paymentModal.style.display = 'flex';
    });

    counterpartySelect.addEventListener('change', (e) => {
        selectedCounterpartyId = e.target.value;
    });


    // =================================================================
    //          --- ЛОГИКА CRUD (Каталог) ---
    // =================================================================

    /** Загружает список контрагентов и рендерит SELECT. */
    async function fetchCounterparties() {
        try {
            const response = await fetch('/api/counterparties/');
            if (!response.ok) throw new Error('Ошибка при получении списка контрагентов');
            counterpartyCache = await response.json();
            renderCounterpartySelect();
        } catch (error) {
            console.error('Ошибка загрузки контрагентов:', error);
            counterpartySelect.innerHTML = '<option value="none">-- Ошибка загрузки --</option>';
        }
    }

    /** Рендерит список контрагентов в SELECT. */
    function renderCounterpartySelect() {
        let optionsHtml = '<option value="none">-- Физическое лицо (Без Контрагента) --</option>';
         
        counterpartyCache.forEach(c => {
            const label = c.bin ? `${c.name} (БИН: ${c.bin})` : c.name;
            const isSelected = c.id.toString() === selectedCounterpartyId;
            optionsHtml += `<option value="${c.id}" ${isSelected ? 'selected' : ''}>${label}</option>`;
        });
         
        counterpartySelect.innerHTML = optionsHtml;
        if (!counterpartyCache.find(c => c.id.toString() === selectedCounterpartyId) && selectedCounterpartyId !== 'none') {
            selectedCounterpartyId = 'none';
        }
    }

    /** Отправка GET-запроса на получение списка товаров. */
    async function fetchProducts() {
        productListButtons.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Загрузка...</p>';
        crudProductList.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Загрузка...</p>';
         
        try {
            const response = await fetch('/api/products/');
            if (!response.ok) throw new Error('Ошибка сети при получении товаров');
             
            const products = await response.json();
            productCache = products;
            renderQuickButtons(products);
            renderCrudList(products);
        } catch (error) {
            const msg = `<p style="color: red; font-weight: bold; text-align: center; padding: 10px;">❌ Ошибка загрузки: ${error.message}. Проверьте API!</p>`;
            productListButtons.innerHTML = msg;
            crudProductList.innerHTML = msg;
        }
    }

    /** Рендеринг кнопок для быстрой продажи. */
    function renderQuickButtons(products) {
        if (products.length === 0 && !scanInput.value.trim()) {
            productListButtons.innerHTML = `<p style="text-align: center; color: #777; padding: 10px;">Нет товаров в каталоге.</p>`;
            return;
        }
         
        productListButtons.innerHTML = products.map(product => `
            <div class="product-card" data-id="${product.id}" title="${product.name} (SKU: ${product.sku})">
                <img src="${product.image_url || '/static/default_product.png'}" alt="${product.name}" class="product-image" onerror="this.onerror=null;this.src='/static/default_product.png';">
                <span class="product-name">${product.name}</span>
                <span class="product-price">${formatCurrency(product.price)}</span>
            </div>
        `).join('');
    }

    /** Рендеринг списка для управления в модальном окне. */
    function renderCrudList(products) {
        if (products.length === 0) {
            crudProductList.innerHTML = '<p style="text-align: center; padding: 20px; color: #777;">Каталог пуст.</p>';
            return;
        }
        crudProductList.innerHTML = products.map(product => `
            <div class="crud-item" data-id="${product.id}">
                <span>${product.name} <span style="font-size: 0.8em; color: #999;">(SKU: ${product.sku})</span></span>
                <span style="font-weight: bold; color: var(--secondary-color);">${formatCurrency(product.price)}</span>
            </div>
        `).join('');
    }

    /** Универсальная функция для отправки данных CRUD. */
    async function sendProductData(url, method, data, successMsg, errorEl) {
        displayMessage(errorEl, '<i class="fas fa-spinner fa-spin"></i> Запрос...', 'info');

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: data ? JSON.stringify(data) : undefined
            });

            if (response.ok || response.status === 204) {
                displayMessage(errorEl, `✅ ${successMsg}`, 'success');
                if (method === 'POST') productForm.reset();
                 
                await fetchProducts();
                 
                if (editModal.style.display !== 'none' && method !== 'POST') {
                    setTimeout(() => {
                        editModal.style.display = 'none';
                        managementModal.style.display = 'flex';
                    }, 500);
                }
                 
                return true;
            } else {
                const errorData = await response.json().catch(() => ({ detail: `Сервер вернул ошибку ${response.status}.` }));
                displayMessage(errorEl, `❌ Ошибка: ${errorData.detail || 'Не удалось выполнить операцию'}`, 'error');
                return false;
            }
        } catch (error) {
            displayMessage(errorEl, `❌ Ошибка сети: ${error.message}`, 'error');
            return false;
        }
    }


    // --- ОБРАБОТЧИКИ CRUD ---

    // 1. Открытие/закрытие модального окна управления
    toggleManagementBtn.addEventListener('click', () => {
        managementModal.style.display = 'flex';
        fetchProducts();
        formMessage.style.display = 'none';
        apiStatus.style.display = 'none';
    });
     
    document.querySelector('.management-close-btn').onclick = function() { managementModal.style.display = 'none'; };

    // 2. Создание товара
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newProduct = {
            name: document.getElementById('name').value,
            price: parseFloat(document.getElementById('price').value),
            sku: document.getElementById('sku').value,
            stock: parseFloat(document.getElementById('stock').value) || 0.00,
            image_url: document.getElementById('image_url').value || null
        };
        await sendProductData('/api/products/', 'POST', newProduct, 'Товар успешно добавлен!', formMessage);
    });

    // 3. Открытие модального окна редактирования по клику на элемент CRUD
    crudProductList.addEventListener('click', (e) => {
        const itemEl = e.target.closest('.crud-item');
        if (!itemEl) return;

        const productId = itemEl.dataset.id;
        const product = productCache.find(p => p.id.toString() === productId);

        if (product) {
            editProductIdEl.textContent = productId;
            document.getElementById('edit-id').value = productId;
            document.getElementById('edit-name').value = product.name;
            document.getElementById('edit-price').value = product.price;
            document.getElementById('edit-sku').value = product.sku;
            document.getElementById('edit-stock').value = product.stock || 0.00;
            document.getElementById('edit-image_url').value = product.image_url || '';
             
            editMessage.style.display = 'none';
            managementModal.style.display = 'none';
            editModal.style.display = 'flex';
            document.getElementById('edit-name').focus();
        }
    });

    // 4. Обновление товара
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = document.getElementById('edit-id').value;
        const updatedProduct = {
            name: document.getElementById('edit-name').value,
            price: parseFloat(document.getElementById('edit-price').value),
            sku: document.getElementById('edit-sku').value,
            stock: parseFloat(document.getElementById('edit-stock').value) || 0.00,
            image_url: document.getElementById('edit-image_url').value || null
        };

        await sendProductData(`/api/products/${productId}`, 'PUT', updatedProduct, `Товар ID ${productId} обновлен!`, editMessage);
    });

    // 5. Удаление товара
    deleteProductBtn.addEventListener('click', async () => {
        const productId = document.getElementById('edit-id').value;
        const productName = document.getElementById('edit-name').value;
        if (confirm(`Вы уверены, что хотите НАВСЕГДА удалить товар "${productName}" (ID: ${productId})?`)) {
            await sendProductData(`/api/products/${productId}`, 'DELETE', null, `Товар ID ${productId} удален!`, editMessage);
        }
    });
     
    // Закрытие модального окна редактирования
    editCloseBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
        managementModal.style.display = 'flex';
    });


    // =================================================================
    //          --- ПРОВЕРКА API ---
    // =================================================================
     
    testApiBtn.addEventListener('click', async () => {
        displayMessage(apiStatus, '<i class="fas fa-sync fa-spin"></i> Проверка подключения...', 'info');
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const status = await response.json();
                displayMessage(apiStatus, `✅ API работает! Версия: ${status.version || '1.0'} | БД: ${status.db_info || 'OK'}`, 'success');
            } else {
                displayMessage(apiStatus, `❌ API недоступно. Код: ${response.status}.`, 'error');
            }
        } catch (error) {
            displayMessage(apiStatus, `❌ Ошибка сети: ${error.message}`, 'error');
        }
    });

    // =================================================================
    //          --- ОБРАБОТЧИКИ ЗАКРЫТИЯ МОДАЛЬНЫХ ОКОН ---
    // =================================================================
     
    window.onclick = function(event) {
        if (event.target === managementModal) { managementModal.style.display = 'none'; }
        if (event.target === quickAddModal) { quickAddModal.style.display = 'none'; }
        if (event.target === paymentModal) { paymentModal.style.display = 'none'; }
         
        if (event.target === editModal) {
            editModal.style.display = 'none';
            managementModal.style.display = 'flex';
        }
        if (event.target === counterpartyModal) {
            counterpartyModal.style.display = 'none';
            paymentModal.style.display = 'flex';
        }
    }


    // =================================================================
    //          --- ИНИЦИАЛИЗАЦИЯ ---
    // =================================================================
    fetchProducts();
    fetchCounterparties();
    renderCart();
    hideAllModals(); 
    scanInput.focus();
     
    // УДАЛЕНО: Блок запуска AI-логики
});
