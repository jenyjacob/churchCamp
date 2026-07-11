import os
import sys
import openpyxl
import pymysql
import boto3
import urllib.parse as urlparse
from dotenv import load_dotenv

# S3 Configuration for T-Shirts
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "gca-camp-report-bucket")
S3_FILE_KEY = os.environ.get("S3_TSHIRT_FILE_KEY", "GCA Tshirt Report.xlsx")
file_path = "/home/ubuntu/GCA Tshirt Report.xlsx"

def download_excel_from_s3():
    try:
        print(f"Connecting to S3 to download '{S3_FILE_KEY}' from bucket '{S3_BUCKET_NAME}'...")
        s3 = boto3.client('s3')
        s3.download_file(S3_BUCKET_NAME, S3_FILE_KEY, file_path)
        print("T-Shirt Excel sheet successfully downloaded from S3.")
        return True
    except Exception as e:
        print(f"Error downloading T-Shirt file from S3: {e}")
        return False

def normalize_size(val):
    if not val:
        return None
    val = str(val).strip()
    if not val:
        return None
    return val

def migrate():
    # 1. Download the T-Shirt Excel file from AWS S3
    # Check if we are running in local/test mode or if S3 download succeeds
    is_ec2 = os.path.exists("/home/ubuntu")
    if is_ec2:
        if not download_excel_from_s3():
            print("Aborting T-Shirt migration because S3 download failed.")
            return
    else:
        # Fallback to local file in workspace root
        global file_path
        file_path = "GCA Tshirt Report.xlsx"
        if not os.path.exists(file_path):
            print(f"Local T-Shirt Excel file not found at: {file_path}")
            return

    # 2. Load Excel workbook
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            raise ValueError("T-Shirt Excel file has no data rows")
    except Exception as e:
        print(f"Error: Failed to load T-Shirt Excel workbook from {file_path}. Aborting.")
        print(f"Details: {e}")
        return

    # 3. Connect to MySQL database
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
    
    db_url = os.environ.get("DATABASE_URL")
    db_user = os.environ.get("DB_USER", "")
    db_password = os.environ.get("DB_PASSWORD", "")
    db_host = os.environ.get("DB_HOST", "127.0.0.1")
    db_port = int(os.environ.get("DB_PORT", 3307))
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
            print(f"Warning: Failed to parse DATABASE_URL from environment: {e}. Using default values.")

    conn = pymysql.connect(
        host=db_host, 
        user=db_user, 
        password=db_password, 
        port=db_port, 
        database=db_name
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    matched_count = 0
    created_count = 0
    updated_count = 0
    unmatched_campers = []

    # Columns: 0: No, 1: Type, 2: Name, 3: T-Shirt Size, ..., 10: Family Group
    # Skip header row (index 0)
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
            
        # Match camper in the database
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
                # fallback to first match
                matched_camper = db_campers[0]
                
        if matched_camper:
            matched_count += 1
            camper_id = matched_camper["id"]
            full_name = f"{matched_camper['first_name']} {matched_camper['last_name']}"
            
            # Check if Tshirt record exists
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

    if unmatched_campers:
        print("\nUnmatched campers from T-Shirt Excel:")
        for name, fg, size in unmatched_campers[:10]:
            print(f" - Name: {name}, Family: {fg}, Size: {size}")

if __name__ == "__main__":
    migrate()
