import os
import json
import re
import math
from functools import lru_cache

from flask import Flask, request, jsonify, Blueprint
from flask_cors import CORS
import requests
import pdfplumber
from dotenv import load_dotenv, find_dotenv
from openai import OpenAI


# Load env early (supports .env in repo root)
load_dotenv(find_dotenv())

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NOMINATIM_EMAIL = os.getenv("NOMINATIM_EMAIL")  # optional but recommended

app = Flask(__name__)

# CORS: allow Next.js dev server(s) by default; can extend via CORS_ALLOW_ORIGIN
origins = {"http://localhost:3000", "http://127.0.0.1:3000"}
extra_origin = os.getenv("CORS_ALLOW_ORIGIN")
if extra_origin:
    origins.add(extra_origin)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": list(origins)}})


# ---------- Shared helpers (Hospitals) ----------
def extract_json(text: str):
    """Try to pull a JSON object/array out of a model response."""
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None


def verify_url(url):
    try:
        r = requests.head(url, allow_redirects=True, timeout=3)
        return r.status_code < 400
    except Exception:
        return False


def haversine_miles(lat1, lon1, lat2, lon2):
    """Compute distance in miles between two lat/lon points."""
    R_km = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlmb/2)**2
    dist_km = 2 * R_km * math.asin(math.sqrt(a))
    return dist_km * 0.621371  # km -> miles


@lru_cache(maxsize=256)
def reverse_geocode(lat: float, lon: float):
    """
    Reverse geocode to (city, state/region, country). Uses OpenStreetMap Nominatim.
    Returns dict with {city, state, country, label}. Falls back sensibly.
    """
    try:
        params = {
            "format": "jsonv2",
            "lat": str(lat),
            "lon": str(lon),
            "zoom": "10",
            "addressdetails": "1",
        }
        headers = {
            "User-Agent": f"hospital-price-finder/1.0 ({NOMINATIM_EMAIL or 'no-email-provided'})"
        }
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params=params,
            headers=headers,
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json() or {}
        addr = data.get("address", {})
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("suburb")
            or addr.get("county")
        )
        state = addr.get("state") or addr.get("region") or addr.get("state_district")
        country = addr.get("country")
        label_parts = [p for p in [city, state, country] if p]
        label = ", ".join(label_parts) if label_parts else data.get("display_name", "Unknown location")
        return {"city": city, "state": state, "country": country, "label": label}
    except Exception:
        return {"city": None, "state": None, "country": None, "label": "this area"}


@lru_cache(maxsize=512)
def forward_geocode(address: str):
    """Resolve a free-form address/place name to (lat, lon) using Nominatim."""
    if not address:
        return (None, None)
    try:
        params = {"format": "jsonv2", "q": address, "limit": 1}
        headers = {"User-Agent": f"hospital-price-finder/1.0 ({NOMINATIM_EMAIL or 'no-email-provided'})"}
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search", params=params, headers=headers, timeout=8
        )
        resp.raise_for_status()
        arr = resp.json() or []
        if not arr:
            return (None, None)
        item = arr[0]
        lat = item.get("lat")
        lon = item.get("lon")
        try:
            return (float(lat), float(lon))
        except Exception:
            return (None, None)
    except Exception:
        return (None, None)


# ---------- Hospitals Blueprint ----------
hospitals_bp = Blueprint("hospitals", __name__)


@hospitals_bp.route("/api/hospitals", methods=["OPTIONS"])  # Preflight if called directly
def hospitals_options():
    return ("", 204)


