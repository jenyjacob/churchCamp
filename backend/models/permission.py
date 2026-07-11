from db import db

class PagePermission(db.Model):
    __tablename__ = "page_permissions"

    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(50), nullable=False) # 'admin', 'director', 'user'
    page_key = db.Column(db.String(50), nullable=False) # 'dashboard', 'campers', 'checkin', 'cabins', 'schedule', 'outdoor', 'apparel', 'users', 'logs'
    access_level = db.Column(db.String(20), nullable=False) # 'hide', 'read', 'edit'

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "page_key": self.page_key,
            "access_level": self.access_level
        }
