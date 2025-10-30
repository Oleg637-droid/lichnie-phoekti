document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
    let cart = [];
    let productCache = []; // Кеш товаров для быстрого поиска
    const CURRENCY = 'KZT'; // Валюта

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
    
    // Элементы смешанной оплаты
    const mixedPaymentBlock = document.getElementById('mixed-payment-block');
    const mixedCashAmountInput = document.getElementById('mixed-cash-amount');
    const mixedSecondModeSelect = document.getElementById('mixed-second-mode');
    const mixedRemainingAmountEl = document.getElementById('mixed-remaining-amount');

    let currentTotal = 0;
    let selectedPaymentMode = null; // Текущий выбранный способ оплаты (cash, card, mixed, etc.)
    let selectedOrganization = null; // Новая переменная для организации

    // =================================================================
    //                            ФУНКЦИИ КАССЫ
    // =================================================================

    /** Форматирует число в валютный формат (KZT). */
    function formatCurrency(amount) {
        if (typeof amount !== 'number') return `0.00 ${CURRENCY}`;
        return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${CURRENCY}`;
    }

    /** Обновляет список товаров в корзине и пересчитывает итоги. */
    function renderCart() {
        if (cart.length === 0) {
            cartTbody.innerHTML = '<tr class="empty-cart-row"><td colspan="4" style="text-align: center; color: #777; padding: 20px;">Чек пуст.</td></tr>';
            totalAmountEl.textContent = formatCurrency(0);
            return;
        }

        let total = 0;
        
        cartTbody.innerHTML = cart.map((item, index) => {
            const sum = item.price * item.quantity;
            total += sum;

            return `
                <tr data-index="${index}">
                    <td class="item-name" title="${item.name}">${item.name}</td>
                    <td>
                        <input type="number" min="0.01" step="0.01" value="${item.quantity.toFixed(2)}" data-id="${item.id}" class="cart-quantity-input" style="width: 70px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                    </td>
                    <td style="font-weight: 700;">${formatCurrency(sum)}</td>
                    <td><button class="remove-from-cart-btn" data-id="${item.id}" style="border: none; background: none; color: #dc3545; cursor: pointer; font-size: 1.1em;"><i class="fas fa-trash-alt"></i></button></td>
                </tr>
            `;
        }).join('');

        totalAmountEl.textContent = formatCurrency(total);
    }

    /** Добавляет товар в корзину по ID или SKU с заданным количеством. */
    function addItemToCart(identifier, quantity = 1.00) {
        const item = productCache.find(p => 
            p.sku === identifier || p.id.toString() === identifier
        );

        if (!item) {
            cartMessage.innerHTML = `<p class="pos-message error">❌ Товар с "${identifier}" не найден.</p>`;
            return false;
        }
        
        const existingItem = cart.find(i => i.id === item.id);
        quantity = parseFloat(quantity); 

        if (existingItem) {
            existingItem.quantity = parseFloat((existingItem.quantity + quantity).toFixed(2));
            cartMessage.innerHTML = `<p class="pos-message success">✅ Количество "${item.name}" увеличено.</p>`;
        } else {
            cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: quantity
            });
            cartMessage.innerHTML = `<p class="pos-message success">✅ "${item.name}" добавлен в чек.</p>`;
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
                cartMessage.innerHTML = `<p class="pos-message info">Товар удален из чека.</p>`;
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
            cartMessage.innerHTML = `<p class="pos-message info">Товар удален из чека.</p>`;
            renderCart();
            scanInput.focus();
        }
    });
    
    // 4. !!! НОВОЕ ПОВЕДЕНИЕ !!! - Быстрое добавление кнопкой из Каталога (Справа)
    productListButtons.addEventListener('click', (e) => {
        const target = e.target.closest('.product-button');
        if (target) {
            const productId = target.dataset.id;
            const product = productCache.find(p => p.id.toString() === productId);
            
            if (!product) return;

            // 1. Заполняем модальное окно Quick Add
            document.getElementById('quick-add-product-name').textContent = product.name;
            document.getElementById('quick-add-product-price').textContent = formatCurrency(product.price);
            document.getElementById('quick-add-product-id').value = productId;
            document.getElementById('quick-add-quantity').value = 1.00; 
            quickAddMessage.innerHTML = '';
            
            // 2. Показываем модальное окно быстрого добавления
            quickAddModal.style.display = 'block'; 
            
            // 3. Сразу устанавливаем фокус на поле количества
            document.getElementById('quick-add-quantity').focus(); 
        }
    });
    
    // 5. Обработчик формы быстрого добавления в чек (из модального окна)
    quickAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const productId = document.getElementById('quick-add-product-id').value;
        const quantity = parseFloat(document.getElementById('quick-add-quantity').value);
        
        if (isNaN(quantity) || quantity <= 0) {
            quickAddMessage.innerHTML = '<p class="pos-message error">Введите корректное количество.</p>';
            return;
        }

        if (addItemToCart(productId, quantity)) {
            // Если успешно, закрываем модальное окно и фокусируемся на сканере
            quickAddModal.style.display = 'none';
            // После добавления сбрасываем фильтр каталога, если он был
            renderQuickButtons(productCache);
            scanInput.focus(); 
        } else {
             quickAddMessage.innerHTML = '<p class="pos-message error">Ошибка при добавлении товара.</p>';
        }
    });


    // 6. Очистка чека
    clearCartBtn.addEventListener('click', () => {
        if (cart.length > 0 && confirm('Вы уверены, что хотите очистить весь чек?')) {
            cart = [];
            cartMessage.innerHTML = `<p class="pos-message info">Чек очищен.</p>`;
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
        
        // 1. Получаем текущую сумму
        const totalText = totalAmountEl.textContent; // "1234.50 KZT"
        currentTotal = parseFloat(totalText.replace(new RegExp(`[^0-9\\.]`, 'g'), ''));

        // 2. Инициализация модального окна
        paymentDueAmountEl.textContent = formatCurrency(currentTotal);
        
        // Сброс состояния оплаты
        selectedPaymentMode = null;
        mixedPaymentBlock.style.display = 'none';
        mixedCashAmountInput.value = '0.00';
        updateMixedPaymentDisplay();
        paymentMessageEl.innerHTML = '';
        
        // Сбрасываем активные кнопки
        document.querySelectorAll('.payment-option-btn').forEach(btn => btn.classList.remove('active'));

        // Устанавливаем текущую организацию и фокус
        selectedOrganization = organizationSelect.value;
        organizationSelect.focus(); 

        // 3. Открываем модальное окно
        paymentModal.style.display = 'block';
    });
    
    // 8. Обработчики логики оплаты (Выбор режима и Смешанный расчет)

    // Обработчик изменения выбора организации (ВНЕ обработчика completeSaleBtn)
    organizationSelect.addEventListener('change', (e) => {
        selectedOrganization = e.target.value;
    });

    // Логика пересчета остатка для смешанной оплаты
    function updateMixedPaymentDisplay() {
        let cashPart = parseFloat(mixedCashAmountInput.value) || 0;
        
        // Ограничиваем наличную часть, чтобы она не превышала общую сумму
        if (cashPart > currentTotal) {
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
            mixedCashAmountInput.focus();
            updateMixedPaymentDisplay(); // Обновляем остаток сразу
        } else {
            mixedPaymentBlock.style.display = 'none';
        }
    });

    // Динамический пересчет при вводе наличной части
    mixedCashAmountInput.addEventListener('input', updateMixedPaymentDisplay);

    // Логика завершения продажи (по нажатию "ЗАВЕРШИТЬ ПРОДАЖУ")
    finalizePaymentBtn.addEventListener('click', () => {
        if (!selectedPaymentMode) {
            paymentMessageEl.innerHTML = '<p class="pos-message error">❌ Выберите способ оплаты!</p>';
            return;
        }
        
        // Получаем название организации для сообщения
        const organizationName = organizationSelect.options[organizationSelect.selectedIndex].text;
        
        let paymentInfo = `Организация: ${organizationName}. Оплата: ${selectedPaymentMode.toUpperCase()}. Сумма: ${formatCurrency(currentTotal)}.`;
        
        if (selectedPaymentMode === 'mixed') {
            const cashPart = parseFloat(mixedCashAmountInput.value) || 0;
            const remainingPart = currentTotal - cashPart;
            const secondMode = mixedSecondModeSelect.value;
            
            if (cashPart <= 0 || remainingPart <= 0) {
                 paymentMessageEl.innerHTML = '<p class="pos-message error">❌ Введите корректные суммы для смешанной оплаты.</p>';
                 return;
            }
            
            paymentInfo = `Организация: ${organizationName}. Смешанная: 1) Наличные: ${formatCurrency(cashPart)}; 2) ${secondMode.toUpperCase()}: ${formatCurrency(remainingPart)}.`;

        } else if (selectedPaymentMode === 'cash') {
            // Для наличных можно добавить окно сдачи в будущем
            paymentInfo = `Организация: ${organizationName}. Наличные. Сумма получена: ${formatCurrency(currentTotal)}.`;
        }

        // --- ФИНАЛИЗАЦИЯ ---
        
        // 1. Показываем сообщение об успехе
        paymentMessageEl.innerHTML = `<p class="pos-message success">✅ ${paymentInfo} Продажа завершена!</p>`;
        
        // 2. Сброс чека
        cart = [];
        renderCart();
        
        // 3. Закрытие модального окна
        setTimeout(() => {
            paymentModal.style.display = 'none';
            cartMessage.innerHTML = `<p class="pos-message success">✅ Чек закрыт, ${paymentInfo}</p>`;
            scanInput.focus();
        }, 1500); 
    });


    // =================================================================
    //                        ФУНКЦИИ КАТАЛОГА / CRUD
    // =================================================================

    /** Отправка GET-запроса на получение списка товаров. */
    async function fetchProducts() {
        productListButtons.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i></p>';
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
            const msg = `<p style="color: red; font-weight: bold;">❌ Ошибка: ${error.message}</p>`;
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
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok || response.status === 204) {
                errorEl.innerHTML = `<p class="pos-message success">✅ ${successMsg}</p>`;
                if (method === 'POST') productForm.reset();
                
                fetchProducts(); 
                
                if (editModal.style.display === 'block') {
                    managementModal.style.display = 'block';
                }
                
                return true;
            } else {
                const errorData = await response.json();
                errorEl.innerHTML = `<p class="pos-message error">❌ Ошибка: ${errorData.detail || 'Не удалось выполнить операцию'}</p>`;
                return false;
            }
        } catch (error) {
            errorEl.innerHTML = `<p class="pos-message error">❌ Ошибка сети: ${error.message}</p>`;
            return false;
        }
    }

    // --- ОБРАБОТЧИКИ CRUD ---

    // 1. Открытие/закрытие модального окна управления
    toggleManagementBtn.addEventListener('click', () => {
        managementModal.style.display = 'block';
        fetchProducts(); 
        formMessage.innerHTML = '';
        apiStatus.innerHTML = '';
    });
    
    document.querySelector('.management-close-btn').onclick = function() { managementModal.style.display = 'none'; };

    // 2. Создание товара
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newProduct = {
            name: document.getElementById('name').value,
            price: parseFloat(document.getElementById('price').value), 
            sku: document.getElementById('sku').value,
            // Предполагаем, что поле stock существует в HTML
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
            // Предполагаем, что поле edit-stock существует в HTML
            stock: parseFloat(document.getElementById('edit-stock').value) || 0.00, 
            image_url: document.getElementById('edit-image_url').value || null 
        };

        const success = await sendProductData(`/api/products/${productId}`, 'PUT', updatedProduct, `Товар ID ${productId} обновлен!`, editMessage);
        
        if (success) {
            setTimeout(() => { 
                editModal.style.display = 'none'; 
                managementModal.style.display = 'block';
            }, 500); 
        }
    });
    
    // 4. !!! ВОССТАНОВЛЕНО !!! - Открытие формы РЕДАКТИРОВАНИЯ из CRUD-списка
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
        // Заполняем поле Остатка, если оно есть в данных товара
        if (document.getElementById('edit-stock')) {
            document.getElementById('edit-stock').value = product.stock || 0.00;
        }
        document.getElementById('edit-image_url').value = product.image_url || '';

        editMessage.innerHTML = '';
        managementModal.style.display = 'none'; 
        editModal.style.display = 'block'; 
        
        document.getElementById('edit-price').focus(); 
    });

    // 5. Проверка API
    document.getElementById('test-api').addEventListener('click', async () => {
        apiStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Запрос...';
        try {
            const response = await fetch('/api/status'); 
            const data = await response.json();
            
            apiStatus.innerHTML = `
                <i class="fas fa-check-circle" style="color: #28a745;"></i> <strong>Успех!</strong>
                ${data.message.split('!')[0]} | БД: ${data.db_info}
            `;
        } catch (error) {
            apiStatus.innerHTML = `
                <i class="fas fa-times-circle" style="color: #dc3545;"></i> <strong>Ошибка!</strong>
            `;
        }
    });

    // 6. Обработчик удаления товара
    deleteProductBtn.addEventListener('click', async () => {
        const productId = document.getElementById('edit-id').value;
        const productName = document.getElementById('edit-name').value;
        
        if (confirm(`Вы уверены, что хотите НАВСЕГДА удалить товар "${productName}" (ID: ${productId})?`)) {
            const success = await sendProductData(
                `/api/products/${productId}`, 
                'DELETE', 
                null, // DELETE обычно не требует тела
                `Товар ID ${productId} удален!`, 
                editMessage
            );
            
            if (success) {
                // Если успешно, закрываем оба модальных окна и возвращаемся к кассе
                setTimeout(() => { 
                    editModal.style.display = 'none'; 
                    managementModal.style.display = 'none';
                    scanInput.focus();
                }, 500); 
            }
        }
    });

    // --- Логика закрытия модальных окон (по клику вне) ---
    const editCloseBtn = document.querySelector('.edit-close-btn');
    if (editCloseBtn) {
        editCloseBtn.onclick = function() { editModal.style.display = 'none'; };
    }
    if (quickAddCloseBtn) {
        quickAddCloseBtn.onclick = function() { quickAddModal.style.display = 'none'; };
    }
    if (paymentCloseBtn) {
        paymentCloseBtn.onclick = function() { paymentModal.style.display = 'none'; };
    }

    window.onclick = function(event) {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
        if (event.target == managementModal) {
            managementModal.style.display = 'none';
        }
        if (event.target == quickAddModal) {
            quickAddModal.style.display = 'none';
        }
        if (event.target == paymentModal) {
            paymentModal.style.display = 'none';
        }
    }

    // Инициализация
    fetchProducts();
    renderCart();
    scanInput.focus();
});
