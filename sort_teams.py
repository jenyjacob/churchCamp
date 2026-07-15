import os
import sys
import shutil
import random
import subprocess
import openpyxl
from collections import defaultdict

def read_workbook_safely(filepath):
    """
    Attempts to read the Excel workbook. If it is locked (e.g. open in Excel),
    uses a PowerShell Copy-Item fallback to read from a copy.
    """
    if not os.path.exists(filepath):
        print(f"Error: Excel file not found at '{filepath}'.")
        sys.exit(1)
        
    try:
        # Try direct open first
        wb = openpyxl.load_workbook(filepath, data_only=True)
        return wb, False
    except PermissionError:
        print("Note: Excel file appears to be locked (open in Excel). Attempting to read via temp copy...")
        temp_path = os.path.join(os.path.dirname(filepath), "temp_read_teamsorter.xlsx")
        try:
            # Run PowerShell Copy-Item to bypass Excel lock
            subprocess.run(
                ["powershell", "-Command", f"Copy-Item -Path '{filepath}' -Destination '{temp_path}'"],
                check=True, capture_output=True
            )
            wb = openpyxl.load_workbook(temp_path, data_only=True)
            # Remove temp file after load
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return wb, True
        except Exception as e:
            print(f"Error: Could not read Excel file even with fallback copy: {e}")
            sys.exit(1)

def write_workbook_safely(wb, filepath):
    """
    Attempts to save the workbook directly. If locked, saves to a fallback path.
    """
    try:
        wb.save(filepath)
        print(f"Successfully saved assignments directly to '{filepath}'")
        return filepath
    except PermissionError:
        base, ext = os.path.splitext(filepath)
        fallback_path = f"{base}_assigned{ext}"
        print(f"\n[WARNING] '{filepath}' is currently open/locked in another program (e.g. Microsoft Excel).")
        print(f"To avoid losing progress, writing assignments to fallback file: '{fallback_path}' instead.")
        try:
            wb.save(fallback_path)
            print(f"Successfully saved to '{fallback_path}'")
            return fallback_path
        except Exception as e:
            print(f"Error: Could not write to fallback path '{fallback_path}': {e}")
            sys.exit(1)

def get_bucket(age):
    """
    Maps an age to one of four cohorts:
    1: Kids/Teens (<= 18)
    2: Young Adults (19-35)
    3: Middle Adults (36-55)
    4: Older Adults (>= 56)
    """
    if age is None:
        return 2  # Default fallback
    if age <= 18:
        return 1
    elif age <= 35:
        return 2
    elif age <= 55:
        return 3
    else:
        return 4

