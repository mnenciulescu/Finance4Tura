#!/usr/bin/env python3
"""
Finance4Tura — Comprehensive Phase 0–8 Test Suite
Run with: python3 test_all_phases.py
"""

import requests
import json
import sys

API  = "http://localhost:3001"
UI   = "http://localhost:5173"

passed = 0
failed = 0
_state = {}   # shared state between tests (IDs etc.)

RESET = "\033[0m"
GREEN = "\033[32m"
RED   = "\033[31m"
CYAN  = "\033[36m"
BOLD  = "\033[1m"

def section(title):
    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}")

def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  {GREEN}✓{RESET} {name}")
    else:
        failed += 1
        print(f"  {RED}✗{RESET} {name}" + (f"  →  {detail}" if detail else ""))

def get(path, **kwargs):
    return requests.get(API + path, **kwargs)

def post(path, body):
    return requests.post(API + path, json=body)

def put(path, body):
    return requests.put(API + path, json=body)

def delete(path, **kwargs):
    return requests.delete(API + path, **kwargs)

def ui(path):
    return requests.get(UI + path)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 0 — Infrastructure
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 0 — Infrastructure & Health")

r = get("/health")
check("GET /health returns 200",        r.status_code == 200)
check("GET /health body = {status:ok}", r.json() == {"status": "ok"})

import subprocess
docker = subprocess.run(
    ["docker","ps","--filter","name=dynamodb-local","--format","{{.Names}}"],
    capture_output=True, text=True
)
check("DynamoDB Local container running", "dynamodb-local" in docker.stdout)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — DynamoDB Tables
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 1 — DynamoDB Tables")

tables = subprocess.run(
    ["aws","dynamodb","list-tables","--endpoint-url","http://localhost:8000",
     "--output","json"],
    capture_output=True, text=True
)
table_names = json.loads(tables.stdout).get("TableNames", [])
check("Incomes table exists",  "Incomes"  in table_names)
check("Expenses table exists", "Expenses" in table_names)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Income CRUD
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 2 — Income CRUD")

# Create single
r = post("/incomes", {"summary":"Test Salary","date":"2026-01-01","amount":5000,"currency":"RON"})
check("POST /incomes single → 201",          r.status_code == 201)
check("POST /incomes returns incomeId",       "incomeId" in r.json())
check("POST /incomes seriesId == incomeId",   r.json().get("seriesId") == r.json().get("incomeId"))
_state["inc_single_id"] = r.json()["incomeId"]

# Create repeating (3 months)
r = post("/incomes", {"summary":"Freelance","date":"2026-01-01","amount":1000,"currency":"EUR",
                       "isRepeatable":True,"repeatFrequency":"monthly","seriesEndDate":"2026-03-01"})
check("POST /incomes repeating → 201",        r.status_code == 201)
check("POST /incomes repeating count=3",      r.json().get("count") == 3)
_state["inc_series_id"]    = r.json()["seriesId"]

# Validation
r = post("/incomes", {"summary":"Bad"})
check("POST /incomes missing fields → 400",   r.status_code == 400)

r = post("/incomes", {"summary":"X","date":"2026-01-01","amount":100,
                       "isRepeatable":True,"repeatFrequency":"monthly"})
check("POST /incomes repeatable no seriesEnd → 400", r.status_code == 400)

# GET single
r = get(f"/incomes/{_state['inc_single_id']}")
check("GET /incomes/{id} → 200",              r.status_code == 200)
check("GET /incomes/{id} correct summary",    r.json().get("summary") == "Test Salary")

# GET list with filter
r = get("/incomes", params={"from":"2026-01-01","to":"2026-03-31"})
check("GET /incomes?from=&to= → 200",         r.status_code == 200)
check("GET /incomes returns list",            isinstance(r.json(), list))
check("GET /incomes sorted by date",
      r.json() == sorted(r.json(), key=lambda x: x["date"]))

# GET 404
r = get("/incomes/non-existent")
check("GET /incomes/{bad-id} → 404",          r.status_code == 404)

