from django.http import JsonResponse
from mongoengine.queryset.visitor import Q
from rest_framework_mongoengine import viewsets
from rest_framework_mongoengine.validators import ValidationError
from rest_framework.decorators import detail_route, list_route
from rest_framework.permissions import IsAuthenticated

from .serializers import ContainerSerializer
from .models import Container
from .permissions import ContainerPermissions

from datasource.models import Datasource
from datalab.models import Datalab
from datasource.serializers import DatasourceSerializer
from audit.serializers import AuditSerializer


class ContainerViewSet(viewsets.ModelViewSet):
    lookup_field = "id"
    serializer_class = ContainerSerializer
    permission_classes = [IsAuthenticated, ContainerPermissions]

    def get_queryset(self):
        request_user = self.request.user.email

        return Container.objects.filter(
            Q(owner=request_user) | Q(sharing__contains=request_user)
        )

    def perform_create(self, serializer):
        request_user = self.request.user.email

        # We are manually checking that the combination of (owner, code) is unique.
        # We cannot take advantage of MongoEngine's inbuilt "unique_with" attribute
        # in the Container model, because we are not sending the owner attribute in
        # the request body (rather, it is provided by the request.user).
        queryset = Container.objects.filter(
            owner=request_user, code=self.request.data["code"]
        )
        if queryset.count():
            raise ValidationError("A container with this code already exists")

        container = serializer.save(owner=request_user)

        audit = AuditSerializer(
            data={
                "model": "container",
                "document": str(container.id),
                "action": "create",
                "user": request_user,
            }
        )
        audit.is_valid()
        audit.save()

    def perform_update(self, serializer):
        container = self.get_object()
        request_user = self.request.user.email

        self.check_object_permissions(self.request, container)

        # Ensure that the owner cannot be changed by a malicious payload
        if "owner" in self.request.data:
            del self.request.data["owner"]

        # Ensure that only the owner can edit sharing permissions
        if request_user != container.owner and "sharing" in self.request.data:
            del self.request.data["sharing"]

        # If we are editing an actual container, as opposed to editing the sharing
        # permissions of a container
        if "code" in self.request.data:
            queryset = Container.objects.filter(
                # We only want to check against the documents that are not the document
                # being updated. I.e. only include objects in the filter that do not have
                # the same id as the current object. We are making use of a MongoEngine
                # query operator [field]__ne (i.e. field not equal to). Refer to
                # http://docs.mongoengine.org/guide/querying.html#query-operators for
                # more information.
                id__ne=container.id,
                owner=request_user,
                code=self.request.data["code"],
            )
            if queryset.count():
                raise ValidationError("A container with this code already exists")

        serializer.save()

        # Identify the changes made to the container
        diff = {}
        for field in container:
            old_value = container[field]
            new_value = serializer.instance[field]
            if old_value != new_value:
                diff[field] = {"from": old_value, "to": new_value}

        # If changes were detected, add a record to the audit collection
        if len(diff.keys()):
            audit = AuditSerializer(
                data={
                    "model": "container",
                    "document": str(container.id),
                    "action": "edit",
                    "user": request_user,
                    "diff": diff,
                }
            )
            audit.is_valid()
            audit.save()

    def perform_destroy(self, container):
        request_user = self.request.user.email

        self.check_object_permissions(self.request, container)

        container.delete()

        audit = AuditSerializer(
            data={
                "model": "container",
                "document": str(container.id),
                "action": "delete",
                "user": request_user,
            }
        )
        audit.is_valid()
        audit.save()

    @list_route(methods=["get"])
    def retrieve_containers(self, request):
        """Retrieve containers owner by or shared with the current user, including 
        the container's associated datasources, data labs and actions"""
        request_user = request.user.email

        # Retrieve containers owned by or shared with the current user,
        # including the associated datasources, data labs and actions
        pipeline = [
            {
                "$match": {
                    "$or": [
                        {"owner": request_user},
                        {"sharing": {"$in": [request_user]}},
                    ]
                }
            },
            {
                "$lookup": {
                    "from": "datasource",
                    "localField": "_id",
                    "foreignField": "container",
                    "as": "datasources",
                }
            },
            {
                "$lookup": {
                    "from": "datalab",
                    "localField": "_id",
                    "foreignField": "container",
                    "as": "datalabs",
                }
            },
            {
                "$lookup": {
                    "from": "action",
                    "localField": "_id",
                    "foreignField": "container",
                    "as": "actions",
                }
            },
            {
                # Whereas other fields are excluded in the container serializer,
                # nested fields that we want to exclude are specified here via a
                # projection because DRF MongoEngine incorrectly throws an error that the
                # field, e.g.'connection.password' does not exist in the datasource model
                # - i.e. it looks for a field literally called 'connection.password'
                # instead of treating it as a nested field belonging to an embedded
                # document called 'connection'
                "$project": {
                    "datasources.connection.password": 0,
                    "datalabs.steps.datasource": 0,
                    "datalabs.steps.form": 0,
                }
            },
        ]

        containers = Container.objects.aggregate(*pipeline)

        # DRF serialize the containers so that can be sent in the HTTP response as JSON
        serialized_containers = []
        for container in containers:
            # MongoDB queries return document ids as '_id', whereas DRF is expecting 'id'
            # Therefore perform a simple mapping of '_id' to 'id'
            container["id"] = container.pop("_id")

            for datasource in container["datasources"]:
                datasource["id"] = datasource.pop("_id")

            for datalab in container["datalabs"]:
                datalab["id"] = datalab.pop("_id")

            datalabs = {}
            for action in container["actions"]:
                action["id"] = action.pop("_id")
                if not action["datalab"] in datalabs:
                    datalabs[action["datalab"]] = Datalab.objects.get(
                        id=action["datalab"]
                    )

                action["datalab"] = datalabs[action["datalab"]]['name']

            serialized_containers.append(ContainerSerializer(container).data)

        return JsonResponse({"containers": serialized_containers})

    @detail_route(methods=["get"])
    def retrieve_datasources(self, request, id=None):
        """Retrieve all datasources associated with the given container"""
        container = Container.objects.get(id=id)

        self.check_object_permissions(self.request, container)

        datasources = Datasource.objects(container=id).only("id", "name", "fields")
        serialized_datasources = [
            DatasourceSerializer(datasource).data for datasource in datasources
        ]

        return JsonResponse({"datasources": serialized_datasources})

    @detail_route(methods=["post"])
    def surrender_access(self, request, id=None):
        """Revoke the requesting user's access to the given container"""
        container = Container.objects.get(id=id)

        sharing = container.sharing
        request_user = request.user.email

        if request_user in sharing:
            sharing.remove(request_user)

            container.save(sharing=sharing)

            audit = AuditSerializer(
                data={
                    "model": "container",
                    "document": str(container.id),
                    "action": "surrender_access",
                    "user": request_user,
                }
            )
            audit.is_valid()
            audit.save()

        return JsonResponse({"success": 1})
