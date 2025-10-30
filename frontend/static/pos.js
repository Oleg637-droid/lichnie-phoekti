document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
    let cart = [];
    let productCache = []; // Кеш товаров для быстрого поиска
    const CURRENCY = 'KZT'; // Новая валюта

    // --- DOM-ЭЛЕМЕНТЫ КАССЫ ---
    const scanInput = document.getElementById('scan-input'); 
    const cartTbody = document.getElementById('cart-tbody');
    const cartMessage = document.getElementById('cart-message');
    const totalAmountEl = document.getElementById('total-amount');
    const clearCartBtn = document.getElementById('clear-cart');
    const completeSaleBtn = document.getElementById('complete-sale');
    const productListButtons = document.getElementById('product-list'); // Правая колонка: кнопки

    // --- DOM-ЭЛЕМЕНТЫ УПРАВЛЕНИЯ (CRUD) ---
    const managementModal = document.getElementById('management-modal');
    const toggleManagementBtn = document.getElementById('toggle-management');
    const crudProductList = document.getElementById('crud-product-list'); // Список в модальном окне
    const productForm = document.getElementById('product-form'); // Форма создания
    const formMessage = document.getElementById('form-message');
    const apiStatus = document.getElementById('api-status');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editMessage = document.getElementById('edit-form-message');

    // --- DOM-ЭЛЕМЕНТЫ ПОИСКА (Теперь это поле сканирования) ---
    // Мы будем использовать scanInput и для сканирования, и для поиска.

    // =================================================================
    //                           ФУНКЦИИ КАССЫ
    // =================================================================

    /** Форматирует число в валютный формат. */
    function formatCurrency(amount) {
        // Простая реализация форматирования для KZT
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
            // Исправлено: item.quantity теперь дробное
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

    /** Добавляет товар в корзину по ID или SKU. */
    function addItemToCart(identifier, quantity = 1.00) {
        const item = productCache.find(p => 
            p.sku === identifier || p.id.toString() === identifier
        );

        if (!item) {
            cartMessage.innerHTML = `<p class="pos-message error">❌ Товар с "${identifier}" не найден.</p>`;
            return false;
        }
        
        const existingItem = cart.find(i => i.id === item.id);

        // Используем parseFloat для работы с десятичными числами
        quantity = parseFloat(quantity); 

        if (existingItem) {
            existingItem.quantity = parseFloat((existingItem.quantity + quantity).toFixed(2));
            cartMessage.innerHTML = `<p class="pos-message success">✅ Количество "${item.name}" увеличено.</p>`;
        } else {
            cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                // Сохраняем количество как дробное
                quantity: quantity
            });
            cartMessage.innerHTML = `<p class="pos-message success">✅ "${item.name}" добавлен в чек.</p>`;
        }

        renderCart();
        return true;
    }
    
    // --- ОБРАБОТЧИКИ КАССЫ ---

    // 1. Сканирование / Ввод (теперь используется и для поиска/фильтрации)
    scanInput.addEventListener('input', (e) => {
        const scanValue = e.target.value.trim();
        
        // Если поле пустое, показываем все товары
        if (!scanValue) {
            renderQuickButtons(productCache);
            return;
        }

        // Если это сканирование (ввод завершен и Enter нажат), добавляем товар
        // Обычно сканер эмулирует нажатие Enter.
        // Здесь мы используем событие 'change' для сканирования (см. ниже)
        
        // Динамическая фильтрация (ПОИСК)
        const filterText = scanValue.toLowerCase();
        
        const filteredProducts = productCache.filter(p => 
            p.name.toLowerCase().includes(filterText) || 
            p.sku.toLowerCase().includes(filterText) ||
            p.id.toString().includes(filterText)
        );
        
        renderQuickButtons(filteredProducts);
    });
    
    // Событие 'change' срабатывает при потере фокуса или нажатии Enter (типично для сканера)
    scanInput.addEventListener('change', (e) => {
        const scanValue = e.target.value.trim();
        e.target.value = ''; // Очистка поля

        if (scanValue) {
            // Пытаемся добавить товар в корзину (по ID/SKU)
            if (addItemToCart(scanValue, 1.00)) {
                // Если товар добавлен, сбрасываем фильтр, чтобы видеть полный каталог
                renderQuickButtons(productCache);
            }
        }
        scanInput.focus(); 
    });


    // 2. Изменение количества в корзине (поддержка дробных чисел)
    cartTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('cart-quantity-input')) {
            const id = parseInt(e.target.dataset.id);
            // Используем parseFloat для чтения дробного значения
            let newQuantity = parseFloat(e.target.value);
            
            // Проверка на корректность
            if (isNaN(newQuantity) || newQuantity < 0.01) {
                newQuantity = 0;
            } else {
                // Округление до двух знаков
                newQuantity = parseFloat(newQuantity.toFixed(2));
            }
            
            if (newQuantity === 0) {
                // Если количество 0, удаляем товар
                cart = cart.filter(item => item.id !== id);
                cartMessage.innerHTML = `<p class="pos-message info">Товар удален из чека.</p>`;
            } else {
                // Иначе обновляем количество
                const item = cart.find(item => item.id === id);
                if (item) item.quantity = newQuantity;
            }
            renderCart();
            scanInput.focus();
        }
    });

    // 3. Удаление из корзины (остается без изменений)
    cartTbody.addEventListener('click', (e) => {
        if (e.target.closest('.remove-from-cart-btn')) {
            const id = parseInt(e.target.closest('.remove-from-cart-btn').dataset.id);
            cart = cart.filter(item => item.id !== id);
            cartMessage.innerHTML = `<p class="pos-message info">Товар удален из чека.</p>`;
            renderCart();
            scanInput.focus();
        }
    });
    
    // 4. Быстрое добавление кнопкой из Каталога
    productListButtons.addEventListener('click', (e) => {
        const target = e.target.closest('.product-button');
        if (target) {
            // Добавляем 1 единицу (метр/штуку)
            addItemToCart(target.dataset.id, 1.00); 
            scanInput.focus();
        }
    });


    // 5. Очистка чека и Завершение продажи
    clearCartBtn.addEventListener('click', () => {
        if (cart.length > 0 && confirm('Вы уверены, что хотите очистить весь чек?')) {
            cart = [];
            cartMessage.innerHTML = `<p class="pos-message info">Чек очищен.</p>`;
            renderCart();
            scanInput.focus();
        }
    });
    
    completeSaleBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert("Нельзя завершить продажу: чек пуст!");
            return;
        }
        const total = totalAmountEl.textContent;
        alert(`Продажа завершена! К оплате: ${total}.`);
        
        cart = [];
        cartMessage.innerHTML = `<p class="pos-message success">✅ Продажа завершена! Чек закрыт.</p>`;
        renderCart();
        scanInput.focus();
    });


    // =================================================================
    //                       ФУНКЦИИ КАТАЛОГА / CRUD
    // =================================================================

    /** Отправка GET-запроса на получение списка товаров. */
    async function fetchProducts() {
        // ... (оставим этот код без изменений, так как он только получает данные) ...
        productListButtons.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i></p>';
        crudProductList.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Загрузка...</p>';
        
        try {
            const response = await fetch('/api/products/');
            if (!response.ok) {
                throw new Error('Ошибка сети при получении товаров');
            }
            const products = await response.json();
            productCache = products; 
            renderQuickButtons(products); // Рендерим все товары в кнопки по умолчанию
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
        // ... (оставим этот код без изменений) ...
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok || response.status === 204) {
                errorEl.innerHTML = `<p class="pos-message success">✅ ${successMsg}</p>`;
                if (method === 'POST') productForm.reset();
                
                // Перезагрузка всего, чтобы обновить кеш и списки
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

    // --- ОБРАБОТЧИКИ CRUD (без изменений) ---

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
            // Используем parseFloat для корректной отправки дробной цены
            price: parseFloat(document.getElementById('price').value), 
            sku: document.getElementById('sku').value,
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
            // Используем parseFloat для корректной отправки дробной цены
            price: parseFloat(document.getElementById('edit-price').value), 
            sku: document.getElementById('edit-sku').value,
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
    
    // 4. Открытие формы редактирования из CRUD-списка
    crudProductList.addEventListener('click', (e) => {
        const targetItem = e.target.closest('.crud-item');
        if (!targetItem) return;
        const productId = targetItem.dataset.id;
        
        const product = productCache.find(p => p.id.toString() === productId);
        if (!product) return;

        document.getElementById('edit-product-id').textContent = productId;
        document.getElementById('edit-id').value = productId;
        document.getElementById('edit-name').value = product.name;
        document.getElementById('edit-price').value = product.price; // Цена
        document.getElementById('edit-sku').value = product.sku;
        document.getElementById('edit-image_url').value = product.image_url || '';

        editMessage.innerHTML = '';
        managementModal.style.display = 'none'; 
        editModal.style.display = 'block'; 
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

    // --- Логика закрытия модальных окон (по клику вне) ---
    const editCloseBtn = document.querySelector('.edit-close-btn');
    if (editCloseBtn) {
        editCloseBtn.onclick = function() { editModal.style.display = 'none'; };
    }

    window.onclick = function(event) {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
        if (event.target == managementModal) {
            managementModal.style.display = 'none';
        }
    }

    // Инициализация
    fetchProducts();
    renderCart();
    scanInput.focus();
});
