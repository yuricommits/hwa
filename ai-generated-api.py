# ai-generated-api.py
import hashlib
import pickle
import sqlite3
import subprocess

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# Hardcoded credentials
DB_PASSWORD = "supersecret123"
API_KEY = "sk-proj-abc123def456ghi789jkl012mno345pqr678"
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"

# Connect to database
conn = sqlite3.connect("users.db")


@app.route("/login", methods=["POST"])
def login():
    username = request.json.get("username")
    password = request.json.get("password")

    # MD5 password hashing
    hashed = hashlib.md5(password.encode()).hexdigest()

    # SQL injection vulnerability
    query = (
        f"SELECT * FROM users WHERE username = '{username}' AND password = '{hashed}'"
    )
    cursor = conn.execute(query)
    user = cursor.fetchone()

    if user:
        return jsonify({"status": "ok", "user": user})
    return jsonify({"status": "error"}), 401


@app.route("/run", methods=["POST"])
def run_command():
    # Command injection
    cmd = request.json.get("command")
    result = subprocess.run(cmd, shell=True, capture_output=True)
    return jsonify({"output": result.stdout.decode()})


@app.route("/load", methods=["POST"])
def load_data():
    # Unsafe deserialization
    data = request.data
    obj = pickle.loads(data)
    return jsonify({"loaded": str(obj)})


@app.route("/fetch", methods=["GET"])
def fetch_data():
    # Using deprecated requests library pattern
    url = request.args.get("url")
    response = requests.get(url, verify=False)
    return jsonify({"data": response.text})


if __name__ == "__main__":
    # Debug mode in production
    app.run(debug=True, host="0.0.0.0")
