from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.repertoire.models import Setlist, SetlistItem, SetlistPublicLink, Song
from apps.users.models import User


class AudienceRequestsFlowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email="musician@example.com", password="strongpass123")
        self.song = Song.objects.create(user=self.user, title="Wonderwall", artist="Oasis")
        self.setlist = Setlist.objects.create(user=self.user, name="Bar da Sexta")
        SetlistItem.objects.create(setlist=self.setlist, song=self.song, position=1)
        self.public_link = SetlistPublicLink.objects.create(setlist=self.setlist)

        self.private_client = APIClient()
        self.private_client.force_authenticate(user=self.user)
        self.public_client = APIClient()

    def test_public_request_is_visible_in_musician_queue(self):
        public_response = self.public_client.post(
            f"/api/repertoire/public/setlists/{self.public_link.token}/requests/",
            {"song_name": "Wonderwall", "requester_name": "Ana"},
            format="json",
        )
        self.assertEqual(public_response.status_code, 201)

        queue_response = self.private_client.get(f"/api/repertoire/setlists/{self.setlist.id}/requests/")
        self.assertEqual(queue_response.status_code, 200)
        self.assertEqual(queue_response.data["count"], 1)
        self.assertEqual(queue_response.data["items"][0]["song"]["id"], self.song.id)
        self.assertEqual(queue_response.data["items"][0]["requested_song_name"], "Wonderwall")
        self.assertEqual(queue_response.data["items"][0]["requester_name"], "Ana")

    def test_short_rate_limit_blocks_immediate_second_request(self):
        first_response = self.public_client.post(
            f"/api/repertoire/public/setlists/{self.public_link.token}/requests/",
            {"song_name": "Wonderwall"},
            format="json",
        )
        self.assertEqual(first_response.status_code, 201)

        second_response = self.public_client.post(
            f"/api/repertoire/public/setlists/{self.public_link.token}/requests/",
            {"song_name": "Wonderwall"},
            format="json",
        )
        self.assertEqual(second_response.status_code, 429)
