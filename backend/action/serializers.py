from rest_framework import serializers
from rest_framework_mongoengine.serializers import DocumentSerializer

from .models import Action


class ActionSerializer(DocumentSerializer):
    data = serializers.ReadOnlyField()
    options = serializers.ReadOnlyField()

    class Meta:
        model = Action
        fields = "__all__"
