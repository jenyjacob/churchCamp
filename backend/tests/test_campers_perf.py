import pytest, json
from app import create_app
from db import db as _db


@pytest.fixture
def app():
    import os, uuid
    db_file = f"test_campers_perf_{uuid.uuid4().hex}.db"

    os.environ["SEED_ADMIN_PASSWORD"] = "Admin@1234!"
    app = create_app({
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_file}",
        "TESTING": True
    })

    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.engine.dispose()

    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass


@pytest.fixture
def client(app):
    return app.test_client()


def admin_token(client):
    res = client.post('/api/auth/login',
        data=json.dumps({'username': 'admin', 'password': 'Admin@1234!'}),
        content_type='application/json')
    assert res.status_code == 200
    return json.loads(res.data)['access_token']


def create_camper(client, token, **overrides):
    payload = {
        "first_name": "Test",
        "last_name": "Camper",
        "registration_status": "registered",
        "age": 10,
    }
    payload.update(overrides)
    res = client.post('/api/campers/',
        data=json.dumps(payload),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 201, res.data
    return json.loads(res.data)['camper']


def test_campers_list_does_not_n_plus_one(app, client):
    """
    Regression test: GET /api/campers/ should issue a small, constant number
    of SQL queries regardless of how many campers exist. Camper.to_dict()
    reads both `checkins` and `tshirts` relationships for every row, which
    were previously lazy-loaded (an N+1: up to 2 extra queries per camper).
    """
    from sqlalchemy import event

    token = admin_token(client)

    for i in range(12):
        create_camper(client, token, first_name=f"Kid{i}", last_name="Camper")

    query_count = {"n": 0}

    def _count_queries(*args, **kwargs):
        query_count["n"] += 1

    with app.app_context():
        engine = _db.engine
        event.listen(engine, "before_cursor_execute", _count_queries)
        try:
            res = client.get('/api/campers/?per_page=-1', headers={'Authorization': f'Bearer {token}'})
        finally:
            event.remove(engine, "before_cursor_execute", _count_queries)

    assert res.status_code == 200
    data = json.loads(res.data)
    assert len(data['campers']) == 12

    # A handful of fixed queries (permission/setting lookups + the
    # selectinload'ed campers/checkins/tshirts queries) rather than scaling
    # with the number of campers (12 rows * 2 lazy relationships would be
    # 24+ extra queries pre-fix).
    assert query_count["n"] < 15, (
        f"Expected a small constant number of queries, got {query_count['n']} "
        "(possible N+1 regression in GET /api/campers/)"
    )


def test_stats_checked_in_count_correct_without_loading_all_campers(client):
    """
    GET /api/campers/stats should compute the checked-in count via a DB-side
    join/count rather than loading every camper's full checkins collection
    into Python. Verify the count is still correct.
    """
    token = admin_token(client)

    c1 = create_camper(client, token, first_name="Ann", last_name="A")
    c2 = create_camper(client, token, first_name="Bo", last_name="B")
    c3 = create_camper(client, token, first_name="Cy", last_name="C")

    # Check in Ann and Bo; leave Cy alone. Then check Ann out again.
    for c in (c1, c2):
        res = client.post('/api/checkin/',
            data=json.dumps({'camper_id': c['id']}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201, res.data

    # Check Ann back out, so only Bo remains actively checked in
    res = client.get('/api/checkin/?active_only=true', headers={'Authorization': f'Bearer {token}'})
    active = json.loads(res.data)['checkins']
    ann_checkin = next(c for c in active if c['camper_id'] == c1['id'])
    res = client.post(f"/api/checkin/{ann_checkin['id']}/checkout", headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200

    res = client.get('/api/campers/stats', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    stats = json.loads(res.data)
    assert stats['checked_in'] == 1
    assert stats['total_registered'] == 3


def test_checkin_list_does_not_n_plus_one(app, client):
    """
    Regression test: GET /api/checkin/ (the general camper check-in log,
    distinct from Kidz Corner's) has the same to_dict() relationship-access
    pattern (camper, staff_in, staff_out) as the Kidz Corner check-in
    endpoint did, so it needs the same eager-loading fix to avoid an N+1.
    """
    from sqlalchemy import event

    token = admin_token(client)

    campers = [create_camper(client, token, first_name=f"C{i}", last_name="Camper") for i in range(10)]
    for c in campers:
        res = client.post('/api/checkin/',
            data=json.dumps({'camper_id': c['id']}),
            content_type='application/json',
            headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201, res.data

    query_count = {"n": 0}

    def _count_queries(*args, **kwargs):
        query_count["n"] += 1

    with app.app_context():
        engine = _db.engine
        event.listen(engine, "before_cursor_execute", _count_queries)
        try:
            res = client.get('/api/checkin/', headers={'Authorization': f'Bearer {token}'})
        finally:
            event.remove(engine, "before_cursor_execute", _count_queries)

    assert res.status_code == 200
    data = json.loads(res.data)
    assert len(data['checkins']) == 10
    assert all(c['camper_name'] for c in data['checkins'])

    assert query_count["n"] < 10, (
        f"Expected a small constant number of queries, got {query_count['n']} "
        "(possible N+1 regression in GET /api/checkin/)"
    )
