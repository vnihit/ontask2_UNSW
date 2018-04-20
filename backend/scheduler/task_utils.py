import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dateutil import parser
from django_celery_beat.models import CrontabSchedule, IntervalSchedule
from uuid import uuid4

from ontask.settings import SECRET_KEY, DB_DRIVER_MAPPING, SMTP,\
                            AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

def send_email(recipient, subject, content, reply_to=None):
    '''Generic service to send email from the application'''
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP['USER']
        msg['To'] = recipient
        if reply_to:
            msg['Reply-To'] = reply_to

        msg.attach(MIMEText(content, 'html'))

        s = smtplib.SMTP(host=SMTP['HOST'], port=SMTP['PORT'])
        if SMTP['USE_TLS']:
            s.starttls()

        s.login(SMTP['USER'], SMTP['PASSWORD'])
        s.sendmail(SMTP['USER'], recipient, msg.as_string())
        s.quit()
        return True

    except:
        raise Exception("Error sending email")

def create_crontab(schedule):
    if type(schedule) is str:
        schedule = json.load(schedule)
    time = parser.parse(schedule['time'])

    if schedule['frequency'] == "daily":
        periodic_schedule, _ = IntervalSchedule.objects.get_or_create(
            every = int(schedule['dayFrequency']),
            period = IntervalSchedule.DAYS
        )

    elif schedule['frequency'] == 'weekly':
        periodic_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute = time.minute,
            hour = time.hour,
            day_of_week = (',').join(schedule['dayOfWeek'])
        )
    
    elif schedule['frequency'] == 'monthly':
        periodic_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute = time.minute,
            hour = time.hour,
            day_of_month = parser.parse(schedule['dayOfMonth']).day #TODO: use datetime for this instead?
        )
    
    return periodic_schedule

def generate_task_name(task):
    task_name = task + '_' + str(uuid4())
    task = 'scheduler.tasks.' + task 
    return (task_name, task)