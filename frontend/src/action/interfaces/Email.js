import React from "react";
import {
  Form,
  Button,
  Alert,
  Spin,
  Icon,
  Tooltip,
  Divider,
  Table,
  Modal,
  Popover,
  notification
} from "antd";
import moment from "moment";
import _ from "lodash";

import { narrowFormItemLayout } from "../../shared/FormItemLayout";

import SchedulerModal from "../../scheduler/SchedulerModal";
import EmailSettings from "./EmailSettings";

import apiRequest from "../../shared/apiRequest";

const FormItem = Form.Item;

class Email extends React.Component {
  constructor(props) {
    super(props);
    const { action } = props;

    const options = [];
    action.options.modules.forEach(step => {
      if (step.type === "datasource") {
        step.fields.forEach(field => {
          options.push(field);
        });
      }
    });

    this.state = {
      index: 0,
      scheduler: { visible: false, selected: null, data: {} },
      previewing: true,
      sending: false,
      options,
      emailView: { visible: false }
    };

    this.dayMap = {
      mon: { order: 0, label: "Monday" },
      tue: { order: 1, label: "Tuesday" },
      wed: { order: 2, label: "Wednesday" },
      thu: { order: 3, label: "Thursday" },
      fri: { order: 4, label: "Friday" },
      sat: { order: 5, label: "Saturday" },
      sun: { order: 6, label: "Sunday" }
    };

    apiRequest(`/action/${action.id}/content/`, {
      method: "GET",
      onSuccess: populatedContent =>
        this.setState({ populatedContent, previewing: false }),
      onError: error => this.setState({ error, previewing: false })
    });
  }

  handleSubmit = () => {
    const { form, action } = this.props;

    form.validateFields((err, payload) => {
      if (err) return;

      const { emailSettings } = payload;
      this.setState({ sending: true, error: null });

      apiRequest(`/action/${action.id}/email/`, {
        method: "POST",
        payload: { emailSettings },
        onSuccess: () => {
          notification["success"]({
            message: "Email(s) successfully sent."
          });
          this.setState({ sending: false });
        },
        onError: error => this.setState({ error })
      });
    });
  };

  updateEmailSettings = ({ emailSettings, onSuccess, onError }) => {
    const { action, updateAction } = this.props;

    apiRequest(`/action/${action.id}/`, {
      method: "PATCH",
      payload: { emailSettings },
      onSuccess: action => {
        notification["success"]({
          message: "Email settings successfully updated."
        });
        onSuccess();
        updateAction(action);
      },
      onError: error => onError(error)
    });
  };

  updateSchedule = ({ payload, onSuccess, onError }) => {
    const { action, updateAction } = this.props;

    const isCreate = !action.schedule;

    apiRequest(`/action/${action.id}/schedule/`, {
      method: "PUT",
      payload,
      onSuccess: action => {
        notification["success"]({
          message: `Schedule ${isCreate ? "created" : "updated"}`,
          description: `The schedule was successfully ${
            isCreate ? "created" : "updated"
          }.`
        });
        onSuccess();
        updateAction(action);
      },
      onError: error => onError(error)
    });
  };

  deleteSchedule = ({ onSuccess, onError }) => {
    const { action, updateAction } = this.props;

    apiRequest(`/action/${action.id}/schedule/`, {
      method: "DELETE",
      onSuccess: action => {
        notification["success"]({
          message: "Schedule deleted",
          description: "The schedule was successfully deleted."
        });
        onSuccess();
        updateAction(action);
      },
      onError: error => onError(error)
    });
  };

  openSchedulerModal = () => {
    const { action } = this.props;

    this.setState({
      scheduler: {
        visible: true,
        selected: action.id,
        data: { schedule: action.schedule }
      }
    });
  };

  closeSchedulerModal = () => {
    this.setState({ scheduler: { visible: false, selected: null, data: {} } });
  };