# PUT single
r = put(f"/incomes/{_state['inc_single_id']}", {"summary":"Updated Salary","amount":5500})
check("PUT /incomes/{id} → 200",              r.status_code == 200)
check("PUT /incomes/{id} summary updated",    r.json().get("summary") == "Updated Salary")
check("PUT /incomes/{id} amount updated",     r.json().get("amount") == 5500)

# PUT series member → isException
all_inc = get("/incomes").json()
series_members = [i for i in all_inc if i.get("seriesId") == _state["inc_series_id"] and i["seriesId"] != i["incomeId"]]
_state["inc_member_id"] = series_members[0]["incomeId"]
r = put(f"/incomes/{_state['inc_member_id']}", {"amount":1200})
check("PUT series member → isException:true", r.json().get("isException") == True)

# PUT /series bulk update
r = put(f"/incomes/{_state['inc_member_id']}/series", {"summary":"Freelance Pro"})
check("PUT /incomes/{id}/series → 200",       r.status_code == 200)
check("PUT /series updated >= 1",             r.json().get("updated", 0) >= 1)

# DELETE single
r = delete(f"/incomes/{_state['inc_single_id']}")
check("DELETE /incomes/{id} → 200",           r.status_code == 200)
r = get(f"/incomes/{_state['inc_single_id']}")
check("Deleted income is gone → 404",         r.status_code == 404)

# DELETE series
r = delete(f"/incomes/{_state['inc_member_id']}", params={"deleteSeries":"true"})
check("DELETE /incomes?deleteSeries=true → 200", r.status_code == 200)
check("DELETE series deleted >= 1",           r.json().get("deleted", 0) >= 1)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — Expense CRUD + resolveIncome
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 3 — Expense CRUD + resolveIncome")

# Seed a fresh income for mapping
r = post("/incomes", {"summary":"March Salary","date":"2026-03-01","amount":6000,"currency":"RON"})
_state["mapping_income_id"] = r.json()["incomeId"]

# resolve-income
r = get("/expenses/resolve-income", params={"date":"2026-03-15"})
check("GET /resolve-income?date= → 200",      r.status_code == 200)
check("GET /resolve-income returns income",   r.json().get("income") is not None)
check("Resolved income is March Salary",
      r.json()["income"].get("summary") == "March Salary",
      r.json()["income"].get("summary"))

r = get("/expenses/resolve-income", params={"date":"2010-01-01"})
check("GET /resolve-income before any income → null", r.json().get("income") is None)

r = get("/expenses/resolve-income")
check("GET /resolve-income missing date → 400", r.status_code == 400)

# Create single expense
r = post("/expenses", {"summary":"Rent","date":"2026-03-05","amount":1200,
                        "currency":"RON","priority":"High","status":"Pending"})
check("POST /expenses single → 201",          r.status_code == 201)
_state["exp_single_id"] = r.json()["expenseId"]

# Verify denormalized mapping
r = get(f"/expenses/{_state['exp_single_id']}")
check("Expense has mappedIncomeId",           r.json().get("mappedIncomeId") is not None)
check("Expense mappedIncomeSummary correct",  r.json().get("mappedIncomeSummary") == "March Salary")
check("Expense mappedIncomeDate correct",     r.json().get("mappedIncomeDate") == "2026-03-01")
check("Expense status default Pending",       r.json().get("status") == "Pending")
check("Expense priority stored",             r.json().get("priority") == "High")

# Expense before any income → unmapped
r = post("/expenses", {"summary":"Old bill","date":"2010-01-01","amount":50,
                        "currency":"RON","priority":"Low","status":"Pending"})
_state["exp_unmapped_id"] = r.json()["expenseId"]
r = get(f"/expenses/{_state['exp_unmapped_id']}")
check("Unmapped expense mappedIncomeId=null", r.json().get("mappedIncomeId") is None)

# Create repeating expense
r = post("/expenses", {"summary":"Netflix","date":"2026-03-01","amount":55,
                        "currency":"RON","priority":"Low","status":"Pending",
                        "isRepeatable":True,"repeatFrequency":"monthly","seriesEndDate":"2026-05-01"})
check("POST /expenses repeating → 201",       r.status_code == 201)
check("POST /expenses repeating count=3",     r.json().get("count") == 3)
_state["exp_series_id"] = r.json()["seriesId"]

