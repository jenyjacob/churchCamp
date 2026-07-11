import time
from functools import wraps
from flask import request, jsonify

# Simple in-memory rate limiting dictionary: { ip_address: [timestamp1, timestamp2, ...] }
rate_limit_cache = {}

def rate_limit(limit=5, period=60):
    """Rate limit decorator. Limit is the number of attempts within period seconds."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # Check for proxy header first, then remote address
            ip = request.headers.get("X-Forwarded-For", request.remote_addr)
            if ip and "," in ip:
                ip = ip.split(",")[0].strip()
            
            now = time.time()
            
            # Filter timestamps to keep only those within current window
            timestamps = rate_limit_cache.get(ip, [])
            timestamps = [t for t in timestamps if now - t < period]
            
            if len(timestamps) >= limit:
                return jsonify({"error": "Too many requests. Please try again later."}), 429
                
            timestamps.append(now)
            rate_limit_cache[ip] = timestamps
            return f(*args, **kwargs)
        return wrapped
    return decorator
