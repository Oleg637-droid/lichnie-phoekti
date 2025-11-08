// =================================================================
//            --- ГОЛОСОВОЙ АССИСТЕНТ (ЛОГИКА AI) ---
// =================================================================

// --- Настройки Голосового Помощника ---
const WAKE_PHRASE = "джарвис";
const RESPONSES = [
    "Да, сэр.",
    "Слушаю, сэр.",
    "К вашим услугам."
];

let recognition;
let isListening = false;
let isCommandMode = false; // Флаг для отслеживания режима команды
let commandTimeout; // Для управления 3-секундной паузой

// DOM элемент для визуальной индикации (voiceInputBtn должен быть доступен глобально)
const voiceInputBtn = document.getElementById('voice-input-btn'); 


// Вспомогательная функция для озвучивания ответа (Text-to-Speech)
function speak(text) {
    if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("Браузер не поддерживает синтез речи.");
    }
}

/** * Главная функция, которая запускает сессию распознавания.
 */
function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        window.showVoiceStatus("❌ Web Speech API не поддерживается.");
        return;
    }

    if (isListening) return;

    // Инициализация при первом запуске
    if (!recognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; 
        recognition.interimResults = true; 
        recognition.lang = 'ru-RU';
        // Устанавливаем все обработчики
        setupRecognitionHandlers();
    }
    
    try {
        recognition.start();
    } catch (e) {
        // Ошибка, если микрофон уже запущен
        if (e.name === 'InvalidStateError') {
             console.warn("Попытка повторного запуска микрофона.");
             return;
        }
        console.error("Критическая ошибка при старте:", e);
        // Повторная попытка через 2 секунды
        setTimeout(startRecognition, 2000); 
    }
}

/**
 * Устанавливает обработчики событий для объекта распознавания.
 */
function setupRecognitionHandlers() {

    recognition.onstart = () => {
        isListening = true;
        isCommandMode = false;
        // Используем функцию из pos.js
        window.showVoiceStatus(`Готов к работе (активация: ${WAKE_PHRASE})`);
    };

    recognition.onresult = (event) => {
        // --- ИСПРАВЛЕНИЕ: Правильное извлечение текста ---
        let final_transcript = '';
        let current_transcript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (event.results[i].isFinal) {
                final_transcript += transcript + ' '; // Добавляем пробел для разделения финальных частей
            } else {
                current_transcript += transcript; // Промежуточный результат
            }
        }
        final_transcript = final_transcript.trim();

        // Текст для проверки активации/промежуточного отображения
        const currentText = (final_transcript || current_transcript).toLowerCase();
    
        // 1. ЛОГИКА АКТИВАЦИИ (WAKE WORD)
        if (!isCommandMode && currentText.includes(WAKE_PHRASE)) {
            
            // Активируем режим команды
            isCommandMode = true;
            window.showVoiceStatus(`Ожидаю команду...`);
            voiceInputBtn.classList.add('waiting-command');

            // --- ОБРАБОТКА НЕПОСРЕДСТВЕННОЙ КОМАНДЫ (Джарвис, очисти чек) ---
            const textAfterWake = currentText.substring(currentText.indexOf(WAKE_PHRASE) + WAKE_PHRASE.length).trim();
            
            if (final_transcript && textAfterWake.length > 0) {
                // Команда пришла сразу же. Обрабатываем и не останавливаемся.
                clearTimeout(commandTimeout);
                recognition.stop(); // Остановим текущую сессию для обработки
                
                // 🔑 Вызов функции pos.js для отправки на бэкенд
                window.sendTextToBackend(textAfterWake);
                return;
            }
            
            // --- ЛОГИКА ТАЙМАУТА (3 секунды) ---
            clearTimeout(commandTimeout);
            
            commandTimeout = setTimeout(() => {
                if (isCommandMode) { // Если не поступила команда за 3 секунды
                    const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
                    speak(response);
                    window.showVoiceStatus(`Ожидаю команду... (Ответ: ${response})`);
                }
            }, 3000); // 3 секунды
            
            // Если была обнаружена только фраза активации, останавливаем для более чистого прослушивания
            // В противном случае, onend вызовет перезапуск, и мы попадем в commandMode.
            if (!final_transcript) {
                recognition.stop();
                return;
            }
        } 
        
        // 2. ЛОГИКА КОМАНДЫ (после активации и окончательный результат)
        if (isCommandMode && final_transcript) {
            
            clearTimeout(commandTimeout); // Команда поступила, сбрасываем таймер
    
            // Очищаем команду от "джарвис" и пробелов (если она была в начале)
            let commandText = final_transcript.replace(new RegExp(WAKE_PHRASE, 'g'), '').trim();
    
            if (commandText.length > 0) {
                voiceInputBtn.classList.remove('waiting-command');
                recognition.stop(); // Останавливаем сессию для обработки
    
                // 🔑 Вызов функции pos.js для отправки на бэкенд
                window.sendTextToBackend(commandText);
            } else {
                // Услышали только "Джарвис" и тишина -> ждем таймаут (который уже запущен)
            }
        }
    };

    recognition.onend = () => {
        isListening = false;
        isCommandMode = false; // Сброс режима команды
        clearTimeout(commandTimeout); // Сброс таймера при завершении сессии
        voiceInputBtn.classList.remove('waiting-command');
        window.showVoiceStatus("Прослушивание остановлено. Перезапуск...");
        
        // 🔑 АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК
        setTimeout(() => {
            if (!isListening) { 
                startRecognition(); 
            }
        }, 100); 
    };
    
    recognition.onerror = (event) => {
        isListening = false;
        isCommandMode = false;
        voiceInputBtn.classList.remove('waiting-command');
        
        const errorMessage = `Ошибка: ${event.error}`;
        window.showVoiceStatus(errorMessage);
        console.error(errorMessage);
    };
}


/** * Главная функция, которая включает постоянное прослушивание.
 * Сделана глобальной для вызова из pos.js.
 */
window.startContinuousListening = function() {
    startRecognition();
}

// Устанавливаем статус по умолчанию
document.addEventListener('DOMContentLoaded', () => {
    if (!isListening) {
        window.showVoiceStatus("Загрузка голосового помощника...");
    }
});
