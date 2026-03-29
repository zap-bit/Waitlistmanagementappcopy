import os
from supabase import create_client, Client
from dotenv import load_dotenv
import hashlib
import time
import uuid  # Add this import at the top of the file

# Load environment variables from .env file
load_dotenv()

# Load environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase URL or API Key in environment variables.")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_user_account(name, email, pswd, phone):
    hashed_password = hash_password(pswd)
    data = {
        "name": name,
        "account_type": "USER",
        "email": email,
        "password": hashed_password,
        "phone": phone,
        "business_name": None  # USER accounts do not have a business name
    }
    response = supabase.table("account").insert(data).execute()
    return response

def create_bus_account(name, email, pswd, b_name, phone):
    hashed_password = hash_password(pswd)
    data = {
        "name": name,
        "account_type": "BUSINESS",
        "email": email,
        "password": hashed_password,
        "phone": phone,
        "business_name": b_name  # BUSINESS accounts require a business name
    }
    response = supabase.table("account").insert(data).execute()
    return response

def generate_unique_code():
    """
    Generates a unique alphanumeric code.
    """
    return uuid.uuid4().hex[:8]  # Generates an 8-character alphanumeric code

def create_capacity_event(account_uuid, name, location, cap_type, queue_capacity, est_wait, event_time):
    """
    Creates a CAPACITY type event in the EVENTS table on Supabase.

    If cap_type is "SINGLE", it also creates a queue for the event.

    Parameters:
        account_uuid (str): The UUID of the account.
        name (str): The name of the event.
        location (str): The location of the event.
        cap_type (str): The capacity type of the event.
        queue_capacity (int): The capacity of the queue.
        est_wait (int): The estimated wait time for the queue.
        event_time (str): The timestamp of the event.

    Returns:
        dict: The response from the Supabase database for the event creation.
    """
    unique_code = generate_unique_code()  # Generate a unique code
    data = {
        "account_uuid": account_uuid,
        "name": name,
        "event_type": "CAPACITY",
        "location": location,
        "cap_type": cap_type,
        "event_time": event_time,
        "code": unique_code,  # Add the unique code
        "archived": False  # Default value for archived
    }
    event_response = supabase.table("events").insert(data).execute()

    # Ensure the response contains data
    if not event_response.data or len(event_response.data) == 0:
        raise ValueError("Failed to create event or retrieve event UUID.")

    # Extract the event UUID
    event_uuid = event_response.data[0]["uuid"]

    # If cap_type is SINGLE, create a queue
    if cap_type == "SINGLE":
        create_queue(event_uuid, est_wait, queue_capacity)

    if cap_type == "MULTI":
        # Loop through est_wait and queue_capacity lists
        for i in range(len(queue_capacity)):
            create_queue(event_uuid, est_wait[i], queue_capacity[i])

    return event_response

def create_table(event_uuid, table_name, table_capacity):
    """
    Creates a table entry in the Supabase database.

    Parameters:
        event_uuid (str): The UUID of the event the table belongs to.
        table_name (str): The name of the table.
        size (int): The size of the table.

    Returns:
        dict: The response from the Supabase database.
    """
    data = {
        "event_uuid": event_uuid,
        "name": table_name,
        "table_capacity": table_capacity
    }
    response = supabase.table("event_table").insert(data).execute()
    return response

def create_table_event(account_uuid, name, num_tables, avg_size, reservation_duration, no_show_policy, event_time):
    """
    Creates a TABLE type event in the EVENTS table on Supabase and generates table entries.

    Parameters:
        account_uuid (str): The UUID of the account.
        name (str): The name of the event.
        num_tables (int): The number of tables to create.
        avg_size (int): The average size of each table.
        reservation_duration (int): The duration of reservations for the tables.
        no_show_policy (str): The policy for no-shows.
        event_time (str): The timestamp of the event.

    Returns:
        dict: The response from the Supabase database for the event creation.
    """
    unique_code = generate_unique_code()  # Generate a unique code
    data = {
        "account_uuid": account_uuid,
        "name": name,
        "event_type": "TABLE",
        "reservation_duration": reservation_duration,
        "no_show_policy": no_show_policy,
        "event_time": event_time,
        "code": unique_code,  # Add the unique code
        "archived": False  # Default value for archived
    }
    event_response = supabase.table("events").insert(data).execute()

    # Ensure the response contains data
    if not event_response.data or not isinstance(event_response.data, list) or len(event_response.data) == 0:
        raise ValueError("Failed to create event or retrieve event UUID.")

    # Extract the event UUID
    event_uuid = event_response.data[0].get("uuid")
    if not event_uuid:
        raise ValueError("Event UUID not found in the response.")

    # Create table entries
    for i in range(1, num_tables + 1):
        create_table(event_uuid, f"Table{i}", avg_size)

    return event_response

