import pytest
import json
from app import create_app
from db import db as _db
from models import WebauthnChallenge, User

@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WEBAUTHN_RP_ID'] = 'localhost'
    app.config['WEBAUTHN_RP_NAME'] = 'GCA Camp Manager'
    app.config['WEBAUTHN_RP_ORIGIN'] = 'http://localhost:3000'

    with app.app_context():
        _db.create_all()
        from utils.seed import seed_admin
        seed_admin()
        yield app

@pytest.fixture
def client(app): 
    return app.test_client()

def test_login_and_get_register_options(client, app):
    # 1. Log in to get access token
    res = client.post('/api/auth/login',
                      data=json.dumps({'username':'admin','password':'Admin@1234!'}),
                      content_type='application/json')
    assert res.status_code == 200
    token = json.loads(res.data)['access_token']

    # 2. Get register options with JWT token
    res = client.post('/api/auth/register-passkey/options',
                       headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    data = json.loads(res.data)
    assert 'challenge' in data
    assert 'rp' in data
    assert data['rp']['id'] == 'localhost'
    assert 'user' in data

    # 3. Verify specific challenge is stored in DB
    with app.app_context():
        challenge_entry = WebauthnChallenge.query.filter_by(challenge=data['challenge']).first()
        assert challenge_entry is not None

def test_get_login_options(client, app):
    # 1. Get login options (public route)
    res = client.post('/api/auth/login-passkey/options')
    assert res.status_code == 200
    data = json.loads(res.data)
    assert 'challenge' in data
    assert 'rpId' in data
    assert data['rpId'] == 'localhost'

    # 2. Verify specific challenge is stored in DB
    with app.app_context():
        challenge_entry = WebauthnChallenge.query.filter_by(challenge=data['challenge']).first()
        assert challenge_entry is not None
