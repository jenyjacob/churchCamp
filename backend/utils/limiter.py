import time
from functools import wraps
from flask import request, jsonify, current_app

# Simple in-memory rate limiting dictionary: { ip_address: [timestamp1, timestamp2, ...] }
rate_limit_cache = {}

def rate_limit(limit=5, period=60):
    """Rate limit decorator. Limit is the number of attempts within period seconds."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if current_app.config.get('TESTING'):
                return f(*args, **kwargs)
                
            # Trust X-Real-IP since Nginx overwrites it entirely with the actual client socket remote address.
            # Fall back to request.remote_addr if no proxy header exists.
            ip = request.headers.get("X-Real-IP", request.remote_addr)
            
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
