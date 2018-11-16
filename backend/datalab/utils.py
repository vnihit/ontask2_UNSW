from collections import defaultdict
from datetime import datetime
import numexpr as ne

from .models import Datalab
from datasource.models import Datasource
from audit.serializers import AuditSerializer
from action.models import Action


def bind_column_types(steps):
    for step in steps:
        if step["type"] == "datasource":
            step = step["datasource"]
            datasource = None

            fields = step["fields"]
            types = step["types"]

            for field in fields:
                if field not in types:
                    if not datasource:
                        datasource_id = step["id"]
                        datasource = Datasource.objects.get(id=datasource_id)
                    types[field] = datasource["types"][field]

        elif step["type"] == "computed":
            step = step["computed"]
            for field in step["fields"]:
                if "type" not in field or field["type"] is None:
                    field_type = "number"
                    nodes = field["formula"]["document"]["nodes"]
                    for node in nodes:
                        if node["type"] == "aggregation":
                            aggregation_type = node["data"]["type"]
                            if aggregation_type == "list":
                                field_type = "list"
                            elif aggregation_type ==  "concat":
                                field_type = "text"
                            elif aggregation_type == "last" and not len(nodes) > 2:
                                field_type = "text"
                    field["type"] = field_type

    return steps


def calculate_computed_field(formula, record, build_fields, tracking_feedback_data):
    calculated_value = 0

    populated_formula = []

    def cast_float(value):
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0

    def tracking_feedback_value(action_id, job_id, data_type, record):
        email_field = tracking_feedback_data[action_id]["email_field"]
        data = tracking_feedback_data[action_id]["jobs"][job_id][data_type]
        return (
            data[record[email_field]]
            if email_field in record and record[email_field] in data
            else 0
        )

    def iterate_aggregation(columns, is_numerical=True):
        values = []

        for column in columns:
            split_column = column.split("_")

            if split_column[0] in ["tracking", "feedback"]:
                data_type = split_column[0]

                if len(split_column) == 1:
                    for action in tracking_feedback_data:
                        for email_job in tracking_feedback_data[action]["jobs"]:
                            values.append(
                                tracking_feedback_value(
                                    action, email_job, data_type, record
                                )
                            )

                if len(split_column) == 2:
                    action_id = split_column[1]
                    for email_job in tracking_feedback_data[action_id]["jobs"]:
                        values.append(
                            tracking_feedback_value(
                                action_id, email_job, data_type, record
                            )
                        )

                if len(split_column) == 3:
                    action_id = split_column[1]
                    job_id = split_column[2]
                    values.append(
                        tracking_feedback_value(action_id, job_id, data_type, record)
                    )

            else:
                if len(split_column) == 1:
                    step_index = int(split_column[0])
                    for field in build_fields[step_index]:
                        value = record[field] if field in record else None
                        values.append(cast_float(value) if is_numerical else value)

                elif len(split_column) == 2:
                    step_index, field_index = [int(i) for i in split_column]
                    field = build_fields[step_index][field_index]
                    value = record[field] if field in record else None
                    values.append(cast_float(value) if is_numerical else value)

        return values

    # Populate values on first pass-through
    for node in formula["document"]["nodes"]:
        node_type = node["type"]

        if node_type == "open-bracket":
            populated_formula.append("(")

        if node_type == "close-bracket":
            populated_formula.append(")")

        if node_type == "operator":
            populated_formula.append(node["data"]["type"])

        if node_type == "field":
            field = node["data"]["name"]
            populated_formula.append(cast_float(record[field]))

        if node_type == "aggregation":
            aggregation_type = node["data"]["type"]
            columns = node["data"]["columns"]
            aggregation_value = 0

            if aggregation_type == "sum":
                aggregation_value = sum(iterate_aggregation(columns))

            if aggregation_type == "average":
                values = iterate_aggregation(columns)
                aggregation_value = sum(values) / len(values) if len(values) else 0

            if aggregation_type == "last":
                # If the "last" aggregation is part of a larger formula, then treat
                # it as numerical, since it must be part of a computation
                values = iterate_aggregation(columns, is_numerical=False)
                # If the number of nodes is 2, then the aggregation is standalone
                # It's 2 and not 1, because Slate.js blockmap always starts with a paragraph block
                if len(formula["document"]["nodes"]) > 2:
                    aggregation_value = cast_float(values[-1]) if len(values) else 0
                else:
                    return values[-1] if len(values) else None

            if aggregation_type == "list":
                return iterate_aggregation(columns, is_numerical=False)

            if aggregation_type == "concat":
                delimiter = node["data"]["delimiter"]
                aggregation_value = iterate_aggregation(columns, is_numerical=False)
                # Join values even if they are null, as this would be the expected
                # functionality if the user is trying to construct a .csv
                # I.e. the number of delimiters should be constant for all rows
                # Regardless of whether a given column has a value or not
                return delimiter.join(
                    [str(x) if x is not None else "" for x in aggregation_value]
                )

            populated_formula.append(aggregation_value)

    populated_formula = "".join([str(x) for x in populated_formula])

    try:
        return ne.evaluate(populated_formula).item()
    except (ZeroDivisionError, AttributeError, TypeError, KeyError, SyntaxError):
        return None


