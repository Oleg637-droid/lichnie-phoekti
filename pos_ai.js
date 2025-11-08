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
let isCommandMode = false; 
let commandTimeout; 

// DOM элемент для визуальной индикации
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
        window.showVoiceStatus(`Готов к работе (активация: ${WAKE_PHRASE})`);
    };

    recognition.onresult = (event) => {

            speak("beep");
        
        // 🚨 КЛЮЧЕВАЯ ОТЛАДКА: если слышен звук "beep", микрофон РАБОТАЕТ.
        // speak("beep"); // Включите, если хотите проверять, что onresult срабатывает
        
        let final_transcript = '';
        let current_transcript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            if (event.results[i].isFinal) {
                final_transcript += transcript + ' '; 
            } else {
                current_transcript += transcript; 
            }
        }
        final_transcript = final_transcript.trim();

        const currentText = (final_transcript || current_transcript).toLowerCase();
    
        // 1. ЛОГИКА АКТИВАЦИИ (WAKE WORD)
        if (!isCommandMode && currentText.includes(WAKE_PHRASE)) {
            
            // Устанавливаем режим команды
            isCommandMode = true;
            window.showVoiceStatus(`Ожидаю команду...`);
            voiceInputBtn.classList.add('waiting-command');

            // --- ОБРАБОТКА НЕПОСРЕДСТВЕННОЙ КОМАНДЫ (Джарвис, очисти чек) ---
            const textAfterWake = currentText.substring(currentText.indexOf(WAKE_PHRASE) + WAKE_PHRASE.length).trim();
            
            if (final_transcript && textAfterWake.length > 0) {
                // Команда пришла сразу же (например, "Джарвис очисти чек")
                clearTimeout(commandTimeout);
                recognition.stop(); // Остановим текущую сессию для обработки
                
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
            
            // Останавливаем для чистого прослушивания команды
            if (!final_transcript) {
                recognition.stop();
                return;
            }
        } 
        
        // 2. ЛОГИКА КОМАНДЫ (после активации и окончательный результат)
        if (isCommandMode && final_transcript) {
            
            clearTimeout(commandTimeout); // Команда поступила, сбрасываем таймаут
    
            // Очищаем команду от "джарвис" (на случай, если сказали "Джарвис, а потом команда")
            let commandText = final_transcript.replace(new RegExp(WAKE_PHRASE, 'g'), '').trim();
    
            if (commandText.length > 0) {
                voiceInputBtn.classList.remove('waiting-command');
                recognition.stop(); 
    
                window.sendTextToBackend(commandText);
            }
        }
    };

    recognition.onend = () => {
        isListening = false;
        isCommandMode = false; 
        clearTimeout(commandTimeout); 
        voiceInputBtn.classList.remove('waiting-command');
        window.showVoiceStatus("Прослушивание остановлено. Перезапуск...");
        
        // АВТОМАТИЧЕСКИЙ ПЕРЕЗАПУСК (имитация 24/7)
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
        // Ошибка, связанная с микрофоном/безопасностью (например, NotAllowedError)
        // В этом случае лучше не перезапускать сразу, чтобы избежать спама ошибками.
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            window.showVoiceStatus("❌ Доступ к микрофону заблокирован. Проверьте HTTPS/Разрешения!");
        }
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
