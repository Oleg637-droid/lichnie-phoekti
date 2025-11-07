# backend/ai_models.py

from pydantic import BaseModel, Field
from typing import Literal, Optional
import json
from google import genai
from google.genai import types
import os

# ----------------------------------------------------------------------
# Схема (Ваш код)
# ----------------------------------------------------------------------
CommandType = Literal['add_item', 'clear_cart', 'complete_sale', 'open_management']

class VoiceCommand(BaseModel):
    """Схема для выполнения команды на POS-терминале."""
    
    command: CommandType = Field(
        ..., 
        description="Тип команды для выполнения на фронтенде. Выберите один из: 'add_item', 'clear_cart', 'complete_sale', 'open_management'."
    )
    
    product_name_or_sku: Optional[str] = Field(
        None, 
        description="Название товара или SKU, если команда 'add_item'. Должно быть строкой (например: 'Кока-кола', '12345')."
    )
    quantity: Optional[float] = Field(
        None, 
        description="Количество товара, если команда 'add_item'. Должно быть числом. Используйте 1.0, если количество не указано."
    )
# ----------------------------------------------------------------------


# 1. Инициализация клиента Gemini
# Используем API ключ из переменной окружения, или заглушку, как в main.py
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyDNw171aCl0VntBWxxx12mQxwAIRzrtW4k")

try:
    # Инициализируем клиента здесь, так как main.py передает ему только текст
    client = genai.Client(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"Ошибка инициализации Gemini клиента в ai_models: {e}")
    client = None

def process_command_with_gemini(recognized_text: str) -> VoiceCommand:
    """
    Отправляет распознанный текст в Gemini с инструкцией 
    вернуть команду в формате VoiceCommand Pydantic.
    """
    if not client:
        # В случае сбоя клиента возвращаем явную ошибку
        raise ConnectionError("Gemini client не инициализирован. Проверьте API ключ.")
    
    # ⚠️ Получаем схему для настройки ответа модели
    json_schema = VoiceCommand.model_json_schema()
    
    system_instruction = (
        "Ты — AI-помощник для POS-терминала. Твоя задача — проанализировать "
        "голосовую команду пользователя и преобразовать ее в JSON-объект, "
        "строго соответствующий предоставленной схеме. "
        "Всегда выбирай наиболее подходящий тип команды (command). "
        "Если пользователь просит добавить товар, извлеки название/SKU и количество. "
        "Если количество не указано, используй 1.0. "
        "Если команда явно не указана, выбери наиболее вероятную команду."
    )
    
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=json_schema,
    )
    
    prompt = f"Распознанная команда пользователя: '{recognized_text}'"
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash', 
            contents=[prompt],
            config=config,
            system_instruction=system_instruction
        )
        
        # Парсинг JSON-строки, возвращенной моделью
        json_data = json.loads(response.text.strip())
        
        # Валидация через Pydantic
        return VoiceCommand.model_validate(json_data)
        
    except Exception as e:
        print(f"Ошибка при работе с Gemini или парсинге JSON: {e}")
        # Генерируем исключение, которое main.py поймает и вернет как 400
        raise ValueError(f"AI не смог обработать команду: {e}")