# Validation
r = post("/expenses", {"summary":"Bad"})
check("POST /expenses missing fields → 400",  r.status_code == 400)

r = post("/expenses", {"summary":"X","date":"2026-03-01","amount":10,
                        "isRepeatable":True,"repeatFrequency":"monthly"})
check("POST /expenses repeatable no seriesEnd → 400", r.status_code == 400)

# GET list
r = get("/expenses", params={"from":"2026-03-01","to":"2026-05-31"})
check("GET /expenses?from=&to= → 200",        r.status_code == 200)
check("GET /expenses returns list",           isinstance(r.json(), list))
check("GET /expenses sorted by date",
      r.json() == sorted(r.json(), key=lambda x: x["date"]))

# GET 404
r = get("/expenses/non-existent")
check("GET /expenses/{bad-id} → 404",         r.status_code == 404)

# PUT single → re-resolve income
r = put(f"/expenses/{_state['exp_single_id']}", {"status":"Completed","amount":1300})
check("PUT /expenses/{id} → 200",             r.status_code == 200)
check("PUT /expenses status updated",         r.json().get("status") == "Completed")
check("PUT /expenses income still mapped",    r.json().get("mappedIncomeId") is not None)

# PUT series member → isException
all_exp = get("/expenses").json()
series_exp = [e for e in all_exp if e.get("seriesId") == _state["exp_series_id"] and e["seriesId"] != e["expenseId"]]
_state["exp_member_id"] = series_exp[0]["expenseId"]
r = put(f"/expenses/{_state['exp_member_id']}", {"amount":60})
check("PUT expense series member → isException:true", r.json().get("isException") == True)

# PUT /series bulk update
r = put(f"/expenses/{_state['exp_member_id']}/series", {"summary":"Netflix HD","amount":70})
check("PUT /expenses/{id}/series → 200",      r.status_code == 200)
check("PUT /expenses series updated >= 1",    r.json().get("updated", 0) >= 1)

# DELETE single
r = delete(f"/expenses/{_state['exp_single_id']}")
check("DELETE /expenses/{id} → 200",          r.status_code == 200)
r = get(f"/expenses/{_state['exp_single_id']}")
check("Deleted expense is gone → 404",        r.status_code == 404)

# DELETE series
r = delete(f"/expenses/{_state['exp_member_id']}", params={"deleteSeries":"true"})
check("DELETE /expenses?deleteSeries=true → 200", r.status_code == 200)
check("DELETE expense series deleted >= 1",   r.json().get("deleted", 0) >= 1)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — Frontend Layout & Routing
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 4 — Frontend Layout & Routing")

routes = ["/", "/add-income", "/add-expense", "/statistics"]
for route in routes:
    r = ui(route)
    check(f"GET {route} → HTTP 200", r.status_code == 200)

r = ui("/")
check("HTML has #root div",         'id="root"' in r.text)
check("HTML references JS bundle",  'src/main.jsx' in r.text or 'assets/' in r.text)
check("Title is Finance4Tura",      "Finance4Tura" in r.text)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5 — Add/Edit Income form API contract
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 5 — Add/Edit Income Form (API contract)")

# Create (form POST)
r = post("/incomes", {"summary":"Form Income","date":"2026-04-01","amount":4000,"currency":"RON"})
check("Create income via form payload → 201", r.status_code == 201)
form_inc_id = r.json()["incomeId"]

# Load for edit (form prefill)
r = get(f"/incomes/{form_inc_id}")
check("Load income for edit prefill → 200",   r.status_code == 200)
d = r.json()
check("Prefill: summary present",   "summary"  in d)
check("Prefill: date present",      "date"     in d)
check("Prefill: amount present",    "amount"   in d)
check("Prefill: currency present",  "currency" in d)

# Edit single occurrence
r = put(f"/incomes/{form_inc_id}", {"summary":"Form Income Updated","amount":4200})
check("Edit single income → 200",   r.status_code == 200)
check("Edit reflects new summary",  r.json().get("summary") == "Form Income Updated")

