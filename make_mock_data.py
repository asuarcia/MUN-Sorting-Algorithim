"""
make_mock_data.py — generate a realistic mock registration export for testing.

Writes mock_delegates.csv (always) and mock_delegates.xlsx (if openpyxl is
installed). The file deliberately mixes the columns the sorter NEEDS with a pile
of fake PERSONAL columns (email, phone, DOB, home address, medical conditions,
allergies, emergency contacts, ...). Uploading it proves the app pulls only the
needed fields and silently drops everything else.

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
TOPICS = ["Healthcare", "Economics", "Environment", "Security", "Law", "Human Rights",
          "Technology", "History", "Media", "Labor", "Energy", "Defense", "Politics",
          "Banking", "Trade", "Humanitarian", "Justice", "Industrialization"]
TYPES = ["Regional Summit", "Topic-based", "Court", "General", "Historical", "Press"]
SIZES = ["Small", "Medium", "Large"]

# Seniority picks use a mix of full names and acronyms to exercise the matcher.
PICKS = ["Security Council", "ICJ", "International Criminal Court", "WHO",
         "General Assembly", "Historical Security Council", "Press / Media", "G20"]

# Fake sensitive values — these must NEVER make it into the app.
MEDICAL = ["None", "Asthma", "ADHD", "Type 1 Diabetes", "Anxiety", "Epilepsy", "None", "None"]
ALLERGIES = ["None", "Peanuts", "Shellfish", "Penicillin", "None", "Lactose", "None"]
DIETARY = ["None", "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "None"]
TSHIRT = ["S", "M", "L", "XL"]
PAYMENT = ["Paid", "Pending", "Waived"]

# Column order mimics a real Airtable form export (needed + personal interleaved).
HEADERS = [
    "Timestamp", "Full Name", "Email", "Phone Number", "Date of Birth", "Home Address",
    "School", "Year", "Preferred Type", "Preferred Topics", "Preferred Size", "Seniority Pick",
    "Medical Conditions", "Allergies", "Dietary Restrictions",
    "Emergency Contact Name", "Emergency Contact Phone", "Parent/Guardian Email",
    "T-Shirt Size", "Payment Status",
]


def make_row(i):
    first, last = random.choice(FIRST), random.choice(LAST)
    name = f"{first} {last}"
    returning = random.random() > 0.40            # ~40% first-years
    year = "Returning" if returning else "First Year"
    # ~8% of returning delegates carry a seniority pick
    pick = random.choice(PICKS) if (returning and random.random() < 0.08) else ""
    topics = ";".join(random.sample(TOPICS, 3))
    dob = f"{random.randint(2006, 2010)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
    return {
        "Timestamp": f"2026-0{random.randint(1,9)}-{random.randint(10,28)} {random.randint(8,18)}:{random.randint(10,59)}",
        "Full Name": name,
        "Email": f"{first.lower()}.{last.lower()}{random.randint(1,99)}@example.edu",
        "Phone Number": f"+1-555-{random.randint(100,999)}-{random.randint(1000,9999)}",
        "Date of Birth": dob,
        "Home Address": f"{random.randint(10,9999)} {random.choice(['Maple','Oak','Pine','Elm','Cedar'])} St, Springfield",
        "School": random.choice(SCHOOLS),
        "Year": year,
        "Preferred Type": random.choice(TYPES),
        "Preferred Topics": topics,
        "Preferred Size": random.choice(SIZES),
        "Seniority Pick": pick,
        "Medical Conditions": random.choice(MEDICAL),
        "Allergies": random.choice(ALLERGIES),
        "Dietary Restrictions": random.choice(DIETARY),
        "Emergency Contact Name": f"{random.choice(FIRST)} {last}",
        "Emergency Contact Phone": f"+1-555-{random.randint(100,999)}-{random.randint(1000,9999)}",
        "Parent/Guardian Email": f"parent.{last.lower()}{random.randint(1,99)}@example.com",
        "T-Shirt Size": random.choice(TSHIRT),
        "Payment Status": random.choice(PAYMENT),
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
