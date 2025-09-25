# -*- coding: utf-8 -*-
import os
from flask import Flask, render_template, url_for, redirect, request, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# Инициализация приложения
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'ваш-очень-секретный-ключ-из-случайных-символов'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///shop.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Модели базы данных
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(20), default='customer')
    price_type = db.Column(db.String(20), default='retail')
    orders = db.relationship('Order', backref='customer', lazy=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_admin(self):
        return self.role == 'admin'

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(200), default='/static/images/placeholder.jpg')
    price_retail = db.Column(db.Float, default=0)
    price_wholesale = db.Column(db.Float, default=0)
    price_small_wholesale = db.Column(db.Float, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    price_at_order = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    product = db.relationship('Product', backref='orders')

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Функция для инициализации базы данных
def init_db():
    """Создает таблицы и добавляет тестовые данные"""
    with app.app_context():
        # Создаем все таблицы
        db.create_all()
        
        # Проверяем, есть ли уже администратор
        if not User.query.filter_by(role='admin').first():
            admin = User(
                username='admin',
                email='admin@example.com',
                role='admin',
                price_type='wholesale'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            print("Администратор создан")
        
        # Проверяем, есть ли уже товары
        if not Product.query.first():
            products = [
                Product(
                    name='iPhone 15 Pro',
                    description='Новый смартфон от Apple с революционным дизайном',
                    image_url='https://via.placeholder.com/400x300/007BFF/FFFFFF?text=iPhone+15+Pro',
                    price_retail=99990,
                    price_wholesale=89990,
                    price_small_wholesale=94990
                ),
                Product(
                    name='Samsung Galaxy S24',
                    description='Мощный Android смартфон с лучшей камерой',
                    image_url='https://via.placeholder.com/400x300/28A745/FFFFFF?text=Galaxy+S24',
                    price_retail=79990,
                    price_wholesale=71990,
                    price_small_wholesale=75990
                ),
                Product(
                    name='Xiaomi Mi 13',
                    description='Отличное соотношение цены и качества',
                    image_url='https://via.placeholder.com/400x300/DC3545/FFFFFF?text=Xiaomi+Mi+13',
                    price_retail=49990,
                    price_wholesale=44990,
                    price_small_wholesale=47990
                )
            ]
            db.session.add_all(products)
            print("Тестовые товары добавлены")
        
        try:
            db.session.commit()
            print("База данных успешно инициализирована")
        except Exception as e:
            db.session.rollback()
            print(f"Ошибка при инициализации базы данных: {e}")

# Инициализируем базу данных при запуске приложения
init_db()

# Главная страница
@app.route('/')
def index():
    try:
        featured_products = Product.query.filter_by(is_active=True).limit(5).all()
        return render_template('index.html', products=featured_products)
    except Exception as e:
        # Если таблицы еще не созданы, показываем заглушку
        return render_template('index.html', products=[])

# Добавьте этот маршрут после существующих маршрутов
@app.route('/cashier')
def cashier():
    try:
        products = Product.query.filter_by(is_active=True).all()
        return render_template('cashier.html', products=products, now=datetime.now())
    except Exception as e:
        flash('Ошибка при загрузке товаров', 'danger')
        return render_template('cashier.html', products=[], now=datetime.now())

# Регистрация
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        try:
            username = request.form['username']
            email = request.form['email']
            password = request.form['password']
            
            if User.query.filter_by(username=username).first():
                flash('Это имя пользователя уже занято', 'danger')
                return redirect(url_for('register'))
            
            if User.query.filter_by(email=email).first():
                flash('Этот email уже зарегистрирован', 'danger')
                return redirect(url_for('register'))
            
            user = User(username=username, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            
            flash('Регистрация прошла успешно! Теперь вы можете войти.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            db.session.rollback()
            flash(f'Ошибка при регистрации: {str(e)}', 'danger')
            return redirect(url_for('register'))
    
    return render_template('register.html')

# Вход
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        try:
            username = request.form['username']
            password = request.form['password']
            user = User.query.filter_by(username=username).first()
            
            if user and user.check_password(password):
                login_user(user)
                next_page = request.args.get('next')
                flash('Вы успешно вошли в систему!', 'success')
                return redirect(next_page or url_for('dashboard'))
            else:
                flash('Неверное имя пользователя или пароль', 'danger')
        except Exception as e:
            flash(f'Ошибка при входе: {str(e)}', 'danger')
    
    return render_template('login.html')

# Выход
@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('index'))

@app.route("/promo")
def promo():
    return render_template("promo.html")

# Личный кабинет
@app.route('/dashboard')
@login_required
def dashboard():
    try:
        user_orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
        return render_template('dashboard.html', orders=user_orders)
    except Exception as e:
        flash('Ошибка при загрузке заказов', 'danger')
        return render_template('dashboard.html', orders=[])

# Простая заглушка для админки
@app.route('/admin')
@login_required
def admin_panel():
    if not current_user.is_admin():
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    return "Панель администратора - в разработке"

# Обработчик ошибок
@app.errorhandler(500)
def internal_error(error):
    return "Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.", 500

@app.errorhandler(404)
def not_found_error(error):
    return "Страница не найдена.", 404

# Запуск приложения
if __name__ == '__main__':
    app.run(debug=True)
