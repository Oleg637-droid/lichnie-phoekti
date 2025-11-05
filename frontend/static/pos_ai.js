// =================================================================
//           --- ГОЛОСОВОЙ АССИСТЕНТ (ЛОГИКА AI) ---
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

// DOM элемент для визуальной индикации (voiceInputBtn определен в pos.js)
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

/** * Главная функция, которая включает постоянное прослушивание,
 * отслеживает кодовое слово и команду.
 * Сделана глобальной для вызова из pos.js.
 */
window.startContinuousListening = function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        window.showVoiceStatus("❌ Web Speech API не поддерживается.");
        return;
    }

    if (isListening) return;

    recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = 'ru-RU';

    recognition.onstart = () => {
        isListening = true;
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
        if (!window.isWakeWordDetected) {
            if (currentText.includes(WAKE_PHRASE)) {
                
                const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
                
                speak(response);

                // Используем глобальный флаг из pos.js
                window.isWakeWordDetected = true; 
                window.showVoiceStatus(`Ожидаю команду... (Ответ: ${response})`);
                
                // Визуализация
                voiceInputBtn.classList.add('waiting-command');
                
                // Таймаут для автоматического сброса
                setTimeout(() => {
                    if (window.isWakeWordDetected) {
                         window.isWakeWordDetected = false;
                         window.showVoiceStatus(`Готов к работе (активация: ${WAKE_PHRASE})`);
                         voiceInputBtn.classList.remove('waiting-command');
                    }
                }, 5000); // 5 секунд на ввод команды
            }
        } else {
            // 2. ЛОГИКА КОМАНДЫ (ПОСЛЕ АКТИВАЦИИ)
            if (final_transcript) {
                
                window.isWakeWordDetected = false; 
                voiceInputBtn.classList.remove('waiting-command');
                
                // Используем функцию из pos.js для отправки
                window.sendTextToBackend(final_transcript); 
            }
        }
    };

    recognition.onend = () => {
        isListening = false;
        window.isWakeWordDetected = false;
        voiceInputBtn.classList.remove('waiting-command');
        window.showVoiceStatus("Прослушивание остановлено. Перезапуск...");
        
        // Автоматический перезапуск
        setTimeout(() => {
            if (!isListening) { 
                startContinuousListening(); 
            }
        }, 500); 
    };
    
    recognition.onerror = (event) => {
        isListening = false;
        window.isWakeWordDetected = false;
        voiceInputBtn.classList.remove('waiting-command');
        
        const errorMessage = `Ошибка: ${event.error}`;
        window.showVoiceStatus(errorMessage);
        console.error(errorMessage);
        
        // Перезапускаем после ошибки
        if (event.error !== 'no-speech') {
            recognition.stop(); 
        } else {
            // Если просто не было речи, продолжаем слушать
            startContinuousListening();
        }
    };

    // Запускаем прослушивание
    recognition.start();
}

// Устанавливаем статус по умолчанию
document.addEventListener('DOMContentLoaded', () => {
    // Временно, пока pos.js не запустится и не вызовет startContinuousListening()
    if (!window.isWakeWordDetected) {
        window.showVoiceStatus("Загрузка голосового помощника...");
    }
});
