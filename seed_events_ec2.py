import os
import pymysql

env_path = "/home/ubuntu/backend/.env"
db_url = None

if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.strip().startswith("DATABASE_URL="):
                db_url = line.split("DATABASE_URL=")[1].strip().strip("'").strip('"')
                break

if not db_url:
    print("Error: Could not locate DATABASE_URL inside /home/ubuntu/backend/.env")
    exit(1)

# Parse credentials from DATABASE_URL
# e.g., mysql+pymysql://username:password@host:port/database
try:
    clean_url = db_url.replace("mysql+pymysql://", "").replace("mysql://", "")
    auth, rest = clean_url.split("@")
    user, password = auth.split(":")
    host_port, database = rest.split("/")
    if ":" in host_port:
        host, port_str = host_port.split(":")
        port = int(port_str)
    else:
        host = host_port
        port = 3306
except Exception as e:
    print(f"Error parsing DATABASE_URL connection string: {e}")
    exit(1)

def seed():
    print(f"Connecting to EC2 MySQL database '{database}' on {host}:{port} as user '{user}'...")
    conn = pymysql.connect(
        host=host, 
        user=user, 
        password=password, 
        port=port, 
        database=database
    )
    cursor = conn.cursor()

    # First ensure the table is created
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schedule_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        day VARCHAR(50) NOT NULL,
        time VARCHAR(100) NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        location VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
    """)
    conn.commit()

    # Clear existing schedule events to prevent duplicates
    cursor.execute("DELETE FROM schedule_events")
    conn.commit()

    schedule_data = [
        # Friday
        ("Friday, Aug 14", "2:00 PM", "Check in - Leadership", ""),
        ("Friday, Aug 14", "4:00 PM", "Camp Registration start", ""),
        ("Friday, Aug 14", "5:00 PM", "Free Time/Snacks", ""),
        ("Friday, Aug 14", "6:00 PM", "Icebreakers", ""),
        ("Friday, Aug 14", "7:00 PM", "Session 1", "Theme: TBD"),
        ("Friday, Aug 14", "8:00 PM", "Dinner", ""),
        ("Friday, Aug 14", "9:00 PM", "Camp fire w/ Smores", ""),
        ("Friday, Aug 14", "10:00 PM", "Light snacks", ""),
        ("Friday, Aug 14", "11:00 PM", "Lights Out", ""),

        # Saturday
        ("Saturday, Aug 15", "7:30 AM", "Refresh", ""),
        ("Saturday, Aug 15", "8:00 AM", "Breakfast", ""),
        ("Saturday, Aug 15", "9:00 AM", "Picture 1 w/ Church T-Shirt", ""),
        ("Saturday, Aug 15", "9:15 AM - 10:15 AM", "Session 2", ""),
        ("Saturday, Aug 15", "10:30 AM", "Field Games", ""),
        ("Saturday, Aug 15", "11:00 AM", "Field Games", ""),
        ("Saturday, Aug 15", "12:00 PM", "Lunch", ""),
        ("Saturday, Aug 15", "1:00 PM", "Lake Activities", ""),
        ("Saturday, Aug 15", "2:00 PM", "Pool", ""),
        ("Saturday, Aug 15", "3:00 PM", "Pool", ""),
        ("Saturday, Aug 15", "4:00 PM", "Pool", ""),
        ("Saturday, Aug 15", "5:00 PM", "Refresh/Tea-Snacks", ""),
        ("Saturday, Aug 15", "6:00 PM", "Session 3", ""),
        ("Saturday, Aug 15", "7:00 PM", "Dinner", ""),
        ("Saturday, Aug 15", "8:00 PM", "Team Games", ""),
        ("Saturday, Aug 15", "9:00 PM", "Team Games", ""),
        ("Saturday, Aug 15", "10:00 PM", "Lights off", ""),

        # Sunday
        ("Sunday, Aug 16", "8:00 AM", "Breakfast", ""),
        ("Sunday, Aug 16", "9:30 AM", "Service", ""),
        ("Sunday, Aug 16", "11:00 AM", "Checkout", ""),
        ("Sunday, Aug 16", "11:30 AM", "Picture in Church Attire", ""),
        ("Sunday, Aug 16", "12:00 PM", "Lunch", ""),
        ("Sunday, Aug 16", "1:00 PM", "Drive out", "")
    ]

    sql = "INSERT INTO schedule_events (day, time, title, description) VALUES (%s, %s, %s, %s)"

    inserted = 0
    for day, time, title, desc in schedule_data:
        cursor.execute(sql, (day, time, title, desc if desc else None))
        inserted += 1

    conn.commit()
    cursor.close()
    conn.close()

    print(f"Successfully seeded {inserted} schedule events into your EC2 database!")

if __name__ == "__main__":
    seed()
