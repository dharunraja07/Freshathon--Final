import os
from datetime import datetime
import re

import certifi
import pymongo
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt

# Input validation patterns
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
NAME_PATTERN = re.compile(r'^[a-zA-Z\s\'-]{2,100}$')
PASSWORD_MIN_LENGTH = 6

# Lazy MongoDB connection - only connect when needed
_mongo_client = None
_db = None


def get_db():
    global _mongo_client, _db
    if _db is None:
        try:
            mongo_uri = settings.MONGO_URI
            if not mongo_uri or mongo_uri == 'mongodb://127.0.0.1:27017':
                raise Exception(
                    'MONGO_URI environment variable not set. Please configure MongoDB connection in Vercel environment variables.')

            _mongo_client = pymongo.MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,
                tlsCAFile=certifi.where()
            )
            _db = _mongo_client[os.environ.get("MONGO_DB_NAME", "gemini_db")]
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            raise
    return _db


def get_users_collection():
    return get_db()['users']


def get_projects_collection():
    return get_db()['projects']


def get_messages_collection():
    return get_db()['messages']


# --- INPUT VALIDATION ---
def validate_email(email):
    """Validate email format"""
    if not email or len(email) > 255:
        return False
    return EMAIL_PATTERN.match(email.lower()) is not None


def validate_name(name):
    """Validate name format"""
    if not name or len(name) < 2 or len(name) > 100:
        return False
    return NAME_PATTERN.match(name) is not None


def validate_password(password):
    """Validate password strength"""
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        return False
    return True


def validate_role(role):
    """Validate user role"""
    return role in ('student', 'donor', 'admin')


def validate_project_title(title):
    """Validate project title"""
    if not title or len(title) < 3 or len(title) > 200:
        return False
    return True


def validate_project_desc(desc):
    """Validate project description"""
    if not desc or len(desc) < 10 or len(desc) > 5000:
        return False
    return True


def validate_project_sector(sector):
    """Validate project sector"""
    valid_sectors=['technology', 'healthcare',
                     'education', 'agriculture', 'environment', 'other']
    return sector.lower() in valid_sectors


def validate_amount(amount):
    """Validate funding amount"""
    try:
        amount=float(amount)
        return amount > 0 and amount < 10000000  # Max 10M
    except:
        return False


def index(request):
    return render(request, 'index.html')


def api_config(request):
    """Return frontend configuration (API keys, settings, etc)"""
    config={
        'google_api_key': os.environ.get('GOOGLE_API_KEY', ''),
        'google_image_search_cx': os.environ.get('GOOGLE_IMAGE_SEARCH_CX', ''),
    }
    return JsonResponse(config)


def login_page(request):
    return render(request, 'login.html')


def register_page(request):
    return render(request, 'register.html')


def student_dashboard(request):
    if not request.session.get('user'):
        return redirect('login')
    return render(request, 'student_dashboard.html')


def donor_dashboard(request):
    if not request.session.get('user'):
        return redirect('login')
    return render(request, 'donor_dashboard.html')


@ csrf_exempt
def api_register(request):
    try:
        if request.method != 'POST':
            return JsonResponse({'error': 'Method not allowed'}, status=405)

        data=request.POST or request.body and request.POST
        if not data:
            try:
                import json
                data=json.loads(request.body.decode('utf-8'))
            except Exception:
                data={}

        name=data.get('name', '').strip()
        email=data.get('email', '').strip().lower()
        password=data.get('password', '')
        role=data.get('role', '').strip().lower()

        # Validate inputs
        if not validate_name(name):
            return JsonResponse({'error': 'Invalid name (2-100 characters, letters/spaces only)'}, status=400)

        if not validate_email(email):
            return JsonResponse({'error': 'Invalid email format'}, status=400)

        if not validate_password(password):
            return JsonResponse({'error': f'Password must be at least {PASSWORD_MIN_LENGTH} characters'}, status=400)

        if not validate_role(role) or role == 'admin':
            return JsonResponse({'error': 'Invalid role. Must be student or donor'}, status=400)

        existing=get_users_collection().find_one({'email': email})
        if existing:
            return JsonResponse({'error': 'Email already registered'}, status=400)

        hashed_password=make_password(password)
        get_users_collection().insert_one({
            'name': name,
            'email': email,
            'password': hashed_password,
            'role': role,
            'created_at': datetime.utcnow(),
        })
        return JsonResponse({'success': True})
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return JsonResponse({'error': f'Server error: {str(e)[:100]}'}, status=500)


@ csrf_exempt
def api_login(request):
    try:
        if request.method != 'POST':
            return JsonResponse({'error': 'Method not allowed'}, status=405)

        try:
            import json
            data=json.loads(request.body.decode('utf-8'))
        except Exception:
            data=request.POST or {}

        email=data.get('email', '').strip().lower()
        password=data.get('password', '')

        if not email or not password:
            return JsonResponse({'error': 'Missing credentials'}, status=400)

        user=get_users_collection().find_one({'email': email})
        if not user or not check_password(password, user.get('password', '')):
            return JsonResponse({'error': 'Invalid email or password'}, status=401)

        request.session['user']={
            'name': user.get('name'),
            'email': user.get('email'),
            'role': user.get('role'),
        }
        return JsonResponse({'success': True, 'user': request.session['user']})
    except Exception as e:
        print(f"Login error: {str(e)}")
        return JsonResponse({'error': f'Server error: {str(e)[:100]}'}, status=500)


@ csrf_exempt
def api_logout(request):
    request.session.flush()
    return JsonResponse({'success': True})


def api_me(request):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    return JsonResponse({'user': user})


def admin_dashboard(request):
    user=request.session.get('user')
    if not user or user.get('role') != 'admin':
        return redirect('login')
    return render(request, 'admin.html')


