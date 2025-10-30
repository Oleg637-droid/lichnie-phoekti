import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

# Импортируем нашу модель и функции БД
# Предполагается, что 'models.py' находится рядом с 'main.py'
from .models import create_db_and_tables, SessionLocal, Product 

# --- Pydantic Схемы (для API) ---
class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    price: float = Field(..., gt=0)
    sku: str = Field(..., max_length=50)
    image_url: str | None = None

class ProductCreate(ProductBase):
    pass

class ProductOut(ProductBase):
    id: int
    is_active: bool
    qr_code_url: str | None = None # Оставляем для совместимости схем

    class Config:
        from_attributes = True # Для совместимости с SQLAlchemy

# --- Инициализация FastAPI и CORS ---
app = FastAPI(title="VORTEX POS API")

# Обслуживание статичных файлов из frontend/static
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Мы разрешаем запросы отовсюду
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- Управление Сессией Базы Данных ---

def get_db():
    """Функция-зависимость, которая открывает и закрывает сессию БД для каждого запроса."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Вспомогательная функция для рендеринга страниц-заглушек ---

def render_page(page_name: str, title: str, content: str) -> str:
    """Считывает шаблон страницы page_template.html и заменяет в нем плейсхолдеры."""
    
    try:
        # Читаем HTML-шаблон
        with open("frontend/page_template.html", "r", encoding="utf-8") as f:
            template_content = f.read()
    except FileNotFoundError:
        return f"<h1>Ошибка! Файл frontend/page_template.html не найден.</h1>"


    # Создаем словарь для активации нужного пункта меню и замены контента
    active_classes = {
        "TITLE_PLACEHOLDER": title,
        "HEADER_PLACEHOLDER": title,
        "CONTENT_PLACEHOLDER": content,
        "PRODUCTS_ACTIVE": "active" if page_name == "products" else "",
        "SERVICES_ACTIVE": "active" if page_name == "services" else "",
        "ABOUT_ACTIVE": "active" if page_name == "about" else "",
        "CONTACTS_ACTIVE": "active" if page_name == "contacts" else "",
    }
    
    # Заменяем плейсхолдеры
    rendered_html = template_content
    for key, value in active_classes.items():
        # Используем .replace() для простой замены
        rendered_html = rendered_html.replace(f"[{key}]", value)
        
    return rendered_html

# --- 7. Маршруты для HTML-страниц (Frontend Routing) ---

# Главная страница (index.html)
@app.get("/", include_in_schema=False)
async def index():
    return FileResponse("frontend/index.html")

# Страница POS-терминала (pos.html)
@app.get("/pos", include_in_schema=False)
async def pos_terminal():
    return FileResponse("frontend/pos.html")


# Динамические страницы-заглушки для навигации
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

    # Если ни один маршрут не сработал (кроме favicon), возвращаем 404
    if page_name == "favicon.ico":
         raise HTTPException(status_code=404)
         
    # В случае, если запрошенная страница не найдена, но не является favicon
    raise HTTPException(status_code=404, detail="Страница не найдена")

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
        "message": "Backend работает! (v3.0 - Динамические страницы)", 
        "db_info": db_status
    }
