import os
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Literal # Добавлен Literal для подсказок
from pathlib import Path

# --- ИСПРАВЛЕННЫЕ ИМПОРТЫ: ВАЖНО, чтобы импорты из models работали с ProductDetail ---
from models import create_db_and_tables, SessionLocal, Product, Counterparty, Category, ProductDetail # <-- ДОБАВЛЕН ProductDetail

# --- Инициализация FastAPI и Настройки ---

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=".")


# --- Pydantic Схемы (для API) ---
# (CategoryBase, CategoryCreate, CategoryOut - без изменений)
class CategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    parent_id: int | None = None

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int
    children: List['CategoryOut'] = []
    
    class Config:
        from_attributes = True
CategoryOut.model_rebuild()


# 🟢 НОВАЯ ВЛОЖЕННАЯ СХЕМА ДЛЯ ХАРАКТЕРИСТИК (ProductDetail) 🟢
class ProductDetailBase(BaseModel):
    # ОПИСАНИЯ
    short_description: Optional[str] = Field(default=None, max_length=255)
    full_description: Optional[str] = None
    
    # --- ХАРАКТЕРИСТИКИ РВД (ШЛАНГОВ) ---
    type_standard: Optional[str] = Field(default=None, max_length=50)
    inner_diameter: Optional[float] = Field(default=None, ge=0)
    outer_diameter: Optional[float] = Field(default=None, ge=0)
    working_pressure_bar: Optional[float] = Field(default=None, ge=0)
    burst_pressure_bar: Optional[float] = Field(default=None, ge=0)
    temperature_range: Optional[str] = None
    reinforcement_layers: Optional[str] = None
    
    # --- ХАРАКТЕРИСТИКИ ФИТИНГОВ (для будущего) ---
    thread_type: Optional[str] = Field(default=None, max_length=50)
    thread_size: Optional[str] = Field(default=None, max_length=50)
    bend_angle: Optional[int] = Field(default=None, ge=0)
    material: Optional[str] = Field(default=None, max_length=50) 
    hose_compatibility_size: Optional[str] = None
    
    # --- Прочие поля ---
    is_universal: bool = Field(default=False)
    weight_kg: Optional[float] = Field(default=None, ge=0)

    class Config:
        from_attributes = True

# 🟡 ОБЩАЯ СХЕМА ПРОДУКТА (Product) - теперь включает детали
class ProductBase(BaseModel):
    # ОБЩЕЕ ЯДРО (Product Model)
    name: str = Field(..., max_length=255)
    price: float = Field(..., gt=0)
    sku: str = Field(..., max_length=50)
    stock: float = Field(default=0.0)
    image_url: Optional[str] = None
    category_id: int # Теперь всегда int, так как мы требуем выбора категории
    
    # ВЛОЖЕНИЕ: Если деталь существует, она будет здесь
    details: Optional[ProductDetailBase] = None

class ProductCreate(ProductBase):
    # Для создания, details будет передаваться вместе с основными полями
    details: Optional[ProductDetailBase] = None
    pass

class ProductOut(ProductBase):
    id: int
    is_active: bool
    
    # details здесь используется, чтобы Pydantic автоматически вытягивал связанные данные
    details: Optional[ProductDetailBase] = None
    
    class Config:
        from_attributes = True

# (CounterpartyBase, CounterpartyCreate, CounterpartyOut - без изменений)
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

# --- Инициализация FastAPI и CORS (без изменений) ---
app = FastAPI(title="VORTEX POS API")

