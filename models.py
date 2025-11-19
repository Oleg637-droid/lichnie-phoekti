import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.schema import UniqueConstraint 

# --- 1. Инициализация Базы Данных ---

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL is not None:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = 'sqlite:///./pos.db' 

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- 2. Определение Моделей (Таблиц) ---

class Category(Base):
    """Модель для хранения категорий товаров и подкатегорий (СТАРАЯ ТАБЛИЦА)."""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete='SET NULL'), nullable=True)
    
    products = relationship("Product", back_populates="category")
    
    parent = relationship("Category", remote_side=[id], back_populates="children", uselist=False)
    children = relationship("Category", back_populates="parent")

    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}')>"


class Product(Base):
    """Модель для хранения ОБЩЕЙ информации о товарах (СТАРАЯ ТАБЛИЦА)."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    
    # Общие поля
    name = Column(String(255), nullable=False)
    sku = Column(String(50), index=True, nullable=False) # Артикул
    price = Column(Float, nullable=False)
    stock = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    image_url = Column(String(512), nullable=True)
    qr_code_url = Column(String(512), nullable=True)
    
    # Внешний ключ на Категорию
    category_id = Column(Integer, ForeignKey("categories.id", ondelete='SET NULL'), nullable=True)
    category = relationship("Category", back_populates="products")
    
    # НОВАЯ СВЯЗЬ: ОДИН К ОДНОМУ с деталями товара
    details = relationship("ProductDetail", back_populates="product", uselist=False)


    __table_args__ = (
        UniqueConstraint('sku', name='ix_products_sku'),
    )

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', sku='{self.sku}')>"


class ProductDetail(Base):
    """
    НОВАЯ ТАБЛИЦА для расширенных характеристик РВД и Фитингов.
    Это позволяет сохранить старую таблицу 'products'.
    """
    __tablename__ = "product_details"

    id = Column(Integer, primary_key=True, index=True)
    
    # Внешний ключ: Ссылка на таблицу products (связь Один-к-Одному)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), unique=True, nullable=False)
    product = relationship("Product", back_populates="details")
    
    # ОПИСАНИЯ
    short_description = Column(String(255), nullable=True)
    full_description = Column(String, nullable=True) 
    
    # 🟢 --- ХАРАКТЕРИСТИКИ РВД (ШЛАНГОВ) --- 🟢
    type_standard = Column(String(50), nullable=True)        
    inner_diameter = Column(Float, nullable=True)          
    outer_diameter = Column(Float, nullable=True)          
    working_pressure_bar = Column(Float, nullable=True)    
    burst_pressure_bar = Column(Float, nullable=True)      
    temperature_range = Column(String(50), nullable=True)  
    reinforcement_layers = Column(String(50), nullable=True)
    
    # 🔵 --- ХАРАКТЕРИСТИКИ ФИТИНГОВ --- 🔵
    thread_type = Column(String(50), nullable=True)         
    thread_size = Column(String(50), nullable=True)         
    bend_angle = Column(Integer, nullable=True)             
    material = Column(String(50), default='Сталь')         
    hose_compatibility_size = Column(String(50), nullable=True) 
    
    # --- ПРОЧИЕ ХАРАКТЕРИСТИКИ ---
    is_universal = Column(Boolean, default=False)
    weight_kg = Column(Float, nullable=True)
    
    def __repr__(self):
        return f"<ProductDetail(id={self.id}, product_id={self.product_id})>"


class Counterparty(Base):
    """Модель для хранения информации о контрагентах (СТАРАЯ ТАБЛИЦА)."""
    __tablename__ = "counterparties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    bin = Column(String(12), unique=True, index=True, nullable=True) 
    phone = Column(String(20), nullable=True)

    def __repr__(self):
        return f"<Counterparty(id={self.id}, name='{self.name}', bin='{self.bin}')>"


# --- 3. Создание Таблиц ---

def create_db_and_tables():
    """Создает все таблицы в базе данных."""
    Base.metadata.create_all(bind=engine)
