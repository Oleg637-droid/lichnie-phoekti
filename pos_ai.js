// =================================================================
//           --- ГОЛОСОВОЙ АССИСТЕНТ (ЛОГИКА AI) ---
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
let isCommandMode = false; // 🆕 Флаг для отслеживания режима команды (заменяет window.isWakeWordDetected)

// DOM элемент для визуальной индикации (voiceInputBtn должен быть доступен глобально или через DOM)
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
        recognition.interimResults = true; // Важно для быстрого обнаружения Wake Word
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
        let final_transcript = '';
        let interim_transcript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (event.results[i].isFinal) {
                final_transcript += transcript;
            } else {
                interim_transcript += transcript;
            }
        }

        const currentText = (final_transcript || interim_transcript).toLowerCase();
        
        // 1. ЛОГИКА АКТИВАЦИИ (WAKE WORD)
        if (!isCommandMode) {
            if (currentText.includes(WAKE_PHRASE)) {
                
                const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
                speak(response);
                
                // 🔑 Активируем режим команды и немедленно останавливаем текущую сессию
                // для получения чистого ввода команды.
                isCommandMode = true;
                window.isWakeWordDetected = true; // Обновляем глобальный флаг
                window.showVoiceStatus(`Ожидаю команду... (Ответ: ${response})`);
                voiceInputBtn.classList.add('waiting-command');
                
                // ОСТАНОВКА: recognition.onend перезапустит прослушивание
                recognition.stop();
                return; 
            }
        } else {
            // 2. ЛОГИКА КОМАНДЫ (ПОСЛЕ АКТИВАЦИИ)
            if (final_transcript) {
                
                // Очищаем команду от "джарвис" и пробелов
                let commandText = final_transcript.replace(new RegExp(WAKE_PHRASE, 'g'), '').trim();
                
                if (commandText.length > 0) {
                    window.isWakeWordDetected = false; 
                    voiceInputBtn.classList.remove('waiting-command');
                    
                    // Используем функцию из pos.js для отправки
                    window.sendTextToBackend(commandText); 
                    
                    // ❗ Важно: не вызываем recognition.stop() здесь, чтобы дать onend 
                    // сработать автоматически после финального результата, завершая цикл.
                } else {
                    // Услышали "Джарвис", но чистой команды нет. Сброс.
                    recognition.stop();
                }
            }
        }
    };

    recognition.onend = () => {
        isListening = false;
        window.isWakeWordDetected = false; // Сброс глобального флага
        voiceInputBtn.classList.remove('waiting-command');
        window.showVoiceStatus("Прослушивание остановлено. Перезапуск...");
        
        // 🔑 АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК (имитация 24/7)
        setTimeout(() => {
            if (!isListening) { 
                startRecognition(); 
            }
        }, 100); // 100мс задержка для стабильности
    };
    
    recognition.onerror = (event) => {
        isListening = false;
        isCommandMode = false;
        window.isWakeWordDetected = false;
        voiceInputBtn.classList.remove('waiting-command');
        
        const errorMessage = `Ошибка: ${event.error}`;
        window.showVoiceStatus(errorMessage);
        console.error(errorMessage);
        
        // Ошибка сама вызовет onend, который перезапустит прослушивание.
        // Дополнительный recognition.stop() не требуется.
    };
}


/** * Главная функция, которая включает постоянное прослушивание.
 * Сделана глобальной для вызова из pos.js.
 */
window.startContinuousListening = function() {
    // В pos.js вы уже проверяете, если window.startContinuousListening существует, то вызываете.
    startRecognition();
}

// Устанавливаем статус по умолчанию
document.addEventListener('DOMContentLoaded', () => {
    // Временно, пока pos.js не запустится и не вызовет startContinuousListening()
    if (!isListening) {
        window.showVoiceStatus("Загрузка голосового помощника...");
    }
});
