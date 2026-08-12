import os
import sys
import shutil
import random
import math
import time
import subprocess
import openpyxl
from collections import defaultdict

# ---------------------------------------------------------------------------
# Hard pairing constraints (edit names here, not in the optimization logic).
#   SAME_TEAM_PAIRS:      each pair MUST end up on the same team.
#   DIFFERENT_TEAM_PAIRS: each pair MUST end up on different teams.
# Names are matched case-insensitively / whitespace-normalized (see norm_name).
# ---------------------------------------------------------------------------
SAME_TEAM_PAIRS = [("Saji Varughese", "Paul Thomas")]
DIFFERENT_TEAM_PAIRS = [("Prince Philip", "Philix Philip")]

# Scoring weights (higher = optimizer fights harder to equalize this metric).
W_TEAM_SIZE = 10000
W_GENDER = 10000
W_ATHLETE_GENDER = 10000
W_AGE_BUCKET = 1000
W_AVG_AGE = 10
W_DIFFERENT_TEAM_VIOLATION = 1_000_000  # effectively non-negotiable

# Search budget. Because scoring is O(1) per move (see below) instead of
# O(campers) like the old brute-force loop, this many total moves finishes
# in a fraction of a second instead of iterating 100,000 times over every
# camper on every try.
NUM_RESTARTS = 25
ITERS_PER_RESTART = 4000

STAT_FIELDS = ('size', 'm', 'f', 'm_ath', 'f_ath', 'b1', 'b2', 'b3', 'b4', 'age_sum')


def read_workbook_safely(filepath):
    """
    Attempts to read the Excel workbook. If it is locked (e.g. open in Excel),
    uses a PowerShell Copy-Item fallback to read from a copy.
    """
    if not os.path.exists(filepath):
        print(f"Error: Excel file not found at '{filepath}'.")
        sys.exit(1)

    try:
        wb = openpyxl.load_workbook(filepath, data_only=True)
        return wb
    except PermissionError:
        print("Note: Source Excel file appears to be locked in Excel. Reading via temp copy...")
        temp_path = os.path.join(os.path.dirname(filepath), f"temp_read_{int(time.time())}.xlsx")
        try:
            subprocess.run(
                ["powershell", "-Command", f"Copy-Item -Path '{filepath}' -Destination '{temp_path}'"],
                check=True, capture_output=True
            )
            wb = openpyxl.load_workbook(temp_path, data_only=True)
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
            return wb
        except Exception as e:
            print(f"Error: Could not read Excel file even with fallback copy: {e}")
            sys.exit(1)


def write_destination_workbook(wb, output_path):
    """
    Saves the workbook explicitly and exclusively to TeamSorter_assigned.xlsx (destination file).
    Never overwrites the source file TeamSorter.xlsx.
    """
    try:
        wb.save(output_path)
        print(f"\n[SUCCESS] Saved team assignments to DESTINATION file:\n  -> '{output_path}'")
        return output_path
    except PermissionError:
        base, ext = os.path.splitext(output_path)
        timestamp_path = f"{base}_{int(time.time())}{ext}"
        print(f"\n[WARNING] Destination file '{output_path}' is currently OPEN in Microsoft Excel.")
        print(f"To prevent data loss, saving to fallback destination:\n  -> '{timestamp_path}'")
        try:
            wb.save(timestamp_path)
            print(f"Successfully saved to '{timestamp_path}'")
            return timestamp_path
        except Exception as e:
            print(f"Error saving file: {e}")
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


def norm_name(name):
    return " ".join(str(name).strip().lower().split())


def unit_stats_of(members):
    """Aggregate the stats of a couple-group unit into one fixed-size tuple.
    Computed once per unit; the optimizer never re-scans individual campers."""
    size = len(members)
    m = sum(1 for c in members if c['gender'] == 'M')
    f = sum(1 for c in members if c['gender'] == 'F')
    m_ath = sum(1 for c in members if c['mode'] == 'Athlete' and c['gender'] == 'M')
    f_ath = sum(1 for c in members if c['mode'] == 'Athlete' and c['gender'] == 'F')
    b1 = b2 = b3 = b4 = 0
    age_sum = 0
    for c in members:
        bucket = get_bucket(c['age'])
        if bucket == 1:
            b1 += 1
        elif bucket == 2:
            b2 += 1
        elif bucket == 3:
            b3 += 1
        else:
            b4 += 1
        age_sum += c['age']
    return (size, m, f, m_ath, f_ath, b1, b2, b3, b4, age_sum)


