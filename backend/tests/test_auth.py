import pytest, json
from app import create_app
from db import db as _db
@pytest.fixture
def app():
    import os
    db_file = "test_churchcamp.db"
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

def test_login_success(client):
    res = client.post('/api/auth/login',
    data=json.dumps({'username':'admin','password':'Admin@1234!'}),
    content_type='application/json')
    assert res.status_code == 200
    assert 'access_token' in json.loads(res.data)

def test_login_wrong_password(client):
    res = client.post('/api/auth/login',
    data=json.dumps({'username':'admin','password':'wrong'}),
    content_type='application/json')
    assert res.status_code == 401

def test_login_missing_fields(client):
    res = client.post('/api/auth/login',
    data=json.dumps({'username':'admin'}), content_type='application/json')
    assert res.status_code == 400

def test_protected_route_no_token(client):
    res = client.get('/api/campers/')
    assert res.status_code == 401