@hospitals_bp.route("/api/hospitals", methods=["POST"])
def hospitals():
    if not OPENROUTER_API_KEY:
        return jsonify({"error": "Missing OPENROUTER_API_KEY"}), 500

    data = request.get_json(force=True) or {}
    lat = data.get("lat")
    lon = data.get("lon")
    location_query = data.get("location") # NEW: Accept location string
    condition = (data.get("condition") or "").strip()

    if not condition:
        return jsonify({"error": "condition required"}), 400

    # NEW: If location_query is provided, geocode it.
    if location_query and (lat is None or lon is None):
        geocoded_lat, geocoded_lon = forward_geocode(location_query)
        if geocoded_lat is None or geocoded_lon is None:
             return jsonify({"error": f"Could not find location: '{location_query}'"}), 400
        lat, lon = geocoded_lat, geocoded_lon

    if lat is None or lon is None:
        return jsonify({"error": "Location required (enable GPS or enter city/zip)"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except Exception:
        return jsonify({"error": "lat/lon must be numbers"}), 400

    place = reverse_geocode(lat, lon)
    city_label = place.get("label") or "this area"

    system_msg = (
        "You are a web-connected data model that must return only structured JSON. "
        "Given a city/region and a medical condition, find and summarize hospitals in that locality "
        "(target within ~30 miles of the city center) with publicly available or estimated cash/self-pay prices "
        "for the given condition. Each object should include: name, address, phone, url, latitude, longitude, "
        "price_usd, price_is_estimate, and notes. Output strictly a JSON array."
    )

    user_msg = (
        f"locality: {city_label}\n"
        f"condition: {condition}\n\n"
        "Constraints:\n"
        "- Prefer hospitals in the named locality and adjacent municipalities (≈30 miles).\n"
        "- If exact cash/self-pay prices are unavailable, estimate sensibly and mark price_is_estimate=true with notes.\n"
        "- Include latitude/longitude if available (helps with distance checks).\n"
        "- Output strictly a JSON array of hospital objects with the requested fields—no extra commentary."
    )

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:5000",
                "X-Title": "Nearby Hospitals Price Finder",
            },
            json={
                "model": "perplexity/sonar",
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.2,
                "max_tokens": 1200,
                "web_search": True,
            },
            timeout=45,
        )
    except requests.RequestException as e:
        return jsonify({"error": f"OpenRouter request failed: {e}"}), 502

    if resp.status_code >= 400:
        return jsonify({"error": f"OpenRouter error {resp.status_code}: {resp.text[:600]}"}), 502

    payload = resp.json()
    try:
        content = payload["choices"][0]["message"]["content"]
    except Exception:
        return jsonify({"error": "Malformed response from model"}), 502

    items = extract_json(content)
    if not isinstance(items, list):
        return jsonify({"error": "Model did not return a JSON array"}), 502

    cleaned = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = it.get("name")
        if not name:
            continue

        site_url = it.get("url")
        if site_url and not verify_url(site_url):
            continue

        addr = it.get("address")
        lat2 = it.get("latitude")
        lon2 = it.get("longitude")

        dist_miles = None
        if isinstance(lat2, (int, float)) and isinstance(lon2, (int, float)):
            try:
                dist_miles = round(haversine_miles(lat, lon, float(lat2), float(lon2)), 2)
                if dist_miles is not None and dist_miles > 37.3:
                    continue
            except Exception:
                pass

        if (not isinstance(lat2, (int, float)) or not isinstance(lon2, (int, float))) and addr:
            fg_lat, fg_lon = forward_geocode(addr)
            if isinstance(fg_lat, (int, float)) and isinstance(fg_lon, (int, float)):
                lat2, lon2 = fg_lat, fg_lon

        maps_url = None
        if addr:
            maps_url = (
                f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={requests.utils.quote(addr)}&travelmode=driving"
            )
        elif isinstance(lat2, (int, float)) and isinstance(lon2, (int, float)):
            maps_url = (
                f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={lat2},{lon2}&travelmode=driving"
            )

        price_raw = it.get("price_usd")
        try:
            price_val = float(price_raw) if price_raw is not None else None
        except Exception:
            price_val = None

        cleaned.append(
            {
                "name": name,
                "address": addr,
                "phone": it.get("phone"),
                "url": site_url,
                "latitude": lat2,
                "longitude": lon2,
                "distance_miles": dist_miles,
                "price_usd": price_val,
                "price_is_estimate": bool(it.get("price_is_estimate", True)),
                "notes": it.get("notes"),
                "maps_url": maps_url,
                "source_locality": city_label,
            }
        )

    cleaned.sort(
        key=lambda r: (
            float("inf") if r["price_usd"] is None else r["price_usd"],
            float("inf") if r.get("distance_miles") is None else r["distance_miles"],
        )
    )

    return jsonify({"results": cleaned})


# ---------- Dispute Blueprint ----------
dispute_bp = Blueprint("dispute", __name__)

