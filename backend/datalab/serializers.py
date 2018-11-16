from rest_framework import serializers
from rest_framework_mongoengine.serializers import (
    DocumentSerializer,
    EmbeddedDocumentSerializer,
)

from .models import Datalab
from datasource.models import Datasource
from action.models import Action, EmailJob, Email


class EmailSerializer(EmbeddedDocumentSerializer):
    class Meta:
        model = Email
        exclude = ["content"]


class EmailJobSerializer(EmbeddedDocumentSerializer):
    emails = EmailSerializer(many=True, allow_null=True, read_only=True)

    class Meta:
        model = EmailJob
        fields = "__all__"


class ActionSerializer(DocumentSerializer):
    emailJobs = EmailJobSerializer(many=True, allow_null=True, read_only=True)
    emailField = serializers.SerializerMethodField()

    class Meta:
        model = Action
        fields = ["id", "name", "emailJobs", "emailField"]

    def get_emailField(self, action):
        if "emailSettings" in action:
            return action.emailSettings.field

        return None


class DatasourceSerializer(DocumentSerializer):
    class Meta:
        model = Datasource
        fields = ["id", "name", "fields"]


class DatalabSerializer(DocumentSerializer):
    datasources = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    def get_datasources(self, datalab):
        datasources = Datasource.objects(container=datalab["container"].id)
        serializer = DatasourceSerializer(datasources, many=True)
        return serializer.data

    def get_actions(self, datalab):
        actions = Action.objects(datalab=datalab.id)
        serializer = ActionSerializer(actions, many=True)
        return serializer.data

    class Meta:
        model = Datalab
        fields = "__all__"
