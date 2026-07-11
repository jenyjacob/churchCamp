import os
import sys
import openpyxl
import pymysql
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.abspath('backend'))

# Load .env file relative to backend directory to connect to MySQL
from dotenv import load_dotenv
basedir = os.path.abspath('backend')
load_dotenv(os.path.join(basedir, ".env"))

db_url = os.environ.get("DATABASE_URL")
if not db_url or not db_url.startswith("mysql"):
    print("Database URL must be MySQL for this migration:", db_url)
    exit(1)

# Extract connection details
try:
    url_parts = db_url.split("://")[1]
    credentials, rest = url_parts.split("@")
    user, password = credentials.split(":")
    host_port, dbname = rest.split("/")
    if ":" in host_port:
        host, port = host_port.split(":")
        port = int(port)
    else:
        host = host_port
        port = 3306
except Exception as e:
    print("Error parsing DATABASE_URL:", e)
    user = os.environ.get("DB_USER", "")
    password = os.environ.get("DB_PASSWORD", "")
    host = os.environ.get("DB_HOST", "localhost")
    port = int(os.environ.get("DB_PORT", 3306))
    dbname = os.environ.get("DB_NAME", "churchcamp")

def normalize_size(val):
    if not val:
        return None
    val = str(val).strip()
    if not val:
        return None
    return val

excel_file = "GCA Tshirt Report.xlsx"
if not os.path.exists(excel_file):
    # Fallback to general report if tshirt report doesn't exist locally
    excel_file = "GCA Camp Report.xlsx"
    print(f"T-Shirt report not found, falling back to: {excel_file}")

if not os.path.exists(excel_file):
    print("No Excel file found for T-shirt migration.")
    exit(1)

print(f"Loading workbook {excel_file}...")
wb = openpyxl.load_workbook(excel_file, data_only=True)
sheet = wb.active
rows = list(sheet.iter_rows(values_only=True))
print(f"Loaded {len(rows)} rows.")

print("Connecting to database...")
conn = pymysql.connect(host=host, user=user, password=password, port=port, database=dbname)
cursor = conn.cursor(pymysql.cursors.DictCursor)

matched_count = 0
created_count = 0
updated_count = 0
unmatched_campers = []

for idx, row in enumerate(rows[1:], start=1):
    if not row or len(row) < 4:
        continue
        
    name = row[2]
    raw_size = row[3]
    family_group = str(row[10]) if len(row) > 10 and row[10] is not None else ""
    
    if not name or not raw_size:
        continue
        
    name = str(name).strip()
    tshirt_size = normalize_size(raw_size)
    if not tshirt_size:
        continue
        
    # Match camper
    query = """
        SELECT id, first_name, last_name, family_group 
        FROM campers 
        WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) = LOWER(%s)
    """
    cursor.execute(query, (name,))
    db_campers = cursor.fetchall()
    
    matched_camper = None
    if len(db_campers) == 1:
        matched_camper = db_campers[0]
    elif len(db_campers) > 1:
        # Resolve by family group
        for dbc in db_campers:
            dbc_fg = str(dbc["family_group"]) if dbc["family_group"] is not None else ""
            if dbc_fg == family_group:
                matched_camper = dbc
                break
        if not matched_camper:
            matched_camper = db_campers[0]
            
    if matched_camper:
        matched_count += 1
        camper_id = matched_camper["id"]
        full_name = f"{matched_camper['first_name']} {matched_camper['last_name']}"
        
        cursor.execute("SELECT id, tshirt_size FROM tshirts WHERE camper_id = %s", (camper_id,))
        existing_tshirt = cursor.fetchone()
        
        if existing_tshirt:
            if existing_tshirt["tshirt_size"] != tshirt_size:
                cursor.execute(
                    "UPDATE tshirts SET tshirt_size = %s, attendee_name = %s WHERE id = %s",
                    (tshirt_size, full_name, existing_tshirt["id"])
                )
                updated_count += 1
        else:
            cursor.execute(
                "INSERT INTO tshirts (camper_id, attendee_name, tshirt_size) VALUES (%s, %s, %s)",
                (camper_id, full_name, tshirt_size)
            )
            created_count += 1
    else:
        unmatched_campers.append((name, family_group, raw_size))

conn.commit()
cursor.close()
conn.close()

print("\nT-SHIRT MIGRATION SUMMARY:")
print(f"Total T-Shirt Excel rows processed: {len(rows) - 1}")
print(f"Total matched campers in DB: {matched_count}")
print(f"Total T-shirts created: {created_count}")
print(f"Total T-shirts updated: {updated_count}")
print(f"Total unmatched campers: {len(unmatched_campers)}")
