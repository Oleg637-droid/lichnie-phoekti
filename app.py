from flask import Flask, render_template, request, redirect, url_for
from datetime import datetime
import psycopg2
import os

app = Flask(__name__)


DATABASE_URL = "postgresql://lichnie_phoekti_db_user:mYbzh2LygbjUE5zTUgMLu603Cia1yDKp@dpg-d22ug2u3jp1c739alq9g-a/lichnie_phoekti_db"

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn

@app.route('/init_db')
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            price NUMERIC NOT NULL,
            quantity INTEGER NOT NULL
        );
    ''')
    conn.commit()
    cur.close()
    conn.close()
    return "База данных и таблица созданы!"


@app.route('/')
def index():
    return render_template("index.html")

@app.route('/pos')
def pos():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM products')
    products = cur.fetchall()
    cur.close()
    conn.close()
    return render_template("pos.html", products=products)


@app.route('/reports')
def reports():
    return render_template("reports.html")



@app.route('/add', methods=['GET', 'POST'])
def add():
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

if __name__ == "__main__":
    app.run(debug=True)

