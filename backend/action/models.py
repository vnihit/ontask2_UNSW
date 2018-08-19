from mongoengine import Document, EmbeddedDocument
from mongoengine.fields import (
    ReferenceField,
    EmbeddedDocumentField,
    EmbeddedDocumentListField,
    StringField,
    DateTimeField,
    IntField,
    ListField,
    DictField,
    BooleanField,
    SequenceField,
    ObjectIdField,
)
from bson import ObjectId
from datetime import datetime
import jwt
from ontask.settings import SECRET_KEY, BACKEND_DOMAIN
from scheduler.utils import send_email

from container.models import Container
from datalab.models import Datalab

from datasource.models import Datasource
from datasource.serializers import DatasourceSerializer

from .utils import did_pass_condition, parse_content_line
from .validators import validate_content

# Condition groups
class Formula(EmbeddedDocument):
    field = StringField()
    operator = StringField()
    comparator = StringField()


class Condition(EmbeddedDocument):
    name = StringField(required=True)
    type = StringField(choices=("and", "or"), default="and")
    formulas = EmbeddedDocumentListField(Formula)


class ConditionGroup(EmbeddedDocument):
    name = StringField(required=True)
    conditions = EmbeddedDocumentListField(Condition)


class Filter(EmbeddedDocument):
    type = StringField(choices=("and", "or"), default="and")
    formulas = EmbeddedDocumentListField(Formula)


class Schedule(EmbeddedDocument):
    startTime = DateTimeField()
    endTime = DateTimeField()
    time = DateTimeField(required=True)
    frequency = StringField(required=True, choices=("daily", "weekly", "monthly"))
    dayFrequency = IntField(min_value=1)  # I.e. every n days
    dayOfWeek = ListField(
        StringField()
    )  # List of shorthand day names, e.g. ['mon', 'wed', 'fri']
    dayOfMonth = (
        DateTimeField()
    )  # Number representing the date in the month, e.g. 1 is the 1st
    taskName = StringField()  # The name of the celery task
    asyncTasks = ListField(StringField())  # async tasks


class EmailSettings(EmbeddedDocument):
    subject = StringField(required=True)
    field = StringField(required=True)
    replyTo = StringField(required=True)
    include_tracking = BooleanField()
    include_feedback = BooleanField()


class Email(EmbeddedDocument):
    recipient = StringField()
    content = StringField()
    feedback = StringField()
    first_tracked = DateTimeField()
    last_tracked = DateTimeField()


class EmailJob(EmbeddedDocument):
    job_id = ObjectIdField()
    subject = StringField()
    emails = EmbeddedDocumentListField(Email)
    type = StringField(choices=["Manual", "Scheduled"])
    initiated_at = DateTimeField(default=datetime.utcnow)
    included_tracking = BooleanField()
    included_feedback = BooleanField()


class Content(EmbeddedDocument):
    blockMap = DictField()
    html = ListField(StringField())


class Action(Document):
    container = ReferenceField(
        Container, required=True, reverse_delete_rule=2
    )  # Cascade delete if container is deleted
    datalab = ReferenceField(
        Datalab, required=True, reverse_delete_rule=2
    )  # Cascade delete if view is deleted
    name = StringField(required=True)
    description = StringField(null=True)
    filter = EmbeddedDocumentField(Filter)
    condition_groups = EmbeddedDocumentListField(ConditionGroup)
    content = EmbeddedDocumentField(Content)
    email_settings = EmbeddedDocumentField(EmailSettings)
    schedule = EmbeddedDocumentField(Schedule, null=True)
    linkId = StringField(null=True)  # link_id is unique across workflow objects
    emailJobs = EmbeddedDocumentListField(EmailJob)

    @property
    def filtered_data(self):
        if not self.filter:
            return self.datalab.data

        return [
            item for item in self.datalab.data if did_pass_condition(item, self.filter)
        ]

    @property
    def unfiltered_data_length(self):
        return len(self.datalab.data)

    @property
    def conditions(self):
        condition_names = []
        for condition_group in self.condition_groups:
            for condition in condition_group.conditions:
                condition_names.append(condition.name)
        return condition_names

    def populate_content(self, content=None, return_data=False):
        if content:
            validate_content(self, content)
        else:
            content = self.content

        filtered_data = self.filtered_data

        conditions_used = set()
        # Use square brackets rather than dot notation to access keys in the content
        # object, as the content may not be an instance of the Content embedded document
        # (in the case where self.content was used), and instead may be a dict (if
        # coming from a request payload)
        nodes = content["blockMap"]["document"]["nodes"]
        for block in nodes:
            if block["type"] == "condition":
                conditions_used.add(block["data"]["name"])


        primary_key = self.datalab.steps[0].datasource.primary
        evaluated_conditions = {}
        for condition_group in self.condition_groups:
            for condition in condition_group.conditions:
                if condition.name in conditions_used:
                    evaluated_conditions[condition.name] = set(
                        [
                            item[primary_key]
                            for item in filtered_data
                            if did_pass_condition(item, condition)
                        ]
                    )
        # TODO: add check for mutual exclusivity of conditions in condition groups if
        # the boolean in the condition group is enabled by user

        result = []
        html = content["html"]
        for item in filtered_data:
            populated_content = ""
            for index, block in enumerate(nodes):
                if block["type"] == "condition":
                    condition_name = block["data"]["name"]
                    if item[primary_key] in evaluated_conditions[condition_name]:
                        populated_content += parse_content_line(html[index], item)
                else:
                    populated_content += parse_content_line(html[index], item)
            result.append(populated_content)

        if return_data:
            return result, filtered_data

        return result

    def perform_email_job(self, job_type, email_settings=None):
        if not email_settings:
            email_settings = self.emailSettings

        populated_content, data = self.populate_content(return_data=True)

        job_id = ObjectId()
        job = EmailJob(
            job_id=job_id,
            subject=email_settings.subject,
            type=job_type,
            included_tracking=email_settings.include_tracking and True,
            included_feedback=email_settings.include_feedback and True,
            emails=[],
        )

        failed_emails = False
        for index, item in enumerate(data):
            recipient = item[email_settings.field]
            email_content = populated_content[index]

            if email_settings.include_tracking:
                tracking_token = jwt.encode(
                    {
                        "workflow_id": str(self.id),
                        "job_id": str(job_id),
                        "recipient": recipient,
                    },
                    SECRET_KEY,
                    algorithm="HS256",
                ).decode("utf-8")

                tracking_pixel = (
                    f'<img src="{BACKEND_DOMAIN}/action/read_receipt/'
                    f'?email={tracking_token}"/>'
                )

                email_content += tracking_pixel

            email_sent = send_email(
                recipient, email_settings.subject, email_content, email_settings.replyTo
            )

            if email_sent:
                job["emails"].append(
                    Email(
                        recipient=recipient,
                        # Content without the tracking pixel
                        content=populated_content[index],
                    )
                )
            # else:
            #     failed_emails = True

        # if failed_emails:
        # TODO: Make these records identifiable, e.g. allow user to specify the primary
        # key of the DataLab? And send back a list of the specific records that we failed
        # to send an email to raise ValidationError('Emails to the some records failed to
        # send: ' + str(failed_emails).strip('[]').strip("'"))

        return job