# Folders for dispute assets (relative to repo structure)
SERVER_DIR = os.path.dirname(__file__)
DISPUTE_DIR = os.path.abspath(os.path.join(SERVER_DIR, "..", "dispute"))
UPLOAD_FOLDER = os.path.join(DISPUTE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
POLICY_DOCS_DIR = os.path.join(DISPUTE_DIR, "policy_docs")
PROVIDER_RULES = {
    "United": os.path.join(POLICY_DOCS_DIR, "United Healthcare Charge Policy.pdf"),
    "Providence": os.path.join(POLICY_DOCS_DIR, "Providence HealthCare Charge.pdf"),
    "Molina": os.path.join(POLICY_DOCS_DIR, "Molina HealthCare Charge.pdf"),
    "CMS": os.path.join(POLICY_DOCS_DIR, "CMS Charge.pdf"),
}

# OpenAI client (if key provided)
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def ai_check_overcharges(rules_text, bill_text):
    if client is None:
        raise RuntimeError("Missing OPENAI_API_KEY")
    prompt = f"""
You are a hospital billing auditor AI.

Hospital Rules:
{rules_text}

Patient Bill:
{bill_text}

Instructions:
- Identify overcharges in the patient bill based on hospital rules.
- For each, provide line number, service, amount, and reason.
- If none, say "No overcharges detected".
"""
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return response.choices[0].message.content


def draft_dispute_letter(patient_name, hospital_name, bill_text, ai_overcharge_report):
    if client is None:
        raise RuntimeError("Missing OPENAI_API_KEY")
    prompt = f"""
Draft a formal letter to dispute overcharges for {patient_name} at {hospital_name}.
Reference the following overcharges and request correction.

Overcharges:
{ai_overcharge_report}
"""
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return response.choices[0].message.content


@dispute_bp.route("/api/dispute", methods=["GET"])
def dispute_home():
    return jsonify({"status": "ok", "providers": list(PROVIDER_RULES.keys())})


@dispute_bp.route("/api/dispute/analyze", methods=["POST"])  # multipart/form-data expected
def analyze():
    provider = request.form.get('provider')
    uploaded_rules = request.files.get('rules_pdf')
    bill_file = request.files.get('bill_pdf')

    if not bill_file:
        return jsonify({"error": "Please upload a patient bill PDF."}), 400

    if not bill_file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported for now."}), 415

    bill_path = os.path.join(UPLOAD_FOLDER, bill_file.filename)
    bill_file.save(bill_path)
    try:
        bill_text = extract_text_from_pdf(bill_path)
    except Exception as e:
        return jsonify({"error": f"Failed to read bill PDF: {e}"}), 400

    rules_path = None
    if uploaded_rules and uploaded_rules.filename:
        if not uploaded_rules.filename.lower().endswith('.pdf'):
            return jsonify({"error": "Rules file must be a PDF."}), 415
        rules_path = os.path.join(UPLOAD_FOLDER, uploaded_rules.filename)
        uploaded_rules.save(rules_path)
    elif provider in PROVIDER_RULES:
        rules_path = PROVIDER_RULES[provider]
    else:
        return jsonify({"error": "No rules PDF selected or provider invalid."}), 400

    try:
        rules_text = extract_text_from_pdf(rules_path)
    except Exception as e:
        return jsonify({"error": f"Failed to read rules PDF: {e}"}), 400

    try:
        ai_result = ai_check_overcharges(rules_text, bill_text)
        dispute_letter = draft_dispute_letter(
            request.form.get('patient_name', 'John Doe'),
            provider if provider else 'Custom Provider',
            bill_text,
            ai_result,
        )
    except Exception as e:
        return jsonify({"error": f"AI processing failed: {e}"}), 500

    return jsonify({
        "providers": list(PROVIDER_RULES.keys()),
        "ai_result": ai_result,
        "dispute_letter": dispute_letter,
    })


# ---------- Health route ----------
@app.get("/health")
def health():
    return jsonify({"ok": True})


# Register blueprints
app.register_blueprint(hospitals_bp)
app.register_blueprint(dispute_bp)


if __name__ == "__main__":
    # Default to port 5000 to match references
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)