import React from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Alert,
  Spin,
  Icon,
  Tooltip,
  Checkbox,
  Divider,
  Table,
  Modal,
  Popover
} from "antd";
import moment from "moment";
import _ from "lodash";

import * as ActionActions from "../ActionActions";

import { narrowFormItemLayout } from "../../shared/FormItemLayout";

import SchedulerModal from "../../scheduler/SchedulerModal";

const FormItem = Form.Item;
const Option = Select.Option;

class Email extends React.Component {
  constructor(props) {
    super(props);
    const { action } = props;

    const options = [];
    action.datalab.steps.forEach(step => {
      if (step.type === "datasource") {
        step = step.datasource;
        step.fields.forEach(field => {
          const label = step.labels[field];
          options.push(label);
        });
      }
    });

    this.state = {
      index: 0,
      scheduler: { visible: false, selected: null, data: {} },
      loading: { emailSettings: false, emailSend: false, preview: true },
      options,
      preview: null,
      error: null,
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

    ActionActions.previewContent({
      actionId: action.id,
      onError: error =>
        this.setState({
          loading: { ...this.state.loading, preview: false },
          error
        }),
      onSuccess: preview =>
        this.setState({
          preview,
          loading: { ...this.state.loading, preview: false },
          error: null
        })
    });
  }

  handleSubmit = () => {
    const { form, action } = this.props;
    const { loading } = this.state;

    form.validateFields((err, payload) => {
      if (err) return;

      this.setState({ loading: { ...loading, emailSend: true } });

      ActionActions.sendEmail({
        actionId: action.id,
        payload,
        onError: error =>
          this.setState({ loading: { ...loading, emailSend: false }, error }),
        onSuccess: () =>
          this.setState({
            loading: { ...loading, emailSend: false },
            error: null
          })
      });
    });
  };

  updateEmailSettings = () => {
    const { form, action, updateAction } = this.props;
    const { loading, error } = this.state;

    form.validateFields((err, payload) => {
      if (err) return;

      this.setState({ loading: { ...loading, emailSettings: true } });

      ActionActions.updateAction({
        actionId: action.id,
        payload,
        onError: () => {
          this.setState({
            loading: { ...loading, emailSettings: false },
            error
          });
        },
        onSuccess: action => {
          this.setState({
            loading: { ...loading, emailSettings: false },
            error: null
          });
          updateAction(action);
        }
      });
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

  TrackingDetails = record => (
    <div>
      <b>First tracked:</b>
      <div>{moment(record.first_tracked).format("DD/MM/YYYY - HH:mm")}</div>
      <Divider style={{ margin: "6px 0" }} />
      <b>Last tracked:</b>
      <div>
        {record.last_tracked
          ? moment(record.last_tracked).format("DD/MM/YYYY - HH:mm")
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
          dataIndex: "feedback",
          key: "feedback",
          render: text => (job.included_feedback ? text : <Icon type="minus" />)
        },
        {
          title: "Tracking",
          dataIndex: "first_tracked",
          key: "first_tracked",
          render: (text, record) =>
            job.included_tracking ? (
              !!text ? (
                <Popover content={this.TrackingDetails(record)} trigger="hover">
                  <Icon type="check" />
                </Popover>
              ) : (
                <Icon type="close" />
              )
            ) : (
              <Icon type="minus" />
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
              render: text => moment(text).format("DD/MM/YYYY - HH:mm")
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
              dataIndex: "included_tracking",
              key: "included_tracking",
              render: (text, record) => {
                const trackedCount = record.emails.filter(
                  email => !!email.first_tracked
                ).length;
                const trackedPct = Math.round(
                  (trackedCount / record.emails.length) * 100
                );
                return text ? (
                  <span>{`${trackedCount} of ${
                    record.emails.length
                  } (${trackedPct}%)`}</span>
                ) : (
                  <Icon type="close" />
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
              {moment(emailView.initiated_at).format("DD/MM/YYYY - HH:mm")}
            </div>
            <Divider />
            <div
              className="content"
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
    const { action, form, updateAction } = this.props;
    const { loading, error, scheduler, options, index, preview } = this.state;

    return (
      <div className="email">
        <SchedulerModal
          {...scheduler}
          onUpdate={ActionActions.updateSchedule}
          onDelete={ActionActions.deleteSchedule}
          onSuccess={action => updateAction(action)}
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

        <Form layout="horizontal" className="panel">
          <FormItem {...narrowFormItemLayout} label="Email field">
            {form.getFieldDecorator("emailSettings.field", {
              rules: [{ required: true, message: "Email field is required" }],
              initialValue: _.get(action, "emailSettings.field")
            })(
              <Select>
                {options.map((option, i) => {
                  return (
                    <Option value={option} key={i}>
                      {option}
                    </Option>
                  );
                })}
              </Select>
            )}
          </FormItem>

          <FormItem {...narrowFormItemLayout} label="Subject">
            {form.getFieldDecorator("emailSettings.subject", {
              rules: [{ required: true, message: "Subject is required" }],
              initialValue: _.get(action, "emailSettings.subject")
            })(<Input />)}
          </FormItem>

          <FormItem {...narrowFormItemLayout} label="Reply-to">
            {form.getFieldDecorator("emailSettings.replyTo", {
              rules: [{ required: true, message: "Reply-to is required" }],
              initialValue: _.get(
                action,
                "emailSettings.replyTo",
                localStorage.email
              )
            })(<Input />)}
          </FormItem>

          <FormItem
            {...narrowFormItemLayout}
            className="checkbox"
            label={
              <div className="field_label">
                Email tracking
                <Tooltip
                  title={`Uses a tracking pixel to determine whether the recipient
                  has opened/read the email`}
                >
                  <Icon type="question-circle-o" />
                </Tooltip>
              </div>
            }
          >
            {form.getFieldDecorator("emailSettings.include_tracking", {
              initialValue:
                _.get(action, "emailSettings.include_tracking") || false,
              valuePropName: "checked"
            })(<Checkbox />)}
          </FormItem>

          <FormItem
            {...narrowFormItemLayout}
            className="checkbox"
            label={
              <div className="field_label">
                Feedback form
                <Tooltip
                  title={`Includes a hyperlink to a form that allows recipients to 
                  provide feedback for this email`}
                >
                  <Icon type="question-circle-o" />
                </Tooltip>
              </div>
            }
          >
            {form.getFieldDecorator("emailSettings.include_feedback", {
              initialValue:
                _.get(action, "emailSettings.include_feedback") || false,
              valuePropName: "checked"
            })(<Checkbox />)}
          </FormItem>

          <div className="button">
            <Button
              loading={loading.emailSettings}
              onClick={this.updateEmailSettings}
            >
              Update
            </Button>
          </div>
        </Form>

        <Divider dashed />

        <div>
          <h3>Email history</h3>

          {this.EmailHistory()}
        </div>

        <Divider dashed />

        <div>
          <h3>Content preview</h3>

          {preview && (
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
                  disabled={index === action.filtered_data.length - 1}
                  onClick={() => this.setState({ index: index + 1 })}
                >
                  Next
                  <Icon type="right" />
                </Button>
              </Button.Group>
              <span className="current_record">
                Record {index + 1} of {action.filtered_data.length}
              </span>
            </div>
          )}
        </div>

        <div className={`preview ${loading.preview && "loading"}`}>
          {loading.preview ? (
            <Spin size="large" />
          ) : (
            <div
              style={{ maxHeight: 500 }}
              dangerouslySetInnerHTML={{
                __html: preview && preview.populatedContent[index]
              }}
            />
          )}
        </div>

        <Button
          loading={loading.emailSend}
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
