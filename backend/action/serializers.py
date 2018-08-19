from rest_framework import serializers
from rest_framework_mongoengine.serializers import DocumentSerializer

from .models import Action
from .validators import validate_filter, validate_condition_groups, validate_content

from datasource.models import Datasource
from datasource.serializers import DatasourceSerializer
from datalab.models import Datalab

class DatalabSerializer(DocumentSerializer):
    class Meta:
        model = Datalab
        fields = ["id", "order", "steps"]
        
class ActionSerializer(DocumentSerializer):
    datasources = serializers.SerializerMethodField()
    filtered_data = serializers.ReadOnlyField()
    unfiltered_data_length = serializers.ReadOnlyField()

    class Meta:
        model = Action
        fields = "__all__"
        depth = 2

    def get_datasources(self, action):
        datasources = Datasource.objects(container=action["container"].id).only(
            "id", "name", "fields"
        )
        datasources = [
            DatasourceSerializer(instance=datasource).data for datasource in datasources
        ]
        return datasources

    def validate(self, payload):
        action = self.instance

        if "filter" in payload:
            validate_filter(action, payload["filter"])

        if "condition_groups" in payload:
            validate_condition_groups(action, payload["condition_groups"])

        if "content" in payload:
            validate_content(action, payload["content"])

        return payload
