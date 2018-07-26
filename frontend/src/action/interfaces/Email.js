import React from "react";
import { Form, Input, Select, Button, Alert, Spin, Icon, Tooltip } from "antd";
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
      error: null
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
      payload: { blockMap: action.content, html: action.html },
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

      ActionActions.updateEmailSettings({
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

          <div className="button">
            <Button
              loading={loading.emailSettings}
              onClick={this.updateEmailSettings}
            >
              Update
            </Button>
          </div>
        </Form>

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
                  disabled={index === preview.length - 1}
                  onClick={() => this.setState({ index: index + 1 })}
                >
                  Next
                  <Icon type="right" />
                </Button>
              </Button.Group>
              <span className="current_record">
                Record {index + 1} of {preview.populatedContent.length}
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
              dangerouslySetInnerHTML={{ __html: preview && preview.populatedContent[index] }}
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

        {error && <Alert message={error} type="error" />}
      </div>
    );
  }
}

export default Form.create()(Email);