document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
    let cart = [];
    let productCache = [];
    let counterpartyCache = [];
    const CURRENCY = 'KZT';

    // --- DOM-ЭЛЕМЕНТЫ КАССЫ ---
    const scanInput = document.getElementById('scan-input');
    const cartTbody = document.getElementById('cart-tbody');
    const cartMessage = document.getElementById('cart-message');
    const totalAmountEl = document.getElementById('total-amount');
    const clearCartBtn = document.getElementById('clear-cart');
    const completeSaleBtn = document.getElementById('complete-sale');
    const productListButtons = document.getElementById('product-list');

    // --- DOM-ЭЛЕМЕНТЫ УПРАВЛЕНИЯ (CRUD) ---
    const managementModal = document.getElementById('management-modal');
    const toggleManagementBtn = document.getElementById('toggle-management');
    const crudProductList = document.getElementById('crud-product-list');
    const productForm = document.getElementById('product-form');
    const formMessage = document.getElementById('form-message');
    const apiStatus = document.getElementById('api-status');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editMessage = document.getElementById('edit-form-message');
    const deleteProductBtn = document.getElementById('delete-product-btn');

    // --- DOM-ЭЛЕМЕНТЫ БЫСТРОГО ДОБАВЛЕНИЯ КОЛИЧЕСТВА ---
    const quickAddModal = document.getElementById('quick-add-modal');
    const quickAddForm = document.getElementById('quick-add-form');
    const quickAddCloseBtn = document.querySelector('.quick-add-close-btn');
    const quickAddMessage = document.getElementById('quick-add-message');

    // --- DOM-ЭЛЕМЕНТЫ ОПЛАТЫ ---
    const paymentModal = document.getElementById('payment-modal');
    const paymentCloseBtn = document.querySelector('.payment-close-btn');
    const paymentOptionsGrid = document.getElementById('payment-mode-selection');
    const finalizePaymentBtn = document.getElementById('finalize-payment-btn');
    const paymentDueAmountEl = document.getElementById('payment-due-amount');
    const paymentMessageEl = document.getElementById('payment-message');
    const organizationSelect = document.getElementById('organization-select');

    const counterpartyModal = document.getElementById('counterparty-modal');
    const counterpartyCloseBtn = document.querySelector('.counterparty-close-btn');
    const addCounterpartyBtn = document.getElementById('add-counterparty-btn');
    const counterpartyForm = document.getElementById('counterparty-form');
    const counterpartyMessageEl = document.getElementById('counterparty-message');
    const counterpartySelect = document.getElementById('counterparty-select');

    // Элементы смешанной оплаты
    const mixedPaymentBlock = document.getElementById('mixed-payment-block');
    const mixedCashAmountInput = document.getElementById('mixed-cash-amount');
    const mixedSecondModeSelect = document.getElementById('mixed-second-mode');
    const mixedRemainingAmountEl = document.getElementById('mixed-remaining-amount');

    let currentTotal = 0; // Теперь это число
    let selectedPaymentMode = null;
    let selectedOrganization = null;
    let selectedCounterpartyId = 'none';
    
    // =================================================================
    //                              ФУНКЦИИ КАССЫ
    // =================================================================

    /** Отображение сообщений */
    function displayMessage(element, message, type = 'info') {
        element.innerHTML = `<p class="pos-message ${type}">${message}</p>`;
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 3000);
    }

    /** Форматирует число в валютный формат (KZT). */
    function formatCurrency(amount) {
        if (typeof amount !== 'number') return `0.00 ${CURRENCY}`;
        // Форматирование числа: 12345.67 -> 12 345.67
        const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return `${formatted} ${CURRENCY}`;
    }

    /** Обновляет список товаров в корзине и пересчитывает итоги. */
    function renderCart() {
        currentTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (cart.length === 0) {
            cartTbody.innerHTML = '<tr class="empty-cart-row"><td colspan="4" style="text-align: center; color: #777; padding: 20px;">Чек пуст.</td></tr>';
            totalAmountEl.textContent = formatCurrency(0);
            return;
        }

        cartTbody.innerHTML = cart.map((item, index) => {
            const sum = item.price * item.quantity;

            return `
                <tr data-id="${item.id}">
                    <td class="item-name" title="${item.name}">${item.name}</td>
                    <td>
                        <input type="number" min="0.01" step="0.01" value="${item.quantity.toFixed(2)}" data-id="${item.id}" class="cart-quantity-input" title="${item.name}">
                    </td>
                    <td style="font-weight: 700;">${formatCurrency(sum)}</td>
                    <td><button class="remove-from-cart-btn" data-id="${item.id}" title="Удалить товар" style="border: none; background: none; color: #dc3545; cursor: pointer; font-size: 1.1em;"><i class="fas fa-trash-alt"></i></button></td>
                </tr>
            `;
        }).join('');

        totalAmountEl.textContent = formatCurrency(currentTotal);
    }

    /** Добавляет товар в корзину по ID или SKU с заданным количеством. */
    function addItemToCart(identifier, quantity = 1.00) {
        const item = productCache.find(p =>
            p.sku === identifier || p.id.toString() === identifier
        );

        if (!item) {
            displayMessage(cartMessage, `❌ Товар с "${identifier}" не найден.`, 'error');
            return false;
        }

        const existingItem = cart.find(i => i.id === item.id);
        quantity = parseFloat(quantity);

        if (existingItem) {
            existingItem.quantity = parseFloat((existingItem.quantity + quantity).toFixed(2));
            displayMessage(cartMessage, `✅ Количество "${item.name}" увеличено.`, 'success');
        } else {
            cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: quantity
            });
            displayMessage(cartMessage, `✅ "${item.name}" добавлен в чек.`, 'success');
        }

        renderCart();
        return true;
    }

    // --- ОБРАБОТЧИКИ КАССЫ ---

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
    
    // Событие 'change' для сканирования/Enter (добавление 1.00 в чек)
    scanInput.addEventListener('change', (e) => {
        const scanValue = e.target.value.trim();
        e.target.value = ''; // Очистка поля после ввода

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

    // 3. Удаление из корзины
    cartTbody.addEventListener('click', (e) => {
        if (e.target.closest('.remove-from-cart-btn')) {
            const id = parseInt(e.target.closest('.remove-from-cart-btn').dataset.id);
            cart = cart.filter(item => item.id !== id);
            displayMessage(cartMessage, `Товар удален из чека.`, 'info');
            renderCart();
            scanInput.focus();
        }
    });
    
    // 4. Быстрое добавление кнопкой из Каталога (Справа)
    productListButtons.addEventListener('click', (e) => {
        const target = e.target.closest('.product-button');
        if (target) {
            const productId = target.dataset.id;
            const product = productCache.find(p => p.id.toString() === productId);
            
            if (!product) return;

            document.getElementById('quick-add-product-name').textContent = product.name;
            document.getElementById('quick-add-product-price').textContent = formatCurrency(product.price);
            document.getElementById('quick-add-product-id').value = productId;
            document.getElementById('quick-add-quantity').value = 1.00; 
            quickAddMessage.style.display = 'none';
            
            quickAddModal.style.display = 'flex'; // Используем flex для центрирования
            
            document.getElementById('quick-add-quantity').focus(); 
        }
    });
    
    // 5. Обработчик формы быстрого добавления в чек (из модального окна)
    quickAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const productId = document.getElementById('quick-add-product-id').value;
        const quantity = parseFloat(document.getElementById('quick-add-quantity').value);
        
        if (isNaN(quantity) || quantity <= 0) {
            displayMessage(quickAddMessage, 'Введите корректное количество.', 'error');
            return;
        }

        if (addItemToCart(productId, quantity)) {
            quickAddModal.style.display = 'none';
            scanInput.value = ''; // Очистка поля сканера
            renderQuickButtons(productCache);
            scanInput.focus();
        } else {
             displayMessage(quickAddMessage, 'Ошибка при добавлении товара.', 'error');
        }
    });


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
            alert("Нельзя завершить продажу: чек пуст!");
            return;
        }
        
        // currentTotal уже обновлен в renderCart()
        paymentDueAmountEl.textContent = formatCurrency(currentTotal);
        
        // Сброс состояния оплаты
        selectedPaymentMode = null;
        mixedPaymentBlock.style.display = 'none';
        mixedCashAmountInput.value = currentTotal.toFixed(2); // Предзаполняем, чтобы облегчить cash-only
        updateMixedPaymentDisplay();
        paymentMessageEl.style.display = 'none';
        
        // Сбрасываем активные кнопки
        document.querySelectorAll('.payment-option-btn').forEach(btn => btn.classList.remove('active'));

        // Установка и фокус
        selectedOrganization = organizationSelect.value;
        // organizationSelect.focus(); // Не обязательно, фокусируемся на модальном окне

        paymentModal.style.display = 'flex'; // Используем flex для центрирования
    });
    
    // 8. Обработчики логики оплаты

    organizationSelect.addEventListener('change', (e) => {
        selectedOrganization = e.target.value;
    });

    // Логика пересчета остатка для смешанной оплаты
    function updateMixedPaymentDisplay() {
        let cashPart = parseFloat(mixedCashAmountInput.value) || 0;
        
        // Ограничиваем наличную часть
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
        
        // Управление активным классом
        document.querySelectorAll('.payment-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Показать/Скрыть блок смешанной оплаты
        if (selectedPaymentMode === 'mixed') {
            mixedPaymentBlock.style.display = 'block';
            mixedCashAmountInput.value = (currentTotal / 2).toFixed(2); // Делим пополам по умолчанию
            updateMixedPaymentDisplay();
            mixedCashAmountInput.focus();
        } else {
            mixedPaymentBlock.style.display = 'none';
        }
        paymentMessageEl.style.display = 'none';
    });

    // Динамический пересчет при вводе наличной части
    mixedCashAmountInput.addEventListener('input', updateMixedPaymentDisplay);

    // Логика завершения продажи (по нажатию "ЗАВЕРШИТЬ ПРОДАЖУ")
    finalizePaymentBtn.addEventListener('click', () => {
        if (!selectedPaymentMode) {
            displayMessage(paymentMessageEl, '❌ Выберите способ оплаты!', 'error');
            return;
        }
        
        const organizationName = organizationSelect.options[organizationSelect.selectedIndex].text;
        const counterpartyName = counterpartySelect.options[counterpartySelect.selectedIndex].text;
        
        let paymentInfo = `Орг: ${organizationName}. Контрагент: ${counterpartyName}. Оплата: ${selectedPaymentMode.toUpperCase()}. Сумма: ${formatCurrency(currentTotal)}.`;
        
        if (selectedPaymentMode === 'mixed') {
            const cashPart = parseFloat(mixedCashAmountInput.value) || 0;
            const remainingPart = currentTotal - cashPart;
            const secondMode = mixedSecondModeSelect.value;
            
            if (cashPart <= 0 || remainingPart <= 0 || Math.abs(cashPart + remainingPart - currentTotal) > 0.01) {
                 displayMessage(paymentMessageEl, '❌ Введите корректные суммы для смешанной оплаты (сумма частей должна быть равна итогу).', 'error');
                 return;
            }
            
            paymentInfo = `Орг: ${organizationName}. Контрагент: ${counterpartyName}. Смешанная: 1) Наличные: ${formatCurrency(cashPart)}; 2) ${secondMode.toUpperCase()}: ${formatCurrency(remainingPart)}.`;
        }

        // --- ФИНАЛИЗАЦИЯ ---
        
        displayMessage(paymentMessageEl, `✅ ${paymentInfo} Продажа завершена!`, 'success');
        
        // Сброс чека
        cart = [];
        renderCart();

        // Сброс выбранного контрагента
        selectedCounterpartyId = 'none';
        counterpartySelect.value = 'none';
        
        // Закрытие модального окна
        setTimeout(() => {
            paymentModal.style.display = 'none';
            displayMessage(cartMessage, `✅ Чек закрыт, ${paymentInfo}`, 'success');
            scanInput.focus();
        }, 1500);
    });

    // 9. Логика работы с Контрагентами
    
    addCounterpartyBtn.addEventListener('click', () => {
        paymentModal.style.display = 'none';
        counterpartyModal.style.display = 'flex'; // Используем flex для центрирования
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
                    paymentModal.style.display = 'flex'; // Возвращаемся в окно оплаты
                    counterpartySelect.value = selectedCounterpartyId;
                }, 1000);

            } else {
                const errorData = await response.json();
                displayMessage(counterpartyMessageEl, `❌ Ошибка: ${errorData.detail || 'Не удалось сохранить контрагента'}`, 'error');
            }
        } catch (error) {
            displayMessage(counterpartyMessageEl, `❌ Ошибка сети при добавлении: ${error.message}`, 'error');
        }
    });

    counterpartySelect.addEventListener('change', (e) => {
        selectedCounterpartyId = e.target.value;
    });


    // =================================================================
    //                          ФУНКЦИИ КАТАЛОГА / CRUD
    // =================================================================

    /** Загружает список контрагентов и рендерит SELECT. */
    async function fetchCounterparties() {
        try {
            const response = await fetch('/api/counterparties/');
            if (!response.ok) {
                throw new Error('Ошибка при получении списка контрагентов');
            }
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
            if (!response.ok) {
                throw new Error('Ошибка сети при получении товаров');
            }
            const products = await response.json();
            productCache = products;
            renderQuickButtons(products);
            renderCrudList(products);
        } catch (error) {
            const msg = `<p style="color: red; font-weight: bold; text-align: center; padding: 10px;">❌ Ошибка загрузки: ${error.message}</p>`;
            productListButtons.innerHTML = msg;
            crudProductList.innerHTML = msg;
        }
    }

    /** Рендеринг кнопок для быстрой продажи. */
    function renderQuickButtons(products) {
        if (products.length === 0) {
            const scanValue = scanInput.value.trim();
            let msg = 'Нет товаров в каталоге.';
            if (scanValue) {
                msg = `Товары по запросу "${scanValue}" не найдены.`;
            }
            productListButtons.innerHTML = `<p style="text-align: center; color: #777; padding: 10px;">${msg}</p>`;
            return;
        }
        productListButtons.innerHTML = products.map(product => `
            <button class="product-button" data-id="${product.id}" title="${product.name} ${formatCurrency(product.price)}">
                ${product.name}
            </button>
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
        errorEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запрос...';
        errorEl.style.display = 'block';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: data ? JSON.stringify(data) : undefined
            });

            if (response.ok || response.status === 204) {
                displayMessage(errorEl, `✅ ${successMsg}`, 'success');
                if (method === 'POST') productForm.reset();
                
                // Обновляем списки
                await fetchProducts(); 
                
                // Закрываем модальное окно редактирования, если мы в нем
                if (editModal.style.display !== 'none' && method !== 'POST') {
                    setTimeout(() => {
                        editModal.style.display = 'none';
                        managementModal.style.display = 'flex'; // Возвращаемся в главное окно управления
                    }, 500);
                }
                
                return true;
            } else {
                const errorData = await response.json();
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
        managementModal.style.display = 'flex'; // Используем flex для центрирования
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

    // 3. Обновление товара
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
    
    // 4. Открытие формы РЕДАКТИРОВАНИЯ из CRUD-списка
    crudProductList.addEventListener('click', (e) => {
        const targetItem = e.target.closest('.crud-item');
        if (!targetItem) return;
        const productId = targetItem.dataset.id;
        
        const product = productCache.find(p => p.id.toString() === productId);
        if (!product) return;

        document.getElementById('edit-product-id').textContent = productId;
        document.getElementById('edit-id').value = productId;
        document.getElementById('edit-name').value = product.name;
        document.getElementById('edit-price').value = product.price; 
        document.getElementById('edit-sku').value = product.sku;
        document.getElementById('edit-stock').value = product.stock || 0.00;
        document.getElementById('edit-image_url').value = product.image_url || '';

        editMessage.style.display = 'none';
        managementModal.style.display = 'none'; 
        editModal.style.display = 'flex'; // Используем flex для центрирования
        
        document.getElementById('edit-price').focus(); 
    });

    // 5. Проверка API
    document.getElementById('test-api').addEventListener('click', async () => {
        apiStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Запрос...';
        apiStatus.style.display = 'block';
        try {
            const response = await fetch('/api/status'); 
            const data = await response.json();
            
            apiStatus.innerHTML = `
                <i class="fas fa-check-circle" style="color: #28a745;"></i> <strong>Успех!</strong>
                ${data.message.split('!')[0]} | БД: ${data.db_info}
            `;
        } catch (error) {
            apiStatus.innerHTML = `
                <i class="fas fa-times-circle" style="color: #dc3545;"></i> <strong>Ошибка!</strong> Проверьте консоль для деталей.
            `;
        }
    });

    // 6. Обработчик удаления товара
    deleteProductBtn.addEventListener('click', async () => {
        const productId = document.getElementById('edit-id').value;
        const productName = document.getElementById('edit-name').value;
        
        if (confirm(`Вы уверены, что хотите НАВСЕГДА удалить товар "${productName}" (ID: ${productId})?`)) {
            await sendProductData(
                `/api/products/${productId}`, 
                'DELETE', 
                null, 
                `Товар ID ${productId} удален!`, 
                editMessage
            );
            // Закрытие модальных окон будет выполнено в sendProductData после success
        }
    });

    // --- Логика закрытия модальных окон (по клику на крестик) ---
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            // Определяем, какое модальное окно закрываем, и скрываем его
            const modal = btn.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                if (modal.id === 'counterparty-modal') {
                    paymentModal.style.display = 'flex'; // Возвращаемся в окно оплаты
                }
            }
        };
    });

    // --- Логика закрытия модальных окон (по клику вне) ---
    window.onclick = function(event) {
        if (event.target == editModal) { editModal.style.display = 'none'; }
        if (event.target == managementModal) { managementModal.style.display = 'none'; }
        if (event.target == quickAddModal) { quickAddModal.style.display = 'none'; }
        if (event.target == paymentModal) { paymentModal.style.display = 'none'; }
        if (event.target == counterpartyModal) { 
            counterpartyModal.style.display = 'none'; 
            paymentModal.style.display = 'flex'; // Возвращаемся в окно оплаты
        }
    }

    // Инициализация
    fetchProducts();
    fetchCounterparties();
    renderCart();
    scanInput.focus();
});