def combine_data(steps, datalab_id=None):
    # Identify the fields used in the build
    # Consumed by the computed column calculation
    build_fields = [[] for x in range(len(steps))]
    for i, step in enumerate(steps):
        if step["type"] == "datasource":
            for field in step["datasource"]["fields"]:
                build_fields[i].append(step["datasource"]["labels"][field])
        if step["type"] in ["form", "computed"]:
            step = step[step["type"]]
            for field in step["fields"]:
                build_fields[i].append(field["name"])

    # Gather all tracking and feedback data for associated actions
    # Consumed by the computed column
    tracking_feedback_data = {}
    if datalab_id:
        actions = Action.objects(datalab=datalab_id)
        for action in actions:
            action_id = str(action.id)
            if not "emailSettings" in action or not len(action["emailJobs"]):
                continue

            tracking_feedback_data[action_id] = {
                "email_field": action["emailSettings"]["field"],
                "jobs": {},
            }
            for email_job in action["emailJobs"]:
                job_id = str(email_job.job_id)

                tracking_feedback_data[action_id]["jobs"][job_id] = {
                    "tracking": {
                        email["recipient"]: email["track_count"]
                        for email in email_job["emails"]
                    }
                }

    # Initialize the dataset using the first module, which is always a datasource
    first_module = steps[0]["datasource"]
    datasource = Datasource.objects.get(id=first_module["id"])
    fields = first_module["fields"]
    label_map = first_module["labels"]

    data = []
    for item in datasource.data:
        record = {}
        for field, value in item.items():
            if field in fields:
                # Add the field to the record object using the field's label
                record[label_map[field]] = value
        data.append(record)

    # For each of the remaining modules, incrementally add to the dataset
    for step in steps[1:]:
        # Instantiate an object that will be a map of the data generated thus far,
        # with the key being the matching field specified for this step. This allows
        #  us to efficiently lookup based on the primary key and find which record
        # should be extended, instead of having to iterate over the list to find the
        # matching record for every record in this datasource
        data_map = defaultdict(list)

        if step["type"] == "datasource":
            module = step["datasource"]
            datasource = Datasource.objects.get(id=module["id"])
            fields = module["fields"]
            label_map = module["labels"]

            # Populate the data map before merging in this datasource module's data
            for item in data:
                # If the item has a value for this module's specified matching field
                # Note that the matching field uses labels and not the original field names
                if module["matching"] in item:
                    match_value = item[module["matching"]]
                    data_map[match_value].append(item)

            # For each record in this datasource's data, extend the matching record in the data map
            for item in datasource.data:
                match_value = item[module["primary"]]
                # If the match value for this record is in the data map, then extend
                # each of the matched records with the chosen fields from this datasource module
                if match_value in data_map:
                    for matched_record in data_map[match_value]:
                        for field, value in item.items():
                            if field in fields:
                                matched_record[label_map[field]] = value

                # If the match value is not in the data map, then there is a discrepency.
                # The user would have been prompted on how to deal with discrepencies after they
                # chose the matching field for this module in the model interface of the DataLab
                else:
                    # If the primary discrepency setting is set to True, then the user wants to keep
                    # the record even with values missing for the previous modules
                    if (
                        "discrepencies" in module
                        and module["discrepencies"] is not None
                        and "primary" in module["discrepencies"]
                        and module["discrepencies"]["primary"]
                    ):
                        new_record = {}
                        for field, value in item.items():
                            if field in fields:
                                new_record[label_map[field]] = value
                        data_map[match_value].append(new_record)

            # If the matching discrepency setting is set to True, then the user wants to keep
            # any records whose matching keys do not exist in this datasource module.
            if not (
                "discrepencies" in module
                and module["discrepencies"] is not None
                and "matching" in module["discrepencies"]
                and module["discrepencies"]["matching"]
            ):
                primary_records = {
                    item.get(module["primary"]) for item in datasource.data
                }
                matching_records = {item.get(module["matching"]) for item in data}
                for record in matching_records - primary_records:
                    data_map.pop(record, None)

        if step["type"] == "form" and "data" in step["form"]:
            module = step["form"]

            # Populate the data map before merging in this form module's data
            for item in data:
                if module["primary"] in item:
                    match_value = item[module["primary"]]
                    data_map[match_value].append(item)

            # Update keys in the data map with this form's data
            for item in module["data"]:
                match_value = item[module["primary"]]
                if match_value in data_map:
                    for matched_record in data_map[match_value]:
                        matched_record.update(item)

        if step["type"] == "computed":
            module = step["computed"]

            for item in data:
                for field in module["fields"]:
                    item[field["name"]] = calculate_computed_field(
                        field["formula"], item, build_fields, tracking_feedback_data
                    )

        # Create the data (list of dicts, with each dict representing a record) based on the updated data map
        if len(data_map):
            data = []
            for match in data_map.values():
                for item in match:
                    data.append(item)

    return data


