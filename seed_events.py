import pymysql

def seed():
    conn = pymysql.connect(
        host='localhost', 
        user='campuser', 
        password='camppass', 
        port=3306, 
        database='churchcamp'
    )
    cursor = conn.cursor()

    # Clear existing schedule events to prevent duplicate runs
    cursor.execute("DELETE FROM schedule_events")
    conn.commit()

    schedule_data = [
        # Friday
        ("Friday", "2:00 PM", "Check in - Leadership", ""),
        ("Friday", "4:00 PM", "Camp Registration start", ""),
        ("Friday", "5:00 PM", "Free Time/Snacks", ""),
        ("Friday", "6:00 PM", "Icebreakers", ""),
        ("Friday", "7:00 PM", "Session 1", "Theme: TBD"),
        ("Friday", "8:00 PM", "Dinner", ""),
        ("Friday", "9:00 PM", "Camp fire w/ Smores", ""),
        ("Friday", "10:00 PM", "Light snacks", ""),
        ("Friday", "11:00 PM", "Lights Out", ""),

        # Saturday
        ("Saturday", "7:30 AM", "Refresh", ""),
        ("Saturday", "8:00 AM", "Breakfast", ""),
        ("Saturday", "9:00 AM", "Picture 1 w/ Church T-Shirt", ""),
        ("Saturday", "9:15 AM - 10:15 AM", "Session 2", ""),
        ("Saturday", "10:30 AM", "Field Games", ""),
        ("Saturday", "11:00 AM", "Field Games", ""),
        ("Saturday", "12:00 PM", "Lunch", ""),
        ("Saturday", "1:00 PM", "Lake Activities", ""),
        ("Saturday", "2:00 PM", "Pool", ""),
        ("Saturday", "3:00 PM", "Pool", ""),
        ("Saturday", "4:00 PM", "Pool", ""),
        ("Saturday", "5:00 PM", "Refresh/Tea-Snacks", ""),
        ("Saturday", "6:00 PM", "Session 3", ""),
        ("Saturday", "7:00 PM", "Dinner", ""),
        ("Saturday", "8:00 PM", "Team Games", ""),
        ("Saturday", "9:00 PM", "Team Games", ""),
        ("Saturday", "10:00 PM", "Lights off", ""),

        # Sunday
        ("Sunday", "8:00 AM", "Breakfast", ""),
        ("Sunday", "9:30 AM", "Service", ""),
        ("Sunday", "11:00 AM", "Checkout", ""),
        ("Sunday", "11:30 AM", "Picture in Church Attire", ""),
        ("Sunday", "12:00 PM", "Lunch", ""),
        ("Sunday", "1:00 PM", "Drive out", "")
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
