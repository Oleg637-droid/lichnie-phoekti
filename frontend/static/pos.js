document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = document.querySelector('.burger-menu-btn');
    const navMenu = document.querySelector('.navigation-menu');

    // Логика переключения бургер-меню
    burgerBtn.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        burgerBtn.classList.toggle('active');
    });

    // --- Остальной код для POS-терминала (если он там есть)
    // ...
});

document.addEventListener('DOMContentLoaded', () => {
    const productForm = document.getElementById('product-form');
    const productList = document.getElementById('product-list');
    const formMessage = document.getElementById('form-message');
    const testApiButton = document.getElementById('test-api');
    const apiStatus = document.getElementById('api-status');

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

            // Создаем карточки товаров
            productList.innerHTML = products.map(product => `
                <div class="product-card" data-id="${product.id}" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                    <h3>${product.name} (ID: ${product.id})</h3>
                    <p>Цена: ${product.price} руб.</p>
                    <p>Артикул (SKU): ${product.sku}</p>
                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" style="max-width: 100px;">` : ''}
                    <button class="delete-btn" data-id="${product.id}">Удалить</button>
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

    // --- 3. Обработчик удаления товара (DELETE) ---
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
    
    // --- 4. Обработчик проверки API (Статус) ---
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

