from rest_framework_mongoengine.validators import ValidationError

def validate_filter(action, filter):
    fields = action.datalab.fields

    if "formulas" in filter:
        for formula in filter["formulas"]:
            field = formula["field"]
            if field not in fields:
                raise ValidationError(
                    f"Invalid filter: field '{field}' does not exist in the DataLab"
                )

def validate_condition_groups(action, condition_groups):
    fields = action.datalab.fields

    condition_group_names = set()
    condition_names = set()
    for condition_group in condition_groups:
        condition_group_name = condition_group["name"]
        if condition_group_name in condition_group_names:
            raise ValidationError(
                f"{condition_group_name} is already being used as a condition "
                "group name in this action"
            )
        condition_group_names.add(condition_group_name)

        for condition in condition_group["conditions"]:
            condition_name = condition["name"]
            if condition_name in condition_names:
                raise ValidationError(
                    f"{condition_name} is already being used as a condition "
                    "name in this action"
                )
            condition_names.add(condition_name)

            for formula in condition["formulas"]:
                if formula["field"] not in fields:
                    raise ValidationError(
                        f"Invalid formula: field '{field}' does not exist in "
                        "the DataLab"
                    )

def validate_content(action, content):
    condition_names = action.conditions

    for block in content["blockMap"]["document"]["nodes"]:
        if block["type"] == "condition":
            condition_name = block["data"]["name"]
            if not condition_name in condition_names:
                raise ValidationError(
                    f"The condition '{condition_name}' does not exist in any "
                    "condition group for this action"
                )