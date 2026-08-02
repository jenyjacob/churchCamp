from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models import Setting, User
from db import db
from utils.logging import log_action
import requests

settings_bp = Blueprint("settings", __name__)





DEFAULT_SETTINGS = {
    "team_1_name": "Team Peter",
    "team_2_name": "Team Paul",
    "signup_title": "GCA 2027 Church Camp Registration",
    "signup_dates": "August 13–15, 2027",
    "signup_location": "Camp Prothro",
    "activity_names": '["KAYAKING", "BOAT TOUR"]',
    "activity_1_price": "10.0",
    "activity_2_price": "20.0",
    "registration_closed": "false",
    "registration_status": "open",
    "camp_description": "Welcome to the annual GCA Church Camp! We are excited to gather for a time of spiritual growth, outdoor fellowship, and memory-making.",
    "camp_poc_name": "Pastor John Doe",
    "camp_poc_email": "john.doe@gca.org",
    "camp_poc_phone": "+1 (555) 019-2834",
    "google_places_api_key": "",
    "cabins_config": "[]",
    "current_camp_year": "2026",
    "signup_camp_year": "2026",
    "camp_info_title": "Grace Christian Assembly Camp",
    "camp_info_address": "Camp Prothro"
}

PUBLIC_SETTINGS_KEYS = {
    "signup_title",
    "signup_dates",
    "signup_location",
    "camp_description",
    "camp_poc_name",
    "camp_poc_email",
    "camp_poc_phone",
    "registration_closed",
    "registration_status",
    "current_camp_year",
    "signup_camp_year",
    "activity_names"
}

@settings_bp.route("/public", methods=["GET"])
def get_public_settings():
    # Only return keys in the explicit public settings allow-list
    settings_dict = {}
    for key in PUBLIC_SETTINGS_KEYS:
        if key in DEFAULT_SETTINGS:
            settings_dict[key] = DEFAULT_SETTINGS[key]
        
    try:
        # Fetch all settings from DB first so we can access signup_camp_year
        db_settings = Setting.query.all()
        db_map = {s.key: s.value for s in db_settings}
        
        # Populate allow-listed keys
        for key in PUBLIC_SETTINGS_KEYS:
            if key in db_map:
                settings_dict[key] = db_map[key]
                
        # Resolve year-specific activity_names
        signup_year = settings_dict.get("signup_camp_year", "2026")
        year_activity_key = f"activity_names_{signup_year}"
        if year_activity_key in db_map:
            settings_dict["activity_names"] = db_map[year_activity_key]
        elif "activity_names" in db_map:
            settings_dict["activity_names"] = db_map["activity_names"]
            
    except Exception:
        pass
        
    return jsonify({
        "settings": settings_dict
    }), 200

@settings_bp.route("/", methods=["GET"])
@jwt_required()
def get_settings():
    # Return all settings. Merge defaults with DB overrides.
    settings_dict = dict(DEFAULT_SETTINGS)
    
    try:
        db_settings = Setting.query.all()
        db_map = {s.key: s.value for s in db_settings}
        for key, val in db_map.items():
            settings_dict[key] = val
            
        # Resolve active year-specific activity_names for dashboard/finance/outdoor pages
        active_year = settings_dict.get("current_camp_year", "2026")
        year_activity_key = f"activity_names_{active_year}"
        if year_activity_key in db_map:
            settings_dict["activity_names"] = db_map[year_activity_key]
            
    except Exception as e:
        # Fallback if table doesn't exist yet
        pass

    # Restrict google_places_api_key to admin and owner roles only
    claims = get_jwt()
    current_role = claims.get("role", "user")
    
    user_id = get_jwt_identity()
    if user_id:
        user = User.query.get(int(user_id))
        if user and user.role:
            current_role = user.role

    if current_role not in ["owner", "admin"]:
        settings_dict.pop("google_places_api_key", None)

    return jsonify({
        "settings": settings_dict
    }), 200

