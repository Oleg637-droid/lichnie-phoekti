import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Импортируем нашу модель и функции БД
from .models import create_db_and_tables, SessionLocal, Product 

# --- Pydantic Схемы (для API) ---
# Схемы определяют, как данные будут выглядеть при приеме и отдаче через API

class ProductBase(BaseModel):
    name: str
    price: float
    sku: str
    image_url: str | None = None

class ProductCreate(ProductBase):
    pass # Для создания используем ту же схему

class ProductOut(ProductBase):
    id: int
    is_active: bool
    qr_code_url: str | None = None
    
    class Config:
        from_attributes = True # Для совместимости с SQLAlchemy

# --- Инициализация FastAPI и CORS ---
app = FastAPI(title="VORTEX POS API")

# Мы разрешаем запросы отовсюду
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- Управление Сессией Базы Данных ---

# Функция-зависимость, которая открывает и закрывает сессию БД для каждого запроса
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Отдача статических файлов (Frontend) ---

frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(frontend_dir, "index.html"))

# --- 4. API-маршрут для Товарного Каталога (CRUD) ---

# 4.1. Создание нового товара
@app.post("/api/products/", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

# 4.2. Получение списка всех товаров
@app.get("/api/products/", response_model=list[ProductOut])
def read_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return products

# 4.3. Обновление товара
@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    for key, value in product.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product

# 4.4. Удаление товара
@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    db.delete(db_product)
    db.commit()
    return 

# --- 5. Жизненный цикл Сервера ---

# Функция, которая выполняется при старте сервера
@app.on_event("startup")
def on_startup():
    # Создаем таблицы в БД при запуске
    create_db_and_tables()
    print("База данных и таблицы успешно инициализированы.")

# --- 6. Тестовый API-маршрут (Обновленный) ---
@app.get("/api/status")
async def get_status():
    db_status = "Подключено к БД (Render)" if os.environ.get('DATABASE_URL') else "БД отсутствует (локальный тест)"
    return {
        "status": "ok", 
        "message": "Backend работает!", 
        "db_info": db_status
    }
