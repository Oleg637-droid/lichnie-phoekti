import os
from fastapi import APIRouter, HTTPException, FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List
from pathlib import Path
from google import genai
from google.genai import types
import json

# --- КРИТИЧЕСКИ ВАЖНОЕ ИСПРАВЛЕНИЕ: Относительные импорты для работы в пакете 'backend' ---

# Импорт AI-моделей и функций из ai_models.py
from .ai_models import VoiceCommand as VoiceCommandSchema, process_command_with_gemini
# Импорт моделей БД и функций из models.py
from .models import create_db_and_tables, SessionLocal, Product, Counterparty

# --- Инициализация FastAPI и Настройки ---

# BASE_DIR указывает на папку 'backend'
BASE_DIR = Path(__file__).resolve().parent
# STATIC_DIR указывает на папку frontend/static относительно корня проекта
STATIC_DIR = BASE_DIR.parent / "frontend" / "static"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyDNw171aCl0VntBWxxx12mQxwAIRzrtW4k") # Замените на заглушку или используйте os.environ

# --- Конфигурация Gemini (оставлена, но не используется в этом файле напрямую) ---
gemini_client = None
if GEMINI_API_KEY and GEMINI_API_KEY != "AIzaSyDNw171aCl0VntBWxxx12mQxwAIRzrtW4k":
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Ошибка инициализации клиента Gemini: {e}")

# --- Роутер для голосового помощника ---
voice_router = APIRouter(prefix="/api/voice", tags=["Voice Assistant"])

# --- ЭНДПОИНТ ОБРАБОТКИ КОМАНДЫ ---
@voice_router.post("/process", response_model=VoiceCommandSchema)
async def process_voice_command_text(command: VoiceCommandSchema):
    """
    Принимает распознанный текст (JSON) с фронтенда и вызывает
    функцию Gemini для извлечения команды.
    """
    recognized_text = command.recognized_text

    if not recognized_text:
        raise HTTPException(status_code=400, detail="Текст команды не получен.")

    try:
        # Вызов функции AI-модели из ai_models.py
        # Предполагается, что process_command_with_gemini возвращает объект,
        # совместимый с VoiceCommandSchema.
        gemini_result = process_command_with_gemini(recognized_text)
        
        # Возвращаем Pydantic-модель
        return gemini_result
        
    except Exception as e:
        # Обработка общих ошибок
        raise HTTPException(status_code=500, detail=f"Не удалось обработать команду AI: {e}")


# --- Pydantic Схемы (для API) ---
class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    price: float = Field(..., gt=0)
    sku: str = Field(..., max_length=50)
    stock: float = Field(default=0.0)
    image_url: str | None = None

class ProductCreate(ProductBase):
    pass

class ProductOut(ProductBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True

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

# Настройка статических файлов
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
def render_page(page_name: str, title: str, content: str) -> str:
    """Считывает шаблон страницы page_template.html и заменяет в нем плейсхолдеры."""
    
    try:
        # Путь к шаблону: из backend/ поднимаемся на уровень выше, затем в frontend/
        template_path = BASE_DIR.parent / "frontend" / "page_template.html"
        with open(template_path, "r", encoding="utf-8") as f:
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

# --- Маршруты для HTML-страниц (Frontend Routing) ---

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
            "content": "Здесь будет размещена подробная информация о наших рукавах..."
        },
        "services": {
            "title": "Услуги и Сервис",
            "content": "Наши услуги включают: срочный ремонт РВД..."
        },
        "about": {
            "title": "О Компании 'Адым Инжениринг'",
            "content": "Компания 'Адым Инжениринг' была основана в 2020 году..."
        },
        "contacts": {
            "title": "Связаться с Нами",
            "content": "Наш офис находится по адресу: г. Астана..."
        }
    }
    
    if page_name in valid_pages:
        data = valid_pages[page_name]
        html_content = render_page(page_name, data["title"], data["content"])
        return HTMLResponse(content=html_content, status_code=200)

    if page_name == "favicon.ico":
        raise HTTPException(status_code=404)
        
    raise HTTPException(status_code=404, detail="Страница не найдена")

# --- API-маршрут для Товарного Каталога (CRUD) ---

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

# --- API-маршруты для Контрагентов (Counterparty CRUD) ---

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


# --- Жизненный цикл Сервера ---

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    print("База данных и таблицы успешно инициализированы.")

# --- Тестовый API-маршрут (Статус) ---
@app.get("/api/status")
async def get_status():
    db_status = "Подключено к БД (Render)" if os.environ.get('DATABASE_URL') else "БД отсутствует (локальный тест)"
    return {
        "status": "ok",
        "message": "Backend работает! (v4.1 - Готов к деплою)",
        "db_info": db_status
    }

# 🔑 ГЛАВНОЕ: ПОДКЛЮЧЕНИЕ РОУТЕРА ГОЛОСОВОГО ПОМОЩНИКА!
app.include_router(voice_router)