def update_form_data(
    datalab, step, field, primary, value, request_user, is_web_form=False
):
    form = datalab.steps[step].form
    web_form = form["webForm"]

    datalab_data_map = {
        item[form.primary]: item for item in datalab.data if form.primary in item
    }

    not_accessible = (
        (is_web_form and not web_form or (web_form and not web_form["active"]))
        or (
            "activeFrom" in form
            and form["activeFrom"] is not None
            and form["activeFrom"] > datetime.utcnow()
        )
        or (
            "activeTo" in form
            and form["activeTo"] is not None
            and form["activeTo"] < datetime.utcnow()
        )
    )
    if not_accessible:
        raise Exception("Unauthorized")

    # Perform permission validation manually, as opposed to using the generic
    # data lab permissions schema. This is so that we can provide access to users
    # that are not necessarily owner or have share access, but are one of the
    # permissable users on the data lab level
    is_owner = request_user == datalab.container.owner
    is_shared = request_user in datalab.container.sharing
    has_access = is_owner or is_shared

    if not has_access:
        if is_web_form and web_form and web_form["active"]:
            permission_field = web_form["permission"]
            if web_form["showAll"]:
                permissable_users = {
                    item.get(permission_field).strip() for item in datalab.data
                }
                has_access = request_user in permissable_users
            else:
                has_access = (
                    request_user == datalab_data_map[primary][permission_field].strip()
                )

    # Confirm whether the user has access after the above checks have been performed
    if not has_access:
        raise Exception("Unauthorized")

    form_data_map = {
        item[form.primary]: item for item in form.data if form.primary in item
    }

    previous_value = None
    if primary in form_data_map:
        previous_value = (
            form_data_map[primary][field] if field in form_data_map[primary] else None
        )
        form_data_map[primary].update({field: value})
    else:
        form_data_map[primary] = {form.primary: primary, field: value}

    form_data = [value for value in form_data_map.values()]

    kw = {f"set__steps__{step}__form__data": form_data}
    Datalab.objects(id=datalab.id).update(**kw)
    datalab.reload()

    data = combine_data(datalab.steps, datalab.id)
    Datalab.objects(id=datalab.id).update(set__data=data)
    datalab.reload()

    audit = AuditSerializer(
        data={
            "model": "datalab",
            "document": str(datalab.id),
            "action": "update_form_value",
            "user": request_user,
            "diff": {
                "form": form.name,
                "module_index": step,
                "record": primary,
                "field": field,
                "from": previous_value,
                "to": value,
            },
        }
    )
    audit.is_valid()
    audit.save()

    return datalab


def retrieve_form_data(datalab, step, request_user):
    is_owner = request_user == datalab.container.owner
    is_shared = request_user in datalab.container.sharing
    has_access = is_owner or is_shared

    if (
        step < 0
        or step >= len(datalab["steps"])
        or "form" not in datalab["steps"][step]
    ):
        return {"error": "This form does not exist"}

    # Convert the document to a format that is JSON serializable
    datalab = datalab.to_mongo()

    form = datalab["steps"][step]["form"]
    web_form = form["webForm"] if "webForm" in form else None

    not_accessible = (
        (not web_form or not web_form["active"])
        or (
            "activeFrom" in form
            and form["activeFrom"] is not None
            and form["activeFrom"] > datetime.utcnow()
        )
        or (
            "activeTo" in form
            and form["activeTo"] is not None
            and form["activeTo"] < datetime.utcnow()
        )
    )
    if not_accessible:
        return {"error": "This form is currently not accessible"}

    columns = [form["primary"]] + web_form["visibleFields"]
    for field in form["fields"]:
        columns.append(field["name"])

    data = []
    permission_field = web_form["permission"]
    permissable_users = {item.get(permission_field) for item in datalab["data"]}

    for (index, item) in enumerate(datalab["data"]):
        if (
            has_access
            or web_form["showAll"]
            and request_user in permissable_users
            or item[permission_field].strip() == request_user
        ):
            record = {field: item.get(field) for field in columns}
            data.append(record)

    if len(data) == 0:
        return {"error": "You are not authorized to access this form"}

    return {
        "name": form["name"],
        "primary_key": form["primary"],
        "columns": columns,
        "data": data,
        "editable_fields": form["fields"],
        "layout": web_form["layout"],
        "is_owner_or_shared": has_access,
    }