app.mount("/static", StaticFiles(directory="."), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Управление Сессией Базы Данных (без изменений) ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Вспомогательная функция для рендеринга страниц-заглушек (без изменений) ---

def render_page(page_name: str, title: str, content: str) -> str:
    # ... (Ваш код render_page) ...
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
    return templates.TemplateResponse("admin/categories.html", {"request": request})

@app.get("/admin/products/new", response_class=HTMLResponse, include_in_schema=False)
async def add_product_form(request: Request):
    # Убедитесь, что ваш файл называется add_hose.html, как мы решили ранее
    return templates.TemplateResponse("add_hose.html", {"request": request}) 


@app.get("/{page_name}", response_class=HTMLResponse, include_in_schema=False)
async def serve_static_pages(page_name: str):
    valid_pages = {
        # ... (Ваши данные) ...
        "services": {"title": "Услуги и Сервис", "content": "Наши услуги включают: срочный ремонт РВД..."},
        "about": {"title": "О Компании 'Адым Инжениринг'", "content": "Компания 'Адым Инжениринг' была основана в 2020 году..."},
        "contacts": {"title": "Связаться с Нами", "content": "Наш офис находится по адресу: г. Астана..."}
    }
    
    if page_name in valid_pages:
        data = valid_pages[page_name]
        html_content = render_page(page_name, data["title"], data["content"])
        return HTMLResponse(content=html_content, status_code=200)

    if page_name == "favicon.ico":
        raise HTTPException(status_code=404)
        
    raise HTTPException(status_code=404, detail="Страница не найдена")

# --- API-маршрут для Товарного Каталога (CRUD) ---

# 🔴 КЛЮЧЕВОЙ МАРШРУТ: Создание товара с деталями
@app.post("/api/products/", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """
    Создает новый товар. Сначала добавляет запись в products, затем - в product_details.
    """
    # 1. Отделяем данные для Product и ProductDetail
    product_data = product.model_dump(exclude={'details', 'is_active'}, exclude_unset=True)
    details_data = product.details.model_dump(exclude_unset=True) if product.details else None
    
    db_product = Product(**product_data)
    
    try:
        # 2. Сохраняем основную запись (Product)
        db.add(db_product)
        db.flush() # Получаем ID нового товара до коммита
        
        # 3. Если есть детали, создаем и сохраняем ProductDetail
        if details_data:
            # Создаем запись ProductDetail, используя ID нового продукта
            db_details = ProductDetail(
                **details_data,
                product_id=db_product.id
            )
            db.add(db_details)
        
        db.commit()
        db.refresh(db_product)
        
        # 4. Возвращаем результат. SQLAlchemy автоматически подтянет details
        return db_product
        
    except IntegrityError as e:
        db.rollback() 
        
        if 'ix_products_sku' in str(e):
            raise HTTPException(
                status_code=409,
                detail=f"Товар с артикулом '{product.sku}' уже существует. Артикул (SKU) должен быть уникальным."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Ошибка базы данных при сохранении товара: " + str(e)
            )

# 🔴 Чтение товаров - SQLAlchemy автоматически подтягивает детали
@app.get("/api/products/", response_model=list[ProductOut])
def read_products(
    category_id: int | None = None,
    db: Session = Depends(get_db)
):
    """Получает список всех товаров с их деталями."""
    query = db.query(Product)
    
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
        
    products = query.all()  # SQLAlchemy выполнит JOIN, чтобы получить details
    return products
    
# 🔴 Чтение одного товара - SQLAlchemy автоматически подтягивает детали
@app.get("/api/products/{product_id}", response_model=ProductOut)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    # Детали будут автоматически включены в ответ благодаря relationship
    return db_product

# 🔴 Обновление товара - требует обновления двух таблиц
@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # 1. Обновляем основные поля (Product)
    product_data = product.model_dump(exclude={'details'}, exclude_unset=True)
    for key, value in product_data.items():
        setattr(db_product, key, value)
    
    # 2. Обновляем или создаем детали (ProductDetail)
    if product.details:
        details_data = product.details.model_dump(exclude_unset=True)
        db_details = db.query(ProductDetail).filter(ProductDetail.product_id == product_id).first()
        
        if db_details:
            # Обновляем существующие детали
            for key, value in details_data.items():
                setattr(db_details, key, value)
        else:
            # Если деталей не было, создаем новую запись
            db_details = ProductDetail(
                **details_data,
                product_id=db_product.id
            )
            db.add(db_details)
    
    try:
        db.commit()
        db.refresh(db_product)
        return db_product
    except IntegrityError as e:
        db.rollback() 
        if 'ix_products_sku' in str(e):
            raise HTTPException(
                status_code=409,
                detail=f"Товар с артикулом '{product.sku}' уже существует."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Ошибка базы данных при обновлении товара."
            )

# 🔴 Удаление товара: CASCADE удалит связанные детали
@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    db.delete(db_product)
    # Благодаря ondelete='CASCADE' в models.py, запись в ProductDetail удалится автоматически.
    db.commit()
    return


# (Остальные API-маршруты и функции не изменены, но включены для полноты)

@app.put("/api/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, category: CategoryCreate, db: Session = Depends(get_db)):
    # ... (Ваш код) ...
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    db_category.name = category.name
    db_category.parent_id = category.parent_id
    
    db.commit()
    db.refresh(db_category)
    return db_category

@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    # ... (Ваш код) ...
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    db.delete(db_category)
    db.commit()
    return

@app.post("/api/categories/", response_model=CategoryOut, status_code=201)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    # ... (Ваш код) ...
    db_category = Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/api/categories/", response_model=list[CategoryOut])
def read_categories(db: Session = Depends(get_db)):
    # ... (Ваш код) ...
    categories = db.query(Category).filter(Category.parent_id == None).all()
    return categories

@app.post("/api/counterparties/", response_model=CounterpartyOut, status_code=201)
def create_counterparty(counterparty: CounterpartyCreate, db: Session = Depends(get_db)):
    # ... (Ваш код) ...
    if counterparty.bin:
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
    # ... (Ваш код) ...
    counterparties = db.query(Counterparty).all()
    return counterparties


# --- Функция для добавления начальных данных (Seeding) ---

def create_initial_categories():
    """Создает начальные категории, если таблица Category пуста."""
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            
            initial_categories = [
                Category(name="Гидравлические шланги"),
                Category(name="Соединительные фитинги"),
                Category(name="Обжимные муфты"), # Добавлена новая категория
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
        print(f"Ошибка при добавлении начальных категорий: {e}")
        db.rollback()
    finally:
        db.close()


# --- Жизненный цикл Сервера ---

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    print("База данных и таблицы успешно инициализированы.")
    create_initial_categories() 

# --- Тестовый API-маршрут (Статус) ---
@app.get("/api/status")
async def get_status():
    db_status = "Подключено к БД (Render)" if os.environ.get('DATABASE_URL') else "БД отсутствует (локальный тест)"
    return {
        "status": "ok",
        "message": "Backend работает! (v5.1 - Отдельные таблицы для деталей)",
        "db_info": db_status
    }
