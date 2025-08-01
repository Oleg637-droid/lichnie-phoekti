from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
from flask_socketio import SocketIO, emit
import os

app = Flask(__name__)
app.secret_key = "admin_oleg"  # ОБЯЗАТЕЛЬНО! Используется для сессий
socketio = SocketIO(app, cors_allowed_origins="*")

DATABASE_URL = "postgresql://lichnie_phoekti_db_user:mYbzh2LygbjUE5zTUgMLu603Cia1yDKp@dpg-d22ug2u3jp1c739alq9g-a/lichnie_phoekti_db"

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

@app.route('/init_db')
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Таблица продуктов
    cur.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            price NUMERIC NOT NULL,
            quantity INTEGER NOT NULL
        );
    ''')

    # Таблица пользователей
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
    ''')

    cur.execute('''
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    conn.commit()
    cur.close()
    conn.close()
    return "База данных и таблицы созданы!"

@app.route('/')
def index():
    return render_template("index.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        hashed_password = generate_password_hash(password)

        conn = psycopg2.connect(...)  # ← подключение как у тебя
        cur = conn.cursor()
        try:
            cur.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed_password))
            conn.commit()
            flash("Регистрация прошла успешно!", "success")
            return redirect(url_for("login"))
        except:
            flash("Пользователь уже существует.", "error")
            conn.rollback()
        finally:
            cur.close()
            conn.close()

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        conn = psycopg2.connect(...)  # ← твои данные
        cur = conn.cursor(cursor_factory=DictCursor)
        cur.execute("SELECT * FROM users WHERE username=%s", (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user and check_password_hash(user["password"], password):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            flash("Успешный вход!", "success")
            return redirect(url_for("pos"))  # или на главную страницу
        else:
            flash("Неверное имя пользователя или пароль", "error")

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    flash("Вы вышли из аккаунта", "info")
    return redirect(url_for("login"))

@app.route('/client')
def client_screen():
    return render_template("client.html")

@app.route('/pos')
def pos():
    if "username" not in session:
        return redirect(url_for("login"))

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM products')
    products = cur.fetchall()
    cur.close()
    conn.close()
    return render_template("pos.html", products=products)

@app.route('/reports')
def reports():
    if "username" not in session:
        return redirect(url_for("login"))
    return render_template("reports.html")

@app.route('/add', methods=['GET', 'POST'])
def add():
    if "username" not in session:
        return redirect(url_for("login"))

    if request.method == 'POST':
        name = request.form['name']
        price = request.form['price']
        quantity = request.form['quantity']

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO products (name, price, quantity) VALUES (%s, %s, %s)',
            (name, price, quantity)
        )
        conn.commit()
        cur.close()
        conn.close()

        return redirect(url_for('pos'))

    return render_template("add_product.html")

@app.route("/send_total", methods=["POST"])
def send_total():
    data = request.get_json()
    amount = data.get("amount")
    if amount:
        socketio.emit("total", {"amount": amount})
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    socketio.run(app, debug=True)