@settings_bp.route("/", methods=["POST"])
@jwt_required()
def update_settings():
    claims = get_jwt()
    current_role = claims.get("role", "user")
    
    from routes.permissions import DEFAULT_PERMISSIONS
    from models.permission import PagePermission
    from models.user import User

    # Lookup current user from DB to ensure role is up to date
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id)) if user_id else None
    if user and user.role:
        current_role = user.role

    data = request.get_json() or {}
    is_stock_update = any(
        k.startswith("tshirt_") or k.startswith("indian_") or 
        k.startswith("custom_") or k.startswith("deleted_") or
        "stock" in k
        for k in data.keys()
    )

    has_apparel_edit = (DEFAULT_PERMISSIONS.get(current_role, {}).get("apparel") == "edit")
    has_finance_edit = (DEFAULT_PERMISSIONS.get(current_role, {}).get("finance") == "edit")

    custom_apparel = PagePermission.query.filter_by(role=current_role, page_key="apparel").first()
    if custom_apparel:
        has_apparel_edit = (custom_apparel.access_level == "edit")

    custom_finance = PagePermission.query.filter_by(role=current_role, page_key="finance").first()
    if custom_finance:
        has_finance_edit = (custom_finance.access_level == "edit")

    is_allowed = (
        current_role in ["owner", "admin", "finance", "director"] or 
        has_apparel_edit or 
        has_finance_edit or 
        is_stock_update
    )

    if not is_allowed:
        return jsonify({"error": "Permission denied. Edit access to Settings, Apparel, or Finance is required."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    updated = []
    for key, val in data.items():
        if val is None or not str(val).strip():
            continue
        
        s = Setting.query.filter_by(key=key).first()
        if s:
            s.value = str(val).strip()
        else:
            s = Setting(key=key, value=str(val).strip())
            db.session.add(s)
        
        updated.append(key)

    db.session.commit()

    # Log action
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    log_action(
        "UPDATE_SETTINGS",
        f"Updated configuration settings: {', '.join(updated)}",
        user.id,
        user.username
    )

    # Return updated list
    return get_settings()


import math
from concurrent.futures import ThreadPoolExecutor

def calculate_distance(lat1, lon1, lat2, lon2):
    # Haversine formula to calculate distance in miles
    R = 3958.8  # Earth radius in miles
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)

def fetch_phone_number(place_id, api_key):
    if not place_id or not api_key:
        return None
    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        res = requests.get(url, params={
            "place_id": place_id,
            "fields": "formatted_phone_number",
            "key": api_key
        }, timeout=3)
        data = res.json()
        if data.get("status") == "OK":
            return data.get("result", {}).get("formatted_phone_number")
    except Exception:
        pass
    return None

def fetch_all_nearby_places(location, radius, type_filter, keyword_filter, api_key):
    """
    Returns a list of raw place results, an empty list for a genuine
    ZERO_RESULTS response, or None if the request itself failed (timeout,
    OVER_QUERY_LIMIT, REQUEST_DENIED, etc). None is distinct from [] so
    callers can tell "nothing nearby" apart from "the API call failed" and
    avoid treating a rate-limited response as if it were real, empty data.
    """
    results = []
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": location,
        "radius": radius,
        "key": api_key
    }
    if type_filter:
        params["type"] = type_filter
    if keyword_filter:
        params["keyword"] = keyword_filter

    try:
        res = requests.get(url, params=params, timeout=5)
        data = res.json()
        status = data.get("status")

        if status == "ZERO_RESULTS":
            return []
        if status != "OK":
            # OVER_QUERY_LIMIT, REQUEST_DENIED, INVALID_REQUEST, UNKNOWN_ERROR, etc.
            return None

        results.extend(data.get("results", []))

        import time
        token = data.get("next_page_token")
        pages_fetched = 1

        while token and pages_fetched < 3:
            time.sleep(2.0)  # Delay for Google API token activation (Google recommends 2.0s)
            next_res = requests.get(url, params={
                "pagetoken": token,
                "key": api_key
            }, timeout=5)
            next_data = next_res.json()
            if next_data.get("status") == "OK":
                results.extend(next_data.get("results", []))
                token = next_data.get("next_page_token")
                pages_fetched += 1
            else:
                # A failed follow-up page still means we return the results
                # we already have from earlier pages - that data was real.
                break
    except Exception:
        return None
    return results

import json
import os

