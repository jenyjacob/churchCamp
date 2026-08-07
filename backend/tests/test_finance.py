import pytest, json
from app import create_app
from db import db as _db


@pytest.fixture
def app():
    import os, uuid
    db_file = f"test_finance_{uuid.uuid4().hex}.db"

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


def set_tshirt(client, token, camper_id, tshirt_size="Adult M"):
    res = client.put(f'/api/campers/{camper_id}',
        data=json.dumps({"tshirt_size": tshirt_size}),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200, res.data
    return json.loads(res.data)['camper']


def test_apparel_count_and_fee_default_price(client):
    token = admin_token(client)

    # Family 5: two campers, only one orders a t-shirt
    c1 = create_camper(client, token, first_name="Amy", last_name="Adams", family_group="5")
    c2 = create_camper(client, token, first_name="Al", last_name="Adams", family_group="5")
    set_tshirt(client, token, c1["id"], "Adult M")

    res = client.get('/api/finance/fees', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    data = json.loads(res.data)
    families = {f['family_group']: f for f in data['families']}

    fam5 = families['5']
    assert fam5['apparel_count'] == 1
    # Default apparel price is $10.00
    assert fam5['apparel_price'] == 10.0
    assert fam5['apparel_fee'] == 10.0

    # total_expected_fee must include apparel_fee on top of registration + activity fees
    expected_total = fam5['calculated_fee'] + fam5['activity_fee'] + fam5['apparel_fee']
    assert fam5['total_expected_fee'] == expected_total


def test_apparel_fee_uses_custom_price_and_multiple_orders(client):
    token = admin_token(client)

    # Set a custom apparel price via settings
    res = client.post('/api/settings/',
        data=json.dumps({"apparel_price": "25.0"}),
        content_type='application/json',
        headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200, res.data

    c1 = create_camper(client, token, first_name="Nina", last_name="Ng", family_group="6")
    c2 = create_camper(client, token, first_name="Nate", last_name="Ng", family_group="6")
    c3 = create_camper(client, token, first_name="Noa", last_name="Ng", family_group="6")
    set_tshirt(client, token, c1["id"], "Adult M")
    set_tshirt(client, token, c2["id"], "Youth L")
    # c3 orders no t-shirt

    res = client.get('/api/finance/fees', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    families = {f['family_group']: f for f in json.loads(res.data)['families']}

    fam6 = families['6']
    assert fam6['apparel_count'] == 2
    assert fam6['apparel_price'] == 25.0
    assert fam6['apparel_fee'] == 50.0
    assert fam6['total_expected_fee'] == fam6['calculated_fee'] + fam6['activity_fee'] + fam6['apparel_fee']


def test_stats_total_expected_includes_apparel_fee(client):
    token = admin_token(client)

    c1 = create_camper(client, token, first_name="Owen", last_name="Ortiz", family_group="7")
    set_tshirt(client, token, c1["id"], "Adult L")

    fees_res = client.get('/api/finance/fees', headers={'Authorization': f'Bearer {token}'})
    fees_data = json.loads(fees_res.data)

    stats_res = client.get('/api/finance/stats', headers={'Authorization': f'Bearer {token}'})
    assert stats_res.status_code == 200
    stats_data = json.loads(stats_res.data)

    # The overall expected total from /stats should match the summed total from /fees
    assert stats_data['total_expected_fees'] == pytest.approx(fees_data['total_expected_fees'])

    families = {f['family_group']: f for f in fees_data['families']}
    fam7 = families['7']
    assert fam7['apparel_fee'] > 0
