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
        productList.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Загрузка товаров...</p>';
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

    /** Рендеринг списка товаров (Адаптировано под новую разметку). */
    function renderProducts(products) {
        if (products.length === 0) {
            productList.innerHTML = '<p style="text-align: center; color: #777;">В каталоге нет товаров. Добавьте первый товар!</p>';
            return;
        }

        productList.innerHTML = products.map(product => `
            <div class="product-card" data-id="${product.id}">
                ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : `<div style="height: 100px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 5px; margin-bottom: 15px; color: #aaa;"><i class="fas fa-image fa-2x"></i></div>`}
                
                <h3 title="${product.name}">${product.name}</h3>
                <p class="sku">ID: ${product.id} | SKU: ${product.sku}</p>
                <p style="font-size: 1.2em; font-weight: 700; color: #28a745;">$${product.price.toFixed(2)}</p>
                
                <div class="actions">
                    <button class="edit-btn cta-button secondary" data-id="${product.id}">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="delete-btn cta-button" data-id="${product.id}" style="background-color: #dc3545;">
                        <i class="fas fa-trash-alt"></i> Удалить
                    </button>
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
                errorEl.innerHTML = `<p class="pos-message success">✅ ${successMsg}</p>`;
                if (method === 'POST') productForm.reset();
                fetchProducts();
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
            setTimeout(() => { editModal.style.display = 'none'; }, 1000); 
        }
    });

    // --- 3. Делегирование событий (Редактирование, Удаление) ---
    productList.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const productId = target.dataset.id;
        if (!productId) return;

        // 3.1. РЕДАКТИРОВАНИЕ (UPDATE)
        if (target.classList.contains('edit-btn')) {
            try {
                const response = await fetch(`/api/products/${productId}`);
                const product = await response.json();

                // Заполнение полей формы
                document.getElementById('edit-product-id').textContent = productId;
                document.getElementById('edit-id').value = productId;
                document.getElementById('edit-name').value = product.name;
                document.getElementById('edit-price').value = product.price;
                document.getElementById('edit-sku').value = product.sku;
                document.getElementById('edit-image_url').value = product.image_url || '';

                editMessage.innerHTML = '';
                editModal.style.display = 'block';
            } catch (error) {
                formMessage.innerHTML = `<p class="pos-message error">❌ Ошибка загрузки товара: ${error.message}</p>`;
            }
        }

        // 3.2. УДАЛЕНИЕ (DELETE)
        if (target.classList.contains('delete-btn')) {
            if (!confirm(`Вы уверены, что хотите удалить товар ID ${productId}?`)) return;

            try {
                const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
                
                if (response.status === 204) {
                    formMessage.innerHTML = `<p class="pos-message success">✅ Товар ID ${productId} удален.</p>`;
                    fetchProducts();
                } else {
                    formMessage.innerHTML = `<p class="pos-message error">❌ Ошибка удаления товара ID ${productId}.</p>`;
                }
            } catch (error) {
                formMessage.innerHTML = `<p class="pos-message error">❌ Ошибка сети при удалении: ${error.message}</p>`;
            }
        }
    });

    // --- 4. Обработчик проверки API (Статус) ---
    document.getElementById('test-api').addEventListener('click', async () => {
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
