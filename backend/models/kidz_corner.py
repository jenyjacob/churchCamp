from db import db
from datetime import datetime


class KidzCornerVolunteer(db.Model):
    """Kidz Corner volunteer roster (Lead, Action Song, Puppet, AV setup, etc)."""
    __tablename__ = "kidz_corner_volunteers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    assignment = db.Column(db.String(150), nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "assignment": self.assignment,
            "order_index": self.order_index,
        }


class KidzCornerKid(db.Model):
    """Kids registered for Kidz Corner (name, age, allergies/notes)."""
    __tablename__ = "kidz_corner_kids"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    age = db.Column(db.Integer, nullable=True)
    allergies = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "age": self.age,
            "allergies": self.allergies,
            "order_index": self.order_index,
        }


class KidzCornerScheduleItem(db.Model):
    """
    Kidz Corner run-of-show, one row per activity block.

    `day` groups rows into the session they belong to, e.g. "Template",
    "Friday Night", "Saturday Morning", "Saturday Night", "Sunday Morning" -
    matching the tabs/sheets in the original planning workbook.
    """
    __tablename__ = "kidz_corner_schedule_items"

    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.String(50), nullable=False)
    date = db.Column(db.String(50), nullable=True)  # e.g. "2026-08-14", free-text ok
    time = db.Column(db.String(50), nullable=True)  # e.g. "9:15-9:30 AM"
    activity = db.Column(db.String(150), nullable=False)
    volunteers_needed = db.Column(db.String(255), nullable=True)
    items_needed = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "day": self.day,
            "date": self.date,
            "time": self.time,
            "activity": self.activity,
            "volunteers_needed": self.volunteers_needed,
            "items_needed": self.items_needed,
            "notes": self.notes,
            "order_index": self.order_index,
        }


class KidzCornerCraft(db.Model):
    """Craft/activity instructions tied to a specific Kidz Corner session."""
    __tablename__ = "kidz_corner_crafts"

    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(255), nullable=True)
    materials = db.Column(db.Text, nullable=True)
    how_to = db.Column(db.Text, nullable=True)
    ages = db.Column(db.Text, nullable=True)
    things_to_bring = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "day": self.day,
            "title": self.title,
            "materials": self.materials,
            "how_to": self.how_to,
            "ages": self.ages,
            "things_to_bring": self.things_to_bring,
            "order_index": self.order_index,
        }


class KidzCornerBudgetItem(db.Model):
    """Kidz Corner budget/expense line items, mirroring the Budget.Expenses sheet."""
    __tablename__ = "kidz_corner_budget_items"

    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(50), nullable=True)
    income_actual = db.Column(db.Float, nullable=True)
    expenses_actual = db.Column(db.Float, nullable=True)
    expenses_projected = db.Column(db.Float, nullable=True)
    related_files = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "month": self.month,
            "income_actual": self.income_actual,
            "expenses_actual": self.expenses_actual,
            "expenses_projected": self.expenses_projected,
            "related_files": self.related_files,
            "notes": self.notes,
            "order_index": self.order_index,
        }


class KidzCornerAVLink(db.Model):
    """Audio/Video reference links (action songs, dance party, background music)."""
    __tablename__ = "kidz_corner_av_links"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(100), nullable=False, default="Action Song List")
    label = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "label": self.label,
            "url": self.url,
            "order_index": self.order_index,
        }
