import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship
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

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String, index=True, nullable=False)
    price = Column(Float, nullable=False)
    sku = Column(String, unique=True, index=True)
    
    # Добавлено поле 'stock' для соответствия фронтенду
    stock = Column(Float, default=0.0) 
    
    is_active = Column(Boolean, default=True)
    image_url = Column(String, nullable=True)
    qr_code_url = Column(String, nullable=True)

    category = relationship("Category", back_populates="products")

class Counterparty(Base):
    """Модель для хранения информации о контрагентах (покупателях)."""
    __tablename__ = "counterparties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    # БИН/ИИН - делаем уникальным, чтобы избежать дубликатов
    bin = Column(String, unique=True, index=True, nullable=True) 
    phone = Column(String, nullable=True)

class Category(Base):
    """Модель для хранения категорий товаров и подкатегорий."""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    
    # 💥 НОВОЕ: Внешний ключ для связи с родительской категорией 💥
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True) 
    
    # Связь с товарами (оставлена как есть)
    products = relationship("Product", back_populates="category")
    
    # 💥 НОВЫЕ СВЯЗИ ДЛЯ ИЕРАРХИИ 💥
    # Связь с родителем (одна родительская категория)
    parent = relationship(
        "Category", 
        remote_side=[id], # Указываем, что id - это сторона, к которой мы обращаемся
        back_populates="children", 
        uselist=False # Категория имеет только одного родителя
    )
    
    # Связь с дочерними элементами (много подкатегорий)
    children = relationship(
        "Category", 
        back_populates="parent"
    )


# --- 3. Создание Таблиц (если их нет) ---

def create_db_and_tables():
    Base.metadata.create_all(bind=engine)
