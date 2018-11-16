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
    BaseField,
)
from datetime import datetime
from collections import defaultdict
from bson.objectid import ObjectId
import jwt

from container.models import Container
from datalab.models import Datalab
from datasource.models import Datasource

from .utils import did_pass_test, parse_content_line
from scheduler.utils import send_email

from ontask.settings import SECRET_KEY, BACKEND_DOMAIN, FRONTEND_DOMAIN


class Formula(EmbeddedDocument):
    comparator = BaseField()
    operator = StringField()
    rangeFrom = BaseField()
    rangeTo = BaseField()


class Condition(EmbeddedDocument):
    conditionId = ObjectIdField(default=ObjectId)
    formulas = EmbeddedDocumentListField(Formula)


class Rule(EmbeddedDocument):
    name = StringField(required=True)
    parameters = ListField(StringField())
    conditions = EmbeddedDocumentListField(Condition)
    catchAll = ObjectIdField(default=ObjectId)


class Filter(EmbeddedDocument):
    parameters = ListField(StringField())
    conditions = EmbeddedDocumentListField(Condition)


class Content(EmbeddedDocument):
    blockMap = DictField()
    html = ListField(StringField())


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


class Option(EmbeddedDocument):
    label = StringField(required=True)
    value = StringField(required=True)


class EmailSettings(EmbeddedDocument):
    subject = StringField(required=True)
    field = StringField(required=True)
    replyTo = StringField(required=True)
    include_feedback = BooleanField()
    feedback_list = BooleanField()
    list_question = StringField()
    list_options = EmbeddedDocumentListField(Option)
    list_type = StringField(choices=("dropdown", "radio"))
    feedback_textbox = BooleanField()
    textbox_question = StringField()


class Email(EmbeddedDocument):
    recipient = StringField()
    content = StringField()
    list_feedback = StringField()
    textbox_feedback = StringField()
    feedback_datetime = DateTimeField()
    track_count = IntField(default=0)
    first_tracked = DateTimeField()
    last_tracked = DateTimeField()