def create_party(account_uuid, event_uuid, party_size, special_req=None):
    """
    Creates a party entry in the Supabase database and generates attendance entries for the party.

    Parameters:
        account_uuid (str): The UUID of the account.
        event_uuid (str): The UUID of the event.
        party_size (int): The size of the party.
        special_req (str, optional): Any special requests for the party.

    Returns:
        dict: The response from the Supabase database for the party creation.
    """
    # Check if the event is archived
    event_check = supabase.table("events").select("archived").eq("uuid", event_uuid).execute()
    if not event_check.data:
        raise ValueError("Event not found for the given UUID.")
    if event_check.data[0]["archived"]:
        raise ValueError("Cannot create a party for an archived event.")

    # Check if a party already exists for the given account_uuid and event_uuid
    existing_party_response = supabase.table("party").select("uuid").eq("account_uuid", account_uuid).eq("event_uuid", event_uuid).execute()
    if existing_party_response.data and len(existing_party_response.data) > 0:
        # KYLE TODO: tell user that they have already made a party, and then they can decide to replace it or not?
        print("Debug: Party already exists for the given account_uuid and event_uuid.")
        return None

    # Fetch the name associated with the account_uuid
    account_response = supabase.table("account").select("name").eq("uuid", account_uuid).execute()
    if not account_response.data or len(account_response.data) == 0:
        raise ValueError("Account not found for the given UUID.")

    party_leader_name = account_response.data[0]["name"]

    data = {
        "account_uuid": account_uuid,
        "event_uuid": event_uuid,
        "party_size": party_size,
        "special_req": special_req
    }
    party_response = supabase.table("party").insert(data).execute()

    # Create attendance entries
    create_attendance(True, account_uuid, event_uuid, party_leader_name, False)  # Use the fetched name for the party leader
    for i in range(1, party_size):
        create_attendance(False, account_uuid, event_uuid, f"Guest{i}", False)

    return party_response

def create_party_with_code(account_uuid, event_code, party_size, special_req=None):
    """
    Creates a party entry in the Supabase database and generates attendance entries for the party,
    using the event code to find the event.

    Parameters:
        account_uuid (str): The UUID of the account.
        event_code (str): The code of the event to join.
        party_size (int): The size of the party.
        special_req (str, optional): Any special requests for the party.

    Returns:
        dict: The response from the Supabase database for the party creation.
    """
    # Find the event by its code
    event_check = supabase.table("events").select("uuid", "archived").eq("code", event_code).execute()
    if not event_check.data:
        raise ValueError("Event not found for the given code.")

    event_data = event_check.data[0]
    event_uuid = event_data["uuid"]

    if event_data["archived"]:
        raise ValueError("Cannot create a party for an archived event.")

    # Check if a party already exists for the given account_uuid and event_uuid
    existing_party_response = supabase.table("party").select("uuid").eq("account_uuid", account_uuid).eq("event_uuid", event_uuid).execute()
    if existing_party_response.data and len(existing_party_response.data) > 0:
        # KYLE TODO: tell user that they have already made a party, and then they can decide to replace it or not?
        print("Debug: Party already exists for the given account_uuid and event_uuid.")
        return None

    # Fetch the name associated with the account_uuid
    account_response = supabase.table("account").select("name").eq("uuid", account_uuid).execute()
    if not account_response.data or len(account_response.data) == 0:
        raise ValueError("Account not found for the given UUID.")

    party_leader_name = account_response.data[0]["name"]

    data = {
        "account_uuid": account_uuid,
        "event_uuid": event_uuid,
        "party_size": party_size,
        "special_req": special_req
    }
    party_response = supabase.table("party").insert(data).execute()

    # Create attendance entries
    create_attendance(True, account_uuid, event_uuid, party_leader_name, False)  # Use the fetched name for the party leader
    for i in range(1, party_size):
        create_attendance(False, account_uuid, event_uuid, f"Guest{i}", False)

    return party_response

def create_attendance(party_leader, account_uuid, event_uuid, name, present=False):
    """
    Creates an attendance entry in the Supabase database.
    """
    data = {
        "party_leader": party_leader,
        "account_uuid": account_uuid,
        "event_uuid": event_uuid,
        "name": name,
        "present": present
    }
    response = supabase.table("attendance").insert(data).execute()
    return response

def assign_user_to_table(table_uuid, account_uuid):
    """
    Assigns a user to a table by updating the table entry in the Supabase database.

    Parameters:
        table_uuid (str): The UUID of the table to assign the user to.
        account_uuid (str): The UUID of the user to assign to the table.

    Returns:
        dict: The response from the Supabase database.
    """
    # Get the current timestamp
    current_time = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    data = {
        "account_uuid": account_uuid,
        "last_sat_at": current_time  # Add the current timestamp
    }
    response = supabase.table("event_table").update(data).eq("uuid", table_uuid).execute()
    return response

