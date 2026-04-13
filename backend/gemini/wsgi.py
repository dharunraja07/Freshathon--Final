import os
import sys
from pathlib import Path
from django.core.wsgi import get_wsgi_application

# Add the backend directory to the sys.path to resolve 'accounts'
path = str(Path(__file__).resolve().parent.parent)
if path not in sys.path:
    sys.path.append(path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gemini.settings')
application = get_wsgi_application()
app = application
