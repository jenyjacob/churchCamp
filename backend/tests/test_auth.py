import pytest, json
from app import create_app
from db import db as _db
@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.app_context():
        _db.create_all()
        from utils.seed import seed_admin
        seed_admin()
        yield app

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