def unassign_user_from_table(table_uuid):
    """
    Unassigns a user from a table by updating the table entry in the Supabase database.

    Parameters:
        table_uuid (str): The UUID of the table to unassign the user from.

    Returns:
        dict: The response from the Supabase database.
    """
    # Get the current timestamp
    current_time = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    data = {
        "account_uuid": None,  # Set account_uuid to null
        "last_unsat_at": current_time  # Add the current timestamp
    }
    response = supabase.table("event_table").update(data).eq("uuid", table_uuid).execute()
    return response

def create_queue(event_uuid, est_wait, queue_capacity):
    """
    Creates a queue entry in the Supabase database.

    Parameters:
        account_uuid (str): The UUID of the account.
        event_uuid (str): The UUID of the event.
        est_wait (int): The estimated wait time for the queue.
        queue_capacity (int): The capacity of the queue.

    Returns:
        dict: The response from the Supabase database.
    """
    data = {
        "event_uuid": event_uuid,
        "est_wait": est_wait,
        "queue_capacity": queue_capacity
    }
    response = supabase.table("queue").insert(data).execute()
    return response

def set_table_capacity(table_uuid, new_capacity):
    """
    Updates the capacity of a table in the Supabase database.

    Parameters:
        table_uuid (str): The UUID of the table to update.
        new_capacity (int): The new capacity to set for the table.

    Returns:
        dict: The response from the Supabase database.
    """
    # Check if the table exists
    existing_table_response = supabase.table("event_table").select("uuid").eq("uuid", table_uuid).execute()
    print("Debug: existing_table_response:", existing_table_response)
    if not existing_table_response.data or len(existing_table_response.data) == 0:
        raise ValueError("Table not found for the given UUID.")

    # Update the table capacity
    data = {
        "table_capacity": new_capacity
    }
    response = supabase.table("event_table").update(data).eq("uuid", table_uuid).execute()
    return response

def set_table_name(table_uuid, new_name):
    """
    Updates the name of a table in the database.

    Parameters:
        table_uuid (str): The UUID of the table to update.
        new_name (str): The new name for the table.

    Returns:
        dict: The response from the Supabase API.
    """
    # Check if the table exists
    existing_table_response = supabase.table("event_table").select("uuid").eq("uuid", table_uuid).execute()
    if not existing_table_response.data or len(existing_table_response.data) == 0:
        raise ValueError("Table not found for the given UUID.")

    # Update the table capacity
    data = {
        "name": new_name
    }
    response = supabase.table("event_table").update(data).eq("uuid", table_uuid).execute()
    return response

def mark_attendance_present(attendance_uuid):
    """
    Marks someone as present in the attendance table given an attendance UUID.

    Parameters:
        attendance_uuid (str): The UUID of the attendance record to update.

    Returns:
        dict: The response from the Supabase API.
    """
    # Ensure the attendance record exists
    attendance_check = supabase.table("attendance").select("uuid").eq("uuid", attendance_uuid).execute()
    if not attendance_check.data:
        return {"error": "Attendance record with the given UUID does not exist."}

    # Update the attendance record to mark as present
    update_response = supabase.table("attendance").update({"present": True}).eq("uuid", attendance_uuid).execute()
    return update_response

def toggle_event_public(event_uuid):
    """
    Toggles the 'public' boolean field for a given event_uuid in the events table.

    Parameters:
        event_uuid (str): The UUID of the event to toggle.

    Returns:
        dict: The response from the Supabase API.
    """
    # Check if the event exists
    event_check = supabase.table("events").select("public").eq("uuid", event_uuid).execute()
    if not event_check.data:
        return {"error": "Event with the given UUID does not exist."}

    # Get the current value of 'public'
    current_public = event_check.data[0]["public"]

    # Toggle the value
    new_public = not current_public

    # Update the event
    update_response = supabase.table("events").update({"public": new_public}).eq("uuid", event_uuid).execute()
    return update_response

def toggle_event_archive(event_uuid):
    """
    Toggles the 'archive' boolean field for a given event_uuid in the events table.

    Parameters:
        event_uuid (str): The UUID of the event to toggle.

    Returns:
        dict: The response from the Supabase API.
    """
    # Check if the event exists
    event_check = supabase.table("events").select("archived").eq("uuid", event_uuid).execute()
    if not event_check.data:
        return {"error": "Event with the given UUID does not exist."}

    # Get the current value of 'archive'
    current_archive = event_check.data[0]["archived"]

    # Toggle the value
    new_archive = not current_archive

    # Update the event
    update_response = supabase.table("events").update({"archived": new_archive}).eq("uuid", event_uuid).execute()
    return update_response

