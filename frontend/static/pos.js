document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ КАССЫ (Корзина) ---
    let cart = [];
    let productCache = []; // Кеш товаров для быстрого поиска

    // --- DOM-ЭЛЕМЕНТЫ КАССЫ ---
    const scanInput = document.getElementById('scan-input'); 
    const cartTbody = document.getElementById('cart-tbody');
    const cartMessage = document.getElementById('cart-message');
    const subtotalEl = document.getElementById('subtotal');
    const totalAmountEl = document.getElementById('total-amount');
    const clearCartBtn = document.getElementById('clear-cart');
    const completeSaleBtn = document.getElementById('complete-sale');

    // --- DOM-ЭЛЕМЕНТЫ КАТАЛОГА (CRUD) ---
    const productList = document.getElementById('product-list');
    const formMessage = document.getElementById('form-message');
    const apiStatus = document.getElementById('api-status');
    const productForm = document.getElementById('product-form');
    const addProductSection = document.getElementById('add-product-section');
    const toggleAddFormBtn = document.getElementById('toggle-add-form');

    // --- DOM-ЭЛЕМЕНТЫ РЕДАКТИРОВАНИЯ ---
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editMessage = document.getElementById('edit-form-message');


    // =================================================================
    //                           ФУНКЦИИ КАССЫ
    // =================================================================

    /** Обновляет список товаров в корзине и пересчитывает итоги. */
    function renderCart() {
        if (cart.length === 0) {
            cartTbody.innerHTML = '<tr class="empty-cart-row"><td colspan="5" style="text-align: center; color: #777;">Чек пуст. Начните сканирование!</td></tr>';
            subtotalEl.textContent = '0.00 USD';
            totalAmountEl.textContent = '0.00 USD';
            return;
        }

        let subtotal = 0;
        
        cartTbody.innerHTML = cart.map((item, index) => {
            const sum = item.price * item.quantity;
            subtotal += sum;

            return `
                <tr data-index="${index}">
                    <td class="item-name">${item.name}</td>
                    <td>
                        <input type="number" min="1" value="${item.quantity}" data-id="${item.id}" class="cart-quantity-input" style="width: 50px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                    </td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>$${sum.toFixed(2)}</td>
                    <td><button class="remove-from-cart-btn" data-id="${item.id}" style="border: none; background: none; color: #dc3545; cursor: pointer;"><i class="fas fa-times-circle"></i></button></td>
                </tr>
            `;
        }).join('');

        // Упрощенный расчет: total = subtotal (без НДС и скидок)
        subtotalEl.textContent = `${subtotal.toFixed(2)} USD`;
        totalAmountEl.textContent = `${subtotal.toFixed(2)} USD`;
    }

    /** Добавляет товар в корзину по ID или SKU. */
    function addItemToCart(identifier) {
        const item = productCache.find(p => 
            p.sku === identifier || p.id.toString() === identifier
        );

        if (!item) {
            cartMessage.innerHTML = `<p class="pos-message error">❌ Товар с "${identifier}" не найден в каталоге.</p>`;
            return;
        }
        
        // Проверяем, есть ли товар уже в корзине
        const existingItem = cart.find(i => i.id === item.id);

        if (existingItem) {
            existingItem.quantity += 1;
            cartMessage.innerHTML = `<p class="pos-message success">✅ Количество "${item.name}" увеличено до ${existingItem.quantity}.</p>`;
        } else {
            cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1
            });
            cartMessage.innerHTML = `<p class="pos-message success">✅ Товар "${item.name}" добавлен в чек.</p>`;
        }

        renderCart();
    }
    
    // --- ОБРАБОТЧИКИ КАССЫ ---

    // 1. Сканирование / Ввод
    scanInput.addEventListener('change', (e) => {
        const scanValue = e.target.value.trim();
        e.target.value = ''; // Очистка поля
        if (scanValue) {
            addItemToCart(scanValue);
        }
        scanInput.focus(); // Возвращаем фокус для следующего сканирования
    });

    // 2. Изменение количества или удаление из корзины
    cartTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('cart-quantity-input')) {
            const id = parseInt(e.target.dataset.id);
            const newQuantity = parseInt(e.target.value);
            
            if (newQuantity <= 0) {
                // Если количество <= 0, удаляем товар
                cart = cart.filter(item => item.id !== id);
            } else {
                // Иначе обновляем количество
                const item = cart.find(item => item.id === id);
                if (item) item.quantity = newQuantity;
            }
            renderCart();
        }
    });

    cartTbody.addEventListener('click', (e) => {
        if (e.target.closest('.remove-from-cart-btn')) {
            const id = parseInt(e.target.closest('.remove-from-cart-btn').dataset.id);
            cart = cart.filter(item => item.id !== id);
            cartMessage.innerHTML = `<p class="pos-message success">Товар удален из чека.</p>`;
            renderCart();
        }
    });

    // 3. Очистка чека
    clearCartBtn.addEventListener('click', () => {
        if (cart.length > 0 && confirm('Вы уверены, что хотите очистить весь чек?')) {
            cart = [];
            cartMessage.innerHTML = `<p class="pos-message info">Чек очищен.</p>`;
            renderCart();
            scanInput.focus();
        }
    });
    
    // 4. Завершение продажи
    completeSaleBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert("Нельзя завершить продажу: чек пуст!");
            return;
        }
        const total = parseFloat(totalAmountEl.textContent);
        alert(`Продажа завершена! К оплате: ${total.toFixed(2)} USD. (В реальной системе здесь был бы вызов API для сохранения чека)`);
        
        // Имитация завершения: очистка корзины
        cart = [];
        cartMessage.innerHTML = `<p class="pos-message success">✅ Продажа успешно завершена! Чек закрыт.</p>`;
        renderCart();
        scanInput.focus();
    });

    // =================================================================
    //                       ФУНКЦИИ КАТАЛОГА / CRUD
    // =================================================================

    /** Отправка GET-запроса на получение списка товаров. */
    async function fetchProducts() {
        productList.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Загрузка товаров...</p>';
        try {
            const response = await fetch('/api/products/');
            if (!response.ok) {
                throw new Error('Ошибка сети при получении товаров');
            }
            const products = await response.json();
            productCache = products; // Обновляем кеш для Кассы
            renderCatalog(products);
        } catch (error) {
            productList.innerHTML = `<p style="color: red; font-weight: bold;">❌ Ошибка: ${error.message}</p>`;
        }
    }

    /** Рендеринг списка товаров в Каталоге. */
    function renderCatalog(products) {
        if (products.length === 0) {
            productList.innerHTML = '<p style="text-align: center; color: #777;">Нет товаров. Используйте "Добавить товар".</p>';
            return;
        }

        productList.innerHTML = products.map(product => `
            <div class="product-card" data-id="${product.id}">
                ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : `<div class="no-image-placeholder"><i class="fas fa-image fa-2x"></i></div>`}
                
                <h3 title="${product.name}">${product.name}</h3>
                <p class="sku">ID: ${product.id} | SKU: ${product.sku}</p>
                <p style="font-size: 1.2em; font-weight: 700; color: #28a745;">$${product.price.toFixed(2)}</p>
                
                <div class="actions">
                    <button class="add-to-cart-btn cta-button primary" data-id="${product.id}" style="flex-grow: 1.5; background-color: var(--primary-color);">
                        <i class="fas fa-cart-plus"></i> В чек
                    </button>
                    <button class="edit-btn cta-button secondary" data-id="${product.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn cta-button" data-id="${product.id}" style="background-color: #dc3545;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
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
                fetchProducts(); // Обновляем и каталог, и кеш
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

    // --- ОБРАБОТЧИКИ КАТАЛОГА ---

    // 1. Переключение формы добавления
    toggleAddFormBtn.addEventListener('click', () => {
        const isVisible = addProductSection.style.display !== 'none';
        addProductSection.style.display = isVisible ? 'none' : 'block';
        toggleAddFormBtn.innerHTML = isVisible ? '<i class="fas fa-plus"></i> Добавить товар' : '<i class="fas fa-minus"></i> Скрыть форму';
        formMessage.innerHTML = '';
        apiStatus.style.display = 'none';
    });
    
    // 2. Создание товара
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newProduct = {
            name: document.getElementById('name').value,
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
            price: parseFloat(document.getElementById('edit-price').value),
            sku: document.getElementById('edit-sku').value,
            image_url: document.getElementById('edit-image_url').value || null 
        };

        const success = await sendProductData(`/api/products/${productId}`, 'PUT', updatedProduct, `Товар ID ${productId} обновлен!`, editMessage);
        
        if (success) {
            setTimeout(() => { editModal.style.display = 'none'; }, 1000); 
        }
    });

    // 4. Делегирование событий Каталога (Edit, Delete, Add to Cart)
    productList.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const productId = target.dataset.id;
        if (!productId) return;

        // Добавление в чек из каталога
        if (target.classList.contains('add-to-cart-btn')) {
            addItemToCart(productId);
            scanInput.focus();
            return;
        }

        // Редактирование
        if (target.classList.contains('edit-btn')) {
            try {
                const product = productCache.find(p => p.id.toString() === productId);
                if (!product) throw new Error("Товар не найден в кеше.");
                
                document.getElementById('edit-product-id').textContent = productId;
                document.getElementById('edit-id').value = productId;
                document.getElementById('edit-name').value = product.name;
                document.getElementById('edit-price').value = product.price;
                document.getElementById('edit-sku').value = product.sku;
                document.getElementById('edit-image_url').value = product.image_url || '';

                editMessage.innerHTML = '';
                editModal.style.display = 'block';
            } catch (error) {
                formMessage.innerHTML = `<p class="pos-message error">❌ Ошибка: ${error.message}</p>`;
            }
        }

        // Удаление
        if (target.classList.contains('delete-btn')) {
            if (!confirm(`Вы уверены, что хотите удалить товар ID ${productId}?`)) return;

            await sendProductData(`/api/products/${productId}`, 'DELETE', null, `Товар ID ${productId} удален.`, formMessage);
            scanInput.focus();
        }
    });

    // 5. Проверка API
    document.getElementById('test-api').addEventListener('click', async () => {
        apiStatus.style.display = 'block';
        apiStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Запрос...';
        try {
            const response = await fetch('/api/status'); 
            const data = await response.json();
            
            apiStatus.innerHTML = `
                <i class="fas fa-check-circle" style="color: #28a745;"></i> <strong>Успех!</strong>
                Сообщение: ${data.message}<br>
                Инфо о БД: ${data.db_info}
            `;
        } catch (error) {
            apiStatus.innerHTML = `
                <i class="fas fa-times-circle" style="color: #dc3545;"></i> <strong>Ошибка связи!</strong>
                Проверьте, запущен ли Backend.
            `;
        }
    });


    // --- Инициализация и закрытие модального окна ---
    const editCloseBtn = document.querySelector('.edit-close-btn');
    if (editCloseBtn) {
        editCloseBtn.onclick = function() { editModal.style.display = 'none'; };
    }

    window.onclick = function(event) {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
    }

    // Инициализация при загрузке страницы
    fetchProducts();
    renderCart();
    scanInput.focus(); // Устанавливаем фокус на поле сканера сразу
});
