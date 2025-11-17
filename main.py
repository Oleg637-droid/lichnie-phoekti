import os
from fastapi import HTTPException, FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List
from pathlib import Path

# --- ИСПРАВЛЕННЫЕ ИМПОРТЫ: Прямой импорт из файлов в корне ---
# SessionLocal, Product, Counterparty, Category импортируются для работы с БД
from models import create_db_and_tables, SessionLocal, Product, Counterparty, Category

# --- Инициализация FastAPI и Настройки ---

BASE_DIR = Path(__file__).resolve().parent

templates = Jinja2Templates(directory=".")


# --- Pydantic Схемы (для API) ---
class CategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    # 💥 ДОБАВЛЕНО: ID родительской категории 💥
    parent_id: int | None = None

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int
    # 💥 НОВОЕ: Вложенность (список дочерних категорий) 💥
    children: List['CategoryOut'] = []
    
    class Config:
        from_attributes = True

CategoryOut.model_rebuild()

class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    price: float = Field(..., gt=0)
    sku: str = Field(..., max_length=50)
    stock: float = Field(default=0.0)
    image_url: str | None = None
    category_id: int | None = None # Внешний ключ для категории

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

# Настройка статических файлов: Используем исправленный STATIC_DIR
app.mount("/static", StaticFiles(directory="."), name="static")
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

# --- Вспомогательная функция для рендеринга страниц-заглушек (оставлено как есть) ---
def render_page(page_name: str, title: str, content: str) -> str:
    """Считывает шаблон страницы page_template.html из корня и заменяет в нем плейсхолдеры."""
    
    try:
        template_path = BASE_DIR / "page_template.html"
        with open(template_path, "r", encoding="utf-8") as f:
            template_content = f.read()
    except FileNotFoundError:
        return f"<h1>Ошибка! Файл page_template.html не найден в корне проекта.</h1>"

    active_classes = {
        "TITLE_PLACEHOLDER": title,
        "HEADER_PLACEHOLDER": title,
        "CONTENT_PLACEHOLDER": content,
        
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
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
    
@app.get("/pos", include_in_schema=False)
async def pos_terminal(request: Request):
    return templates.TemplateResponse("pos.html", {"request": request})

@app.get("/products", include_in_schema=False)
async def products_page(request: Request):
    return templates.TemplateResponse("products.html", {"request": request})

@app.get("/admin/categories", include_in_schema=False)
async def categories_admin_page(request: Request):
    """Страница администратора для управления категориями."""
    return templates.TemplateResponse("admin/categories.html", {"request": request})

@app.get("/admin/products/new", response_class=HTMLResponse, include_in_schema=False)
async def add_product_form(request: Request):
    return templates.TemplateResponse("add_product_form.html", {"request": request})


@app.get("/{page_name}", response_class=HTMLResponse, include_in_schema=False)
async def serve_static_pages(page_name: str):
    valid_pages = {
        
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
def read_products(
    category_id: int | None = None,
    db: Session = Depends(get_db)
):
    """Получает список всех товаров, с возможностью фильтрации по категории."""
    query = db.query(Product)
    
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
        
    products = query.all() 
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

# Вставьте эти два маршрута в секцию "API-маршруты для Категорий (Category CRUD)"

@app.put("/api/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, category: CategoryCreate, db: Session = Depends(get_db)):
    """Обновляет существующую категорию."""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Обновляем только имя
    db_category.name = category.name
    
    db.commit()
    db.refresh(db_category)
    return db_category

@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """Удаляет категорию."""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # ⚠️ ВАЖНО: При удалении категории, товары, связанные с ней,
    # должны иметь category_id=NULL. SQLAlchemy должен это обработать
    # благодаря `nullable=True` и правильным настройкам БД.
    
    db.delete(db_category)
    db.commit()
    return

@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    db.delete(db_product)
    db.commit()
    return

# --- API-маршруты для Категорий (Category CRUD) ---

@app.post("/api/categories/", response_model=CategoryOut, status_code=201)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    """Создает новую категорию."""
    db_category = Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/api/categories/", response_model=list[CategoryOut])
def read_categories(db: Session = Depends(get_db)):
    """Получает список корневых категорий (parent_id IS NULL)."""
    # 💥 ИЗМЕНЕНИЕ: Получаем только те категории, у которых нет родителя 💥
    categories = db.query(Category).filter(Category.parent_id == None).all()
    return categories

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


# --- Функция для добавления начальных данных (Seeding) ---

def create_initial_categories():
    """Создает начальные категории, если таблица Category пуста."""
    # Используем SessionLocal напрямую, так как мы вне контекста запроса FastAPI
    db = SessionLocal()
    try:
        # Проверяем, есть ли уже записи в таблице Category
        if db.query(Category).count() == 0:
            
            initial_categories = [
                Category(name="Гидравлические шланги"),
                Category(name="Соединительные фитинги"),
                Category(name="Смазочные материалы"),
                Category(name="Инструменты")
            ]
            
            for category in initial_categories:
                db.add(category)
            
            db.commit()
            print("Начальные категории успешно добавлены.")
        else:
            print("Категории уже существуют в БД. Пропуск добавления начальных данных.")
    except Exception as e:
        # Это полезно для отладки, если что-то пойдет не так при старте
        print(f"Ошибка при добавлении начальных категорий: {e}")
        db.rollback()
    finally:
        db.close()


# --- Жизненный цикл Сервера ---

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    print("База данных и таблицы успешно инициализированы.")
    # Запускаем функцию добавления начальных данных
    create_initial_categories() 

# --- Тестовый API-маршрут (Статус) ---
@app.get("/api/status")
async def get_status():
    db_status = "Подключено к БД (Render)" if os.environ.get('DATABASE_URL') else "БД отсутствует (локальный тест)"
    return {
        "status": "ok",
        "message": "Backend работает! (v4.4 - Добавлено Seeding)",
        "db_info": db_status
    }



