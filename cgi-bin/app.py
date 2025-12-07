from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import hashlib
from datetime import datetime
import os
import json

app = Flask(__name__)
# Enable CORS so Vercel can talk to Render
CORS(app)

# -----------------------------------------
# DATABASE CONFIGURATION
# -----------------------------------------
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
# LOGIC FUNCTIONS
# -----------------------------------------

def handle_login(data):
    email = data.get('email')
    password = data.get('password')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
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
        cursor.execute("SELECT name, email, bio, education, experience FROM lecturer WHERE lecturer_id = %s", (lecturer_id,))
        lecturer = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) AS total_courses FROM course WHERE lecturer_id = %s", (lecturer_id,))
        total_courses = cursor.fetchone()['total_courses']
        
        cursor.execute("""SELECT COUNT(DISTINCT student_id) AS total_students FROM student_courses sc 
                          JOIN course c ON sc.course_id = c.course_id WHERE c.lecturer_id = %s""", (lecturer_id,))
        total_students = cursor.fetchone()['total_students']
        
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

def get_courses(data):
    lecturer_id = data.get('lecturer_id')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""SELECT c.course_id, c.course_code, c.title, c.level,
                          COUNT(DISTINCT sc.student_id) AS student_count,
                          COUNT(DISTINCT a.assignment_id) AS assignment_count
                          FROM course c
                          LEFT JOIN student_courses sc ON c.course_id = sc.course_id
                          LEFT JOIN assignment a ON c.course_id = a.course_id
                          WHERE c.lecturer_id = %s GROUP BY c.course_id""", (lecturer_id,))
        courses = cursor.fetchall()
        return {'success': True, 'courses': courses}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def get_assignments(data):
    lecturer_id = data.get('lecturer_id')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""SELECT a.assignment_id, a.title, a.description, a.due_date, c.course_code, c.title AS course_title
                          FROM assignment a JOIN course c ON a.course_id = c.course_id
                          WHERE c.lecturer_id = %s ORDER BY a.due_date DESC""", (lecturer_id,))
        assignments = cursor.fetchall()
        # Fix date format
        for a in assignments:
            if a.get('due_date'):
                a['due_date'] = str(a['due_date'])
            a['total_submissions'] = 0 # Placeholder if table missing
            a['pending_grading'] = 0   # Placeholder
        return {'success': True, 'assignments': assignments}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def get_students(data):
    lecturer_id = data.get('lecturer_id')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""SELECT DISTINCT s.student_id, s.full_name, s.matric_no, s.email, c.course_code 
                          FROM student s JOIN student_courses sc ON s.student_id = sc.student_id 
                          JOIN course c ON sc.course_id = c.course_id 
                          WHERE c.lecturer_id = %s""", (lecturer_id,))
        students = cursor.fetchall()
        return {'success': True, 'students': students}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def get_lecturer_profile(data):
    lecturer_id = data.get('lecturer_id')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT lecturer_id, name, email, bio, education, experience FROM lecturer WHERE lecturer_id = %s", (lecturer_id,))
        lecturer = cursor.fetchone()
        if lecturer:
            return {'success': True, 'lecturer': lecturer}
        return {'success': False, 'message': 'Lecturer not found'}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def add_course(data):
    lecturer_id = data.get('lecturer_id')
    course_code = data.get('course_code')
    title = data.get('title')
    level = data.get('level')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO course (course_code, title, level, lecturer_id) VALUES (%s, %s, %s, %s)", (course_code, title, level, lecturer_id))
        conn.commit()
        return {'success': True, 'message': 'Course created', 'course_id': cursor.lastrowid}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

def delete_course(data):
    course_id = data.get('course_id')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM course WHERE course_id = %s", (course_id,))
        conn.commit()
        return {'success': True, 'message': 'Course deleted'}
    except Exception as e:
        return {'success': False, 'message': str(e)}
    finally:
        cursor.close()
        conn.close()

# -----------------------------------------
# FLASK ROUTE HANDLER
# -----------------------------------------
@app.route('/', methods=['POST'])
@app.route('/lecturer_api.py', methods=['POST'])
def main_handler():
    try:
        action = request.form.get('action')
        data_str = request.form.get('data')
        
        if not action or not data_str:
            req_json = request.get_json(silent=True)
            if req_json:
                action = req_json.get('action')
                data = req_json.get('data')
            else:
                return jsonify({'success': False, 'message': 'No data received'})
        else:
             data = json.loads(data_str)

        # ---------------------------------------------------------
        # THIS IS THE PART THAT WAS MISSING IN THE PREVIOUS VERSION
        # ---------------------------------------------------------
        if action == 'login':
            result = handle_login(data)
        elif action == 'signup':
            result = handle_signup(data)
        elif action == 'dashboard':
            result = get_dashboard_data(data)
        elif action == 'courses':
            result = get_courses(data)
        elif action == 'assignments':
            result = get_assignments(data)
        elif action == 'students':
            result = get_students(data)
        elif action == 'profile':
            result = get_lecturer_profile(data)
        elif action == 'add_course':
            result = add_course(data)
        elif action == 'delete_course':
            result = delete_course(data)
        elif action == 'publications' or action == 'add_publication' or action == 'delete_publication':
            # Placeholder for publications (returns empty list so it doesn't crash)
            result = {'success': True, 'publications': []}
        else:
            result = {'success': False, 'message': 'Unknown action'}
            
        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
