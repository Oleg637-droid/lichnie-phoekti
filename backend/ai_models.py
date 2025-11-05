# backend/ai_models.py

from pydantic import BaseModel, Field
from typing import Literal, Optional

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
