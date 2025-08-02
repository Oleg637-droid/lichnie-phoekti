from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
from psycopg2.extras import DictCursor
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.secret_key = "admin_oleg"
socketio = SocketIO(app, cors_allowed_origins="*")

DATABASE_URL = "postgresql://lichnie_phoekti_db_user:mYbzh2LygbjUE5zTUgMLu603Cia1yDKp@dpg-d22ug2u3jp1c739alq9g-a/lichnie_phoekti_db"

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

@app.route('/init_db')
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    # Удаляем старые таблицы если есть
    cur.execute("DROP TABLE IF EXISTS registration_requests CASCADE;")
    cur.execute("DROP TABLE IF EXISTS users CASCADE;")
    cur.execute("DROP TABLE IF EXISTS products CASCADE;")

    # Создаем заново
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            access_granted BOOLEAN DEFAULT FALSE,
            price_type TEXT DEFAULT 'retail'
        );
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS registration_requests (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            price NUMERIC,
            quantity INTEGER NOT NULL,
            wholesale_price NUMERIC,
            retail_price NUMERIC
        );
    ''')

    conn.commit()
    cur.close()
    conn.close()

    return "База данных успешно переинициализирована"


    return "База данных и таблицы успешно инициализированы!"


@app.route('/')
def index():
    return render_template("index.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        existing_user = cur.fetchone()

        if existing_user:
            flash("Пользователь уже существует", "error")
        else:
            hashed_password = generate_password_hash(password)
            cur.execute("INSERT INTO registration_requests (username) VALUES (%s)", (username,))
            cur.execute("""
                INSERT INTO users (username, password, role, access_granted, price_type)
                VALUES (%s, %s, %s, %s, %s)
            """, (username, hashed_password, 'user', False, 'retail'))
            conn.commit()
            flash("Заявка отправлена. Ожидайте подтверждения администратора.", "info")

        cur.close()
        conn.close()
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=DictCursor)
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user and check_password_hash(user["password"], password):
            if not user.get("access_granted"):
                flash("Доступ не подтверждён администратором", "error")
                return redirect(url_for("login"))

            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            session["price_type"] = user.get("price_type", "retail")
            return redirect(url_for("dashboard"))
        else:
            flash("Неверные имя пользователя или пароль", "error")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("Вы вышли из аккаунта", "info")
    return redirect(url_for("login"))


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("dashboard.html", title="Личный кабинет")


@app.route("/admin/requests")
def admin_requests():
    if session.get("role") != "admin":
        return redirect(url_for("login"))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    cur.execute("SELECT * FROM registration_requests ORDER BY created_at DESC")
    requests = cur.fetchall()
    cur.close()
    conn.close()
    return render_template("admin_requests.html", requests=requests)


@app.route("/admin/approve/<username>/<price_type>")
def approve_user(username, price_type):
    if session.get("role") != "admin":
        return redirect(url_for("login"))

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET access_granted = TRUE, price_type = %s
        WHERE username = %s
    """, (price_type, username))
    cur.execute("DELETE FROM registration_requests WHERE username = %s", (username,))
    conn.commit()
    cur.close()
    conn.close()
    flash(f"Пользователю {username} выдан доступ с ценой: {price_type}", "success")
    return redirect(url_for("admin_requests"))


@app.route('/pos')
def pos():
    if "username" not in session:
        return redirect(url_for("login"))

    price_type = session.get("price_type", "retail")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    cur.execute("SELECT name, retail_price, wholesale_price, quantity FROM products")
    products = cur.fetchall()
    cur.close()
    conn.close()

    return render_template("pos.html", products=products, price_type=price_type)


@app.route('/add', methods=['GET', 'POST'])
def add():
    if "username" not in session:
        return redirect(url_for("login"))

    if request.method == 'POST':
        name = request.form['name']
        retail = request.form['retail_price']
        wholesale = request.form['wholesale_price']
        quantity = request.form['quantity']

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO products (name, retail_price, wholesale_price, quantity) VALUES (%s, %s, %s, %s)',
            (name, retail, wholesale, quantity)
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



