import openpyxl
import pymysql
import os

file_path = "/home/ubuntu/GCA Camp Report.xlsx"

def split_name(full_name):
    if not full_name:
        return "", ""
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]

def migrate():
    # 1. Connect to local MySQL database container mapping on port 3307
    conn = pymysql.connect(
        host='127.0.0.1', 
        user='campuser', 
        password='camppass', 
        port=3307, # Map to the host port defined in docker-compose
        database='churchcamp'
    )
    cursor = conn.cursor()
    
    # Clear existing campers to prevent duplicates
    cursor.execute("DELETE FROM checkins")
    cursor.execute("DELETE FROM campers")
    conn.commit()
    print("Cleaned existing campers & checkins tables.")

    # 2. Load Excel workbook
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb.active
    
    rows = list(sheet.iter_rows(values_only=True))
    header = rows[0]
    data_rows = rows[1:]
    
    # 3. First pass: group adults by Family Group to extract parent/guardian details
    family_guardians = {}
    
    for row in data_rows:
        if not row or len(row) < 11:
            continue
        member_type = row[1] # 'Adult' or 'Child'
        name = row[2]
        phone = row[8]
        email = row[9]
        family_group = str(row[10]) if row[10] is not None else None
        
        if not family_group or not name:
            continue
            
        if family_group not in family_guardians:
            family_guardians[family_group] = { 'names': [], 'phone': None, 'email': None }
            
        if member_type == 'Adult':
            family_guardians[family_group]['names'].append(name)
            if phone and not family_guardians[family_group]['phone']:
                family_guardians[family_group]['phone'] = str(phone).strip()
            if email and not family_guardians[family_group]['email']:
                family_guardians[family_group]['email'] = str(email).strip()

    # 4. Second pass: insert campers
    inserted_count = 0
    
    insert_sql = """
        INSERT INTO campers (
            first_name, last_name, age, gender, cabin_group, family_group,
            guardian_name, guardian_phone, allergies, registration_status, notes,
            kayaking, boat_tour
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s
        )
    """
    
    for row in data_rows:
        if not row or len(row) < 11:
            continue
        
        member_type = row[1] # 'Adult' or 'Child'
        name = row[2]
        child_age = row[4]
        allergies = row[7]
        phone = row[8]
        email = row[9]
        family_group = str(row[10]) if row[10] is not None else None
        
        # Parse outdoor activities
        kayaking_val = 0
        try:
            if row[5] is not None and str(row[5]).strip() != "":
                kayaking_val = int(float(row[5]))
        except:
            pass

        boat_tour_val = 0
        try:
            if row[6] is not None and str(row[6]).strip() != "":
                boat_tour_val = int(float(row[6]))
        except:
            pass

        if not name:
            continue
            
        first_name, last_name = split_name(name)
        
        age = None
        if member_type == 'Child' and child_age is not None:
            try:
                age = int(child_age)
            except ValueError:
                pass
                
        guardian_name = None
        guardian_phone = None
        
        if family_group and family_group in family_guardians:
            guardians = family_guardians[family_group]
            if guardians['names']:
                guardian_name = " & ".join(guardians['names'])
            guardian_phone = guardians['phone']
            
        notes = f"Type: {member_type}"
        if member_type == 'Adult':
            guardian_name = "Self"
            guardian_phone = str(phone).strip() if phone else None
            
        cursor.execute(insert_sql, (
            first_name,
            last_name,
            age,
            None, # gender
            None, # cabin_group
            family_group,
            guardian_name,
            guardian_phone,
            allergies,
            'registered',
            notes,
            kayaking_val,
            boat_tour_val
        ))
        inserted_count += 1
        
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Data migration finished! Successfully inserted {inserted_count} members.")

if __name__ == "__main__":
    migrate()