CACHE_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "places_cache.json")

def read_places_cache():
    if os.path.exists(CACHE_FILE_PATH):
        try:
            with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def write_places_cache(cache_data):
    try:
        with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def is_sane_places_payload(data):
    """
    Guard against ever serving a corrupted/partial cache entry - e.g. one
    written by an older version of this endpoint, or hand-edited during
    testing - where a hospital/restaurant is missing its name or other core
    fields. Cards built from data like that render as visually broken (blank
    title, no rating, etc) even though the count in the accordion header
    looks fine. If anything looks off, treat it as a cache miss and
    regenerate instead of serving it forever.
    """
    if not isinstance(data, dict):
        return False
    hospitals = data.get("hospitals")
    restaurants = data.get("restaurants")
    if not isinstance(hospitals, list) or not isinstance(restaurants, list):
        return False
    for item in hospitals + restaurants:
        if not isinstance(item, dict) or not item.get("name"):
            return False
    return True

# Minimum time between live Google API refreshes for the same address. Without
# this, clicking "Refresh" repeatedly re-queries Google on every click; if that
# trips Google's per-second rate limit (OVER_QUERY_LIMIT), some of the 4
# concurrent nearby-search calls come back empty and - before this fix - that
# partial, degraded result was written over the good cached data, so results
# visibly shrank with each click. Now a rapid refresh is served from cache
# instead of hammering the API again, and a failed live attempt never
# overwrites a previously-good cache entry.
REFRESH_COOLDOWN_SECONDS = 60

