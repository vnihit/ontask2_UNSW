from django.contrib.auth import get_user_model
from datetime import datetime, timedelta
from passlib.hash import pbkdf2_sha256
from jwt import encode
from random import randint
from bson import ObjectId
import os

from ontask.settings import SECRET_KEY, DEMO_BUCKET, ADMINS

from .models import OneTimeToken

from container.models import Container
from datasource.models import Datasource, Connection
from datalab.models import (
    Datalab,
    Module,
    DatasourceModule,
    FormModule,
    ComputedModule,
    ComputedField,
    FormField,
    Column,
)
from datalab.utils import combine_data
from action.models import Action, Filter, Rule, Condition, Formula

from scheduler.utils import send_email

User = get_user_model()


def get_or_create_user(email, fullname):
    # Find the user based on the email provided in the payload
    # The user is implicitly being authenticated simply because we trust
    # the assertions received from AAF/LTI
    try:
        user = User.objects.get(email=email)
    # If the user doesn't exist, then create them
    except User.DoesNotExist:
        password = pbkdf2_sha256.hash(email)
        user = User.objects.create_user(email=email, password=password, name=fullname)

        # Send a notification to admins on user signup, if OnTask is in demo mode
        user_signup_notification(user)
        
        # Give the user a container with example datasources, datalabs, actions, etc
        seed_data(user)

    return user


def generate_one_time_token(user):
    # Create a one-time, short expiry token to be sent as a querystring to the
    # frontend. This token is used by the frontend to securely receive a long-term
    # token by initiating a POST request
    iat = datetime.utcnow()
    exp = iat + timedelta(seconds=30)
    token = encode(
        {"id": user.id, "iat": iat, "exp": exp}, SECRET_KEY, algorithm="HS256"
    )
    token = token.decode("utf-8")

    # Add the token to the database in order to validate any incoming tokens
    OneTimeToken.objects(user=user.id).update_one(token=token, upsert=True)

    return token


def user_signup_notification(user):
    # Notify admins of user sign-up
    if os.environ.get("ONTASK_DEMO"):
        recipients = ", ".join(ADMINS)
        send_email(
            recipients,
            "OnTask - new user signup",
            (
                "<p>A new user has signed up with the following details:</p>"
                "<p>Name: " + user.name + "</p>"
                "<p>Email: " + user.email + "</p>"
            ),
            force_send=True
        )


