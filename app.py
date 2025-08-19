# -*- coding: utf-8 -*-
import os
from flask import Flask, render_template, url_for, redirect, request, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# Инициализация приложения
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'ваш-очень-секретный-ключ'
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

# Создаем таблицы и первого администратора
def create_tables():
    with app.app_context():
        db.create_all()
        # Создаем администратора если его нет
        if not User.query.filter_by(role='admin').first():
            admin = User(
                username='admin',
                email='admin@example.com',
                role='admin',
                price_type='wholesale'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            
            # Добавляем несколько тестовых товаров
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
            
            db.session.commit()

# Главная страница
@app.route('/')
def index():
    featured_products = Product.query.filter_by(is_active=True).limit(5).all()
    return render_template('index.html', products=featured_products)

# Регистрация
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
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
    
    return render_template('register.html')

# Вход
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
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
    
    return render_template('login.html')

# Выход
@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('index'))

# Личный кабинет
@app.route('/dashboard')
@login_required
def dashboard():
    user_orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
    return render_template('dashboard.html', orders=user_orders)

# Панель администратора
@app.route('/admin')
@login_required
def admin_panel():
    if not current_user.is_admin():
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    users = User.query.all()
    products = Product.query.all()
    orders = Order.query.order_by(Order.created_at.desc()).limit(10).all()
    
    return render_template('admin/index.html', users=users, products=products, orders=orders)

# Управление пользователями
@app.route('/admin/users')
@login_required
def manage_users():
    if not current_user.is_admin():
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    users = User.query.all()
    return render_template('admin/users.html', users=users)

# Изменение типа цены пользователя
@app.route('/admin/user/<int:user_id>/price_type', methods=['POST'])
@login_required
def change_user_price_type(user_id):
    if not current_user.is_admin():
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    user = User.query.get_or_404(user_id)
    price_type = request.form['price_type']
    
    if price_type in ['retail', 'wholesale', 'small_wholesale']:
        user.price_type = price_type
        db.session.commit()
        flash(f'Тип цены для {user.username} изменен на {price_type}', 'success')
    else:
        flash('Неверный тип цены', 'danger')
    
    return redirect(url_for('manage_users'))

# Управление товарами
@app.route('/admin/products')
@login_required
def manage_products():
    if not current_user.is_admin():
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    products = Product.query.all()
    return render_template('admin/products.html', products=products)

# Добавление товара
@app.route('/admin/products/add', methods=['GET', 'POST'])
@login_required
def add_product():
    if not current_user.is_admin():
        flash('Доступ запрещен', 'danger')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        product = Product(
            name=request.form['name'],
            description=request.form['description'],
            image_url=request.form['image_url'],
            price_retail=float(request.form['price_retail']),
            price_wholesale=float(request.form['price_wholesale']),
            price_small_wholesale=float(request.form['price_small_wholesale'])
        )
        db.session.add(product)
        db.session.commit()
        flash('Товар успешно добавлен', 'success')
        return redirect(url_for('manage_products'))
    
    return render_template('admin/add_product.html')

# Создание заказа
@app.route('/order/<int:product_id>', methods=['POST'])
@login_required
def create_order(product_id):
    product = Product.query.get_or_404(product_id)
    
    # Определяем цену в зависимости от типа пользователя
    if current_user.price_type == 'wholesale':
        price = product.price_wholesale
    elif current_user.price_type == 'small_wholesale':
        price = product.price_small_wholesale
    else:
        price = product.price_retail
    
    quantity = int(request.form.get('quantity', 1))
    
    order = Order(
        user_id=current_user.id,
        product_id=product.id,
        quantity=quantity,
        price_at_order=price
    )
    
    db.session.add(order)
    db.session.commit()
    flash('Заказ успешно создан!', 'success')
    return redirect(url_for('dashboard'))

# Запуск приложения
if __name__ == '__main__':
    create_tables()
    app.run(debug=True)
