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

    def normalize_size(val):
        if not val:
            return None
        val = str(val).strip()
        if not val:
            return None
        return val

    matched_count = 0
    created_count = 0
    updated_count = 0
    unmatched_campers = []

    # Locate column indexes dynamically from the header row
    header = [str(cell).strip().lower() if cell is not None else "" for cell in rows[0]]
    name_idx = -1
    tshirt_idx = -1
    indian_idx = -1

    for i, col in enumerate(header):
        if "name" in col:
            name_idx = i
        elif "t-shirt" in col or "tshirt" in col or "size" in col:
            if "indian" not in col and tshirt_idx == -1:
                tshirt_idx = i
        if "indian" in col:
            indian_idx = i

    # Fallbacks if dynamic detection fails
    if name_idx == -1:
        name_idx = 1
    if tshirt_idx == -1:
        tshirt_idx = 3
    if indian_idx == -1:
        indian_idx = 4

    # Skip header row (index 0)
    for idx, row in enumerate(rows[1:], start=1):
        if not row or len(row) <= max(name_idx, tshirt_idx):
            continue
            
        name = row[name_idx]
        raw_us_size = row[tshirt_idx]
        raw_indian_size = row[indian_idx] if indian_idx != -1 and len(row) > indian_idx else None
        
        if not name:
            continue
            
        name = str(name).strip()
        us_size = normalize_size(raw_us_size) or "Adult M"
        indian_size = str(raw_indian_size).strip() if raw_indian_size is not None else None
            
        # Match camper in the database by first_name + ' ' + last_name
        query = """
            SELECT id, first_name, last_name 
            FROM campers 
            WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) = LOWER(%s)
        """
        cursor.execute(query, (name,))
        db_campers = cursor.fetchall()
        
        matched_camper = None
        if len(db_campers) >= 1:
            matched_camper = db_campers[0]
                
        if matched_camper:
            matched_count += 1
            camper_id = matched_camper["id"]
            full_name = f"{matched_camper['first_name']} {matched_camper['last_name']}"
            
            # Check if Tshirt record exists
            cursor.execute("SELECT id, tshirt_size, indian_size FROM tshirts WHERE camper_id = %s", (camper_id,))
            existing_tshirt = cursor.fetchone()
            
            if existing_tshirt:
                if existing_tshirt["tshirt_size"] != us_size or existing_tshirt["indian_size"] != indian_size:
                    cursor.execute(
                        "UPDATE tshirts SET tshirt_size = %s, indian_size = %s, attendee_name = %s WHERE id = %s",
                        (us_size, indian_size, full_name, existing_tshirt["id"])
                    )
                    updated_count += 1
            else:
                cursor.execute(
                    "INSERT INTO tshirts (camper_id, attendee_name, tshirt_size, indian_size) VALUES (%s, %s, %s, %s)",
                    (camper_id, full_name, us_size, indian_size)
                )
                created_count += 1
        else:
            unmatched_campers.append((name, raw_us_size, raw_indian_size))

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
        for name, us_sz, ind_sz in unmatched_campers[:15]:
            print(f" - Name: {name}, US Size: {us_sz}, Indian Size: {ind_sz}")

if __name__ == "__main__":
    migrate()
