from db import db

class Setting(db.Model):
    __tablename__ = "settings"

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text(4294967295), nullable=False)

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value
        }
