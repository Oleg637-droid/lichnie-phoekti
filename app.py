# -*- coding: utf-8 -*-
import os
from flask import Flask, render_template, url_for, redirect, request, flash
from flask_sqlalchemy import SQLAlchemy

from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from voice_assistant import assistant

# Инициализация приложения
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'ваш-очень-секретный-ключ-из-случайных-символов'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///shop.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)



# Главная страница
@app.route('/')
def index():
    try:
        featured_products = Product.query.filter_by(is_active=True).limit(5).all()
        return render_template('index.html', products=featured_products)
    except Exception as e:
        # Если таблицы еще не созданы, показываем заглушку
        return render_template('index.html', products=[])



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
