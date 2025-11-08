import os, json, re, math
from flask import Flask, render_template, request, jsonify
import requests
from functools import lru_cache

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
NOMINATIM_EMAIL = os.getenv("NOMINATIM_EMAIL")  # optional but recommended

app = Flask(__name__)

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
    return dist_km * 0.621371  # km -> miles conversion

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
            # Nominatim requires a descriptive User-Agent
            "User-Agent": f"hospital-price-finder/1.0 ({NOMINATIM_EMAIL or 'no-email-provided'})"
        }
        resp = requests.get("https://nominatim.openstreetmap.org/reverse",
                            params=params, headers=headers, timeout=6)
        resp.raise_for_status()
        data = resp.json() or {}
        addr = data.get("address", {})
        # Prefer city/town/village/suburb, then county
        city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("suburb") or addr.get("county")
        state = addr.get("state") or addr.get("region") or addr.get("state_district")
        country = addr.get("country")
        label_parts = [p for p in [city, state, country] if p]
        label = ", ".join(label_parts) if label_parts else data.get("display_name", "Unknown location")
        return {
            "city": city,
            "state": state,
            "country": country,
            "label": label
        }
    except Exception:
        # Soft fallback
        return {"city": None, "state": None, "country": None, "label": "this area"}

@lru_cache(maxsize=512)
def forward_geocode(address: str):
    """Resolve a free-form address/place name to (lat, lon) using Nominatim.
    Returns tuple (lat, lon) or (None, None) if not found. Light caching to avoid rate issues.
    """
    if not address:
        return (None, None)
    try:
        params = {
            "format": "jsonv2",
            "q": address,
            "limit": 1,
        }
        headers = {
            "User-Agent": f"hospital-price-finder/1.0 ({NOMINATIM_EMAIL or 'no-email-provided'})"
        }
        resp = requests.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers, timeout=8)
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

@app.route("/")
def index():
    return render_template("index.html")

@app.post("/api/hospitals")
def hospitals():
    if not OPENROUTER_API_KEY:
        return jsonify({"error": "Missing OPENROUTER_API_KEY"}), 500

    data = request.get_json(force=True) or {}
    lat = data.get("lat")
    lon = data.get("lon")
    condition = (data.get("condition") or "").strip()

    if lat is None or lon is None:
        return jsonify({"error": "lat/lon required"}), 400
    if not condition:
        return jsonify({"error": "condition required"}), 400

    # 1) Convert lat/lon -> local city/state for query
    try:
        lat = float(lat); lon = float(lon)
    except Exception:
        return jsonify({"error": "lat/lon must be numbers"}), 400

    place = reverse_geocode(lat, lon)
    city_label = place["label"] or "this area"

    # 2) Ask Sonar with a city-focused query (NOT raw coordinates)
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
                "X-Title": "Nearby Hospitals Price Finder"
            },
            json={
                "model": "perplexity/sonar",     # real-time web search
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg}
                ],
                "temperature": 0.2,
                "max_tokens": 1200,
                "web_search": True               # enable live browsing
            },
            timeout=45
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

    # 3) Normalize + distance filter against the ORIGINAL lat/lon
    cleaned = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = it.get("name")
        if not name:
            continue

        # Verify website URL if provided; drop entry if it's dead
        site_url = it.get("url")
        if site_url and not verify_url(site_url):
            continue

        addr = it.get("address")
        lat2 = it.get("latitude")
        lon2 = it.get("longitude")

        # Distance cutoff: keep only within ~37.3 miles of the user (hard filter; ~60 km)
        dist_miles = None
        if isinstance(lat2, (int, float)) and isinstance(lon2, (int, float)):
            try:
                dist_miles = round(haversine_miles(lat, lon, float(lat2), float(lon2)), 2)
                if dist_miles is not None and dist_miles > 37.3:  # ~60 km
                    continue  # too far; discard
            except Exception:
                pass

        # Ensure we have lat/long for destination; if missing but address exists, try forward geocode
        if (not isinstance(lat2, (int, float)) or not isinstance(lon2, (int, float))) and addr:
            fg_lat, fg_lon = forward_geocode(addr)
            if isinstance(fg_lat, (int, float)) and isinstance(fg_lon, (int, float)):
                lat2, lon2 = fg_lat, fg_lon

        # Build Google Maps navigation link (prefer destination by address for user clarity)
        maps_url = None
        if addr:
            maps_url = (
                f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={requests.utils.quote(addr)}&travelmode=driving"
            )
        elif isinstance(lat2, (int, float)) and isinstance(lon2, (int, float)):
            maps_url = (
                f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={lat2},{lon2}&travelmode=driving"
            )

        # Price normalization
        price_raw = it.get("price_usd")
        try:
            price_val = float(price_raw) if price_raw is not None else None
        except Exception:
            price_val = None

        cleaned.append({
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
            "maps_url": maps_url,  # already contains origin + destination for accurate routing
            "source_locality": city_label,  # useful for debugging
        })

    # 4) Sort by price (None last), then by distance
    cleaned.sort(key=lambda r: (
        float('inf') if r["price_usd"] is None else r["price_usd"],
        float('inf') if r.get("distance_miles") is None else r["distance_miles"]
    ))

    return jsonify({"results": cleaned})

if __name__ == "__main__":
    app.run(debug=True)