@settings_bp.route("/places", methods=["GET"])
@jwt_required()
def get_nearby_places():
    import requests
    import time
    
    # 1. Get camp location & API key
    #
    # Prefer camp_info_address (edited on the Camp Info page, right above this
    # widget) so what admins see and edit here actually drives what's searched.
    # Fall back to signup_location for older configs that never set camp_info_address.
    info_address_setting = Setting.query.filter_by(key="camp_info_address").first()
    location_setting = Setting.query.filter_by(key="signup_location").first()
    camp_address = (
        (info_address_setting.value if info_address_setting else None)
        or (location_setting.value if location_setting else None)
        or DEFAULT_SETTINGS["camp_info_address"]
    )
    
    # Check persistent cache first
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    cache_dict = read_places_cache()
    norm_address = camp_address.strip().upper()
    cached_entry = cache_dict.get(norm_address)

    api_key_setting = Setting.query.filter_by(key="google_places_api_key").first()
    api_key = api_key_setting.value if api_key_setting else ""

    if not api_key:
        if cached_entry and "data" in cached_entry and is_sane_places_payload(cached_entry["data"]):
            if not cached_entry["data"].get("is_mock"):
                # If we have a good real cache entry but no API key configured,
                # do not overwrite it with mock data on forced refreshes.
                return jsonify(cached_entry["data"]), 200

    if not force_refresh and cached_entry and "data" in cached_entry:
        if time.time() - cached_entry.get("timestamp", 0) < 604800:  # 7 days
            if is_sane_places_payload(cached_entry["data"]):
                return jsonify(cached_entry["data"]), 200
            # Corrupted/partial entry from an older run - fall through and
            # regenerate rather than serving broken cards forever.

    # Only throttle forced refreshes when there's actually an API key to call -
    # with no key configured, "refresh" just regenerates the same deterministic
    # local directory fallback, which is free and has no rate limit to protect,
    # so there's no reason to lock the button or serve a stale copy.
    if force_refresh and api_key and cached_entry and "data" in cached_entry:
        last_attempt = cached_entry.get("last_attempt", cached_entry.get("timestamp", 0))
        if time.time() - last_attempt < REFRESH_COOLDOWN_SECONDS and is_sane_places_payload(cached_entry["data"]):
            # Too soon since the last live attempt - serve what we have instead
            # of issuing another burst of Google API calls.
            throttled_data = dict(cached_entry["data"])
            throttled_data["throttled"] = True
            throttled_data["retry_after_seconds"] = round(REFRESH_COOLDOWN_SECONDS - (time.time() - last_attempt))
            return jsonify(throttled_data), 200

    hospitals = []
    restaurants = []
    using_mock = True
    fetch_failed = False
    failure_reason = None
    
    if api_key:
        try:
            # Geocode camp address
            geo_url = "https://maps.googleapis.com/maps/api/geocode/json"
            geo_res = requests.get(geo_url, params={"address": camp_address, "key": api_key}, timeout=5)
            geo_data = geo_res.json()
            
            if geo_data.get("status") == "OK":
                loc = geo_data["results"][0]["geometry"]["location"]
                lat, lng = loc["lat"], loc["lng"]
                
                # Search Google Places concurrently to avoid sequential time.sleep delays
                with ThreadPoolExecutor(max_workers=4) as executor:
                    hosp_future = executor.submit(fetch_all_nearby_places, f"{lat},{lng}", 40233, "hospital", None, api_key)
                    rest_future = executor.submit(fetch_all_nearby_places, f"{lat},{lng}", 40233, "restaurant", None, api_key)
                    ff_future = executor.submit(fetch_all_nearby_places, f"{lat},{lng}", 40233, "restaurant", "fast food", api_key)
                    mcd_future = executor.submit(fetch_all_nearby_places, f"{lat},{lng}", 40233, "restaurant", "McDonald's", api_key)
                    
                    hosp_raw = hosp_future.result()
                    rest_raw = rest_future.result()
                    ff_raw = ff_future.result()
                    mcd_raw = mcd_future.result()

                # None means that particular call failed outright (timeout,
                # OVER_QUERY_LIMIT, etc) rather than legitimately finding
                # nothing. Treat the whole refresh as failed rather than
                # quietly building a partial/degraded result from whichever
                # calls happened to succeed.
                if any(r is None for r in (hosp_raw, rest_raw, ff_raw, mcd_raw)):
                    fetch_failed = True
                    failure_reason = "One or more Google Places nearby-search calls failed (rate limit, denied, or timeout)."
                else:
                    # Parse Hospitals
                    if hosp_raw:
                        using_mock = False
                        for item in hosp_raw:
                            place_loc = item.get("geometry", {}).get("location", {})
                            p_lat, p_lng = place_loc.get("lat"), place_loc.get("lng")
                            dist = calculate_distance(lat, lng, p_lat, p_lng) if p_lat and p_lng else 999.0
                            if dist <= 25.0:
                                hospitals.append({
                                    "place_id": item.get("place_id"),
                                    "name": item.get("name"),
                                    "rating": item.get("rating", "N/A"),
                                    "address": item.get("vicinity"),
                                    "distance": f"{dist} miles",
                                    "dist_val": dist,
                                    "open_now": item.get("opening_hours", {}).get("open_now", True)
                                })
                        # Sort hospitals by distance
                        hospitals.sort(key=lambda x: x.get("dist_val", 999.0))

                    # Parse Restaurants & Dining
                    raw_dining_items = []
                    seen_place_ids = set()

                    combined_raw_dining = (rest_raw or []) + (ff_raw or [])
                    if combined_raw_dining:
                        using_mock = False
                        for item in combined_raw_dining:
                            pid = item.get("place_id")
                            if pid and pid not in seen_place_ids:
                                seen_place_ids.add(pid)
                                place_loc = item.get("geometry", {}).get("location", {})
                                p_lat, p_lng = place_loc.get("lat"), place_loc.get("lng")
                                dist = calculate_distance(lat, lng, p_lat, p_lng) if p_lat and p_lng else 999.0
                                if dist <= 25.0:
                                    raw_dining_items.append({
                                        "place_id": pid,
                                        "name": item.get("name"),
                                        "rating": item.get("rating", "N/A"),
                                        "address": item.get("vicinity"),
                                        "distance": f"{dist} miles",
                                        "dist_val": dist,
                                        "open_now": item.get("opening_hours", {}).get("open_now", True)
                                    })

                        # Guarantee a McDonald's is in the list
                        has_mcdonalds = any("mcdonald" in it["name"].lower() for it in raw_dining_items)
                        if not has_mcdonalds and mcd_raw:
                            for mcd_item in mcd_raw:
                                pid = mcd_item.get("place_id")
                                if pid and pid not in seen_place_ids:
                                    seen_place_ids.add(pid)
                                    place_loc = mcd_item.get("geometry", {}).get("location", {})
                                    p_lat, p_lng = place_loc.get("lat"), place_loc.get("lng")
                                    dist = calculate_distance(lat, lng, p_lat, p_lng) if p_lat and p_lng else 999.0
                                    if dist <= 25.0:
                                        raw_dining_items.append({
                                            "place_id": pid,
                                            "name": mcd_item.get("name"),
                                            "rating": mcd_item.get("rating", "N/A"),
                                            "address": mcd_item.get("vicinity"),
                                            "distance": f"{dist} miles",
                                            "dist_val": dist,
                                            "open_now": mcd_item.get("opening_hours", {}).get("open_now", True)
                                        })
                                        break

                    # Sort combined list by distance
                    raw_dining_items.sort(key=lambda x: x.get("dist_val", 999.0))
                    restaurants = raw_dining_items

                    # Fetch Phone Numbers in Parallel for ALL items
                    all_items_to_fetch = hospitals + restaurants

                    with ThreadPoolExecutor(max_workers=35) as executor:
                        futures = {
                            executor.submit(fetch_phone_number, item.get("place_id"), api_key): item
                            for item in all_items_to_fetch if item.get("place_id")
                        }
                        for fut in futures:
                            target_item = futures[fut]
                            try:
                                phone = fut.result()
                                if phone:
                                    target_item["phone"] = phone
                            except Exception:
                                pass
            else:
                # Geocoding itself failed - can't trust anything downstream.
                fetch_failed = True
                failure_reason = f"Geocoding the camp address failed (Google status: {geo_data.get('status', 'unknown')})."
        except Exception as e:
            fetch_failed = True
            failure_reason = f"Request to Google failed: {e}"

    if fetch_failed:
        # The live refresh attempt failed (rate limit, timeout, bad geocode,
        # etc). Never let a failed attempt overwrite good cached data - just
        # remember that we tried, so the cooldown above prevents hammering
        # the API again on the very next click, and serve whatever we already
        # had cached for this address.
        cache_dict[norm_address] = {
            **(cached_entry or {}),
            "last_attempt": time.time(),
        }
        write_places_cache(cache_dict)

        if cached_entry and "data" in cached_entry and is_sane_places_payload(cached_entry["data"]):
            stale_data = dict(cached_entry["data"])
            stale_data["refresh_failed"] = True
            stale_data["failure_reason"] = failure_reason
            return jsonify(stale_data), 200
        # No prior cache at all (or what's cached is corrupted) - fall
        # through to the deterministic mock fallback below so the page still
        # has something valid to show.
        using_mock = True
        mock_after_failed_refresh = True
    else:
        mock_after_failed_refresh = False

    # Mock fallback if Google Places API is not set or failed
    if using_mock:
        import re
        
        # Parse city and state from camp_address
        city = "Pottsboro"
        state = "TX"
        
        # Look for standard "City, ST" pattern
        match = re.search(r"([^,]+),\s*([A-Z]{2})\b", camp_address)
        if match:
            city = match.group(1).strip()
            state = match.group(2).strip()
        elif "El Dorado" in camp_address:
            city = "El Dorado"
            state = "AR"
            
        # Customize mock list based on Pottsboro vs general city
        if city.lower() == "pottsboro" or state.lower() == "tx":
            hospitals = [
                {"name": "Texoma Medical Center", "rating": 4.2, "address": f"5016 S US 75, Denison, {state}", "distance": "8.4 miles", "phone": "+1 (903) 246-6000", "open_now": True},
                {"name": "Wilson N. Jones Regional Medical Center", "rating": 4.1, "address": f"500 N Highland Ave, Sherman, {state}", "distance": "12.1 miles", "phone": "+1 (903) 892-6101", "open_now": True},
                {"name": "Pottsboro Primary Care Clinic", "rating": 4.5, "address": f"111 Highway 120, {city}, {state}", "distance": "1.2 miles", "phone": "+1 (903) 786-3911", "open_now": True}
            ]
            restaurants = [
                {"name": "McDonald's", "rating": 3.8, "address": f"415 Highport Rd, {city}, {state}", "distance": "3.4 miles", "phone": "+1 (903) 786-1212", "open_now": True},
                {"name": "The Island Bar & Grill", "rating": 4.6, "address": f"407 Highport Rd, {city}, {state}", "distance": "3.5 miles", "phone": "+1 (903) 786-2187", "open_now": True},
                {"name": "Napoli's Pizza & Restaurant", "rating": 4.4, "address": f"118 FM120, {city}, {state}", "distance": "0.9 miles", "phone": "+1 (903) 786-2383", "open_now": True},
                {"name": "Devolli's Italian Restaurant", "rating": 4.7, "address": f"109 FM120, {city}, {state}", "distance": "0.8 miles", "phone": "+1 (903) 786-4545", "open_now": False},
                {"name": "Sonic Drive-In", "rating": 4.1, "address": f"120 Highway 120, {city}, {state}", "distance": "1.0 miles", "phone": "+1 (903) 786-4040", "open_now": True},
                {"name": "Subway", "rating": 4.0, "address": f"105 FM120, {city}, {state}", "distance": "0.7 miles", "phone": "+1 (903) 786-5500", "open_now": True},
                {"name": "Mommie's Diner", "rating": 4.3, "address": f"510 S Pottsboro Rd, {city}, {state}", "distance": "1.1 miles", "phone": "+1 (903) 786-6300", "open_now": True}
            ]
        else:
            hospitals = [
                {"name": f"{city} Community Hospital", "rating": 4.1, "address": f"700 W Grove St, {city}, {state}", "distance": "2.4 miles", "phone": "+1 (555) 019-2234", "open_now": True},
                {"name": f"{city} Health Clinic", "rating": 4.3, "address": f"120 E 5th St, {city}, {state}", "distance": "1.8 miles", "phone": "+1 (555) 019-2235", "open_now": True},
                {"name": f"{city} Emergency Care Center", "rating": 4.6, "address": f"1501 Northwest Ave, {city}, {state}", "distance": "3.1 miles", "phone": "+1 (555) 019-2236", "open_now": True}
            ]
            restaurants = [
                {"name": "McDonald's", "rating": 3.8, "address": f"1200 Main St, {city}, {state}", "distance": "1.6 miles", "phone": "+1 (555) 019-4455", "open_now": True},
                {"name": f"Country Kitchen {city}", "rating": 4.2, "address": f"1203 Main St, {city}, {state}", "distance": "1.5 miles", "phone": "+1 (555) 019-3344", "open_now": True},
                {"name": f"The {city} Grill & Cafe", "rating": 4.5, "address": f"802 S West Ave, {city}, {state}", "distance": "0.9 miles", "phone": "+1 (555) 019-3345", "open_now": True},
                {"name": f"Fayrays {city}", "rating": 4.7, "address": f"110 E Elm St, {city}, {state}", "distance": "1.2 miles", "phone": "+1 (555) 019-3346", "open_now": False},
                {"name": f"Lake {city} Diner", "rating": 4.0, "address": f"415 N West Ave, {city}, {state}", "distance": "2.1 miles", "phone": "+1 (555) 019-3347", "open_now": True},
                {"name": "Burger King", "rating": 3.9, "address": f"805 S West Ave, {city}, {state}", "distance": "0.8 miles", "phone": "+1 (555) 019-4456", "open_now": True}
            ]
        
    response_data = {
        "hospitals": hospitals,
        "restaurants": restaurants,
        "is_mock": using_mock,
        "camp_address": camp_address,
        "throttled": False,
        "refresh_failed": mock_after_failed_refresh,
        "failure_reason": failure_reason if mock_after_failed_refresh else None
    }
    
    # Store in persistent file cache. We only reach here on a genuine success
    # (or the no-api-key / no-prior-cache mock path) - a failed live attempt
    # returns earlier above without ever reaching this point, so it can never
    # clobber a previously-good cache entry with worse data.
    cache_dict[norm_address] = {
        "timestamp": time.time(),
        "last_attempt": time.time(),
        "data": response_data
    }
    write_places_cache(cache_dict)
    
    return jsonify(response_data), 200
