import os
import pymysql
import urllib.parse as urlparse
from dotenv import load_dotenv

def seed():
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

    db_url = os.environ.get("DATABASE_URL")
    db_user = os.environ.get("DB_USER", "")
    db_password = os.environ.get("DB_PASSWORD", "")
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = int(os.environ.get("DB_PORT", 3306))
    db_name = os.environ.get("DB_NAME", "churchcamp")

    if db_url:
        try:
            parsed_url = db_url.replace("mysql+pymysql://", "http://")
            url = urlparse.urlparse(parsed_url)
            db_user = url.username or db_user
            db_password = url.password or db_password
            db_host = url.hostname or db_host
            db_port = url.port or db_port
            db_name = url.path.lstrip('/') or db_name
        except Exception as e:
            print(f"Warning: Failed to parse DATABASE_URL: {e}")

    conn = pymysql.connect(
        host=db_host, 
        user=db_user, 
        password=db_password, 
        port=db_port, 
        database=db_name
    )
    cursor = conn.cursor()

    # Clear existing schedule events to prevent duplicate runs
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

    print(f"Successfully seeded {inserted} schedule events!")

if __name__ == "__main__":
    seed()
