import sqlite3

db_path = "instance/churchcamp.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables in SQLite:")
for t in tables:
    print(t)
    
cursor.execute("SELECT COUNT(*) FROM campers")
print(f"Campers count: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM users")
print(f"Users count: {cursor.fetchone()[0]}")
conn.close()
