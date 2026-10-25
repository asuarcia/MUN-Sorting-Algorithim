"""
make_mock_data.py — generate a realistic mock registration export for testing.

Writes mock_delegates.csv (always) and mock_delegates.xlsx (if openpyxl is
installed). The columns are exactly those of the 2027 GPY Model UN Airtable
registration form, so the file looks like a real export: the handful the sorter
NEEDS mixed in with a pile of fake PERSONAL ones (email, birthday, address,
insurance, allergies, emergency contacts, signatures, ...). Uploading it proves
the app pulls only the needed fields and silently drops everything else.

All data is fake and seeded, so re-running produces the same file.
"""

import csv
import random

random.seed(42)

N = 855
OUT_CSV = "mock_delegates.csv"
OUT_XLSX = "mock_delegates.xlsx"

FIRST = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery",
         "Quinn", "Cameron", "Bella", "Carlos", "Diana", "Ethan", "Fiona", "Gabriel",
         "Hannah", "Ivan", "Julia", "Kevin", "Luna", "Marco", "Nina", "Oscar", "Priya",
         "Rafael", "Sofia", "Tomas", "Uma", "Victor", "Wendy", "Yasmine", "Zoe", "Noah", "Olivia"]
LAST = ["Smith", "Johnson", "Chen", "Rodriguez", "Kim", "Patel", "Martinez", "Williams",
        "Brown", "Garcia", "Liu", "Taylor", "Anderson", "Hernandez", "Nguyen", "Flores",
        "Adams", "Baker", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Campbell"]
SCHOOLS = ["Lincoln High School", "Jefferson Academy", "Roosevelt Preparatory",
           "Washington Academy", "Madison High", "Franklin Institute", "Hamilton School",
           "Monroe Academy", "Kennedy International", "Westbrook Academy", "Eastside High School",
           "Riverside Academy", "Lakewood High", "Hillcrest School", "Greenwood Academy"]
# The 2027 GPY Model UN registration form (Airtable) — exact option lists.
INTERESTS = ["Technology", "Health", "Environment", "Economic", "Law",
             "Social Justice/Human Rights", "History", "Military/Conflict Resolution", "Social Media"]
SIZES = ["Small (20-40)", "Medium (40-70)", "Large (70+)"]
NO_SIZE_PREF = "No preference on committee size"
GENDERS = ["Male", "Female", "Non-binary", "Genderfluid"]
PRONOUNS = ["She/Her", "He/Him", "They/Them", "She/They", "He/They"]
TSHIRT = ["Small", "Medium", "Large", "XL", "XXL", "XXXL"]

# Seniority picks aren't on the form; organizers add the column in Airtable.
# A mix of full names and acronyms exercises the matcher.
PICKS = ["Security Council", "ICJ", "International Criminal Court", "WHO",
         "General Assembly", "Historical Security Council", "Press / Media", "G20"]

# Fake sensitive values — these must NEVER make it into the app.
DIETARY = ["", "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", ""]
ALLERGIES = ["", "Peanuts", "Tree nuts", "Shellfish", "Dairy", "", ""]
INSURERS = ["Blue Cross", "Aetna", "Cigna", "UnitedHealthcare", "Kaiser"]
STATES = ["CA", "NY", "TX", "IL", "MA"]

# Column order is the form's field order, as an Airtable CSV export writes it.
HEADERS = [
    "First Name", "Last Name", "Preferred First Name", "Gender", "Pronouns", "Birthday",
    "T-Shirt Size", "Delegation", "Email", "Home Address", "City", "State", "Zip Code",
    "Parent/Guardian & Emergency Contact Name", "Parent/Guardian & Emergency Contact Phone",
    "Parent/Guardian & Emergency Contact Email", "Additional Emergency Contact Name",
    "Additional Emergency Contact Phone", "Grade", "Are you a first year delegate or returning?",
    "What are your interests in Model UN?", "Please select ALL committee sizes you are interested in",
    "Dietary Restrictions - Please select from the list below",
    "Allergies - Please select all allergies from the list below", "Do you require an Epi-Pen?",
    "Any additional dietary and/or allergy information you would like to share?",
    "Medical Insurance Provider", "Health Insurance Policy Number", "Insurance Group Name/Number",
    "Medical Insurance Policy Holder Full Name", "Policy Holder Phone Number", "Medical Waiver",
    "Parent Signature - Participation Agreement", "Parent Signature - Financial Agreement",
    "Participant Signature - Code of Conduct", "Parent Signature - Code of Conduct",
    "Seniority Pick",
]


def phone():
    return f"({random.randint(200,999)}) 555-{random.randint(1000,9999)}"


def make_row(i):
    first, last = random.choice(FIRST), random.choice(LAST)
    grade = random.choice([9, 9, 10, 10, 11, 11, 12])
    # First-years skew young: ~70% of 9th graders, ~15% of seniors
    returning = random.random() > {9: 0.70, 10: 0.45, 11: 0.25, 12: 0.15}[grade]
    pick = random.choice(PICKS) if (returning and random.random() < 0.08) else ""
    interests = ",".join(random.sample(INTERESTS, random.randint(1, 5)))
    if random.random() < 0.2:
        sizes = NO_SIZE_PREF
    else:
        sizes = ",".join(sorted(random.sample(SIZES, random.randint(1, 3)), key=SIZES.index))
    allergy = random.choice(ALLERGIES)
    parent = f"{random.choice(FIRST)} {last}"
    return {
        "First Name": first,
        "Last Name": last,
        "Preferred First Name": random.choice(["", "", "", "", first[:3]]),
        "Gender": random.choice(GENDERS),
        "Pronouns": random.choice(PRONOUNS),
        "Birthday": f"{random.randint(1,12)}/{random.randint(1,28)}/{2026 - grade - 6}",
        "T-Shirt Size": random.choice(TSHIRT),
        "Delegation": random.choice(SCHOOLS),
        "Email": f"{first.lower()}.{last.lower()}{random.randint(1,99)}@example.com",
        "Home Address": f"{random.randint(10,9999)} {random.choice(['Maple','Oak','Pine','Elm','Cedar'])} St",
        "City": "Springfield",
        "State": random.choice(STATES),
        "Zip Code": f"{random.randint(10000,99999)}",
        "Parent/Guardian & Emergency Contact Name": parent,
        "Parent/Guardian & Emergency Contact Phone": phone(),
        "Parent/Guardian & Emergency Contact Email": f"parent.{last.lower()}{random.randint(1,99)}@example.com",
        "Additional Emergency Contact Name": random.choice(["", f"{random.choice(FIRST)} {last}"]),
        "Additional Emergency Contact Phone": random.choice(["", phone()]),
        "Grade": str(grade),
        "Are you a first year delegate or returning?": "Returning" if returning else "First year delegate",
        "What are your interests in Model UN?": interests,
        "Please select ALL committee sizes you are interested in": sizes,
        "Dietary Restrictions - Please select from the list below": random.choice(DIETARY),
        "Allergies - Please select all allergies from the list below": allergy,
        "Do you require an Epi-Pen?": "Yes" if allergy in ("Peanuts", "Tree nuts") and random.random() < 0.5 else "No",
        "Any additional dietary and/or allergy information you would like to share?": "",
        "Medical Insurance Provider": random.choice(INSURERS),
        "Health Insurance Policy Number": f"P{random.randint(10**8, 10**9 - 1)}",
        "Insurance Group Name/Number": f"G{random.randint(1000, 9999)}",
        "Medical Insurance Policy Holder Full Name": parent,
        "Policy Holder Phone Number": phone(),
        "Medical Waiver": "checked",
        "Parent Signature - Participation Agreement": "signature.png (https://example.com/sig.png)",
        "Parent Signature - Financial Agreement": "signature.png (https://example.com/sig.png)",
        "Participant Signature - Code of Conduct": "signature.png (https://example.com/sig.png)",
        "Parent Signature - Code of Conduct": "signature.png (https://example.com/sig.png)",
        "Seniority Pick": pick,
    }


def main():
    rows = [make_row(i) for i in range(N)]

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {OUT_CSV} ({N} delegates, {len(HEADERS)} columns)")

    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Registrations"
        ws.append(HEADERS)
        for r in rows:
            ws.append([r[h] for h in HEADERS])
        wb.save(OUT_XLSX)
        print(f"Wrote {OUT_XLSX}")
    except ImportError:
        print(f"(skipped {OUT_XLSX} — run 'pip install openpyxl' to also generate the Excel version)")


if __name__ == "__main__":
    main()