def main():
    # Resolve file path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_path = os.path.join(script_dir, "TeamSorter.xlsx")
    
    print(f"Opening Excel workbook: {excel_path}")
    wb, was_locked = read_workbook_safely(excel_path)
    sheet = wb.active
    
    # 1. Resolve header indices dynamically
    header_row = [cell.value for cell in sheet[1]]
    
    def find_col_idx(headers, keywords):
        for idx, h in enumerate(headers):
            if h and any(kw in str(h).strip().lower() for kw in keywords):
                return idx
        return None

    name_idx = find_col_idx(header_row, ['name', 'camper'])
    age_idx = find_col_idx(header_row, ['age'])
    couple_idx = find_col_idx(header_row, ['couple group', 'couple_group'])
    gender_idx = find_col_idx(header_row, ['gender', 'sex'])
    type_idx = find_col_idx(header_row, ['type', 'adult/child'])
    mode_idx = find_col_idx(header_row, ['mode'])

    if None in (name_idx, age_idx, couple_idx, gender_idx, type_idx):
        print("Error: Could not resolve all required headers dynamically.")
        print(f"Header found: {header_row}")
        print("Required headers: 'Name', 'Age', 'Couple Group', 'Gender', and 'Type'.")
        sys.exit(1)
        
    print(f"Dynamic Column Resolution:")
    print(f"  - Name: Column {name_idx + 1} ('{header_row[name_idx]}')")
    print(f"  - Age: Column {age_idx + 1} ('{header_row[age_idx]}')")
    print(f"  - Couple Group: Column {couple_idx + 1} ('{header_row[couple_idx]}')")
    print(f"  - Gender: Column {gender_idx + 1} ('{header_row[gender_idx]}')")
    print(f"  - Type: Column {type_idx + 1} ('{header_row[type_idx]}')")
    if mode_idx is not None:
        print(f"  - Mode: Column {mode_idx + 1} ('{header_row[mode_idx]}')")
    else:
        print("  - Mode: Not found (defaulting all to non-athlete)")

    # 2. Extract data and skip empty rows
    campers = []
    unique_counter = 1000
    
    for r_num in range(2, sheet.max_row + 1):
        name = sheet.cell(row=r_num, column=name_idx + 1).value
        if not name or not str(name).strip():
            continue
            
        age_val = sheet.cell(row=r_num, column=age_idx + 1).value
        try:
            age = int(float(str(age_val).strip())) if age_val is not None and str(age_val).strip() else None
        except (ValueError, TypeError):
            age = None
            
        couple_grp = sheet.cell(row=r_num, column=couple_idx + 1).value
        gender = sheet.cell(row=r_num, column=gender_idx + 1).value
        type_val = sheet.cell(row=r_num, column=type_idx + 1).value
        
        mode_val = sheet.cell(row=r_num, column=mode_idx + 1).value if mode_idx is not None else None
        mode = str(mode_val).strip() if mode_val else None
        
        # Clean couple group to avoid type mismatch (e.g. int vs string)
        if couple_grp is None or str(couple_grp).strip() == "":
            couple_grp = f"single_{unique_counter}"
            unique_counter += 1
        else:
            try:
                couple_grp = int(float(str(couple_grp).strip()))
            except ValueError:
                couple_grp = str(couple_grp).strip()
                
        campers.append({
            'row_num': r_num,
            'name': str(name).strip(),
            'age': age,
            'couple_group': couple_grp,
            'gender': str(gender).strip().upper() if gender else 'M',
            'type': str(type_val).strip() if type_val else 'Adult',
            'mode': mode
        })
        
    print(f"Successfully loaded {len(campers)} campers from spreadsheet.")
    
    # 3. Estimate missing ages
    for c in campers:
        if c['age'] is None:
            if c['type'].lower() == 'child':
                c['age'] = 10
            else:
                c['age'] = 35
                
    # 4. Group campers by Couple Group
    couple_groups = defaultdict(list)
    for c in campers:
        couple_groups[c['couple_group']].append(c)
        
    units = list(couple_groups.values())
    
    # 5. Randomized sorting optimization loop
    best_score = float('inf')
    best_partition = None
    best_stats = None
    
    print("\nRunning randomized sorting optimization (100,000 iterations)...")
    for iteration in range(100000):
        random.shuffle(units)
        t1, t2 = [], []
        
        # Greedily balance team sizes to prevent extreme splits
        for u in units:
            if sum(len(x) for x in t1) <= sum(len(x) for x in t2):
                t1.extend(u)
            else:
                t2.extend(u)
                
        m1 = sum(1 for c in t1 if c['gender'] == 'M')
        m2 = sum(1 for c in t2 if c['gender'] == 'M')
        f1 = sum(1 for c in t1 if c['gender'] == 'F')
        f2 = sum(1 for c in t2 if c['gender'] == 'F')
        
        ath1 = sum(1 for c in t1 if c['mode'] == 'Athlete')
        ath2 = sum(1 for c in t2 if c['mode'] == 'Athlete')
        
        b1_1 = sum(1 for c in t1 if get_bucket(c['age']) == 1)
        b1_2 = sum(1 for c in t2 if get_bucket(c['age']) == 1)
        b2_1 = sum(1 for c in t1 if get_bucket(c['age']) == 2)
        b2_2 = sum(1 for c in t2 if get_bucket(c['age']) == 2)
        b3_1 = sum(1 for c in t1 if get_bucket(c['age']) == 3)
        b3_2 = sum(1 for c in t2 if get_bucket(c['age']) == 3)
        b4_1 = sum(1 for c in t1 if get_bucket(c['age']) == 4)
        b4_2 = sum(1 for c in t2 if get_bucket(c['age']) == 4)
        
        ages1 = [c['age'] for c in t1 if c['age'] is not None]
        ages2 = [c['age'] for c in t2 if c['age'] is not None]
        avg1 = sum(ages1)/len(ages1) if ages1 else 0
        avg2 = sum(ages2)/len(ages2) if ages2 else 0
        
        diff_m = abs(m1 - m2)
        diff_f = abs(f1 - f2)
        diff_ath = abs(ath1 - ath2)
        diff_b1 = abs(b1_1 - b1_2)
        diff_b2 = abs(b2_1 - b2_2)
        diff_b3 = abs(b3_1 - b3_2)
        diff_b4 = abs(b4_1 - b4_2)
        diff_age = abs(avg1 - avg2)
        
        score = (diff_m * 10000 + 
                 diff_f * 10000 + 
                 diff_ath * 10000 + 
                 diff_b1 * 1000 + 
                 diff_b2 * 1000 + 
                 diff_b3 * 1000 + 
                 diff_b4 * 1000 + 
                 diff_age * 10)
                 
        if score < best_score:
            best_score = score
            best_partition = (t1, t2)
            best_stats = {
                'm1': m1, 'm2': m2,
                'f1': f1, 'f2': f2,
                'ath1': ath1, 'ath2': ath2,
                'b1_1': b1_1, 'b1_2': b1_2,
                'b2_1': b2_1, 'b2_2': b2_2,
                'b3_1': b3_1, 'b3_2': b3_2,
                'b4_1': b4_1, 'b4_2': b4_2,
                'avg1': avg1, 'avg2': avg2
            }
            # Stop early if we find an exceptionally balanced team
            if diff_m == 0 and diff_f == 0 and diff_ath == 0 and diff_b1 <= 1 and diff_b2 <= 1 and diff_b3 <= 1 and diff_b4 <= 1 and diff_age < 0.1:
                break
                
    # 6. Apply assignments to active sheet
    team_idx = find_col_idx(header_row, ['team'])
    if team_idx is None:
        team_idx = len(header_row)
        sheet.cell(row=1, column=team_idx + 1, value="Team")
        print(f"Added new 'Team' column at index {team_idx + 1}")
    else:
        print(f"Updating existing 'Team' column at index {team_idx + 1}")
        
    t1_assigned, t2_assigned = best_partition
    
    for c in t1_assigned:
        sheet.cell(row=c['row_num'], column=team_idx + 1, value="Team 1")
    for c in t2_assigned:
        sheet.cell(row=c['row_num'], column=team_idx + 1, value="Team 2")
        
    # Save the file
    saved_path = write_workbook_safely(wb, excel_path)
    
    # 7. Print formatted summary
    s = best_stats
    print("\n" + "=" * 60)
    print("           CHURCH CAMP TEAM SORTING COMPLETED               ")
    print("=" * 60)
    print(f"Output Saved to: {saved_path}")
    print("-" * 60)
    print("                    TEAM SUMMARY METRICS                    ")
    print("-" * 60)
    print(f"{'Metric':<25}{'Team 1':<15}{'Team 2':<15}")
    print("-" * 60)
    print(f"{'Total Members':<25}{len(t1_assigned):<15}{len(t2_assigned):<15}")
    print(f"{'Males (M)':<25}{s['m1']:<15}{s['m2']:<15}")
    print(f"{'Females (F)':<25}{s['f1']:<15}{s['f2']:<15}")
    if mode_idx is not None:
        print(f"{'Athletes':<25}{s['ath1']:<15}{s['ath2']:<15}")
    print(f"{'Average Age':<25}{s['avg1']:<15.2f}{s['avg2']:<15.2f}")
    print("\nAge Cohorts Distribution:")
    print(f"  - Kids & Teens (<=18)   {s['b1_1']:<15}{s['b1_2']:<15}")
    print(f"  - Young Adults (19-35)  {s['b2_1']:<15}{s['b2_2']:<15}")
    print(f"  - Middle Adults (36-55) {s['b3_1']:<15}{s['b3_2']:<15}")
    print(f"  - Older Adults (>=56)   {s['b4_1']:<15}{s['b4_2']:<15}")
    print("=" * 60)

if __name__ == "__main__":
    main()