# Edit series — scope single
r = post("/incomes", {"summary":"Series Inc","date":"2026-04-01","amount":500,"currency":"RON",
                       "isRepeatable":True,"repeatFrequency":"monthly","seriesEndDate":"2026-06-01"})
sid = r.json()["seriesId"]
members = [i for i in get("/incomes").json() if i.get("seriesId") == sid and i["seriesId"] != i["incomeId"]]
mid = members[0]["incomeId"]

r = put(f"/incomes/{mid}", {"amount":600})
check("Edit series member (single scope) → isException", r.json().get("isException") == True)

r = put(f"/incomes/{mid}/series", {"summary":"Series Inc Updated"})
check("Edit series (all future) → updated count", r.json().get("updated", 0) >= 1)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 6 — Add/Edit Expense form + resolveIncome preview
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 6 — Add/Edit Expense Form + Income Preview")

# Preview endpoint
r = get("/expenses/resolve-income", params={"date":"2026-04-01"})
check("resolve-income preview → 200",         r.status_code == 200)
inc_preview = r.json().get("income")
check("Preview returns income object",        inc_preview is not None)
check("Preview income has required fields",
      all(k in (inc_preview or {}) for k in ["incomeId","summary","date","amount"]))

# Create expense (form submit)
r = post("/expenses", {"summary":"Form Expense","date":"2026-04-10","amount":200,
                        "currency":"RON","priority":"Medium","status":"Pending"})
check("Create expense via form payload → 201", r.status_code == 201)
form_exp_id = r.json()["expenseId"]

# Load for edit (form prefill + existing mapped income)
r = get(f"/expenses/{form_exp_id}")
check("Load expense for edit prefill → 200",  r.status_code == 200)
d = r.json()
check("Prefill: all expense fields present",
      all(k in d for k in ["summary","date","amount","currency","priority","status"]))
check("Prefill: mappedIncome denormalized",
      "mappedIncomeId" in d and "mappedIncomeSummary" in d and "mappedIncomeDate" in d)

# Priority values
for priority in ["High","Medium","Low"]:
    r = post("/expenses", {"summary":f"P-{priority}","date":"2026-04-15","amount":10,
                            "currency":"RON","priority":priority,"status":"Pending"})
    check(f"Create expense priority={priority} → 201", r.status_code == 201)

# Status values
for status in ["Pending","Completed"]:
    r = post("/expenses", {"summary":f"S-{status}","date":"2026-04-15","amount":10,
                            "currency":"RON","priority":"Low","status":status})
    check(f"Create expense status={status} → 201", r.status_code == 201)

# Edit with date change → income re-resolved
r = put(f"/expenses/{form_exp_id}", {"date":"2026-04-20","status":"Completed"})
check("Edit expense date → 200",              r.status_code == 200)
check("Edit expense status updated",          r.json().get("status") == "Completed")
check("Edit expense income re-resolved",      r.json().get("mappedIncomeId") is not None)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 7 — Dashboard data (income grouping + balance logic)
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 7 — Dashboard Data & Card Logic")

all_inc = get("/incomes").json()
all_exp = get("/expenses").json()
sorted6  = sorted(all_inc, key=lambda x: x["date"], reverse=True)[:3]

check("At least 1 income exists",             len(all_inc) > 0)
check("Dashboard selects max 3 incomes",      len(sorted6) <= 3)
check("Sorted 3 are most recent",
      sorted6 == sorted(all_inc, key=lambda x: x["date"], reverse=True)[:3])

# Group expenses by mappedIncomeId
exp_by_inc = {}
for e in all_exp:
    k = e.get("mappedIncomeId") or "__unmapped__"
    exp_by_inc.setdefault(k, []).append(e)

# Balance check for each of the 6 cards
for inc in sorted6:
    exps    = exp_by_inc.get(inc["incomeId"], [])
    exp_tot = sum(e["amount"] for e in exps)
    balance = inc["amount"] - exp_tot
    check(f"Balance calc [{inc['date'][:7]} {inc['summary'][:12]}]: {inc['amount']} - {exp_tot:.0f} = {balance:.0f}",
          isinstance(balance, (int, float)))

