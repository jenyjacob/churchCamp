import pytest
import json
from app import create_app
from db import db as _db
from models.user import User
from models.kidz_corner import KidzCornerKid, KidzCornerCheckIn

@pytest.fixture
def app():
    import os
    db_file = "test_kidz_corner_checkin.db"
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
        
        # Create users
        admin = User(username="admin_user", role="admin")
        admin.set_password("AdminPass123!")
        _db.session.add(admin)

        regular = User(username="regular_user", role="user")
        regular.set_password("RegularPass123!")
        _db.session.add(regular)

        # Create a Kidz Corner kid
        kid = KidzCornerKid(name="Timmy Tester", age=8, allergies="Peanuts")
        _db.session.add(kid)
        
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

def get_auth_headers(client, username, password):
    res = client.post('/api/auth/login',
                      data=json.dumps({'username': username, 'password': password}),
                      content_type='application/json')
    token = json.loads(res.data)['access_token']
    return {'Authorization': f'Bearer {token}'}

def test_kidz_corner_checkin_lifecycle(client):
    headers = get_auth_headers(client, "regular_user", "RegularPass123!")
    
    # 1. GET checkins initially empty
    res = client.get('/api/kidz-corner/checkins', headers=headers)
    assert res.status_code == 200
    data = json.loads(res.data)
    assert len(data['checkins']) == 0

    # 2. Check in Timmy
    res = client.post('/api/kidz-corner/checkins', 
                      data=json.dumps({'kid_id': 1, 'notes': 'Dropped off by mom'}),
                      content_type='application/json',
                      headers=headers)
    assert res.status_code == 201
    checkin_data = json.loads(res.data)
    assert checkin_data['checkin']['kid_name'] == "Timmy Tester"
    assert checkin_data['checkin']['checked_out_at'] is None
    checkin_id = checkin_data['checkin']['id']

    # 3. Try checking in again (should fail)
    res = client.post('/api/kidz-corner/checkins', 
                      data=json.dumps({'kid_id': 1}),
                      content_type='application/json',
                      headers=headers)
    assert res.status_code == 409

    # 4. Update allergies from checkin view
    res = client.put('/api/kidz-corner/kids/1/allergies',
                     data=json.dumps({'allergies': 'Peanuts, Strawberries'}),
                     content_type='application/json',
                     headers=headers)
    assert res.status_code == 200
    assert json.loads(res.data)['kid']['allergies'] == 'Peanuts, Strawberries'

    # 5. Check out Timmy
    res = client.post(f'/api/kidz-corner/checkins/{checkin_id}/checkout', headers=headers)
    assert res.status_code == 200
    assert json.loads(res.data)['checkin']['checked_out_at'] is not None

    # 6. Admin can delete/reset check-in
    admin_headers = get_auth_headers(client, "admin_user", "AdminPass123!")
    res = client.delete(f'/api/kidz-corner/checkins/{checkin_id}', headers=admin_headers)
    assert res.status_code == 200

    # 7. Verify checkin log is empty again
    res = client.get('/api/kidz-corner/checkins', headers=headers)
    assert len(json.loads(res.data)['checkins']) == 0
