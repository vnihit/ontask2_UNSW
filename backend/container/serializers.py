from rest_framework import serializers
from rest_framework_mongoengine.serializers import (
    DocumentSerializer,
    EmbeddedDocumentSerializer,
)

from .models import Container
from datasource.models import Datasource
from datalab.models import Datalab
from action.models import Action


class EmbeddedDatasourceSerializer(EmbeddedDocumentSerializer):
    class Meta:
        model = Datasource
        fields = ["id", "name", "connection", "schedule", "lastUpdated"]


class EmbeddedDatalabSerializer(EmbeddedDocumentSerializer):
    class Meta:
        model = Datalab
        fields = ["id", "name", "steps"]


class EmbeddedActionSerializer(EmbeddedDocumentSerializer):
    datalab = serializers.CharField()

    class Meta:
        model = Action
        fields = ["id", "name", "description", "datalab"]


class ContainerSerializer(DocumentSerializer):
    datasources = EmbeddedDatasourceSerializer(
        many=True, allow_null=True, read_only=True
    )
    datalabs = EmbeddedDatalabSerializer(many=True, allow_null=True, read_only=True)
    actions = EmbeddedActionSerializer(many=True, allow_null=True, read_only=True)

    class Meta:
        model = Container
        fields = "__all__"
