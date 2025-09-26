import threading
import queue
import time
import requests
import json
from datetime import datetime

class VoiceAssistant:
    def __init__(self):
        # Очередь для команд
        self.command_queue = queue.Queue()
        self.is_listening = False
        self.is_speaking = False
        
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
        """Симулирует речь (в веб-интерфейсе)"""
        def _speak():
            self.is_speaking = True
            # В веб-версии используем браузерный синтез речи
            time.sleep(1)  # Имитация задержки речи
            self.is_speaking = False
        
        thread = threading.Thread(target=_speak)
        thread.start()
        return text
    
    def process_command(self, command):
        """Обрабатывает текстовую команду"""
        if not command:
            return self.respond("unknown")
        
        print(f"Обработка команды: {command}")
        
        command = command.lower()
        
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
        
        # Используем OpenAI для сложных запросов
        return self.process_with_ai(command)
    
    def process_cashier_command(self, command):
        """Обрабатывает команды связанные с кассой"""
        # Добавление товара
        if "добавить" in command or "положить" in command:
            product_name = self.extract_product_name(command)
            return f"Добавляю товар '{product_name}' в корзину"
        
        # Удаление товара
        if "удалить" in command or "убери" in command:
            product_name = self.extract_product_name(command)
            return f"Удаляю товар '{product_name}' из корзины"
        
        # Поиск товара
        if "найди" in command or "поиск" in command or "найти" in command:
            product_name = self.extract_product_name(command)
            return f"Ищу товар '{product_name}' в базе данных"
        
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
        
        # Цена товара
        if "сколько стоит" in command or "цена" in command:
            product_name = self.extract_product_name(command)
            return f"Ищу цену товара '{product_name}'"
        
        return None
    
    def process_with_ai(self, command):
        """Обрабатывает сложные запросы с помощью AI"""
        # Простая имитация AI для начала
        ai_responses = {
            "погода": "К сожалению, я не могу проверить погоду. Я специализируюсь на кассовых операциях.",
            "курс": "Я не имею доступа к текущим курсам валют. Обратитесь к финансовым сервисам.",
            "доставка": "Информацию о доставке уточняйте у менеджера.",
            "гарантия": "Гарантия на товары составляет 12 месяцев. Подробности уточняйте в отделе продаж."
        }
        
        for key, response in ai_responses.items():
            if key in command:
                return response
        
        return self.respond("unknown")
    
    def extract_product_name(self, command):
        """Извлекает название товара из команды"""
        stop_words = ["добавить", "удалить", "найди", "поиск", "найти", "товар", "продукт", "сколько", "стоит", "цена"]
        
        words = command.split()
        product_words = [word for word in words if word not in stop_words]
        
        return " ".join(product_words) if product_words else "неизвестный товар"
    
    def respond(self, response_type):
        """Возвращает случайный ответ из базы"""
        import random
        return random.choice(self.responses.get(response_type, self.responses["unknown"]))
    
    def start_listening(self):
        """Запускает симуляцию прослушивания"""
        self.is_listening = True
        return "Голосовой помощник активирован. Используйте текстовый ввод для команд."
    
    def stop_listening(self):
        """Останавливает прослушивание"""
        self.is_listening = False
        return "Помощник остановлен"

# Создаем глобальный экземпляр помощника
assistant = VoiceAssistant()
