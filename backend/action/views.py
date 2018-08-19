from rest_framework_mongoengine import viewsets
from rest_framework_mongoengine.validators import ValidationError
from rest_framework.decorators import detail_route, list_route
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse, HttpResponse

import os
import json
from datetime import date, datetime
from bson import ObjectId
import base64
import jwt

from .serializers import ActionSerializer
from .models import Action, EmailSettings, EmailJob, Email
from .permissions import ActionPermissions

from container.views import ContainerViewSet
from audit.models import Audit
from audit.serializers import AuditSerializer

from scheduler.methods import (
    create_scheduled_task,
    remove_scheduled_task,
    remove_async_task,
)

from ontask.settings import SECRET_KEY, BACKEND_DOMAIN

PIXEL_GIF_DATA = base64.b64decode(
    b"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


class ActionViewSet(viewsets.ModelViewSet):
    lookup_field = "id"
    serializer_class = ActionSerializer
    permission_classes = [IsAuthenticated, ActionPermissions]

    def get_queryset(self):
        # Get the containers this user owns or has access to
        containers = ContainerViewSet.get_queryset(self)

        # Retrieve only the DataLabs that belong to these containers
        actions = Action.objects(container__in=containers)

        return actions

    def perform_create(self, serializer):
        self.check_object_permissions(self.request, None)
        serializer.save()

    def perform_update(self, serializer):
        self.check_object_permissions(self.request, self.get_object())
        serializer.save()

    def perform_destroy(self, obj):
        self.check_object_permissions(self.request, obj)
        self.delete_schedule(self.request, obj.id)
        obj.delete()

    @detail_route(methods=["put"])
    def preview_content(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(self.request, action)

        populated_content = action.populate_content(content=self.request.data)

        return JsonResponse({"populatedContent": populated_content})

    @detail_route(methods=["patch"])
    def update_schedule(self, request, id=None):
        action = Workflow.objects.get(id=id)
        arguments = json.dumps({"workflow_id": id})

        # If a schedule already exists for this action, then delete it
        if "schedule" in action and "taskName" in action["schedule"]:
            remove_scheduled_task(action["schedule"]["taskName"])

        if "schedule" in action and "asyncTasks" in action["schedule"]:
            remove_async_task(action["schedule"]["asyncTasks"])

        arguments = json.dumps({"workflow_id": id})
        # create updated schedule tasks
        task_name, async_tasks = create_scheduled_task(
            "workflow_send_email", request.data, arguments
        )

        schedule = request.data
        schedule["taskName"] = task_name
        schedule["asyncTasks"] = async_tasks
        serializer = ActionSerializer(
            action, data={"schedule": schedule}, partial=True
        )

        serializer.is_valid()
        serializer.save()

        return JsonResponse(serializer.data)

    @detail_route(methods=["patch"])
    def delete_schedule(self, request, id=None):
        action = Workflow.objects.get(id=id)

        # if taskName exist remove task with taskName
        if "schedule" in action and "taskName" in action["schedule"]:
            remove_scheduled_task(action["schedule"]["taskName"])
        # else remove async starter task
        if "schedule" in action and "asyncTasks" in action["schedule"]:
            remove_async_task(action["schedule"]["asyncTasks"])

        action.update(unset__schedule=1)
        action.reload()

        serializer = ActionSerializer(action)

        return JsonResponse(serializer.data)

    @list_route(methods=["get"], permission_classes=[])
    def read_receipt(self, request):
        token = request.GET.get("email")
        decrypted_token = None

        if token:
            try:
                decrypted_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            except Exception:
                # Invalid token, ignore the read receipt
                return HttpResponse(PIXEL_GIF_DATA, content_type="image/gif")

            did_update = False
            workflow = Workflow.objects.get(id=decrypted_token["workflow_id"])
            for job in workflow.emailJobs:
                if job.job_id == ObjectId(decrypted_token["job_id"]):
                    for email in job.emails:
                        if email.recipient == decrypted_token["recipient"]:
                            if not email.first_tracked:
                                email.first_tracked = datetime.utcnow()
                            else:
                                email.last_tracked = datetime.utcnow()
                            did_update = True
                            break
                    break

            if did_update:
                workflow.save()

        return HttpResponse(PIXEL_GIF_DATA, content_type="image/gif")

    @detail_route(methods=["put"])
    def send_email(self, request, id=None):
        workflow = Workflow.objects.get(id=id)
        self.check_object_permissions(self.request, workflow)

        if os.environ.get("ONTASK_DEMO") is not None:
            raise ValidationError("Email sending is disabled in the demo")

        if not "content" in workflow:
            raise ValidationError("Email content cannot be empty.")

        email_settings = EmailSettings(**request.data["emailSettings"])

        email_job = workflow.perform_email_job("Manual", email_settings)

        workflow.emailJobs.append(email_job)
        workflow.emailSettings = email_settings
        workflow.save()

        return JsonResponse({"success": "true"})

    @detail_route(methods=["post"])
    def clone_action(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(self.request, action)

        action = action.to_mongo()
        action["name"] = action["name"] + "_cloned"
        action.pop("_id")
        # The scheduled tasks in Celery are not cloned, therefore remove the schedule
        # information from the cloned action
        action.pop("schedule")
        # Ensure that the new action is not bound to the original action's Moodle link Id
        action.pop("linkId")

        serializer = ActionSerializer(data=action)
        serializer.is_valid()
        serializer.save()

        audit = AuditSerializer(
            data={
                "model": "action",
                "document": str(id),
                "action": "clone",
                "user": self.request.user.email,
                "diff": {"new_document": str(serializer.instance.id)},
            }
        )
        audit.is_valid()
        audit.save()

        return JsonResponse({"success": 1})

    # # retrive email sending history and generate static page.
    # @detail_route(methods=["get"])
    # def retrieve_history(self, request, id=None):
    #     pipeline = [
    #         {"$match": {"$and": [{"creator": request.user.email}, {"workflowId": id}]}}
    #     ]

    #     def json_serial(obj):
    #         if isinstance(obj, (datetime, date)):
    #             return obj.strftime("%T %Y/%m/%d")
    #         if isinstance(obj, ObjectId):
    #             return str(obj)

    #     audits = list(Audit.objects.aggregate(*pipeline))
    #     response = {}
    #     response["data"] = None
    #     response["columns"] = []
    #     if audits:
    #         # will change based on which column we wish to show users
    #         columns = list(audits[0].keys())[2:-1]
    #         audits_str = str(dumps(audits, default=json_serial)).replace(
    #             '"_id":', '"id":'
    #         )
    #         response["data"] = json.loads(audits_str)
    #         response["columns"] = columns
    #     return JsonResponse(response, safe=False)

    # # search workflow with link_id
    # @list_route(methods=["post"])
    # def search_workflow(self, request):
    #     link_id = self.request.data["link_id"]
    #     pipeline = [{"$match": {"linkId": link_id}}]

    #     workflow = list(Workflow.objects.aggregate(*pipeline))
    #     if len(workflow) == 0:
    #         return JsonResponse({"mismatch": True})
    #     else:
    #         return JsonResponse({"workflowId": str(workflow[0]["_id"])}, safe=False)

    # # search specific content for studentwith link_id and student zid
    # @list_route(methods=["post"])
    # def search_content(self, request):
    #     link_id = self.request.data["link_id"]
    #     zid = self.request.data["zid"]
    #     try:
    #         workflow = Workflow.objects.get(linkId=link_id)
    #     except Workflow.DoesNotExist:
    #         return JsonResponse({"mismatch": True})
    #     content = populate_content(workflow, None, zid)
    #     if content:
    #         return JsonResponse({"content": content}, safe=False)
    #     else:
    #         return JsonResponse({"mismatch": True})
