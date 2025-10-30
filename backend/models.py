import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# --- 1. Инициализация Базы Данных ---

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL is not None:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = 'sqlite:///./pos.db' # Изменено на pos.db для консистентности

engine = create_engine(DATABASE_URL)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- 2. Определение Моделей (Таблиц) ---

class Product(Base):
    """Модель для хранения информации о товарах."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String, index=True, nullable=False)
    price = Column(Float, nullable=False)
    sku = Column(String, unique=True, index=True)
    
    # Добавлено поле 'stock' для соответствия фронтенду
    stock = Column(Float, default=0.0) 
    
    is_active = Column(Boolean, default=True)
    image_url = Column(String, nullable=True)
    qr_code_url = Column(String, nullable=True)

class Counterparty(Base):
    """Модель для хранения информации о контрагентах (покупателях)."""
    __tablename__ = "counterparties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    # БИН/ИИН - делаем уникальным, чтобы избежать дубликатов
    bin = Column(String, unique=True, index=True, nullable=True) 
    phone = Column(String, nullable=True)


# --- 3. Создание Таблиц (если их нет) ---

def create_db_and_tables():
    Base.metadata.create_all(bind=engine)