def login(email, password):
    """
    Authenticates a user by checking their email and password against the account table.

    Parameters:
        email (str): The email of the account.
        password (str): The password of the account.

    Returns:
        bool: True if authentication is successful, False otherwise.
    """
    # Hash the provided password
    hashed_password = hash_password(password)

    # Query the account table for a matching email and password
    account_response = supabase.table("account").select("uuid").eq("email", email).eq("password", hashed_password).execute()

    if not account_response.data or len(account_response.data) == 0:
        return False

    return True

# Example usage
if __name__ == "__main__":
    
    print("testing backend/databse connection -Kyle")

    """
    for testing purposes:
    USER_UUID = dbe6ea8a-3ac5-454b-ad2d-baf4c971f68e (Bob)
    BUSS_UUID = eb30833a-45e7-4fa8-9f82-24aa2a292f49 (Joe)

    TABL_UUID = 3f1ec332-d5ac-4cfb-b7a6-cc75abe889f4 (chow down)
    CAPY_UUID = ff445652-ed9f-4e32-8230-6a0b35e405cc (buffet)
    """

    # if commented out, that means it was already tested and added to the supabase DB

    """CREATING ACCOUNTS"""
    # create_user_account("Bob", "bob@gmail.com", "password123", 1112223333)
    # create_bus_account("Joe", "joesfood@company.com", "joeshack", "joes food", 1234567890)
    # create_user_account("Sir. Toby III", "Toby3@gmail.com", "royalToby", 2136547098)
    # create_bus_account("Jimmy", "hotdogJim@work.com", "jimdog", "JimmyDogs", 9087673554)

    """CREATING EVENTS"""
    """
    added event_time to the end of these calls now
    "2026-03-28T15:00:00Z" <-- time will be the start time of event
    (year-month-day)T(time)Z <-- that is the format for it

    when creating a MULTI QUEUE event make sure that the queue info is in lists for "est_wait" and "queue_capacity"
    the ammount of indexes in the list will be the ammount of queues
    """
    # create_capacity_event("eb30833a-45e7-4fa8-9f82-24aa2a292f49", "buffet", "plaza", "SINGLE", 10, 30)
    # create_table_event("eb30833a-45e7-4fa8-9f82-24aa2a292f49", "chow down", 5, 4, 30, 20)
    # create_table_event("eb30833a-45e7-4fa8-9f82-24aa2a292f49", "nom nom time", 6, 5, 30, 20)
    # create_capacity_event("eb30833a-45e7-4fa8-9f82-24aa2a292f49", "cap cap", "mall", "SINGLE", 10, 30)
    
    #create_capacity_event("eb30833a-45e7-4fa8-9f82-24aa2a292f49", "multiCope", "the spot", "MULTI", [10, 12, 15], [40, 20, 50], "2026-03-28T15:00:00Z")

    """CREATING PARTY"""
    # create_party("dbe6ea8a-3ac5-454b-ad2d-baf4c971f68e", "ff445652-ed9f-4e32-8230-6a0b35e405cc", 4)
    # create_party("dbe6ea8a-3ac5-454b-ad2d-baf4c971f68e", "3f1ec332-d5ac-4cfb-b7a6-cc75abe889f4", 2, "Vegan")

    """ASSIGNING USER TO TABLE"""
    # assign_user_to_table("75462301-d82d-4f1a-b11c-c615bd3f9394", "832f9b71-ddd1-4ef2-9f7a-8169e582f62b")

    """UNASSIGNING USER TO TABLE"""
    # unassign_user_from_table("75462301-d82d-4f1a-b11c-c615bd3f9394")

    """UPDATE TABLE"""
    # set_table_capacity("75462301-d82d-4f1a-b11c-c615bd3f9394", 8)
    # set_table_name("37f4a03b-c780-4d99-908b-9dd60ff591eb", "4th Table")

    """MARK PRESENT"""
    # mark_attendance_present("721a8de3-a737-47c3-b74b-c63660d6118f")

    """PUBLIC/PRIVATE and ARCHIVE EVENT"""
    # toggle_event_public("c539b519-ac81-4691-9816-26c271c8cec0")
    # toggle_event_archive("ff445652-ed9f-4e32-8230-6a0b35e405cc")
    # create_party("dbe6ea8a-3ac5-454b-ad2d-baf4c971f68e", "ff445652-ed9f-4e32-8230-6a0b35e405cc", 4)

    """LOGIN"""
    # print(login("Toby3@gmail.com", "royalToby")) # this is accurate
    # print(login("hotdogJim@work.com", "Jimdog")) # this is wrong, real password is "jimdog"

    """CODE BASED JOINING"""
    # create_party_with_code("832f9b71-ddd1-4ef2-9f7a-8169e582f62b", "258949b9", 10, "no requests from me! :) (idk i was bored so now this is here -Kyle)")