  FeedbackDetails = record => (
    <div>
      <b>Feedback provided on:</b>
      <div>{moment(record.feedback_datetime).format("DD/MM/YYYY, HH:mm")}</div>

      <Divider style={{ margin: "6px 0" }} />

      {record.list_feedback && (
        <div>
          <b>Dropdown feedback:</b>
          <div>{record.list_feedback}</div>
        </div>
      )}

      {record.list_feedback &&
        record.textbox_feedback && <Divider style={{ margin: "6px 0" }} />}

      {record.textbox_feedback && (
        <div style={{ maxWidth: 400, wordBreak: "break-word" }}>
          <b>Textbox feedback:</b>
          <div>{record.textbox_feedback}</div>
        </div>
      )}
    </div>
  );

  TrackingDetails = record => (
    <div>
      <b>First tracked:</b>
      <div>{moment(record.first_tracked).format("DD/MM/YYYY, HH:mm")}</div>
      <Divider style={{ margin: "6px 0" }} />
      <b>Last tracked:</b>
      <div>
        {record.last_tracked
          ? moment(record.last_tracked).format("DD/MM/YYYY, HH:mm")
          : "N/A"}
      </div>
    </div>
  );

  EmailJobDetails = job => (
    <Table
      size="small"
      columns={[
        { title: "Recipient", dataIndex: "recipient", key: "recipient" },
        {
          title: "Feedback",
          render: (text, record) => {
            if (!job.included_feedback) return <Icon type="minus" />;

            var feedback =
              record.list_feedback && record.textbox_feedback
                ? `["${record.list_feedback}", "${record.textbox_feedback}"]`
                : record.list_feedback || record.textbox_feedback || "";

            return (
              <Popover content={this.FeedbackDetails(record)} trigger="hover">
                {feedback.length > 25
                  ? `${feedback.slice(0, 25)} ...`
                  : feedback}
              </Popover>
            );
          }
        },
        {
          title: "Tracking",
          dataIndex: "track_count",
          key: "track_count",
          render: (count, record) =>
            count > 0 ? (
              <Popover content={this.TrackingDetails(record)} trigger="hover">
                {count}
              </Popover>
            ) : (
              <Icon type="close" />
            )
        },
        {
          title: "Content",
          dataIndex: "content",
          key: "content",
          render: (text, record) => (
            <a
              onClick={() =>
                this.setState({
                  emailView: {
                    visible: true,
                    recipient: record.recipient,
                    subject: job.subject,
                    text
                  }
                })
              }
            >
              View
            </a>
          )
        }
      ]}
      dataSource={job.emails}
      rowKey="recipient"
      pagination={{ size: "small", pageSize: 5 }}
    />
  );

  EmailHistory = () => {
    const { action } = this.props;
    const { emailView } = this.state;

    const onCancel = () => this.setState({ emailView: { visible: false } });

    return (
      <div>
        <Table
          size="small"
          className="email_history"
          locale={{ emptyText: "No emails have been sent for this action" }}
          columns={[
            {
              title: "Date/Time",
              dataIndex: "initiated_at",
              key: "initiated_at",
              render: text => moment(text).format("DD/MM/YYYY, HH:mm")
            },
            { title: "Type", dataIndex: "type", key: "type" },
            { title: "Subject", dataIndex: "subject", key: "subject" },
            {
              title: "Feedback",
              dataIndex: "included_feedback",
              key: "included_feedback",
              render: text =>
                text ? <Icon type="check" /> : <Icon type="close" />
            },
            {
              title: "Tracking",
              render: (text, record) => {
                const trackedCount = record.emails.filter(
                  email => !!email.first_tracked
                ).length;
                const trackedPct = Math.round(
                  (trackedCount / record.emails.length) * 100
                );
                return (
                  <span>{`${trackedCount} of ${
                    record.emails.length
                  } (${trackedPct}%)`}</span>
                );
              }
            }
          ]}
          dataSource={action.emailJobs}
          expandedRowRender={this.EmailJobDetails}
          rowKey="job_id"
          pagination={{ size: "small", pageSize: 5 }}
        />

        <Modal
          visible={emailView.visible}
          onCancel={onCancel}
          footer={
            <Button type="primary" onClick={onCancel}>
              OK
            </Button>
          }
        >
          <div className="view_email">
            <div className="field">Recipient:</div>
            <div className="value">{emailView.recipient}</div>
            <div className="field">Subject:</div>
            <div className="value">{emailView.subject}</div>
            <div className="field">Date/Time:</div>
            <div className="value">
              {moment(emailView.initiated_at).format("DD/MM/YYYY, HH:mm")}
            </div>
            <Divider />
            <div
              className="email_content"
              dangerouslySetInnerHTML={{
                __html: emailView.text
              }}
            />
          </div>
        </Modal>
      </div>
    );
  };

