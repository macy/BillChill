import os, json, re, math
from flask import Flask, render_template, request, jsonify
import requests

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

app = Flask(__name__)

def extract_json(text: str):
    """
    Try to pull a JSON object/array out of a model response.
    """
    # First, try a straight parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Otherwise, look for the first {...} or [...] block
    m = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None

# Verify a URL is reachable before including the hospital entry
def verify_url(url):
    try:
        resp = requests.head(url, allow_redirects=True, timeout=3)
        return resp.status_code < 400
    except Exception:
        return False

def haversine_km(lat1, lon1, lat2, lon2):
    """Compute distance in km between two lat/lon points."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlmb/2)**2
    return 2 * R * math.asin(math.sqrt(a))

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

    # Ask the model for nearby hospitals + estimated prices.
    # We instruct it to return clean JSON so we can parse and sort.
    system_msg = (
        "You are a data finder that returns **only structured JSON**. "
        "Given a latitude, longitude, and condition, produce a list of nearby hospitals "
        "with rough *estimated* cash/self-pay prices for a relevant visit/procedure, "
        "plus address and optional phone/URL. If price data isn’t available, estimate sensibly "
        "and indicate that it's an estimate. Prefer facilities within ~50km. "
        "Return an array of objects like: "
        "[{"
        "\"name\":\"...\","
        "\"address\":\"...\","
        "\"phone\":\"...\","
        "\"url\":\"...\","
        "\"latitude\":00.0,"
        "\"longitude\":00.0,"
        "\"price_usd\": 1234,"
        "\"price_is_estimate\": true,"
        "\"notes\":\"...\""
        "}]. "
        "Do not include any extra commentary—JSON only."
    )

    user_msg = (
        f"latitude: {lat}\n"
        f"longitude: {lon}\n"
        f"condition: {condition}\n"
        "Output strictly JSON array as specified."
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
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg}
                ],
                "temperature": 0.2,
                "max_tokens": 900
            },
            timeout=30
        )
    except requests.RequestException as e:
        return jsonify({"error": f"OpenRouter request failed: {e}"}), 502

    if resp.status_code >= 400:
        return jsonify({"error": f"OpenRouter error {resp.status_code}: {resp.text[:500]}"}), 502

    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except Exception:
        return jsonify({"error": "Malformed response from model"}), 502

    items = extract_json(content)
    if not isinstance(items, list):
        return jsonify({"error": "Model did not return a JSON array"}), 502

    # Normalize records; compute distance if we got coordinates.
    cleaned = []
    for it in items:
        name = it.get("name") if isinstance(it, dict) else None
        if not name:
            continue

        # Verify website URL if provided; drop entry if it's dead
        site_url = it.get("url")
        if site_url and not verify_url(site_url):
            continue

        addr = it.get("address")
        lat2 = it.get("latitude")
        lon2 = it.get("longitude")
        price = it.get("price_usd")
        try:
            price_val = float(price) if price is not None else None
        except Exception:
            price_val = None
        dist_km = None
        if isinstance(lat2, (int, float)) and isinstance(lon2, (int, float)):
            try:
                dist_km = round(haversine_km(float(lat), float(lon), float(lat2), float(lon2)), 2)
            except Exception:
                dist_km = None

        # Build Google Maps navigation link
        maps_url = None
        if isinstance(lat2, (int, float)) and isinstance(lon2, (int, float)):
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat2},{lon2}"
        elif addr:
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={requests.utils.quote(addr)}"

        cleaned.append({
            "name": name,
            "address": addr,
            "phone": it.get("phone"),
            "url": site_url,
            "latitude": lat2,
            "longitude": lon2,
            "distance_km": dist_km,
            "price_usd": price_val,
            "price_is_estimate": bool(it.get("price_is_estimate", True)),
            "notes": it.get("notes"),
            "maps_url": maps_url,  # one-click navigation link
        })

    # Sort by price (None at the end), then by distance
    cleaned.sort(key=lambda r: (float('inf') if r["price_usd"] is None else r["price_usd"],
                                float('inf') if r["distance_km"] is None else r["distance_km"]))

    return jsonify({"results": cleaned})
    
if __name__ == "__main__":
    app.run(debug=True)