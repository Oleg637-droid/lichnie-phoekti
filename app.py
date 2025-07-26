from flask import Flask, render_template
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/pos')
def pos():
    return render_template("pos.html")

@app.route('/reports')
def reports():
    return render_template("reports.html")

@app.route('/add')
def add():
    return render_template("add_product.html")

if __name__ == "__main__":
    app.run(debug=True)