  render() {
    const { action, form } = this.props;
    const {
      sending,
      previewing,
      error,
      scheduler,
      options,
      index,
      populatedContent
    } = this.state;

    return (
      <div className="email">
        <SchedulerModal
          {...scheduler}
          onUpdate={this.updateSchedule}
          onDelete={this.deleteSchedule}
          closeModal={this.closeSchedulerModal}
        />

        {action.schedule ? (
          <div>
            <h3>Current schedule</h3>

            <div className="panel scheduler">
              <div className="button floating">
                <Tooltip title="Update schedule">
                  <Button
                    shape="circle"
                    icon="edit"
                    size="small"
                    onClick={this.openSchedulerModal}
                  />
                </Tooltip>
              </div>

              {_.get(action, "schedule.startTime") && (
                <FormItem {...narrowFormItemLayout} label="Active from">
                  {moment(action.schedule.startTime).format("YYYY/MM/DD HH:mm")}
                </FormItem>
              )}

              {_.get(action, "schedule.endTime") && (
                <FormItem {...narrowFormItemLayout} label="Active to">
                  {moment(action.schedule.endTime).format("YYYY/MM/DD HH:mm")}
                </FormItem>
              )}

              <FormItem {...narrowFormItemLayout} label="Execute at">
                {moment(action.schedule.time).format("HH:mm")}
              </FormItem>

              <FormItem {...narrowFormItemLayout} label="Frequency">
                {action.schedule.frequency === "daily" &&
                  `
                  Every ${action.schedule.dayFrequency} ${
                    action.schedule.dayFrequency === "1" ? "day" : "days"
                  }
                `}

                {action.schedule.frequency === "weekly" &&
                  `
                  Every ${action.schedule.dayOfWeek
                    .sort((a, b) => this.dayMap[a].order - this.dayMap[b].order)
                    .map(day => this.dayMap[day].label)
                    .join(", ")}
                `}

                {action.schedule.frequency === "monthly" &&
                  `On the ${moment(action.schedule.dayOfMonth).format(
                    "Do"
                  )} of each month`}
              </FormItem>
            </div>
          </div>
        ) : (
          <Button
            icon="schedule"
            className="schedule_button"
            onClick={this.openSchedulerModal}
          >
            Schedule email sending
          </Button>
        )}

        <h3>Email settings</h3>

        <EmailSettings
          emailSettings={action.emailSettings}
          updateEmailSettings={this.updateEmailSettings}
          options={options}
          form={form}
        />

        <Divider dashed />

        <div>
          <h3>Email history</h3>

          {this.EmailHistory()}
        </div>

        <Divider dashed />

        <div>
          <h3>Content preview</h3>

          {populatedContent && (
            <div>
              <Button.Group>
                <Button
                  disabled={index === 0}
                  onClick={() => this.setState({ index: index - 1 })}
                >
                  <Icon type="left" />
                  Previous
                </Button>

                <Button
                  disabled={index === action.data.records.length - 1}
                  onClick={() => this.setState({ index: index + 1 })}
                >
                  Next
                  <Icon type="right" />
                </Button>
              </Button.Group>
              <span className="current_record">
                Record {index + 1} of {action.data.records.length}
              </span>
            </div>
          )}
        </div>

        <div className={`preview ${previewing && "loading"}`}>
          {previewing ? (
            <Spin size="large" />
          ) : (
            <div
              dangerouslySetInnerHTML={{
                __html: populatedContent[index]
              }}
            />
          )}
        </div>

        <Button
          loading={sending}
          type="primary"
          size="large"
          onClick={this.handleSubmit}
        >
          Send once-off email
        </Button>

        {error && <Alert message={error} className="error" type="error" />}
      </div>
    );
  }
}

export default Form.create()(Email);
