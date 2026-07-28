def validate_password_strength(password):
    """
    Validates that a password meets the following strict strength requirements:
    - At least 8 characters long
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one numeric digit (0-9)
    - At least one special character from: @$!%*?&#^-+=_
    
    Returns None if the password is valid, or a descriptive error message string if invalid.
    """
    if not password:
        return "Password is required."
    
    if len(password) < 8:
        return "Password must be at least 8 characters long."
        
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter."
        
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter."
        
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number."
        
    special_chars = "@$!%*?&#^-+=_"
    if not any(c in special_chars for c in password):
        return f"Password must contain at least one special character (from: {special_chars})."
        
    return None
