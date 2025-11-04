import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List
from pathlib import Path

# Импортируем нашу модель и функции БД
from models import create_db_and_tables, SessionLocal, Product, Counterparty # <--- Добавлен Counterparty

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parent / "frontend" / "static"

# --- Pydantic Схемы (для API) ---
class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    price: float = Field(..., gt=0)
    sku: str = Field(..., max_length=50)
    # Добавлено stock
    stock: float = Field(default=0.0) 
    image_url: str | None = None

class ProductCreate(ProductBase):
    pass

class ProductOut(ProductBase):
    id: int
    is_active: bool
    # Удаляем qr_code_url из Out, если он не используется на фронте, но оставляем в БД
    
    class Config:
        from_attributes = True

# --- НОВЫЕ Pydantic Схемы для Контрагента ---

class CounterpartyBase(BaseModel):
    name: str = Field(..., max_length=255)
    bin: str | None = Field(default=None, max_length=12)
    phone: str | None = Field(default=None, max_length=20)

class CounterpartyCreate(CounterpartyBase):
    pass

class CounterpartyOut(CounterpartyBase):
    id: int
    
    class Config:
        from_attributes = True

# --- Инициализация FastAPI и CORS ---
app = FastAPI(title="VORTEX POS API")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- Управление Сессией Базы Данных ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Вспомогательная функция для рендеринга страниц-заглушек ---
# ... (Оставлено без изменений) ...

def render_page(page_name: str, title: str, content: str) -> str:
    """Считывает шаблон страницы page_template.html и заменяет в нем плейсхолдеры."""
    
    try:
        with open("frontend/page_template.html", "r", encoding="utf-8") as f:
            template_content = f.read()
    except FileNotFoundError:
        return f"<h1>Ошибка! Файл frontend/page_template.html не найден.</h1>"

    active_classes = {
        "TITLE_PLACEHOLDER": title,
        "HEADER_PLACEHOLDER": title,
        "CONTENT_PLACEHOLDER": content,
        "PRODUCTS_ACTIVE": "active" if page_name == "products" else "",
        "SERVICES_ACTIVE": "active" if page_name == "services" else "",
        "ABOUT_ACTIVE": "active" if page_name == "about" else "",
        "CONTACTS_ACTIVE": "active" if page_name == "contacts" else "",
    }
    
    rendered_html = template_content
    for key, value in active_classes.items():
        rendered_html = rendered_html.replace(f"[{key}]", value)
        
    return rendered_html

# --- 7. Маршруты для HTML-страниц (Frontend Routing) ---

@app.get("/", include_in_schema=False)
async def index():
    # Путь из корня репозитория
    return FileResponse(BASE_DIR.parent / "frontend" / "index.html")

@app.get("/pos", include_in_schema=False)
async def pos_terminal():
    # Путь из корня репозитория
    return FileResponse(BASE_DIR.parent / "frontend" / "pos.html")


@app.get("/{page_name}", response_class=HTMLResponse, include_in_schema=False)
async def serve_static_pages(page_name: str):
    valid_pages = {
        "products": {
            "title": "Каталог Продукции",
            "content": "Здесь будет размещена подробная информация о наших рукавах высокого давления, фитингах и муфтах. Мы работаем только с проверенными поставщиками, гарантируя надежность каждой единицы."
        },
        "services": {
            "title": "Услуги и Сервис",
            "content": "Наши услуги включают: срочный ремонт РВД, изготовление РВД по чертежам заказчика, диагностику гидравлических систем и консультации по подбору оборудования. Мы работаем 24/7 для вашей техники."
        },
        "about": {
            "title": "О Компании 'Адым Инжениринг'",
            "content": "Компания 'Адым Инжениринг' была основана в 2020 году как ответ на растущий спрос на качественные и надежные гидравлические компоненты. Наша миссия — обеспечить бесперебойную работу вашей спецтехники, предлагая высококлассный сервис и продукцию."
        },
        "contacts": {
            "title": "Связаться с Нами",
            "content": "Наш офис находится по адресу: г. Астана, ул. Индустриальная, 1. Телефон: +7 (700) 123-45-67. Email: info@adym-eng.kz. Ждем ваших заявок и вопросов!"
        }
    }
    
    if page_name in valid_pages:
        data = valid_pages[page_name]
        html_content = render_page(page_name, data["title"], data["content"])
        return HTMLResponse(content=html_content, status_code=200)

    if page_name == "favicon.ico":
        raise HTTPException(status_code=404)
        
    raise HTTPException(status_code=404, detail="Страница не найдена")

# --- 4. API-маршрут для Товарного Каталога (CRUD) ---

@app.post("/api/products/", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.get("/api/products/", response_model=list[ProductOut])
def read_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return products
    
@app.get("/api/products/{product_id}", response_model=ProductOut)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return db_product

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

@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    db.delete(db_product)
    db.commit()
    return

# --- 5. НОВЫЕ API-маршруты для Контрагентов (Counterparty CRUD) ---

@app.post("/api/counterparties/", response_model=CounterpartyOut, status_code=201)
def create_counterparty(counterparty: CounterpartyCreate, db: Session = Depends(get_db)):
    """Создает новый контрагент. Проверяет уникальность БИН/ИИН."""
    if counterparty.bin:
        # Проверка уникальности БИН
        existing = db.query(Counterparty).filter(Counterparty.bin == counterparty.bin).first()
        if existing:
            raise HTTPException(status_code=400, detail="Контрагент с таким БИН/ИИН уже существует")
            
    db_counterparty = Counterparty(**counterparty.model_dump(exclude_unset=True))
    db.add(db_counterparty)
    db.commit()
    db.refresh(db_counterparty)
    return db_counterparty

@app.get("/api/counterparties/", response_model=list[CounterpartyOut])
def read_counterparties(db: Session = Depends(get_db)):
    """Получает список всех контрагентов."""
    counterparties = db.query(Counterparty).all()
    return counterparties


# --- 6. Жизненный цикл Сервера ---

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    print("База данных и таблицы успешно инициализированы.")

# --- 7. Тестовый API-маршрут (Статус) ---
@app.get("/api/status")
async def get_status():
    db_status = "Подключено к БД (Render)" if os.environ.get('DATABASE_URL') else "БД отсутствует (локальный тест)"
    return {
        "status": "ok", 
        "message": "Backend работает! (v4.1 - Добавлен Counterparty)", 
        "db_info": db_status
    }