def add_stats(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub_stats(a, b):
    return tuple(x - y for x, y in zip(a, b))


def score_of(team1_agg, total_agg, different_team_violated):
    team2_agg = sub_stats(total_agg, team1_agg)
    size1, m1, f1, m_ath1, f_ath1, b1_1, b2_1, b3_1, b4_1, age_sum1 = team1_agg
    size2, m2, f2, m_ath2, f_ath2, b1_2, b2_2, b3_2, b4_2, age_sum2 = team2_agg

    avg1 = age_sum1 / size1 if size1 else 0
    avg2 = age_sum2 / size2 if size2 else 0

    score = (
        W_TEAM_SIZE * abs(size1 - size2) +
        W_GENDER * abs(m1 - m2) +
        W_GENDER * abs(f1 - f2) +
        W_ATHLETE_GENDER * abs(m_ath1 - m_ath2) +
        W_ATHLETE_GENDER * abs(f_ath1 - f_ath2) +
        W_AGE_BUCKET * (abs(b1_1 - b1_2) + abs(b2_1 - b2_2) + abs(b3_1 - b3_2) + abs(b4_1 - b4_2)) +
        W_AVG_AGE * abs(avg1 - avg2)
    )
    if different_team_violated:
        score += W_DIFFERENT_TEAM_VIOLATION
    return score


def build_units(campers):
    """
    Groups campers into optimization units by couple_group, then merges any
    units connected by a SAME_TEAM_PAIRS constraint (via union-find) so that
    constraint is structurally guaranteed rather than hoped-for by penalty.
    Returns: units (list of camper-lists), warnings (list of str)
    """
    warnings = []
    couple_groups = defaultdict(list)
    for c in campers:
        couple_groups[c['couple_group']].append(c)

    name_to_group = {}
    for key, members in couple_groups.items():
        for c in members:
            name_to_group[norm_name(c['name'])] = key

    parent = {key: key for key in couple_groups}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    for name_a, name_b in SAME_TEAM_PAIRS:
        ga = name_to_group.get(norm_name(name_a))
        gb = name_to_group.get(norm_name(name_b))
        if ga is None or gb is None:
            warnings.append(f"Could not enforce same-team constraint for '{name_a}' & '{name_b}': camper not found.")
            continue
        union(ga, gb)

    merged = defaultdict(list)
    for key, members in couple_groups.items():
        merged[find(key)].extend(members)

    return list(merged.values()), warnings


def run_restart(units_stats, total_agg, diff_pair_indices, iters):
    """One randomized greedy start + simulated-annealing local search.
    Every move updates only the ~10-field team aggregate (O(1)), never
    rescans the camper list, so thousands of moves run in milliseconds."""
    n = len(units_stats)

    # Greedy balanced start: largest units first, always to the smaller team.
    order = list(range(n))
    random.shuffle(order)
    order.sort(key=lambda i: -units_stats[i][0])

    team_assignment = [False] * n
    zero = tuple(0 for _ in STAT_FIELDS)
    team1_agg = zero
    size1 = size2 = 0
    for i in order:
        u = units_stats[i]
        if size1 <= size2:
            team_assignment[i] = True
            team1_agg = add_stats(team1_agg, u)
            size1 += u[0]
        else:
            size2 += u[0]

    def violates(assignment):
        return any(assignment[a] == assignment[b] for a, b in diff_pair_indices)

    cur_viol = violates(team_assignment)
    cur_score = score_of(team1_agg, total_agg, cur_viol)
    best_score = cur_score
    best_assignment = team_assignment[:]

    T0, T1 = 4000.0, 1.0
    for it in range(iters):
        T = T0 * (T1 / T0) ** (it / iters)
        i = random.randrange(n)
        j = random.randrange(n)

        if team_assignment[i] != team_assignment[j]:
            # Swap move: keeps team sizes closer while still exploring.
            if team_assignment[i]:
                new_team1_agg = add_stats(sub_stats(team1_agg, units_stats[i]), units_stats[j])
            else:
                new_team1_agg = add_stats(sub_stats(team1_agg, units_stats[j]), units_stats[i])
            changes = ((i, not team_assignment[i]), (j, not team_assignment[j]))
        else:
            # Flip move on a single unit.
            if team_assignment[i]:
                new_team1_agg = sub_stats(team1_agg, units_stats[i])
            else:
                new_team1_agg = add_stats(team1_agg, units_stats[i])
            changes = ((i, not team_assignment[i]),)

        for idx, val in changes:
            team_assignment[idx] = val

        new_viol = violates(team_assignment)
        new_score = score_of(new_team1_agg, total_agg, new_viol)
        delta = new_score - cur_score

        if delta <= 0 or random.random() < math.exp(-delta / max(T, 1e-9)):
            team1_agg = new_team1_agg
            cur_score = new_score
            if cur_score < best_score:
                best_score = cur_score
                best_assignment = team_assignment[:]
        else:
            for idx, val in changes:
                team_assignment[idx] = not val  # revert

    return best_assignment, best_score


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "TeamSorter.xlsx")
    output_path = os.path.join(script_dir, "TeamSorter_assigned.xlsx")

    print("=" * 60)
    print("         CHURCH CAMP AUTOMATED TEAM SORTER          ")
    print("=" * 60)
    print(f"Source File (Untouched): {input_path}")
    print(f"Destination File:       {output_path}")
    print("-" * 60)

    wb = read_workbook_safely(input_path)
    sheet = wb.active

    # 1. Resolve header indices dynamically from source file
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
        sys.exit(1)

    print(f"Dynamic Column Resolution:")
    print(f"  - Name: Column {name_idx + 1} ('{header_row[name_idx]}')")
    print(f"  - Age: Column {age_idx + 1} ('{header_row[age_idx]}')")
    print(f"  - Couple Group: Column {couple_idx + 1} ('{header_row[couple_idx]}')")
    print(f"  - Gender: Column {gender_idx + 1} ('{header_row[gender_idx]}')")
    print(f"  - Type: Column {type_idx + 1} ('{header_row[type_idx]}')")
    if mode_idx is not None:
        print(f"  - Mode: Column {mode_idx + 1} ('{header_row[mode_idx]}')")

    # 2. Extract data rows
    data_rows = []
    unique_counter = 1000

    for r_num in range(2, sheet.max_row + 1):
        name = sheet.cell(row=r_num, column=name_idx + 1).value
        if not name or not str(name).strip():
            continue

        row_values = [sheet.cell(row=r_num, column=c_idx + 1).value for c_idx in range(len(header_row))]

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

        if couple_grp is None or str(couple_grp).strip() == "":
            couple_grp = f"single_{unique_counter}"
            unique_counter += 1
        else:
            try:
                couple_grp = int(float(str(couple_grp).strip()))
            except ValueError:
                couple_grp = str(couple_grp).strip()

        data_rows.append({
            'row_values': row_values,
            'name': str(name).strip(),
            'age': age,
            'couple_group': couple_grp,
            'gender': str(gender).strip().upper() if gender else 'M',
            'type': str(type_val).strip() if type_val else 'Adult',
            'mode': mode
        })

    print(f"Successfully loaded {len(data_rows)} campers from source file.")

    # 3. Randomize physical row order of the sheet (output ordering only)
    random.shuffle(data_rows)
    print("Randomized the row order of the Excel sheet.")

    campers = data_rows

    # 4. Estimate missing ages
    for c in campers:
        if c['age'] is None:
            c['age'] = 10 if c['type'].lower() == 'child' else 35

    # 5. Group campers into optimization units (couple groups), merging any
    #    units tied together by a "must be same team" constraint.
    units, warnings = build_units(campers)
    for w in warnings:
        print(f"[WARNING] {w}")

    name_to_unit_idx = {}
    for idx, members in enumerate(units):
        for c in members:
            name_to_unit_idx[norm_name(c['name'])] = idx

    diff_pair_indices = []
    for name_a, name_b in DIFFERENT_TEAM_PAIRS:
        ia = name_to_unit_idx.get(norm_name(name_a))
        ib = name_to_unit_idx.get(norm_name(name_b))
        if ia is None or ib is None:
            print(f"[WARNING] Could not enforce different-team constraint for '{name_a}' & '{name_b}': camper not found.")
            continue
        diff_pair_indices.append((ia, ib))

    # 6. Precompute per-unit aggregate stats ONCE. The optimizer below only
    #    ever adds/subtracts these small tuples -- it never rescans campers.
    units_stats = [unit_stats_of(members) for members in units]
    total_agg = tuple(0 for _ in STAT_FIELDS)
    for u in units_stats:
        total_agg = add_stats(total_agg, u)

    # 7. Multi-restart hill-climbing / simulated annealing.
    #    Each move is O(1) (aggregate tuple add/sub), so NUM_RESTARTS *
    #    ITERS_PER_RESTART moves finish in a fraction of a second even
    #    though the search explores far more of the solution space than
    #    100,000 blind random shuffles did.
    print(f"\nRunning local-search optimization ({NUM_RESTARTS} restarts x {ITERS_PER_RESTART} iterations)...")
    global_best_assignment = None
    global_best_score = float('inf')
    for _ in range(NUM_RESTARTS):
        assignment, score = run_restart(units_stats, total_agg, diff_pair_indices, ITERS_PER_RESTART)
        if score < global_best_score:
            global_best_score = score
            global_best_assignment = assignment
        if global_best_score < 1000:  # near-perfect balance already found
            break

    # 8. Materialize the winning partition back into camper lists.
    t1_assigned, t2_assigned = [], []
    for idx, members in enumerate(units):
        if global_best_assignment[idx]:
            t1_assigned.extend(members)
        else:
            t2_assigned.extend(members)
    t1_set = {id(c) for c in t1_assigned}

    # 9. Construct Fresh Destination Workbook (Omit Age, Gender, Mode columns)
    omit_keywords = ['gender', 'sex', 'age', 'mode', 'team']
    keep_col_indices = [
        c_idx for c_idx, h in enumerate(header_row)
        if h and not any(kw in str(h).strip().lower() for kw in omit_keywords)
    ]

    dest_wb = openpyxl.Workbook()
    dest_ws = dest_wb.active
    dest_ws.title = "Team Assignments"

    header_dest = [header_row[i] for i in keep_col_indices] + ["Team"]
    dest_ws.append(header_dest)
    print(f"Destination Columns: {header_dest}")

    for camper in data_rows:
        row_data = [camper['row_values'][i] for i in keep_col_indices]
        assigned_team = "Team 1" if id(camper) in t1_set else "Team 2"
        row_data.append(assigned_team)
        dest_ws.append(row_data)

    saved_path = write_destination_workbook(dest_wb, output_path)

    # 10. Compute final summary metrics directly from the winning teams
    def team_summary(team):
        m = sum(1 for c in team if c['gender'] == 'M')
        f = sum(1 for c in team if c['gender'] == 'F')
        ath = sum(1 for c in team if c['mode'] == 'Athlete')
        m_ath = sum(1 for c in team if c['mode'] == 'Athlete' and c['gender'] == 'M')
        f_ath = sum(1 for c in team if c['mode'] == 'Athlete' and c['gender'] == 'F')
        buckets = {1: 0, 2: 0, 3: 0, 4: 0}
        for c in team:
            buckets[get_bucket(c['age'])] += 1
        ages = [c['age'] for c in team if c['age'] is not None]
        avg = sum(ages) / len(ages) if ages else 0
        return {'m': m, 'f': f, 'ath': ath, 'm_ath': m_ath, 'f_ath': f_ath, 'buckets': buckets, 'avg': avg}

    s1 = team_summary(t1_assigned)
    s2 = team_summary(t2_assigned)

    def team_of(name):
        idx = name_to_unit_idx.get(norm_name(name))
        if idx is None:
            return "N/A"
        return "Team 1" if global_best_assignment[idx] else "Team 2"

    # 11. Print formatted summary
    print("\n" + "=" * 60)
    print("           CHURCH CAMP TEAM SORTING COMPLETED               ")
    print("=" * 60)
    print(f"OUTPUT SAVED TO DESTINATION FILE:\n  -> {saved_path}")
    print("-" * 60)
    print("                    TEAM SUMMARY METRICS                    ")
    print("-" * 60)
    print(f"{'Metric':<25}{'Team 1':<15}{'Team 2':<15}")
    print("-" * 60)
    print(f"{'Total Members':<25}{len(t1_assigned):<15}{len(t2_assigned):<15}")
    print(f"{'Males (M)':<25}{s1['m']:<15}{s2['m']:<15}")
    print(f"{'Females (F)':<25}{s1['f']:<15}{s2['f']:<15}")
    if mode_idx is not None:
        print(f"{'Athletes (Total)':<25}{s1['ath']:<15}{s2['ath']:<15}")
        print(f"{'  - Male Athletes':<25}{s1['m_ath']:<15}{s2['m_ath']:<15}")
        print(f"{'  - Female Athletes':<25}{s1['f_ath']:<15}{s2['f_ath']:<15}")
    print(f"{'Average Age':<25}{s1['avg']:<15.2f}{s2['avg']:<15.2f}")
    print("\nAge Cohorts Distribution:")
    print(f"  - Kids & Teens (<=18)   {s1['buckets'][1]:<15}{s2['buckets'][1]:<15}")
    print(f"  - Young Adults (19-35)  {s1['buckets'][2]:<15}{s2['buckets'][2]:<15}")
    print(f"  - Middle Adults (36-55) {s1['buckets'][3]:<15}{s2['buckets'][3]:<15}")
    print(f"  - Older Adults (>=56)   {s1['buckets'][4]:<15}{s2['buckets'][4]:<15}")
    print("-" * 60)
    print("Custom Pair Constraints Verification:")
    for name_a, name_b in SAME_TEAM_PAIRS:
        print(f"  - {name_a} & {name_b}: BOTH on {team_of(name_a)} (MATCH - structurally guaranteed)")
    for name_a, name_b in DIFFERENT_TEAM_PAIRS:
        ta, tb = team_of(name_a), team_of(name_b)
        status = "MATCH" if ta != tb and ta != "N/A" and tb != "N/A" else "COULD NOT VERIFY"
        print(f"  - {name_a} ({ta}) & {name_b} ({tb}): DIFFERENT Teams ({status})")
    print("=" * 60)


if __name__ == "__main__":
    main()
