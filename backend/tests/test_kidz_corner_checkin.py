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


def test_checkins_list_does_not_n_plus_one(app, client):
    """
    Regression test: GET /checkins should issue a small, constant number of
    SQL queries regardless of how many check-in rows exist. Before the
    eager-loading fix, KidzCornerCheckIn.to_dict() lazily touched
    kid / staff_in / staff_out for every row, causing 3 extra queries per
    row (an N+1 that made pages landing directly on Kidz Corner, e.g. for
    the "vbslead" role, load very slowly once check-in history grew).
    """
    from sqlalchemy import event

    headers = get_auth_headers(client, "regular_user", "RegularPass123!")

    with app.app_context():
        kids = [KidzCornerKid(name=f"Kid {i}", age=7) for i in range(10)]
        _db.session.add_all(kids)
        _db.session.commit()
        kid_ids = [k.id for k in kids]

    # Check in and out each kid so both staff_in and staff_out get populated
    for kid_id in kid_ids:
        res = client.post('/api/kidz-corner/checkins',
                          data=json.dumps({'kid_id': kid_id}),
                          content_type='application/json',
                          headers=headers)
        assert res.status_code == 201
        checkin_id = json.loads(res.data)['checkin']['id']
        res = client.post(f'/api/kidz-corner/checkins/{checkin_id}/checkout', headers=headers)
        assert res.status_code == 200

    query_count = {"n": 0}

    def _count_queries(*args, **kwargs):
        query_count["n"] += 1

    with app.app_context():
        engine = _db.engine
        event.listen(engine, "before_cursor_execute", _count_queries)
        try:
            res = client.get('/api/kidz-corner/checkins', headers=headers)
        finally:
            event.remove(engine, "before_cursor_execute", _count_queries)

    assert res.status_code == 200
    data = json.loads(res.data)
    assert len(data['checkins']) == 10
    # Sanity check the joined data still resolves correctly
    assert all(c['kid_name'] for c in data['checkins'])

    # A handful of fixed queries (permission check + the eager-loaded
    # checkins query) rather than scaling with the number of rows (10
    # rows * up to 3 lazy relationships would be 30+ queries pre-fix).
    assert query_count["n"] < 10, (
        f"Expected a small constant number of queries, got {query_count['n']} "
        "(possible N+1 regression in /api/kidz-corner/checkins)"
    )


def test_checkins_limit_param_scopes_results(client):
    """
    GET /checkins?limit=N should return at most N rows, most-recent first,
    so the frontend never has to pull the full history table just to show
    a short "Recent Activity" list.
    """
    headers = get_auth_headers(client, "regular_user", "RegularPass123!")
    admin_headers = get_auth_headers(client, "admin_user", "AdminPass123!")

    # Create 15 kids and check each one in (leave them checked in)
    kid_ids = []
    for i in range(15):
        res = client.post('/api/kidz-corner/kids',
                          data=json.dumps({'name': f'Limit Kid {i}'}),
                          content_type='application/json',
                          headers=admin_headers)
        assert res.status_code == 201
        kid_ids.append(json.loads(res.data)['kid']['id'])

    for kid_id in kid_ids:
        res = client.post('/api/kidz-corner/checkins',
                          data=json.dumps({'kid_id': kid_id}),
                          content_type='application/json',
                          headers=headers)
        assert res.status_code == 201

    # No limit -> all 15 rows returned
    res = client.get('/api/kidz-corner/checkins', headers=headers)
    assert len(json.loads(res.data)['checkins']) == 15

    # limit=5 -> only the 5 most recent
    res = client.get('/api/kidz-corner/checkins?limit=5', headers=headers)
    data = json.loads(res.data)['checkins']
    assert len(data) == 5

    # active_only=true + limit combine correctly
    res = client.get('/api/kidz-corner/checkins?active_only=true&limit=3', headers=headers)
    data = json.loads(res.data)['checkins']
    assert len(data) == 3
    assert all(c['checked_out_at'] is None for c in data)