@ csrf_exempt
def api_users(request):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method == 'GET':
        # Fetch all users (only name and email for non-admins, full details for admins)
        if user.get('role') == 'admin':
            users=list(get_users_collection().find(
                {}, {'_id': 0, 'password': 0}))
        else:
            users=list(get_users_collection().find(
                {}, {'_id': 0, 'name': 1, 'email': 1}))
        return JsonResponse({'users': users})

    # Restrict modifying actions to admin only
    if user.get('role') != 'admin':
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    elif request.method == 'DELETE':
        # Delete user
        try:
            import json
            data=json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid request'}, status=400)

        email=data.get('email')
        if not email:
            return JsonResponse({'error': 'Email required'}, status=400)

        # Admin can't delete themselves
        if email == user.get('email'):
            return JsonResponse({'error': 'Cannot delete yourself'}, status=400)

        get_users_collection().delete_one({'email': email})
        return JsonResponse({'success': True})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@ csrf_exempt
def api_users_promote(request):
    user=request.session.get('user')
    if not user or user.get('role') != 'admin':
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        import json
        data=json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid request'}, status=400)

    email=data.get('email')
    if not email:
        return JsonResponse({'error': 'Email required'}, status=400)

    get_users_collection().update_one(
        {'email': email},
        {'$set': {'role': 'admin'}}
    )
    return JsonResponse({'success': True})


@ csrf_exempt
def api_projects(request):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method == 'GET':
        projects=list(get_projects_collection().find({}, {'_id': 0}))
        projects.sort(key=lambda x: x.get('id', 0), reverse=True)
        return JsonResponse({'projects': projects})

    elif request.method == 'POST':
        try:
            import json
            data=json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid request'}, status=400)

        title=data.get('title', '').strip()
        desc=data.get('desc', '').strip()
        sector=data.get('sector', '').strip()
        needed=data.get('needed', 0)
        imageUrl=data.get('imageUrl', '').strip()

        # Validate project data
        if not validate_project_title(title):
            return JsonResponse({'error': 'Title must be 3-200 characters'}, status=400)

        if not validate_project_desc(desc):
            return JsonResponse({'error': 'Description must be 10-5000 characters'}, status=400)

        if not validate_project_sector(sector):
            return JsonResponse({'error': 'Invalid sector'}, status=400)

        if not validate_amount(needed):
            return JsonResponse({'error': 'Invalid funding amount (0 - 10,000,000)'}, status=400)

        import time
        project_id=int(time.time() * 1000)

        new_project={
            'id': project_id,
            'title': title,
            'desc': desc,
            'sector': sector.lower(),
            'needed': float(needed),
            'raised': 0,
            'author': user.get('email'),
            'fundedBy': [],
            'imageUrl': imageUrl
        }

        get_projects_collection().insert_one(new_project)
        new_project.pop('_id', None)
        return JsonResponse({'success': True, 'project': new_project})


@ csrf_exempt
def api_project_delete(request, project_id):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        project_id=int(project_id)
    except Exception:
        return JsonResponse({'error': 'Invalid project id'}, status=400)

    project=get_projects_collection().find_one({'id': project_id})
    if not project:
        return JsonResponse({'error': 'Project not found'}, status=404)

    if project.get('author') != user.get('email') and user.get('role') != 'admin':
        return JsonResponse({'error': 'Forbidden'}, status=403)

    get_projects_collection().delete_one({'id': project_id})
    return JsonResponse({'success': True})


@ csrf_exempt
def api_project_fund(request, project_id):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        project_id=int(project_id)
        import json
        data=json.loads(request.body.decode('utf-8'))
        amount=float(data.get('amount', 0))
    except Exception:
        return JsonResponse({'error': 'Invalid request data'}, status=400)

    if amount <= 0:
        return JsonResponse({'error': 'Invalid amount'}, status=400)

    project=get_projects_collection().find_one({'id': project_id})
    if not project:
        return JsonResponse({'error': 'Project not found'}, status=404)

    get_projects_collection().update_one(
        {'id': project_id},
        {
            '$inc': {'raised': amount},
            '$push': {'fundedBy': {'donorName': user.get('name'), 'amount': amount}}
        }
    )

    return JsonResponse({'success': True})


@ csrf_exempt
def api_messages(request):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method == 'GET':
        email=user.get('email')
        query={'$or': [{'from': email}, {'to': email}]}
        messages=list(get_messages_collection().find(query, {'_id': 0}))
        # Sort by timestamp
        messages.sort(key=lambda x: x.get('timestamp', ''))
        return JsonResponse({'messages': messages})

    elif request.method == 'POST':
        try:
            import json
            data=json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid request'}, status=400)

        import time
        from datetime import datetime
        to_email=data.get('to')
        text=data.get('text', '')

        if not to_email or not text:
            return JsonResponse({'error': 'Missing to or text fields'}, status=400)

        new_message={
            'id': int(time.time() * 1000),
            'from': user.get('email'),
            'to': to_email,
            'text': text,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'read': False
        }

        get_messages_collection().insert_one(new_message)
        new_message.pop('_id', None)
        return JsonResponse({'success': True, 'message': new_message})


@ csrf_exempt
def api_messages_read(request):
    user=request.session.get('user')
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        import json
        data=json.loads(request.body.decode('utf-8'))
        contact_email=data.get('contactEmail')
    except Exception:
        return JsonResponse({'error': 'Invalid request data'}, status=400)

    if not contact_email:
        return JsonResponse({'error': 'Contact email required'}, status=400)

    # Mark messages sent TO me FROM contactEmail as read
    get_messages_collection().update_many(
        {'to': user.get('email'), 'from': contact_email, 'read': False},
        {'$set': {'read': True}}
    )

    return JsonResponse({'success': True})
