from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_login_me_refresh_logout_flow(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "email": "artist@example.com",
                "password": "strongpass123",
                "first_name": "Art",
                "last_name": "Ista",
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", register_response.data)
        self.assertEqual(User.objects.count(), 1)

        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "artist@example.com", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        access = login_response.data["tokens"]["access"]
        refresh = login_response.data["tokens"]["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        me_response = self.client.get("/api/auth/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["user"]["email"], "artist@example.com")

        refresh_response = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)

        logout_response = self.client.post("/api/auth/logout/")
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_invalid_login_rejected_and_me_requires_token(self):
        User.objects.create_user(email="artist@example.com", password="strongpass123")

        invalid_login = self.client.post(
            "/api/auth/login/",
            {"email": "artist@example.com", "password": "wrongpass"},
            format="json",
        )
        self.assertEqual(invalid_login.status_code, status.HTTP_400_BAD_REQUEST)

        me_unauthorized = self.client.get("/api/auth/me/")
        self.assertEqual(me_unauthorized.status_code, status.HTTP_401_UNAUTHORIZED)


class ObservabilityMiddlewareTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_response_contains_observability_headers(self):
        response = self.client.post(
            "/api/auth/register/",
            {"email": "metrics@example.com", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("X-Request-Id", response)
        self.assertIn("X-Response-Time-ms", response)
