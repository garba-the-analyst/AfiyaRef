"""Live smoke test against the running backend. Run: python3 smoke.py"""
import random

from api import ApiClient

api = ApiClient()
phone = f"+2349{random.randint(100000000, 999999999)}"

reg = api.register(phone, "test1234", "Flet Smoke")
api.token = reg["token"]
print("register OK:", reg["user"]["phoneNumber"])

s = api.search(6.52, 3.37)
assert s["count"] > 0, s
print("search OK:", s["count"], "→", s["results"][0]["name"])

r = api.route(6.52, 3.37, s["results"][0]["latitude"], s["results"][0]["longitude"])
assert len(r["coordinates"]) > 2 and len(r["steps"]) > 0
print(f"route OK: {len(r['coordinates'])} pts, {len(r['steps'])} steps, 1st: {r['steps'][0]['instruction']}")

st = api.nurse_status()
print("nurse status:", st)
chat = api.nurse_chat("Someone burned their hand, what do I do?")
assert "life-threatening emergency" in chat["reply"]
print("nurse chat OK (offline fallback)" if chat["offline"] else "nurse chat OK (live)")

b = api.create_booking(s["results"][0]["id"], "DOCTOR_APPOINTMENT", "2026-10-01T09:00:00Z")
print("booking OK:", b["id"], b["status"])
c = api.cancel_booking(b["id"])
print("cancel OK:", c.get("updated", c))

f = api.search(6.52, 3.37, service="Emergency", emergency_only=True)
assert all("Emergency" in r["services_offered"] for r in f["results"]), f
print(f"filtered search OK: {f['count']} emergency facilities")

n = api.nurse_chat("hello")
api.reset_nurse_history()
print("nurse reset OK")

p = api.save_profile({"blood_group": "O+", "allergies": ["penicillin"]})
assert p["bloodGroup"] == "O+"
print("profile OK")

t = api.transfer_checkin(s["results"][0]["id"], "NHIA-FLET-1")
assert t["status"] == "NOTIFIED"
print("checkin OK:", t["id"])
mine = api.my_transfers()
assert any(x["id"] == t["id"] for x in mine)
print(f"transfer history OK: {len(mine)} records")
print("\nFlet smoke test passed ✅")