class EmailJob(EmbeddedDocument):
    job_id = ObjectIdField()
    subject = StringField()
    emails = EmbeddedDocumentListField(Email)
    type = StringField(choices=["Manual", "Scheduled"])
    initiated_at = DateTimeField(default=datetime.utcnow)
    included_feedback = BooleanField()


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
    rules = EmbeddedDocumentListField(Rule)
    content = EmbeddedDocumentField(Content)
    emailSettings = EmbeddedDocumentField(EmailSettings)
    schedule = EmbeddedDocumentField(Schedule, null=True, required=False)
    linkId = StringField(null=True)  # link_id is unique across action objects
    emailJobs = EmbeddedDocumentListField(EmailJob)

    @property
    def options(self):
        modules = []
        types = {}
        labels = []

        # Create a "pseudo" module to hold the computed fields
        computed = {"type": "computed", "fields": []}

        # Iterate over the modules of the datalab
        for step in self.datalab.steps:
            module = {"type": step.type, "fields": []}
            module_labels = {}

            if step.type == "datasource":
                module["name"] = Datasource.objects.get(id=step.datasource.id).name
                for field in step.datasource.fields:
                    label = step.datasource.labels[field]
                    module["fields"].append(label)
                    types[label] = step.datasource.types[field]
                    module_labels[field] = label
                modules.append(module)
                labels.append(module_labels)

            if step.type == "form":
                module["name"] = step.form.name
                for field in step.form.fields:
                    module["fields"].append(field.name)
                    types[field.name] = field.type
                    module_labels[field.name] = field.name
                modules.append(module)
                labels.append(module_labels)

            if step.type == "computed":
                for field in step.computed.fields:
                    computed["fields"].append(field.name)
                    types[field.name] = field.type
                    module_labels[field.name] = field.name
                    labels.append(module_labels)

        modules.append(computed)

        return {"modules": modules, "types": types, "labels": labels}

    @property
    def data(self):
        options = self.options

        if self.filter:
            filtered_data = []

            types = options["types"]
            parameters = self.filter.parameters
            condition = self.filter.conditions[0]

            for item in self.datalab.data:
                if all(
                    [
                        did_pass_test(
                            condition.formulas[parameter_index],
                            item.get(parameter),
                            types.get(parameter),
                        )
                        for parameter_index, parameter in enumerate(parameters)
                    ]
                ):
                    filtered_data.append(item)

        else:
            filtered_data = self.datalab.data

        labels = options["labels"]
        column_order = []
        for item in self.datalab.order:
            step_index = item["stepIndex"]
            field = item["field"]
            column_order.append(labels[step_index][field])

        return {
            "records": filtered_data,
            "order": column_order,
            "unfilteredLength": len(self.datalab.data),
            "filteredLength": len(filtered_data),
        }

    def populate_content(self, content=None):
        if not content and not self.content:
            return []
        elif not content:
            content = self.content

        filtered_data = self.data["records"]
        types = self.options["types"]

        # Assign each record to the rule groups
        populated_rules = defaultdict(set)
        for item_index, item in enumerate(filtered_data):
            for rule in self.rules:
                parameters = rule.parameters
                did_match = False

                for condition in rule.conditions:
                    if all(
                        [
                            did_pass_test(
                                condition.formulas[parameter_index],
                                item.get(parameter),
                                types.get(parameter),
                            )
                            for parameter_index, parameter in enumerate(parameters)
                        ]
                    ):
                        did_match = True
                        populated_rules[condition.conditionId].add(item_index)
                        break

                if not did_match:
                    populated_rules[rule.catchAll].add(item_index)

        block_map = content["blockMap"]["document"]["nodes"]
        html = content["html"]
        result = []

        # Populate the content for each record
        for item_index, item in enumerate(filtered_data):
            populated_content = ""

            for block_index, block in enumerate(block_map):
                if block["type"] == "condition":
                    condition_id = block["data"]["conditionId"]
                    if item_index in populated_rules.get(ObjectId(condition_id), {}):
                        populated_content += parse_content_line(html[block_index], item)
                else:
                    populated_content += parse_content_line(html[block_index], item)

            result.append(populated_content)

        return result

    def clean_content(self, conditions):
        if not self.content:
            return

        blocks = self.content["blockMap"]["document"]["nodes"]
        new_blocks = list(
            filter(
                lambda block: block["data"].get("conditionId") not in conditions, blocks
            )
        )

        self.content["blockMap"]["document"]["nodes"] = new_blocks

        return self.content

    def send_email(self, job_type, email_settings=None):
        if not email_settings:
            email_settings = self.emailSettings

        populated_content = self.populate_content()

        job_id = ObjectId()
        job = EmailJob(
            job_id=job_id,
            subject=email_settings.subject,
            type=job_type,
            included_feedback=email_settings.include_feedback and True,
            emails=[],
        )

        failed_emails = False
        for index, item in enumerate(self.data["records"]):
            recipient = item.get(email_settings.field)
            email_content = populated_content[index]

            tracking_token = jwt.encode(
                {
                    "action_id": str(self.id),
                    "job_id": str(job_id),
                    "recipient": recipient,
                },
                SECRET_KEY,
                algorithm="HS256",
            ).decode("utf-8")

            tracking_link = (
                f"{BACKEND_DOMAIN}/action/read_receipt/?email={tracking_token}"
            )
            tracking_pixel = f"<img src='{tracking_link}'/>"
            email_content += tracking_pixel

            if email_settings.include_feedback:
                feedback_link = (
                    f"{FRONTEND_DOMAIN}/action/{self.id}/feedback/?job={job_id}"
                )
                email_content += (
                    "<p>Did you find this correspondence useful? Please provide your "
                    f"feedback by <a href='{feedback_link}'>clicking here</a>.</p>"
                )

            email_sent = send_email(
                recipient, email_settings.subject, email_content, email_settings.replyTo
            )

            if email_sent:
                job.emails.append(
                    Email(
                        recipient=recipient,
                        # Content without the tracking pixel
                        content=populated_content[index],
                    )
                )
            else:
                failed_emails = True

        # if failed_emails:
        # TODO: Make these records identifiable, e.g. allow user to specify the primary key of the DataLab?
        # And send back a list of the specific records that we failed to send an email to
        # raise ValidationError('Emails to the some records failed to send: ' + str(failed_emails).strip('[]').strip("'"))

        self.emailJobs.append(job)
        self.emailSettings = email_settings

        self.save()
