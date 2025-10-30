document.addEventListener('DOMContentLoaded', () => {
    // --- ОБЩИЕ ПЕРЕМЕННЫЕ (для главной страницы и POS) ---
    // Для бургер-меню (хотя на странице POS оно не используется, переменные объявлены)
    const burgerBtn = document.querySelector('.burger-menu-btn');
    const navMenu = document.querySelector('.navigation-menu');
    
    // --- ПЕРЕМЕННЫЕ ДЛЯ POS-ТЕРМИНАЛА ---
    const productForm = document.getElementById('product-form');
    const productList = document.getElementById('product-list');
    const formMessage = document.getElementById('form-message');
    const testApiButton = document.getElementById('test-api');
    const apiStatus = document.getElementById('api-status');

    // --- ПЕРЕМЕННЫЕ ДЛЯ РЕДАКТИРОВАНИЯ (UPDATE) ---
    const editModal = document.getElementById('edit-modal');
    const closeBtn = document.querySelector('.close-btn');
    const editForm = document.getElementById('edit-product-form');
    const editMessage = document.getElementById('edit-form-message');


    // Логика переключения бургер-меню (для главной страницы)
    if (burgerBtn && navMenu) {
        burgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            burgerBtn.classList.toggle('active');
        });
    }

    // --- 1. Функция загрузки и отображения товаров (READ) ---
    async function fetchProducts() {
        productList.innerHTML = '<p>Загрузка товаров...</p>';
        try {
            const response = await fetch('/api/products/');
            const products = await response.json();
            
            if (products.length === 0) {
                productList.innerHTML = '<p>Нет добавленных товаров.</p>';
                return;
            }

            // Создаем карточки товаров (добавлена кнопка Редактировать)
            productList.innerHTML = products.map(product => `
                <div class="product-card" data-id="${product.id}" style="border: 1px solid #eee; padding: 15px; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin-top: 0; color: #007bff;">${product.name}</h3>
                        <div style="font-weight: bold; color: #3f51b5;">SKU: ${product.sku}</div>
                    </div>
                    <p><strong>Цена:</strong> ${product.price} руб.</p>
                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" style="max-width: 80px; height: auto; margin-bottom: 10px; border-radius: 4px;">` : ''}
                    
                    <div style="margin-top: 10px;">
                        <button class="delete-btn cta-button" data-id="${product.id}" style="background-color: #dc3545; color: white;">Удалить</button>
                        <button class="edit-btn cta-button secondary" data-id="${product.id}" 
                                data-name="${product.name}" 
                                data-price="${product.price}" 
                                data-sku="${product.sku}" 
                                data-image="${product.image_url || ''}"
                                style="margin-left: 10px; background-color: #28a745; color: white;">Редактировать</button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            productList.innerHTML = `<p style="color: red;">Ошибка загрузки товаров: ${error.message}</p>`;
        }
    }

    // --- 2. Обработчик добавления товара (CREATE) ---
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newProduct = {
            name: document.getElementById('name').value,
            price: parseFloat(document.getElementById('price').value),
            sku: document.getElementById('sku').value,
            image_url: document.getElementById('image_url').value || null 
        };

        try {
            const response = await fetch('/api/products/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });

            if (response.ok) {
                formMessage.textContent = '✅ Товар успешно добавлен!';
                productForm.reset();
                fetchProducts(); // Обновляем список
            } else {
                const errorData = await response.json();
                formMessage.textContent = `❌ Ошибка: ${errorData.detail || 'Не удалось добавить товар'}`;
            }
        } catch (error) {
            formMessage.textContent = `❌ Ошибка сети: ${error.message}`;
        }
    });
    
    // --- 3. Обработчики модального окна и кнопки редактирования ---

    // Открытие модального окна и заполнение полей
    productList.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            const btn = e.target;
            
            // Заполнение формы данными из data-атрибутов кнопки
            document.getElementById('edit-product-id').textContent = btn.dataset.id;
            document.getElementById('edit-id').value = btn.dataset.id;
            document.getElementById('edit-name').value = btn.dataset.name;
            document.getElementById('edit-price').value = parseFloat(btn.dataset.price);
            document.getElementById('edit-sku').value = btn.dataset.sku;
            document.getElementById('edit-image_url').value = btn.dataset.image;

            editMessage.textContent = ''; // Очистка сообщений
            editModal.style.display = 'block'; // Показать модальное окно
        }
    });

    // Закрытие модального окна по кнопке (X)
    if (closeBtn) {
        closeBtn.onclick = function() {
            editModal.style.display = 'none';
        }
    }

    // Закрытие модального окна по клику вне окна
    window.onclick = function(event) {
        if (event.target == editModal) {
            editModal.style.display = 'none';
        }
    }

    // --- 4. Обработчик отправки формы редактирования (UPDATE) ---
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const productId = document.getElementById('edit-id').value;
            const updatedProduct = {
                name: document.getElementById('edit-name').value,
                price: parseFloat(document.getElementById('edit-price').value),
                sku: document.getElementById('edit-sku').value,
                image_url: document.getElementById('edit-image_url').value || null 
            };

            try {
                const response = await fetch(`/api/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedProduct)
                });

                if (response.ok) {
                    editMessage.textContent = `✅ Товар ID ${productId} успешно обновлен!`;
                    editModal.style.display = 'none'; // Скрыть после успеха
                    fetchProducts(); // Обновляем список
                } else {
                    const errorData = await response.json();
                    editMessage.textContent = `❌ Ошибка: ${errorData.detail || 'Не удалось обновить товар'}`;
                }
            } catch (error) {
                editMessage.textContent = `❌ Ошибка сети: ${error.message}`;
            }
        });
    }


    // --- 5. Обработчик удаления товара (DELETE) ---
    productList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const productId = e.target.dataset.id;
            if (!confirm(`Вы уверены, что хотите удалить товар ID ${productId}?`)) {
                return;
            }

            try {
                const response = await fetch(`/api/products/${productId}`, {
                    method: 'DELETE',
                });

                if (response.status === 204) { // 204 No Content
                    formMessage.textContent = `✅ Товар ID ${productId} удален.`;
                    fetchProducts(); // Обновляем список
                } else {
                    formMessage.textContent = `❌ Ошибка удаления товара ID ${productId}.`;
                }
            } catch (error) {
                formMessage.textContent = `❌ Ошибка сети при удалении: ${error.message}`;
            }
        }
    });
    
    // --- 6. Обработчик проверки API (Статус) ---
    testApiButton.addEventListener('click', async () => {
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


    // Инициализация: Загрузка товаров при запуске
    fetchProducts();
});
