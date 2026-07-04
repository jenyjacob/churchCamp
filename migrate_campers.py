import openpyxl
import pymysql
import os

file_path = r"C:\Users\jenyj\Google Drive\GCA\gca_2026_camp\GCA_2026_Camp_Signup.xlsx"

def split_name(full_name):
    if not full_name:
        return "", ""
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]

def migrate():
    # 1. Connect to local MySQL database
    conn = pymysql.connect(
        host='localhost', 
        user='campuser', 
        password='camppass', 
        port=3306, 
        database='churchcamp'
    )
    cursor = conn.cursor()
    
    # Clear existing campers to prevent duplicates if running migration fresh
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
    family_guardians = {} # family_group_id -> { 'names': [], 'phone': None, 'email': None }
    
    for row in data_rows:
        if not row or len(row) < 11:
            continue
        member_type = row[2] # 'Adult' or 'Child'
        name = row[3]
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

    # 4. Second pass: insert campers (both Adults and Children)
    inserted_count = 0
    
    insert_sql = """
        INSERT INTO campers (
            first_name, last_name, age, gender, grade, cabin_group, session, family_group,
            guardian_name, guardian_phone, guardian_email, emergency_contact, emergency_phone,
            allergies, medical_notes, medications, registration_status, payment_status, notes
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s
        )
    """
    
    for row in data_rows:
        if not row or len(row) < 11:
            continue
        
        member_type = row[2] # 'Adult' or 'Child'
        name = row[3]
        child_age = row[4]
        allergies = row[7]
        phone = row[8]
        email = row[9]
        family_group = str(row[10]) if row[10] is not None else None
        
        if not name:
            continue
            
        first_name, last_name = split_name(name)
        
        # Determine demographics & contacts
        age = None
        if member_type == 'Child' and child_age is not None:
            try:
                age = int(child_age)
            except ValueError:
                pass
                
        # Resolve guardian info using our family group mapping
        guardian_name = None
        guardian_phone = None
        guardian_email = None
        
        if family_group and family_group in family_guardians:
            guardians = family_guardians[family_group]
            if guardians['names']:
                guardian_name = " & ".join(guardians['names'])
            guardian_phone = guardians['phone']
            guardian_email = guardians['email']
            
        # Notes
        notes = f"Type: {member_type}"
        if member_type == 'Adult':
            # For adults, store their direct contact info in guardian fields
            guardian_name = "Self"
            guardian_phone = str(phone).strip() if phone else None
            guardian_email = str(email).strip() if email else None
            
        # Execute INSERT
        cursor.execute(insert_sql, (
            first_name,
            last_name,
            age,
            None, # gender
            None, # grade
            None, # cabin_group
            "Session 2026", # default session name
            family_group,
            guardian_name,
            guardian_phone,
            guardian_email,
            None, # emergency_contact
            None, # emergency_phone
            allergies,
            None, # medical_notes
            None, # medications
            'registered',
            'unpaid',
            notes
        ))
        inserted_count += 1
        
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Data migration finished! Successfully inserted {inserted_count} members.")

if __name__ == "__main__":
    migrate()
