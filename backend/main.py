import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# --- 1. Инициализация FastAPI и CORS ---
app = FastAPI(title="VORTEX POS API")

# Разрешаем запросы отовсюду (пока мы не знаем точный URL Render)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- 2. Отдача статических файлов (Frontend) ---

# Определяем путь к папке 'frontend'
frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')

# Монтируем папку 'frontend' для обслуживания CSS/JS/картинок
# URL будет: /static/style.css, /static/app.js
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


# Главный маршрут (Главная страница)
@app.get("/")
async def serve_index():
    # Отдаем index.html
    return FileResponse(os.path.join(frontend_dir, "index.html"))

# --- 3. Тестовый API-маршрут ---

# Это первый маршрут, который будет вызывать наш JS для проверки связи
@app.get("/api/status")
async def get_status():
    # Проверяем, есть ли переменная DATABASE_URL (она будет на Render)
    db_status = "Подключено к БД (Render)" if os.environ.get('DATABASE_URL') else "БД отсутствует (локальный тест)"
    return {
        "status": "ok", 
        "message": "Backend работает!", 
        "db_info": db_status
    }