def seed_data(user):
    # Create container
    demo_container = Container(
        owner=user.email, code="DEMO", description="A demo container to explore OnTask."
    )
    demo_container.save()

    # Create datasources
    def generate_s3_csv_datasource(name):
        connection = Connection(
            dbType="s3BucketFile",
            bucket=DEMO_BUCKET,
            fileName=f"{name}.csv",
            delimiter=",",
        )
        datasource = Datasource(
            container=demo_container, name=name, connection=connection
        )
        datasource.data = datasource.retrieve_data()
        datasource.fields = [field for field in datasource.data[0]]
        datasource.save()

        return datasource

    students_datasource, classes_datasource, tutors_datasource = [
        generate_s3_csv_datasource(demo_datasource)
        for demo_datasource in ["Students", "Classes", "Tutors"]
    ]

    # Create datalab modules
    demo_modules = []

    demo_modules.append(
        Module(
            type="datasource",
            datasource=DatasourceModule(
                id=str(students_datasource.id),
                primary="zid",
                fields=["zid", "first_name", "last_name", "email"],
                labels={
                    "zid": "zId",
                    "first_name": "first_name",
                    "last_name": "last_name",
                    "email": "email",
                },
                types={
                    "zid": "text",
                    "first_name": "text",
                    "last_name": "text",
                    "email": "text",
                },
            ),
        )
    )

    demo_modules.append(
        Module(
            type="datasource",
            datasource=DatasourceModule(
                id=str(classes_datasource.id),
                primary="ID",
                matching="zId",
                fields=["CLASS"],
                labels={"CLASS": "class"},
                types={"CLASS": "number"},
                discrepencies={"primary": False},
            ),
        )
    )

    demo_modules.append(
        Module(
            type="datasource",
            datasource=DatasourceModule(
                id=str(tutors_datasource.id),
                primary="class",
                matching="class",
                fields=["first_name", "last_name", "email"],
                labels={
                    "first_name": "tutor_first_name",
                    "last_name": "tutor_last_name",
                    "email": "tutor_email",
                },
                types={"first_name": "text", "last_name": "text", "email": "text"},
            ),
        )
    )

    attendance_form_fields = [
        FormField(name=f"attendance_w{i+1}", type="checkbox") for i in range(4)
    ]
    # grade_form_fields = [
    #     FormField(
    #         name=field,
    #         type="number",
    #         minimum=0,
    #         maximum=10,
    #         precision=2,
    #         interval=0.25,
    #         numberDisplay="input",
    #     )
    #     for field in ["grade_midterm", "grade_final"]
    # ]

    demo_form_data = [
        {
            "zId": student["zid"],
            **{field.name: randint(1, 100) < 90 for field in attendance_form_fields},
            # **{field.name: randint(1, 40) * 0.25 for field in grade_form_fields},
        }
        for student in students_datasource.data
    ]

    demo_modules.append(
        Module(
            type="form",
            form=FormModule(
                primary="zId",
                name="Grades",
                # fields=attendance_form_fields + grade_form_fields,
                fields=attendance_form_fields,
                data=demo_form_data,
            ),
        )
    )

    demo_average = ComputedField(
        name="average_attendance",
        type="number",
        formula={
            "object": "value",
            "document": {
                "object": "document",
                "data": {},
                "nodes": [
                    {
                        "object": "block",
                        "type": "aggregation",
                        "isVoid": False,
                        "data": {
                            "type": "average",
                            "columns": ["3_0", "3_1", "3_2", "3_3"],
                        },
                    }
                ],
            },
        },
    )

    demo_modules.append(
        Module(type="computed", computed=ComputedModule(fields=[demo_average]))
    )

    demo_order = [
        Column(stepIndex=0, field="zid", pinned=True),
        Column(stepIndex=0, field="first_name"),
        Column(stepIndex=0, field="last_name"),
        Column(stepIndex=0, field="email"),
        Column(stepIndex=1, field="CLASS"),
        Column(stepIndex=2, field="first_name"),
        Column(stepIndex=2, field="last_name"),
        Column(stepIndex=2, field="email"),
    ]
    demo_order += [
        Column(stepIndex=3, field=field.name) for field in attendance_form_fields
    ]
    demo_order.append(Column(stepIndex=4, field=demo_average.name))
    # demo_order += [Column(stepIndex=3, field=field.name) for field in grade_form_fields]
    # demo_order.append()

    # Create demo datalab
    demo_datalab = Datalab(
        container=demo_container.id,
        name="Demo DataLab",
        steps=demo_modules,
        order=demo_order,
    )
    demo_datalab.data = combine_data(demo_datalab.steps)
    demo_datalab.save()

    demo_filter = Filter(
        parameters=["class"],
        conditions=[
            Condition(formulas=[Formula(operator="between", rangeFrom=1, rangeTo=2)])
        ],
    )

    demo_rules = [
        Rule(
            name="perfect_attendance",
            parameters=["average_attendance"],
            conditions=[
                Condition(
                    conditionId=ObjectId(),
                    formulas=[Formula(operator="==", comparator=1)],
                )
            ],
            catchAll=ObjectId(),
        )
    ]

    demo_content = {
        "blockMap": {
            "object": "value",
            "document": {
                "object": "document",
                "nodes": [
                    {
                        "object": "block",
                        "type": "paragraph",
                        "isVoid": False,
                        "nodes": [
                            {
                                "object": "text",
                                "leaves": [{"object": "leaf", "text": "Hello "}],
                            },
                            {
                                "object": "inline",
                                "type": "attribute",
                                "isVoid": True,
                                "data": {"field": "first_name"},
                            },
                            {
                                "object": "text",
                                "leaves": [{"object": "leaf", "text": " "}],
                            },
                            {
                                "object": "inline",
                                "type": "attribute",
                                "isVoid": True,
                                "data": {"field": "last_name"},
                            },
                            {
                                "object": "text",
                                "leaves": [{"object": "leaf", "text": ","}],
                            },
                        ],
                    },
                    {
                        "object": "block",
                        "type": "condition",
                        "isVoid": False,
                        "data": {
                            "conditionId": str(demo_rules[0].conditions[0].conditionId),
                            "ruleIndex": 0,
                        },
                        "nodes": [
                            {
                                "object": "text",
                                "leaves": [
                                    {
                                        "object": "leaf",
                                        "text": "You have perfect attendance!",
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "object": "block",
                        "type": "condition",
                        "isVoid": False,
                        "data": {
                            "label": "else",
                            "conditionId": str(demo_rules[0].catchAll),
                            "ruleIndex": 0,
                        },
                        "nodes": [
                            {
                                "object": "text",
                                "leaves": [
                                    {
                                        "object": "leaf",
                                        "text": "Your attendance is not perfect.",
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "object": "block",
                        "type": "paragraph",
                        "isVoid": False,
                        "nodes": [
                            {
                                "object": "text",
                                "leaves": [{"object": "leaf", "text": ""}],
                            }
                        ],
                    },
                    {
                        "object": "block",
                        "type": "paragraph",
                        "isVoid": False,
                        "nodes": [
                            {
                                "object": "text",
                                "leaves": [
                                    {
                                        "object": "leaf",
                                        "text": "Kind regards,\nOnTask demo",
                                    }
                                ],
                            }
                        ],
                    },
                ],
            },
        },
        "html": [
            "<p>Hello <attribute>first_name</attribute> <attribute>last_name</attribute>,</p>",
            "<div>You have perfect attendance!</div>",
            "<div>Your attendance is not perfect.</div>",
            "<p></p>",
            "<p>Kind regards,<br/>OnTask Demo</p>",
        ],
    }

    # Create a demo action
    demo_action = Action(
        container=demo_container.id,
        datalab=demo_datalab.id,
        name="Demo Action",
        description="A demo action to illustrate OnTask's features.",
        filter=demo_filter,
        rules=demo_rules,
        content=demo_content,
    )
    demo_action.save()
