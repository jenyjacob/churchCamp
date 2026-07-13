import os
import sys
import argparse
import pymysql
import openpyxl
from dotenv import load_dotenv
import urllib.parse as urlparse

def main():
    parser = argparse.ArgumentParser(description="Bulk assign camper teams from an Excel sheet.")
    parser.add_argument("excel_path", nargs="?", default="GCA Team Allocation.xlsx", 
                        help="Path to the Excel file containing name and team columns.")
    args = parser.parse_args()

    excel_path = args.excel_path
    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found at '{excel_path}'.")
        print("Please place the Excel sheet in this directory or provide the correct path.")
        sys.exit(1)

    print(f"Opening Excel workbook: {excel_path}")
    try:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
    except Exception as e:
        print(f"Error reading Excel sheet: {e}")
        sys.exit(1)

    if not rows:
        print("Error: Excel sheet is empty.")
        sys.exit(1)

    # 1. Resolve header indices dynamically
    header = rows[0]
    data_rows = rows[1:]

    name_idx = None
    team_idx = None

    for idx, col in enumerate(header):
        if not col:
            continue
        col_str = str(col).strip().lower()
        if "name" in col_str or "camper" in col_str:
            name_idx = idx
        elif "team" in col_str:
            team_idx = idx

    if name_idx is None or team_idx is None:
        print("Error: Could not resolve header columns dynamically.")
        print(f"Header found: {header}")
        print("Make sure your Excel sheet has column headers like 'Name' and 'Team'.")
        sys.exit(1)

    print(f"Dynamic Column Resolution:")
    print(f"  - Name Column: '{header[name_idx]}' (index {name_idx})")
    print(f"  - Team Column: '{header[team_idx]}' (index {team_idx})")

    # 2. Connect to MySQL database
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
            print(f"Warning: Failed to parse DATABASE_URL: {e}")

    try:
        conn = pymysql.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            port=db_port,
            database=db_name
        )
        cursor = conn.cursor()
    except Exception as e:
        print(f"Error connecting to MySQL database: {e}")
        sys.exit(1)

    print("Successfully connected to the database. Running updates...")
    
    updated_count = 0
    skipped_count = 0
    matched_count = 0

    try:
        for idx, row in enumerate(data_rows, start=2):
            if not row or len(row) <= max(name_idx, team_idx):
                continue
            
            raw_name = row[name_idx]
            raw_team = row[team_idx]

            if not raw_name or not str(raw_name).strip():
                continue

            name = str(raw_name).strip()
            team = str(raw_team).strip() if raw_team else None

            # Split name to first and last name or match by full_name pattern
            # To handle robust matching, we look up campers by first_name/last_name combinations
            # We fetch all campers first or match dynamically. Matching dynamically is safer.
            cursor.execute(
                "SELECT id, first_name, last_name FROM campers WHERE CONCAT(TRIM(first_name), ' ', TRIM(last_name)) = %s", 
                (name,)
            )
            campers = cursor.fetchall()

            if not campers:
                # Try fuzzy matching or split name
                parts = name.split(None, 1)
                if len(parts) == 2:
                    cursor.execute(
                        "SELECT id, first_name, last_name FROM campers WHERE TRIM(first_name) = %s AND TRIM(last_name) = %s",
                        (parts[0], parts[1])
                    )
                    campers = cursor.fetchall()

            if not campers:
                print(f"Row {idx}: No camper found matching name '{name}' in database. Skipping.")
                skipped_count += 1
                continue

            matched_count += len(campers)
            for camper in campers:
                camper_id = camper[0]
                cursor.execute(
                    "UPDATE campers SET team_name = %s WHERE id = %s",
                    (team, camper_id)
                )
                updated_count += 1

        conn.commit()
        print("\nAllocation Complete Summary:")
        print(f"  - Matched names in Excel: {matched_count}")
        print(f"  - Database records updated: {updated_count}")
        print(f"  - Excel rows skipped (unmatched): {skipped_count}")

    except Exception as e:
        conn.rollback()
        print(f"Transaction rolled back due to error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
