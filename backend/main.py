import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# 1. Инициализация FastAPI
app = FastAPI(title="VORTEX POS API")

# 2. Настройка CORS
# Это обязательно, чтобы браузер не блокировал запросы с Frontend на Backend
# В 'origins' должны быть все домены, откуда могут прийти запросы.
# После развертывания на Render.com здесь нужно будет добавить URL вашего Frontend-сайта.
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    # Здесь Render.com автоматически добавит URL вашего статического Frontend-сайта
    # Например: "https://pos-frontend-XXX.onrender.com" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем все методы (GET, POST, PUT, DELETE)
    allow_headers=["*"],
)

# 3. Отдаем статические файлы (HTML, CSS, JS)
# Мы монтируем папку "frontend" так, чтобы она была доступна по корневому пути "/"
app.mount(
    "/static", 
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), '..', 'frontend')), 
    name="static"
)

# 4. Главный маршрут (Root route)
# Этот маршрут будет обрабатывать запрос к основному адресу (например, https://vortex-pos.onrender.com/)
@app.get("/")
async def serve_index():
    # Отдаем index.html из папки 'frontend'
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    return FileResponse(os.path.join(frontend_path, "index.html"))


# 5. Первый тестовый API-маршрут
# Этот маршрут будет использоваться для проверки связи между Frontend и Backend
@app.get("/api/status")
async def get_status():
    return {"status": "ok", "message": "Backend работает!", "version": "1.0"}
