document.addEventListener('DOMContentLoaded', () => {
    // --- ОСНОВНЫЕ DOM-ЭЛЕМЕНТЫ ---
    const productList = document.getElementById('product-list');
    const formMessage = document.getElementById('form-message');
    const apiStatus = document.getElementById('api-status');

    // Форма создания
    const productForm = document.getElementById('product-form');

    // Модальное окно Редактирования
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-product-form');
    const editMessage = document.getElementById('edit-form-message');


    // --- Вспомогательные функции ---

    /** Отправка GET-запроса на получение списка товаров. */
    async function fetchProducts() {
        productList.innerHTML = '<p>Загрузка товаров...</p>';
        try {
            const response = await fetch('/api/products/');
            if (!response.ok) {
                throw new Error('Ошибка сети при получении товаров');
            }
            const products = await response.json();
            renderProducts(products);
        } catch (error) {
            productList.innerHTML = `<p style="color: red; font-weight: bold;">❌ Ошибка: ${error.message}</p>`;
        }
    }

    /** Рендеринг списка товаров. */
    function renderProducts(products) {
        if (products.length === 0) {
            productList.innerHTML = '<p>Нет добавленных товаров.</p>';
            return;
        }

        productList.innerHTML = products.map(product => `
            <div class="product-card" data-id="${product.id}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin-top: 0; color: #007bff;">${product.name}</h3>
                    <div style="font-weight: bold; color: #333;">SKU: ${product.sku}</div>
                </div>
                <p><strong>Цена:</strong> $${product.price.toFixed(2)}</p>
                ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" style="max-width: 80px; height: auto; margin-bottom: 10px; border-radius: 4px;">` : ''}
                
                <div style="margin-top: 10px;">
                    <button class="delete-btn cta-button" data-id="${product.id}" style="background-color: #dc3545; color: white;">Удалить</button>
                    <button class="edit-btn cta-button secondary" data-id="${product.id}" style="margin-left: 10px; background-color: #28a745; color: white;">Редактировать</button>
                </div>
            </div>
        `).join('');
    }

    /** Отправка данных на сервер (POST или PUT). */
    async function sendProductData(url, method, data, successMsg, errorEl) {
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                errorEl.textContent = `✅ ${successMsg}`;
                if (method === 'POST') productForm.reset();
                fetchProducts();
                return true;
            } else {
                const errorData = await response.json();
                errorEl.textContent = `❌ Ошибка: ${errorData.detail || 'Не удалось выполнить операцию'}`;
                return false;
            }
        } catch (error) {
            errorEl.textContent = `❌ Ошибка сети: ${error.message}`;
            return false;
        }
    }


    // --- 1. Обработчик добавления товара (CREATE) ---
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

    // --- 2. Обработчик редактирования товара (UPDATE) ---
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productId = document.getElementById('edit-id').value;
        const updatedProduct = {
            name: document.getElementById('edit-name').value,
            price: parseFloat(document.getElementById('edit-price').value),
            sku: document.getElementById('edit-sku').value,
            image_url: document.getElementById('edit-image_url').value || null 
        };

        const success = await sendProductData(`/api/products/${productId}`, 'PUT', updatedProduct, `Товар ID ${productId} успешно обновлен!`, editMessage);
        
        if (success) {
            // Закрываем модальное окно только при успехе
            setTimeout(() => { editModal.style.display = 'none'; }, 1000); 
        }
    });

    // --- 3. Делегирование событий (Редактирование, Удаление) ---
    productList.addEventListener('click', async (e) => {
        const target = e.target;
        const productId = target.dataset.id;
        if (!productId) return;

        // 3.1. РЕДАКТИРОВАНИЕ (UPDATE)
        if (target.classList.contains('edit-btn')) {
            try {
                // Загрузка данных конкретного товара
                const response = await fetch(`/api/products/${productId}`);
                const product = await response.json();

                // Заполнение полей формы
                document.getElementById('edit-product-id').textContent = productId;
                document.getElementById('edit-id').value = productId;
                document.getElementById('edit-name').value = product.name;
                document.getElementById('edit-price').value = product.price;
                document.getElementById('edit-sku').value = product.sku;
                document.getElementById('edit-image_url').value = product.image_url || '';

                editMessage.textContent = '';
                editModal.style.display = 'block';
            } catch (error) {
                formMessage.textContent = `❌ Ошибка загрузки товара для редактирования: ${error.message}`;
            }
        }

        // 3.2. УДАЛЕНИЕ (DELETE)
        if (target.classList.contains('delete-btn')) {
            if (!confirm(`Вы уверены, что хотите удалить товар ID ${productId}?`)) return;

            try {
                const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
                
                if (response.status === 204) {
                    formMessage.textContent = `✅ Товар ID ${productId} удален.`;
                    fetchProducts();
                } else {
                    formMessage.textContent = `❌ Ошибка удаления товара ID ${productId}.`;
                }
            } catch (error) {
                formMessage.textContent = `❌ Ошибка сети при удалении: ${error.message}`;
            }
        }
    });

    // --- 4. Обработчик проверки API (Статус) ---
    document.getElementById('test-api').addEventListener('click', async () => {
        apiStatus.textContent = 'Запрос...';
        try {
            const response = await fetch('/api/status'); 
            const data = await response.json();
            
            apiStatus.innerHTML = `
                <strong>✅ Успех! Backend ответил:</strong><br>
                Сообщение: ${data.message}<br>
                Инфо о БД: ${data.db_info}
            `;
        } catch (error) {
            apiStatus.innerHTML = `
                <strong>❌ Ошибка связи с Backend:</strong><br>
                ${error.message}. Проверьте, запущен ли сервер.
            `;
        }
    });


    // --- 5. Логика закрытия модального окна ---
    const editCloseBtn = document.querySelector('.edit-close-btn');
    if (editCloseBtn) {
        editCloseBtn.onclick = function() { editModal.style.display = 'none'; };
    }

    window.onclick = function(event) {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
    }

    // Инициализация
    fetchProducts();
});
