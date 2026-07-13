from db import db

class FeeRate(db.Model):
    __tablename__ = "fee_rates"

    member_count = db.Column(db.Integer, primary_key=True)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "member_count": self.member_count,
            "price": self.price
        }
