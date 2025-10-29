from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

# --- 1. Инициализация Базы Данных ---

# Render передает нам URL через переменную окружения.
# Если переменной нет (локальный запуск), используем SQLite для теста.
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./test.db')

# Создаем "движок" подключения к БД
engine = create_engine(DATABASE_URL)

# Базовый класс для всех моделей (таблиц)
Base = declarative_base()

# Создаем фабрику сессий (для общения с БД)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- 2. Определение Модели (Таблицы) "Товары" ---

class Product(Base):
    """Модель для хранения информации о товарах."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    
    # Информация о товаре
    name = Column(String, index=True, nullable=False)
    price = Column(Float, nullable=False) # Цена (используем Float, т.к. валюта)
    sku = Column(String, unique=True, index=True) # Артикул (уникальный)
    
    # Дополнительная информация
    is_active = Column(Boolean, default=True) # Активен ли товар
    image_url = Column(String, nullable=True) # Ссылка на фото
    qr_code_url = Column(String, nullable=True) # Ссылка на QR-код (если есть)

# --- 3. Создание Таблиц (если их нет) ---

# Эта команда создает все таблицы, унаследованные от Base,
# если их еще нет в базе данных.
def create_db_and_tables():
    Base.metadata.create_all(bind=engine)
