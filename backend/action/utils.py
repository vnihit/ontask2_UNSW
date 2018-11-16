import re
from dateutil import parser
import time


def transform(value, param_type):
    try:
        if param_type == "number":
            value = float(value)

        elif param_type == "date":
            value = parser.parse(value)
            value = int(time.mktime(value.timetuple()))

        return value

    except:
        return None


def did_pass_test(test, value, param_type):
    value = transform(value, param_type)
    if "comparator" in test:
        comparator = transform(test["comparator"], param_type)
    else:
        test["rangeFrom"] = transform(test["rangeFrom"], param_type)
        test["rangeTo"] = transform(test["rangeTo"], param_type)

    operator = test["operator"]

    try:
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
        elif operator == "between":
            return value >= test["rangeFrom"] and value <= test["rangeTo"]
        elif operator == "contains":
            return comparator.lower() in (item.lower() for item in value)
        else:
            return False
    except:
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
