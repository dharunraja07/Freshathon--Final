import os
import pymongo
import dotenv
from pathlib import Path

dotenv.load_dotenv(Path(__file__).resolve().parent / ".env")

try:
    mongo_uri = os.environ.get("MONGO_URI")
    db_name = os.environ.get("MONGO_DB_NAME", "gemini_db")
    print(f"Attempting to connect to: {mongo_uri}")
    
    import certifi
    # Establish connection and immediately check for status
    client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
    client.server_info() # This forces a connection, triggering timeout exception if it fails
    
    db = client[db_name]
    coll = db['users']
    count = coll.count_documents({})
    
    print("SUCCESS: Connection to MongoDB Atlas established flawlessly!")
    print(f"Found {count} users in the database.")
except pymongo.errors.ServerSelectionTimeoutError as err:
    print("ERROR: Connection timed out. This means Atlas is blocking your IP address or the URL is bad.")
except pymongo.errors.OperationFailure as err:
    print("ERROR: Authentication failed. Is the password correct?")
except Exception as e:
    print(f"ERROR: {e}")
