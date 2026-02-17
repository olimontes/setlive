from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Max
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AudienceRequest, Setlist, SetlistItem, SetlistPublicLink, Song
from .serializers import (
    AddSetlistItemSerializer,
    AudienceRequestSerializer,
    PublicAudienceRequestCreateSerializer,
    PublicSetlistSerializer,
    ReorderSetlistSerializer,
    SetlistDetailSerializer,
    SetlistSerializer,
    SongSerializer,
)

SHORT_RATE_WINDOW_SECONDS = 15
LONG_RATE_WINDOW_SECONDS = 10 * 60
LONG_RATE_MAX_REQUESTS = 20


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _ensure_session_key(request):
    if not request.session.session_key:
        request.session.save()
    return request.session.session_key or ""


def _channel_group_for_setlist(setlist_id):
    return f"setlist_requests_{setlist_id}"


def _public_url_for_token(request, token):
    if settings.FRONTEND_PUBLIC_URL:
        return f"{settings.FRONTEND_PUBLIC_URL}/public/{token}"
    return request.build_absolute_uri(f"/public/{token}")


class SongListCreateView(generics.ListCreateAPIView):
    serializer_class = SongSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Song.objects.filter(user=self.request.user).order_by("title", "id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SongDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SongSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Song.objects.filter(user=self.request.user)


class SetlistListCreateView(generics.ListCreateAPIView):
    serializer_class = SetlistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Setlist.objects.filter(user=self.request.user).order_by("-updated_at", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SetlistDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Setlist.objects.filter(user=self.request.user).prefetch_related("items__song")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return SetlistDetailSerializer
        return SetlistSerializer


class SetlistAddItemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, setlist_id):
        setlist = Setlist.objects.filter(user=request.user, id=setlist_id).first()
        if not setlist:
            return Response({"detail": "Repertorio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AddSetlistItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        song_id = serializer.validated_data["song_id"]

        song = Song.objects.filter(id=song_id, user=request.user).first()
        if not song:
            return Response({"detail": "Musica nao encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if SetlistItem.objects.filter(setlist=setlist, song=song).exists():
            return Response({"detail": "Musica ja adicionada no repertorio."}, status=status.HTTP_400_BAD_REQUEST)

        last_position = SetlistItem.objects.filter(setlist=setlist).aggregate(max_pos=Max("position"))["max_pos"] or 0
        item = SetlistItem.objects.create(setlist=setlist, song=song, position=last_position + 1)
        setlist.save(update_fields=["updated_at"])

        return Response(
            {
                "id": item.id,
                "position": item.position,
                "song": SongSerializer(song).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SetlistReorderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, setlist_id):
        setlist = Setlist.objects.filter(user=request.user, id=setlist_id).first()
        if not setlist:
            return Response({"detail": "Repertorio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReorderSetlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_ids = serializer.validated_data["item_ids"]
        items = list(SetlistItem.objects.filter(setlist=setlist).order_by("position", "id"))

        if len(item_ids) != len(items):
            return Response({"detail": "Quantidade de itens invalida para reordenar."}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = {item.id for item in items}
        provided_ids = set(item_ids)

        if existing_ids != provided_ids:
            return Response({"detail": "Lista de itens invalida."}, status=status.HTTP_400_BAD_REQUEST)

        item_map = {item.id: item for item in items}
        with transaction.atomic():
            offset = len(items) + 1000
            for temp_index, item_id in enumerate(item_ids, start=1):
                item = item_map[item_id]
                item.position = offset + temp_index
                item.save(update_fields=["position"])

            for position, item_id in enumerate(item_ids, start=1):
                item = item_map[item_id]
                item.position = position
                item.save(update_fields=["position"])
            setlist.save(update_fields=["updated_at"])

        setlist.refresh_from_db()
        return Response(SetlistDetailSerializer(setlist).data)


class SetlistItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, item_id):
        item = SetlistItem.objects.filter(id=item_id, setlist__user=request.user).select_related("setlist").first()
        if not item:
            return Response({"detail": "Item nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        setlist = item.setlist
        removed_position = item.position

        with transaction.atomic():
            item.delete()
            remaining = SetlistItem.objects.filter(setlist=setlist, position__gt=removed_position).order_by("position", "id")
            for next_item in remaining:
                next_item.position -= 1
                next_item.save(update_fields=["position"])
            setlist.save(update_fields=["updated_at"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class SetlistPublicLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, setlist_id):
        setlist = Setlist.objects.filter(user=request.user, id=setlist_id).first()
        if not setlist:
            return Response({"detail": "Repertorio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        public_link, _ = SetlistPublicLink.objects.get_or_create(setlist=setlist)
        return Response(
            {
                "setlist_id": setlist.id,
                "token": public_link.token,
                "public_url": _public_url_for_token(request, public_link.token),
                "is_active": public_link.is_active,
            }
        )


class SetlistAudienceRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, setlist_id):
        setlist = Setlist.objects.filter(user=request.user, id=setlist_id).first()
        if not setlist:
            return Response({"detail": "Repertorio nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        queue = AudienceRequest.objects.filter(setlist=setlist).select_related("song")
        return Response(
            {
                "setlist_id": setlist.id,
                "count": queue.count(),
                "items": AudienceRequestSerializer(queue, many=True).data,
            }
        )


class PublicSetlistView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        public_link = (
            SetlistPublicLink.objects.filter(token=token, is_active=True)
            .select_related("setlist")
            .first()
        )
        if not public_link:
            return Response({"detail": "Link publico invalido."}, status=status.HTTP_404_NOT_FOUND)

        return Response(PublicSetlistSerializer(public_link.setlist).data)


class PublicAudienceRequestCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        public_link = SetlistPublicLink.objects.filter(token=token, is_active=True).select_related("setlist").first()
        if not public_link:
            return Response({"detail": "Link publico invalido."}, status=status.HTTP_404_NOT_FOUND)

        setlist = public_link.setlist
        serializer = PublicAudienceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_song_name = serializer.validated_data["song_name"].strip()
        requester_name = serializer.validated_data.get("requester_name", "").strip()
        if not requested_song_name:
            return Response({"detail": "Nome da musica e obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

        matched_song = (
            Song.objects.filter(setlist_items__setlist=setlist, title__iexact=requested_song_name)
            .order_by("id")
            .first()
        )

        client_ip = _client_ip(request)
        session_key = _ensure_session_key(request)
        short_key = f"audience:short:{setlist.id}:{client_ip}:{session_key}"
        long_key = f"audience:long:{setlist.id}:{client_ip}:{session_key}"

        if cache.get(short_key):
            return Response(
                {"detail": f"Espere {SHORT_RATE_WINDOW_SECONDS}s antes de enviar novo pedido."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if cache.add(long_key, 1, timeout=LONG_RATE_WINDOW_SECONDS):
            request_count = 1
        else:
            try:
                request_count = cache.incr(long_key)
            except ValueError:
                cache.set(long_key, 1, timeout=LONG_RATE_WINDOW_SECONDS)
                request_count = 1

        if request_count > LONG_RATE_MAX_REQUESTS:
            return Response(
                {"detail": "Limite de pedidos excedido. Tente novamente mais tarde."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        cache.set(short_key, 1, timeout=SHORT_RATE_WINDOW_SECONDS)

        audience_request = AudienceRequest.objects.create(
            setlist=setlist,
            song=matched_song,
            requested_song_name=requested_song_name,
            requester_name=requester_name,
            ip_address=client_ip or None,
            session_key=session_key,
        )

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                _channel_group_for_setlist(setlist.id),
                {
                    "type": "queue.request.created",
                    "setlist_id": setlist.id,
                    "request_id": audience_request.id,
                    "created_at": audience_request.created_at.isoformat(),
                },
            )

        return Response(AudienceRequestSerializer(audience_request).data, status=status.HTTP_201_CREATED)
