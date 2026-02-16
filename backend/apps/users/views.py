from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    get_tokens_for_user,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': get_tokens_for_user(user),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': get_tokens_for_user(user),
            }
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'user': UserSerializer(request.user).data})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
