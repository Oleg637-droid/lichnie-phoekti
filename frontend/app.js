// Тестовый скрипт для проверки связи с Python Backend

document.getElementById('test-api').addEventListener('click', async () => {
    const statusElement = document.getElementById('api-status');
    statusElement.textContent = 'Запрос...';
    
    try {
        // Запрос на относительный путь. Python-сервер сам его обработает.
        const response = await fetch('/api/status'); 
        const data = await response.json();
        
        statusElement.innerHTML = `
            <strong>✅ Успех! Backend ответил:</strong><br>
            Статус: ${data.status}<br>
            Сообщение: ${data.message}<br>
            Инфо о БД: ${data.db_info}
        `;
    } catch (error) {
        statusElement.innerHTML = `
            <strong>❌ Ошибка связи с Backend:</strong><br>
            ${error.message}. Проверьте, запущен ли сервер.
        `;
    }
});
