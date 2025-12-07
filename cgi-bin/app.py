from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import hashlib
from datetime import datetime
import os

app = Flask(__name__)
# Enable CORS so Vercel can talk to Render
CORS(app)

# -----------------------------------------
# DATABASE CONFIGURATION (Use TiDB Details)
# -----------------------------------------
# Ideally, use os.environ.get for security, but you can hardcode for testing
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'gateway01.us-west-2.prod.aws.tidbcloud.com'), 
    'user': os.environ.get('DB_USER', 'YOUR_TIDB_USER'),
    'password': os.environ.get('DB_PASS', 'YOUR_TIDB_PASSWORD'),
    'port': int(os.environ.get('DB_PORT', 4000)),
    'database': 'lecturer_portfolio'
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

# -----------------------------------------
# LOGIC FUNCTIONS (Same as your old script)
# -----------------------------------------

def handle_login(data):
    email = data.get('email')
    password = data.get('password') # In a real app, hash this before comparing!
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Note: In production, never store plain text passwords. Use hashing.
        cursor.execute("SELECT lecturer_id, name, email, bio, education, experience FROM lecturer WHERE email = %s AND password = %s", (email, password))
        lecturer = cursor.fetchone()
        if lecturer:
            return {'success': True, 'message': 'Login successful', 'lecturer': lecturer}
        return {'success': False, 'message': 'Invalid email or password'}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def handle_signup(data):
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT lecturer_id FROM lecturer WHERE email = %s", (email,))
        if cursor.fetchone():
            return {'success': False, 'message': 'Email already registered'}
            
        cursor.execute("INSERT INTO lecturer (name, email, password, bio, education, experience) VALUES (%s, %s, %s, %s, %s, %s)",
                       (name, email, password, '', '', ''))
        conn.commit()
        return {'success': True, 'message': 'Account created', 'lecturer_id': cursor.lastrowid}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def get_dashboard_data(data):
    lecturer_id = data.get('lecturer_id')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Lecturer Info
        cursor.execute("SELECT name, email, bio, education, experience FROM lecturer WHERE lecturer_id = %s", (lecturer_id,))
        lecturer = cursor.fetchone()
        
        # 2. Stats
        cursor.execute("SELECT COUNT(*) AS total_courses FROM course WHERE lecturer_id = %s", (lecturer_id,))
        total_courses = cursor.fetchone()['total_courses']
        
        cursor.execute("""SELECT COUNT(DISTINCT student_id) AS total_students FROM student_courses sc 
                          JOIN course c ON sc.course_id = c.course_id WHERE c.lecturer_id = %s""", (lecturer_id,))
        total_students = cursor.fetchone()['total_students']
        
        # 3. Courses List
        cursor.execute("""SELECT c.course_id, c.course_code, c.title, c.level, COUNT(sc.student_id) AS student_count
                          FROM course c LEFT JOIN student_courses sc ON c.course_id = sc.course_id
                          WHERE c.lecturer_id = %s GROUP BY c.course_id""", (lecturer_id,))
        courses = cursor.fetchall()

        return {
            'success': True,
            'lecturer': lecturer,
            'stats': {'total_courses': total_courses, 'total_students': total_students, 'pending_marking': 0},
            'courses': courses
        }
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

# ... (You can paste the get_students, get_assignments, add_course functions here similarly) ...
# For brevity, I am showing the structure. You literally copy the inside of your old functions here.

# -----------------------------------------
# FLASK ROUTE HANDLER
# -----------------------------------------
@app.route('/', methods=['POST'])
@app.route('/lecturer_api.py', methods=['POST']) # Keep this path so you don't break frontend logic
def main_handler():
    try:
        # In Flask, we get data from request.form or request.json
        # Your JS sends data as a string inside 'data' form field
        action = request.form.get('action')
        data_str = request.form.get('data')
        
        if not action or not data_str:
            # Fallback for pure JSON requests
            req_json = request.get_json(silent=True)
            if req_json:
                action = req_json.get('action')
                data = req_json.get('data')
            else:
                import json
                data = json.loads(data_str) if data_str else {}

        else:
             import json
             data = json.loads(data_str)

        # Dispatcher
        if action == 'login':
            result = handle_login(data)
        elif action == 'signup':
            result = handle_signup(data)
        elif action == 'dashboard':
            result = get_dashboard_data(data)
        # Add your other elifs here:
        # elif action == 'students': result = get_students(data)
        else:
            return jsonify({'success': False, 'message': 'Unknown action'})
            
        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    # This is for running locally
    app.run(host='0.0.0.0', port=5000)