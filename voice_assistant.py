import speech_recognition as sr
import pyttsx3
import threading
import queue
import time
import requests
import json
from datetime import datetime

class VoiceAssistant:
    def __init__(self):
        # Инициализация голосового движка
        self.tts_engine = pyttsx3.init()
        self.tts_engine.setProperty('rate', 150)  # Скорость речи
        self.tts_engine.setProperty('volume', 0.8)  # Громкость
        
        # Инициализация распознавания речи
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Очередь для команд
        self.command_queue = queue.Queue()
        self.is_listening = False
        self.is_speaking = False
        
        # Настройка микрофона
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source)
        
        # База знаний помощника
        self.knowledge_base = {
            "приветствия": ["привет", "здравствуй", "добрый день", "доброе утро", "добрый вечер"],
            "прощания": ["пока", "до свидания", "выход", "закрыть"],
            "команды_кассы": [
                "добавить товар", "удалить товар", "посчитать сумму", "очистить корзину",
                "распечатать чек", "завершить продажу", "найти товар", "поиск товара"
            ],
            "вопросы_товары": [
                "цена товара", "стоимость", "сколько стоит", "есть в наличии",
                "описание товара", "характеристики"
            ],
            "команды_системы": [
                "время", "дата", "помощь", "что ты умеешь", "справка"
            ]
        }
        
        # Ответы помощника
        self.responses = {
            "greeting": [
                "Приветствую! Я ваш голосовой помощник для кассовой системы.",
                "Здравствуйте! Чем могу помочь?",
                "Добрый день! Готов к работе."
            ],
            "farewell": [
                "До свидания! Хорошего дня!",
                "Всего доброго! Обращайтесь еще.",
                "Пока! Буду ждать ваших команд."
            ],
            "unknown": [
                "Извините, я не понял команду. Повторите, пожалуйста.",
                "Не совсем понимаю, что вы имеете в виду.",
                "Можете переформулировать запрос?"
            ],
            "help": [
                "Я умею: добавлять товары в корзину, считать сумму, печатать чеки, искать товары.",
                "Мои команды: сказать 'добавить iPhone' или 'сколько стоит Samsung'.",
                "Попросите: 'найди товар', 'очисти корзину', 'распечатай чек'."
            ]
        }
    
    def speak(self, text):
        """Произносит текст"""
        def _speak():
            self.is_speaking = True
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
            self.is_speaking = False
        
        thread = threading.Thread(target=_speak)
        thread.start()
    
    def listen(self):
        """Слушает и распознает речь"""
        try:
            with self.microphone as source:
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=5)
            
            text = self.recognizer.recognize_google(audio, language="ru-RU")
            return text.lower()
        except sr.WaitTimeoutError:
            return None
        except sr.UnknownValueError:
            return "неразборчиво"
        except Exception as e:
            return f"ошибка: {str(e)}"
    
    def process_command(self, command):
        """Обрабатывает голосовую команду"""
        if not command or command == "неразборчиво":
            return self.respond("unknown")
        
        print(f"Распознано: {command}")
        
        # Приветствия
        if any(greeting in command for greeting in self.knowledge_base["приветствия"]):
            return self.respond("greeting")
        
        # Прощания
        if any(farewell in command for farewell in self.knowledge_base["прощания"]):
            return self.respond("farewell")
        
        # Помощь
        if "помощь" in command or "справка" in command or "что ты умеешь" in command:
            return self.respond("help")
        
        # Время и дата
        if "время" in command:
            current_time = datetime.now().strftime("%H:%M")
            return f"Сейчас {current_time}"
        
        if "дата" in command:
            current_date = datetime.now().strftime("%d.%m.%Y")
            return f"Сегодня {current_date}"
        
        # Команды для кассы
        response = self.process_cashier_command(command)
        if response:
            return response
        
        return self.respond("unknown")
    
    def process_cashier_command(self, command):
        """Обрабатывает команды связанные с кассой"""
        # Добавление товара
        if "добавить" in command or "положить" in command:
            product_name = self.extract_product_name(command)
            return f"Добавляю товар {product_name} в корзину"
        
        # Удаление товара
        if "удалить" in command or "убери" in command:
            product_name = self.extract_product_name(command)
            return f"Удаляю товар {product_name} из корзины"
        
        # Поиск товара
        if "найди" in command or "поиск" in command or "найти" in command:
            product_name = self.extract_product_name(command)
            return f"Ищу товар {product_name} в базе данных"
        
        # Сумма
        if "сумма" in command or "итого" in command or "посчитай" in command:
            return "Подсчитываю общую сумму заказа"
        
        # Чек
        if "чек" in command or "распечатай" in command:
            return "Формирую и печатаю кассовый чек"
        
        # Очистка корзины
        if "очисти" in command or "очистить" in command:
            return "Очищаю корзину покупок"
        
        # Завершение продажи
        if "заверши" in command or "продажа" in command:
            return "Завершаю текущую продажу"
        
        return None
    
    def extract_product_name(self, command):
        """Извлекает название товара из команды"""
        # Убираем стоп-слова и извлекаем существительные
        stop_words = ["добавить", "удалить", "найди", "поиск", "найти", "товар", "продукт"]
        
        words = command.split()
        product_words = [word for word in words if word not in stop_words]
        
        return " ".join(product_words) if product_words else "неизвестный товар"
    
    def respond(self, response_type):
        """Возвращает случайный ответ из базы"""
        import random
        return random.choice(self.responses.get(response_type, self.responses["unknown"]))
    
    def start_listening(self):
        """Запускает фоновое прослушивание"""
        self.is_listening = True
        
        def listen_loop():
            while self.is_listening:
                if not self.is_speaking:  # Не слушаем пока говорим
                    command = self.listen()
                    if command and command not in ["неразборчиво", None]:
                        response = self.process_command(command)
                        self.speak(response)
                        self.command_queue.put({"command": command, "response": response})
                time.sleep(0.1)
        
        thread = threading.Thread(target=listen_loop)
        thread.daemon = True
        thread.start()
    
    def stop_listening(self):
        """Останавливает прослушивание"""
        self.is_listening = False
    
    def get_last_command(self):
        """Возвращает последнюю команду из очереди"""
        try:
            return self.command_queue.get_nowait()
        except queue.Empty:
            return None

# Создаем глобальный экземпляр помощника
assistant = VoiceAssistant()
