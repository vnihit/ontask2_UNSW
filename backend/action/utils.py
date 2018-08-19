import re


def did_pass_formula(item, formula):
    operator = formula["operator"]
    comparator = formula["comparator"]

    try:
        value = item[formula["field"]]
    except KeyError:
        return False  # This record must not have a value for this field

    if operator == "==":
        return value == comparator
    elif operator == "!=":
        return value != comparator
    elif operator == "<":
        return value < comparator
    elif operator == "<=":
        return value <= comparator
    elif operator == ">":
        return value > comparator
    elif operator == ">=":
        return value >= comparator


def did_pass_condition(item, condition):
    formulas = condition["formulas"]
    condition_type = condition["type"]

    pass_counts = [did_pass_formula(item, formula) for formula in formulas]

    if condition_type == "and":
        return sum(pass_counts) == len(formulas)
    elif condition_type == "or":
        return sum(pass_counts) > 0
    return False


def populate_field(match, item):
    field = match.group(1)
    if field in item:
        return str(item[field])
    else:
        return None


def parse_content_line(line, item):
    return re.sub(
        r"<attribute>(.*?)</attribute>", lambda match: populate_field(match, item), line
    )