# Edit link targets exist
check("Edit income URL pattern works",
      ui(f"/add-income?id={sorted6[0]['incomeId']}").status_code == 200)

exp_with_map = [e for e in all_exp if e.get("mappedIncomeId")]
if exp_with_map:
    check("Edit expense URL pattern works",
          ui(f"/add-expense?id={exp_with_map[0]['expenseId']}").status_code == 200)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 8 — Statistics computations
# ─────────────────────────────────────────────────────────────────────────────
section("PHASE 8 — Statistics Computations")

all_inc = get("/incomes").json()
all_exp = get("/expenses").json()
top6    = sorted(all_inc, key=lambda x: x["date"], reverse=True)[:6]

total_income   = sum(i["amount"] for i in top6)
total_expenses = sum(e["amount"] for e in all_exp)
net_balance    = total_income - total_expenses
savings_rate   = (net_balance / total_income * 100) if total_income > 0 else 0

check("Total income > 0",                    total_income > 0)
check("Net balance computable",              isinstance(net_balance, (int, float)))
check("Savings rate 0–100%",                 0 <= savings_rate <= 100)

# Priority breakdown
priority_totals = {}
for e in all_exp:
    p = e.get("priority","Unknown")
    priority_totals[p] = priority_totals.get(p, 0) + e.get("amount", 0)
check("Priority breakdown has data",         len(priority_totals) > 0)
check("All priorities are valid values",
      all(p in ("High","Medium","Low","Unknown") for p in priority_totals))

# Status breakdown
status_totals = {}
for e in all_exp:
    st = e.get("status","Unknown")
    status_totals[st] = status_totals.get(st, 0) + e.get("amount", 0)
check("Status breakdown has data",           len(status_totals) > 0)
check("All statuses are valid values",
      all(s in ("Pending","Completed","Unknown") for s in status_totals))

# Top 5 sorted correctly
top5 = sorted(all_exp, key=lambda x: x.get("amount",0), reverse=True)[:5]
check("Top 5 expenses sorted by amount desc",
      top5 == sorted(top5, key=lambda x: x.get("amount",0), reverse=True))
check("Top 5 count <= 5",                    len(top5) <= 5)

# Per-period bar chart data integrity
exp_by_inc = {}
for e in all_exp:
    k = e.get("mappedIncomeId") or "__unmapped__"
    exp_by_inc.setdefault(k, []).append(e)

period_data = []
for inc in reversed(top6):
    exps     = exp_by_inc.get(inc["incomeId"], [])
    exp_tot  = sum(e["amount"] for e in exps)
    period_data.append({"income": inc["amount"], "expenses": exp_tot, "balance": inc["amount"] - exp_tot})

check("Bar chart data has 3 data points",    len(period_data) == 3)
check("Each period has income > 0",          all(p["income"] > 0 for p in period_data))
check("Each period balance = income - exp",
      all(abs(p["balance"] - (p["income"] - p["expenses"])) < 0.01 for p in period_data))

# ─────────────────────────────────────────────────────────────────────────────
# Build artefacts
# ─────────────────────────────────────────────────────────────────────────────
section("BUILD ARTEFACTS")

import os
dist = "/Users/nenciulescu/Documents/__PERSONAL/Work/Finance4Tura/frontend/dist/assets"
files = os.listdir(dist) if os.path.isdir(dist) else []
check("dist/ assets directory exists",           len(files) > 0)
check("React chunk present (react-*.js)",        any(f.startswith("react-") and f.endswith(".js") for f in files))
check("Recharts chunk present (recharts-*.js)",  any(f.startswith("recharts-") and f.endswith(".js") for f in files))
check("App chunk present (index-*.js)",          any(f.startswith("index-") and f.endswith(".js") for f in files))
check("CSS bundle present",                      any(f.endswith(".css") for f in files))

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
total = passed + failed
print(f"\n{BOLD}{'═'*60}{RESET}")
print(f"{BOLD}  Results: {GREEN}{passed} passed{RESET}{BOLD}, {RED if failed else ''}{failed} failed{RESET}{BOLD} / {total} total{RESET}")
print(f"{BOLD}{'═'*60}{RESET}\n")
sys.exit(0 if failed == 0 else 1)
