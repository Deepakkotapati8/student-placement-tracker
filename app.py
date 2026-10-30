from flask import Flask, request, jsonify, render_template, session, redirect, url_for
import psycopg2
import os

app = Flask(__name__)

# ==================== LOGIN SETTINGS ====================

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "placement-tracker-secret-key"
)

LOGIN_USERNAME = "deepak"
LOGIN_PASSWORD = "123456"

DATABASE_URL = os.environ.get("DATABASE_URL")


# ==================== DATABASE CONNECTION ====================

def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")

    return psycopg2.connect(DATABASE_URL)


# ==================== DATABASE INITIALIZATION ====================

def init_db():
    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS skills (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    progress INTEGER NOT NULL
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    status TEXT DEFAULT 'Not Applied'
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dsa (
                    id SERIAL PRIMARY KEY,
                    topic TEXT NOT NULL,
                    total_problems INTEGER DEFAULT 0,
                    solved_problems INTEGER DEFAULT 0
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS interviews (
                    id SERIAL PRIMARY KEY,
                    company TEXT NOT NULL,
                    role TEXT,
                    interview_date TEXT,
                    status TEXT DEFAULT 'Scheduled',
                    notes TEXT
                )
            """)

        conn.commit()

    finally:
        conn.close()


def read_json():
    return request.get_json(silent=True) or {}


# ==================== LOGIN ====================

@app.route("/login", methods=["GET"])
def login_page():

    if "user_id" in session:
        return redirect(url_for("home"))

    return render_template("login.html")


@app.route("/login", methods=["POST"])
def login():

    data = read_json()

    username = data.get("username", "")
    password = data.get("password", "")

    if username == LOGIN_USERNAME and password == LOGIN_PASSWORD:

        session["user_id"] = username

        return jsonify({
            "message": "Login successful"
        })

    return jsonify({
        "error": "Invalid User ID or Password"
    }), 401


@app.route("/logout")
def logout():

    session.clear()

    return redirect(url_for("login_page"))


# ==================== HOME ====================

@app.route("/")
def home():

    if "user_id" not in session:
        return redirect(url_for("login_page"))

    return render_template("index.html")


# ==================== SKILLS ====================

@app.route("/api/skills", methods=["GET"])
def get_skills():

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute("SELECT * FROM skills ORDER BY id DESC")
            rows = cursor.fetchall()

        return jsonify([
            {
                "id": row[0],
                "name": row[1],
                "progress": row[2]
            }
            for row in rows
        ])

    finally:
        conn.close()


@app.route("/api/skills", methods=["POST"])
def add_skill():

    data = read_json()

    name = data.get("name", "")
    progress = data.get("progress", 0)

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Skill name is required"}), 400

    try:
        progress = int(progress)
    except (TypeError, ValueError):
        return jsonify({"error": "Progress must be a whole number"}), 400

    if not 0 <= progress <= 100:
        return jsonify({"error": "Progress must be between 0 and 100"}), 400

    conn = get_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO skills (name, progress)
                VALUES (%s, %s)
                """,
                (name.strip(), progress)
            )

        conn.commit()

        return jsonify({"message": "Skill added successfully!"}), 201

    finally:
        conn.close()


@app.route("/api/skills/<int:skill_id>", methods=["PUT", "DELETE"])
def update_skill(skill_id):

    data = read_json()

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            if request.method == "DELETE":

                cursor.execute(
                    "DELETE FROM skills WHERE id = %s",
                    (skill_id,)
                )

                if cursor.rowcount == 0:
                    return jsonify({"error": "Skill not found"}), 404

                conn.commit()

                return jsonify({"message": "Skill deleted successfully!"})

            try:
                progress = int(data.get("progress"))
            except (TypeError, ValueError):
                return jsonify({"error": "Progress must be a whole number"}), 400

            if not 0 <= progress <= 100:
                return jsonify({"error": "Progress must be between 0 and 100"}), 400

            cursor.execute(
                """
                UPDATE skills
                SET progress = %s
                WHERE id = %s
                """,
                (progress, skill_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"error": "Skill not found"}), 404

        conn.commit()

        return jsonify({"message": "Skill progress updated successfully!"})

    finally:
        conn.close()


# ==================== PROJECTS ====================

@app.route("/api/projects", methods=["GET"])
def get_projects():

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute("SELECT * FROM projects ORDER BY id DESC")
            rows = cursor.fetchall()

        return jsonify([
            {
                "id": row[0],
                "name": row[1],
                "description": row[2] or ""
            }
            for row in rows
        ])

    finally:
        conn.close()


@app.route("/api/projects", methods=["POST"])
def add_project():

    data = read_json()

    name = data.get("name", "")
    description = data.get("description", "")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Project name is required"}), 400

    if not isinstance(description, str):
        return jsonify({"error": "Description must be text"}), 400

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute(
                """
                INSERT INTO projects (name, description)
                VALUES (%s, %s)
                """,
                (name.strip(), description.strip())
            )

        conn.commit()

        return jsonify({"message": "Project added successfully!"}), 201

    finally:
        conn.close()


@app.route("/api/projects/<int:project_id>", methods=["PUT", "DELETE"])
def update_project(project_id):

    data = read_json()

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            if request.method == "DELETE":

                cursor.execute(
                    "DELETE FROM projects WHERE id = %s",
                    (project_id,)
                )

                if cursor.rowcount == 0:
                    return jsonify({"error": "Project not found"}), 404

                conn.commit()

                return jsonify({"message": "Project deleted successfully!"})

            name = data.get("name", "")
            description = data.get("description", "")

            if not isinstance(name, str) or not name.strip():
                return jsonify({"error": "Project name is required"}), 400

            if not isinstance(description, str):
                return jsonify({"error": "Description must be text"}), 400

            cursor.execute(
                """
                UPDATE projects
                SET name = %s, description = %s
                WHERE id = %s
                """,
                (name.strip(), description.strip(), project_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"error": "Project not found"}), 404

        conn.commit()

        return jsonify({"message": "Project updated successfully!"})

    finally:
        conn.close()


# ==================== COMPANIES ====================

@app.route("/api/companies", methods=["GET"])
def get_companies():

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute("SELECT * FROM companies ORDER BY id DESC")
            rows = cursor.fetchall()

        return jsonify([
            {
                "id": row[0],
                "name": row[1],
                "status": row[2] or "Not Applied"
            }
            for row in rows
        ])

    finally:
        conn.close()


@app.route("/api/companies", methods=["POST"])
def add_company():

    data = read_json()

    name = data.get("name", "")
    status = data.get("status", "Not Applied")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Company name is required"}), 400

    allowed_statuses = [
        "Not Applied",
        "Applied",
        "Interview",
        "Selected"
    ]

    if status not in allowed_statuses:
        return jsonify({"error": "Invalid application status"}), 400

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute(
                """
                INSERT INTO companies (name, status)
                VALUES (%s, %s)
                """,
                (name.strip(), status)
            )

        conn.commit()

        return jsonify({"message": "Company added successfully!"}), 201

    finally:
        conn.close()


@app.route("/api/companies/<int:company_id>", methods=["PUT", "DELETE"])
def update_company(company_id):

    data = read_json()

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            if request.method == "DELETE":

                cursor.execute(
                    "DELETE FROM companies WHERE id = %s",
                    (company_id,)
                )

                if cursor.rowcount == 0:
                    return jsonify({"error": "Company not found"}), 404

                conn.commit()

                return jsonify({"message": "Company deleted successfully!"})

            status = data.get("status", "")

            allowed_statuses = [
                "Not Applied",
                "Applied",
                "Interview",
                "Selected"
            ]

            if status not in allowed_statuses:
                return jsonify({"error": "Invalid application status"}), 400

            cursor.execute(
                """
                UPDATE companies
                SET status = %s
                WHERE id = %s
                """,
                (status, company_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"error": "Company not found"}), 404

        conn.commit()

        return jsonify({"message": "Company status updated successfully!"})

    finally:
        conn.close()


# ==================== DSA ====================

@app.route("/api/dsa", methods=["GET"])
def get_dsa():

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute("SELECT * FROM dsa ORDER BY id DESC")
            rows = cursor.fetchall()

        return jsonify([
            {
                "id": row[0],
                "topic": row[1],
                "total_problems": row[2],
                "solved_problems": row[3]
            }
            for row in rows
        ])

    finally:
        conn.close()


@app.route("/api/dsa", methods=["POST"])
def add_dsa():

    data = read_json()

    topic = data.get("topic", "")

    if not isinstance(topic, str) or not topic.strip():
        return jsonify({"error": "Topic name is required"}), 400

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute(
                """
                INSERT INTO dsa (topic, total_problems, solved_problems)
                VALUES (%s, 0, 0)
                """,
                (topic.strip(),)
            )

        conn.commit()

        return jsonify({"message": "DSA topic added successfully!"}), 201

    finally:
        conn.close()


@app.route("/api/dsa/<int:topic_id>", methods=["PUT", "DELETE"])
def update_dsa(topic_id):

    data = read_json()

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            if request.method == "DELETE":

                cursor.execute(
                    "DELETE FROM dsa WHERE id = %s",
                    (topic_id,)
                )

                if cursor.rowcount == 0:
                    return jsonify({"error": "DSA topic not found"}), 404

                conn.commit()

                return jsonify({"message": "DSA topic deleted successfully!"})

            try:
                total = int(data.get("total_problems"))
                solved = int(data.get("solved_problems"))
            except (TypeError, ValueError):
                return jsonify({"error": "Problem counts must be whole numbers"}), 400

            if total < 0 or solved < 0 or solved > total:
                return jsonify({
                    "error": "Solved problems must be between 0 and total problems"
                }), 400

            cursor.execute(
                """
                UPDATE dsa
                SET total_problems = %s, solved_problems = %s
                WHERE id = %s
                """,
                (total, solved, topic_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"error": "DSA topic not found"}), 404

        conn.commit()

        return jsonify({"message": "DSA progress updated successfully!"})

    finally:
        conn.close()


# ==================== INTERVIEWS ====================

@app.route("/api/interviews", methods=["GET"])
def get_interviews():

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute("SELECT * FROM interviews ORDER BY id DESC")
            rows = cursor.fetchall()

        return jsonify([
            {
                "id": row[0],
                "company": row[1],
                "role": row[2] or "",
                "interview_date": row[3] or "",
                "status": row[4] or "Scheduled",
                "notes": row[5] or ""
            }
            for row in rows
        ])

    finally:
        conn.close()


@app.route("/api/interviews", methods=["POST"])
def add_interview():

    data = read_json()

    company = data.get("company", "")
    role = data.get("role", "")
    interview_date = data.get("interview_date", "")
    status = data.get("status", "Scheduled")
    notes = data.get("notes", "")

    if not isinstance(company, str) or not company.strip():
        return jsonify({"error": "Company name is required"}), 400

    allowed_statuses = [
        "Scheduled",
        "Completed",
        "Cancelled"
    ]

    if status not in allowed_statuses:
        return jsonify({"error": "Invalid interview status"}), 400

    if not all(
        isinstance(value, str)
        for value in [role, interview_date, notes]
    ):
        return jsonify({"error": "Role, date, and notes must be text"}), 400

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            cursor.execute(
                """
                INSERT INTO interviews
                (company, role, interview_date, status, notes)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    company.strip(),
                    role.strip(),
                    interview_date.strip(),
                    status,
                    notes.strip()
                )
            )

        conn.commit()

        return jsonify({"message": "Interview added successfully!"}), 201

    finally:
        conn.close()


@app.route("/api/interviews/<int:interview_id>", methods=["PUT", "DELETE"])
def update_interview(interview_id):

    data = read_json()

    conn = get_connection()

    try:
        with conn.cursor() as cursor:

            if request.method == "DELETE":

                cursor.execute(
                    "DELETE FROM interviews WHERE id = %s",
                    (interview_id,)
                )

                if cursor.rowcount == 0:
                    return jsonify({"error": "Interview not found"}), 404

                conn.commit()

                return jsonify({"message": "Interview deleted successfully!"})

            status = data.get("status", "")

            allowed_statuses = [
                "Scheduled",
                "Completed",
                "Cancelled"
            ]

            if status not in allowed_statuses:
                return jsonify({"error": "Invalid interview status"}), 400

            cursor.execute(
                """
                UPDATE interviews
                SET status = %s
                WHERE id = %s
                """,
                (status, interview_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"error": "Interview not found"}), 404

        conn.commit()

        return jsonify({"message": "Interview status updated successfully!"})

    finally:
        conn.close()


# ==================== START SERVER ====================

# Create database tables when the application starts.
init_db()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )