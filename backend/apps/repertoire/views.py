from django.db import transaction
from django.db.models import Max
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Setlist, SetlistItem, Song
from .serializers import (
    AddSetlistItemSerializer,
    ReorderSetlistSerializer,
    SetlistDetailSerializer,
    SetlistSerializer,
    SongSerializer,
)


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
