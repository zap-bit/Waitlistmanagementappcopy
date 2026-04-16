from __future__ import annotations
from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

class SupabaseStore:
    def __init__(self, client: Client):
        self.client = client
    
    @property
    def table(self):
        return self.client.table

store = SupabaseStore(supabase)
