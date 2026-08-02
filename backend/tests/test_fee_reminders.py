import pytest, json
from app import create_app
from db import db as _db


@pytest.fixture
def app():
    import os, uuid
    db_file = f"test_reminders_{uuid.uuid4().hex}.db"

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
        "family_group": "1",
        "guardian_phone": "5551234567",
        "registration_status": "registered",
        "age": 30,
        "kayaking": 0,
        "boat_tour": 0,
    }
    payload.update(overrides)
    res = client.post('/api/campers/',
        data=json.dumps(payload),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 201, res.data
    return json.loads(res.data)['camper']


def test_families_have_different_fees_and_contact_phone(client):
    token = admin_token(client)

    # Family 1: a single camper, no activities
    create_camper(client, token, first_name="Alice", last_name="Anderson",
                   family_group="1", guardian_phone="5551110000")

    # Family 2: three campers (bigger family tier), two doing kayaking
    create_camper(client, token, first_name="Bob", last_name="Baker",
                   family_group="2", guardian_phone="5552220000", kayaking=1)
    create_camper(client, token, first_name="Bea", last_name="Baker",
                   family_group="2", guardian_phone="", kayaking=1)
    create_camper(client, token, first_name="Ben", last_name="Baker",
                   family_group="2", guardian_phone="")

    res = client.get('/api/finance/fees', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    families = {f['family_group']: f for f in json.loads(res.data)['families']}

    assert families['1']['total_expected_fee'] != families['2']['total_expected_fee'], \
        "Different-sized families should have different total fees"

    assert families['2']['activity_fee'] > families['1']['activity_fee'], \
        "Family with kayaking sign-ups should have a higher activity fee"

    # contact_phone should resolve to the head of family's guardian_phone
    assert families['1']['contact_phone'] == "5551110000"
    assert families['2']['contact_phone'] == "5552220000"

    # No reminder sent yet
    assert families['1']['reminder_sent_at'] is None
    assert families['2']['reminder_sent_at'] is None


def test_family_with_no_phone_on_file(client):
    token = admin_token(client)
    create_camper(client, token, first_name="Nophone", last_name="Guy",
                   family_group="3", guardian_phone=None)

    res = client.get('/api/finance/fees', headers={'Authorization': f'Bearer {token}'})
    families = {f['family_group']: f for f in json.loads(res.data)['families']}
    assert families['3']['contact_phone'] is None


def test_mark_reminder_sent_persists(client):
    token = admin_token(client)
    create_camper(client, token, first_name="Carla", last_name="Chen", family_group="4")

    res = client.post('/api/finance/fees/mark-reminder-sent',
        data=json.dumps({"family_group": "4"}),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert json.loads(res.data)['payment']['reminder_sent_at'] is not None

    # Confirm it shows up on a fresh GET /fees call (persisted, not just returned once)
    res2 = client.get('/api/finance/fees', headers={'Authorization': f'Bearer {token}'})
    families = {f['family_group']: f for f in json.loads(res2.data)['families']}
    assert families['4']['reminder_sent_at'] is not None


def test_mark_reminder_sent_requires_finance_edit_permission(client):
    # Register a plain "user" role account, which defaults to finance: hide
    token = admin_token(client)
    res = client.post('/api/users/',
        data=json.dumps({
            "username": "plainuser",
            "password": "PlainUser@123!",
            "role": "user"
        }),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code in (200, 201), res.data

    login_res = client.post('/api/auth/login',
        data=json.dumps({'username': 'plainuser', 'password': 'PlainUser@123!'}),
        content_type='application/json')
    assert login_res.status_code == 200
    user_token = json.loads(login_res.data)['access_token']

    res = client.post('/api/finance/fees/mark-reminder-sent',
        data=json.dumps({"family_group": "1"}),
        content_type='application/json',
        headers={'Authorization': f'Bearer {user_token}'})
    assert res.status_code == 403


def test_mark_reminder_sent_requires_family_group(client):
    token = admin_token(client)
    res = client.post('/api/finance/fees/mark-reminder-sent',
        data=json.dumps({}),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 400
