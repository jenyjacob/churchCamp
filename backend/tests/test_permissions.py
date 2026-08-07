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

        if not User.query.filter_by(username="vbslead_user").first():
            vbslead = User(username="vbslead_user", role="vbslead")
            vbslead.set_password("VbsLeadPass123!")
            _db.session.add(vbslead)

        if not User.query.filter_by(username="volunteer_user").first():
            volunteer = User(username="volunteer_user", role="volunteer")
            volunteer.set_password("VolunteerPass123!")
            _db.session.add(volunteer)

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

def test_vbs_lead_and_volunteer_access(client):
    vbslead_token = get_token(client, "vbslead_user", "VbsLeadPass123!")
    volunteer_token = get_token(client, "volunteer_user", "VolunteerPass123!")

    # 1. Neither vbslead nor volunteer can view campers list (should get 403)
    res = client.get('/api/campers/', headers={"Authorization": f"Bearer {vbslead_token}"})
    assert res.status_code == 403

    res = client.get('/api/campers/', headers={"Authorization": f"Bearer {volunteer_token}"})
    assert res.status_code == 403

    # 2. Both can view my-permissions
    res = client.get('/api/permissions/my-permissions', headers={"Authorization": f"Bearer {vbslead_token}"})
    assert res.status_code == 200
    perms = json.loads(res.data)["permissions"]
    assert perms["kidz_corner"] == "edit"
    assert perms["camp_info"] == "read"
    assert perms["campers"] == "hide"

    res = client.get('/api/permissions/my-permissions', headers={"Authorization": f"Bearer {volunteer_token}"})
    assert res.status_code == 200
    perms = json.loads(res.data)["permissions"]
    assert perms["kidz_corner"] == "read"
    assert perms["camp_info"] == "read"
    assert perms["campers"] == "hide"


def test_get_all_permissions_applies_custom_overrides_per_role(client):
    """
    GET /api/permissions/ (owner-only "Role Assigner" grid) batches its
    per-role PagePermission lookups into a single query instead of one
    query per role. Verify custom overrides for different roles still land
    on the correct role and don't leak into other roles' grids.
    """
    owner_token = get_token(client, "owner_user", "OwnerPass123!")

    # Give vbslead a custom "edit" on finance (normally "hide"), and give
    # volunteer a custom "read" on campers (normally "hide").
    res = client.post('/api/permissions/',
        data=json.dumps({"role": "vbslead", "page_key": "finance", "access_level": "edit"}),
        content_type='application/json',
        headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200, res.data

    res = client.post('/api/permissions/',
        data=json.dumps({"role": "volunteer", "page_key": "campers", "access_level": "read"}),
        content_type='application/json',
        headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200, res.data

    res = client.get('/api/permissions/', headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    grid = json.loads(res.data)["permissions"]

    # Overrides landed on the correct role...
    assert grid["vbslead"]["finance"] == "edit"
    assert grid["volunteer"]["campers"] == "read"

    # ...and didn't leak into other roles or other pages for the same role.
    assert grid["vbslead"]["campers"] == "hide"
    assert grid["volunteer"]["finance"] == "hide"
    assert grid["finance"]["finance"] == "edit"  # untouched default for the "finance" role
    assert grid["user"]["campers"] == "edit"  # untouched default for "user" role

