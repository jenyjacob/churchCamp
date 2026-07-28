import pytest
import json
from app import create_app
from db import db as _db
from models.user import User
from models.camper import Camper

@pytest.fixture
def app():
    import os
    db_file = "test_permissions.db"
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass

    os.environ["SEED_ADMIN_PASSWORD"] = "Admin@1234!"
    app = create_app({
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_file}",
        "TESTING": True
    })

    with app.app_context():
        _db.create_all()
        
        # Create users with different roles if they don't exist
        if not User.query.filter_by(username="owner_user").first():
            owner = User(username="owner_user", role="owner")
            owner.set_password("OwnerPass123!")
            _db.session.add(owner)
        
        if not User.query.filter_by(username="finance_user").first():
            finance = User(username="finance_user", role="finance")
            finance.set_password("FinancePass123!")
            _db.session.add(finance)
        
        if not User.query.filter_by(username="regular_user").first():
            regular = User(username="regular_user", role="user")
            regular.set_password("RegularPass123!")
            _db.session.add(regular)

        # Create a camper if database is empty/fresh
        if not Camper.query.first():
            camper = Camper(
                first_name="John",
                last_name="Doe",
                gender="male",
                registration_status="registered"
            )
            _db.session.add(camper)
        
        _db.session.commit()
        yield app
        _db.session.remove()
        _db.drop_all()

    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass

@pytest.fixture
def client(app):
    return app.test_client()

def get_token(client, username, password):
    res = client.post('/api/auth/login',
                      data=json.dumps({'username': username, 'password': password}),
                      content_type='application/json')
    return json.loads(res.data)['access_token']

def test_camper_list_access(client):
    # 1. Owner Token
    owner_token = get_token(client, "owner_user", "OwnerPass123!")
    res = client.get('/api/campers/', headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200

    # 2. Finance Token (should be allowed due to apparel read permission)
    finance_token = get_token(client, "finance_user", "FinancePass123!")
    res = client.get('/api/campers/', headers={"Authorization": f"Bearer {finance_token}"})
    assert res.status_code == 200

    # 3. Regular User Token (allowed due to campers read permission)
    regular_token = get_token(client, "regular_user", "RegularPass123!")
    res = client.get('/api/campers/', headers={"Authorization": f"Bearer {regular_token}"})
    assert res.status_code == 200

def test_camper_update_field_restrictions(client):
    owner_token = get_token(client, "owner_user", "OwnerPass123!")
    finance_token = get_token(client, "finance_user", "FinancePass123!")
    regular_token = get_token(client, "regular_user", "RegularPass123!")

    # 1. Owner updates first_name (allowed)
    res = client.put('/api/campers/1', 
                     data=json.dumps({"first_name": "Johnny"}), 
                     content_type='application/json',
                     headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["camper"]["first_name"] == "Johnny"

    # 2. Finance updates tshirt_size (allowed because finance has apparel: edit)
    res = client.put('/api/campers/1', 
                     data=json.dumps({"tshirt_size": "Adult L"}), 
                     content_type='application/json',
                     headers={"Authorization": f"Bearer {finance_token}"})
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["camper"]["tshirt_size"] == "Adult L"

    # 3. Finance attempts to update first_name (should be securely ignored/unaffected because finance only has apparel: edit)
    res = client.put('/api/campers/1', 
                     data=json.dumps({"first_name": "TamperedName"}), 
                     content_type='application/json',
                     headers={"Authorization": f"Bearer {finance_token}"})
    assert res.status_code == 200
    data = json.loads(res.data)
    # The name should remain "Johnny", not change to "TamperedName"!
    assert data["camper"]["first_name"] == "Johnny"

    # 4. Regular User updates first_name (allowed because regular user has campers: edit)
    res = client.put('/api/campers/1', 
                     data=json.dumps({"first_name": "Jane"}), 
                     content_type='application/json',
                     headers={"Authorization": f"Bearer {regular_token}"})
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["camper"]["first_name"] == "Jane"
