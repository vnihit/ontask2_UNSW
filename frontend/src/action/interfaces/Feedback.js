import React from "react";

import {
  Form,
  Divider,
  Input,
  Button,
  notification,
  Alert,
  Select,
  Radio
} from "antd";
import moment from "moment";
import _ from "lodash";

import apiRequest from "../../shared/apiRequest";

class Feedback extends React.Component {
  state = { loading: false, dropdown: null, textbox: null };

  constructor(props) {
    super(props);
    const { feedback } = props;

    this.state = {
      loading: false,
      dropdown: _.get(feedback, "dropdown.value"),
      textbox: _.get(feedback, "textbox.value")
    };
  }

  submitFeedback = () => {
    const { feedback } = this.props;
    const { dropdown, textbox } = this.state;
    const { actionId, jobId } = feedback;

    if (!dropdown && !textbox) {
      notification["warning"]({
        message: "Feedback submission failed",
        description: "You did not provide any feedback."
      });
      return;
    }

    this.setState({ loading: true, error: null });

    apiRequest(`/action/${actionId}/submit_feedback/?job=${jobId}`, {
      method: "POST",
      payload: { dropdown, textbox },
      onSuccess: response => {
        if ("error" in response) {
          this.setState({ loading: false, error: response.error });
        } else {
          this.setState({ loading: false, didSubmit: true, error: null });
        }
      }
    });
  };

  render() {
    const { feedback } = this.props;
    const { dropdown, textbox, loading, error, didSubmit } = this.state;

    return (
      <div className="feedback">
        <h1>Feedback</h1>

        {"error" in feedback ? (
          <h2>{feedback.error}</h2>
        ) : (
          <div className="feedback">
            <div>
              {feedback.feedback_datetime && (
                <i style={{ marginBottom: 15, display: "block" }}>
                  {`You provided feedback on ${moment(
                    feedback.feedback_datetime
                  ).format("DD/MM/YYYY, HH:mm")}.`}
                </i>
              )}

              {feedback.dropdown.enabled && (
                <div>
                  <p style={{ marginBottom: 5, fontWeight: 500 }}>
                    {feedback.dropdown.question}
                  </p>

                  {feedback.dropdown.type === "dropdown" && (
                    <Select
                      value={dropdown}
                      onChange={e => this.setState({ dropdown: e })}
                      style={{ marginBottom: 15, width: "100%" }}
                    >
                      {feedback.dropdown.options.map((option, i) => (
                        <Select.Option value={option.value} key={i}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  )}

                  {feedback.dropdown.type === "radio" && (
                    <Radio.Group
                      value={dropdown}
                      onChange={e =>
                        this.setState({ dropdown: e.target.value })
                      }
                      style={{ marginBottom: 15, width: "100%" }}
                    >
                      {feedback.dropdown.options.map((option, i) => (
                        <Radio value={option.value} key={i}>
                          {option.label}
                        </Radio>
                      ))}
                    </Radio.Group>
                  )}
                </div>
              )}

              {feedback.textbox.enabled && (
                <div>
                  <p style={{ marginBottom: 5, fontWeight: 500 }}>
                    {feedback.textbox.question}
                  </p>
                  <Input.TextArea
                    rows={4}
                    value={textbox}
                    onChange={e => this.setState({ textbox: e.target.value })}
                    style={{ marginBottom: 15 }}
                  />
                </div>
              )}

              <Button
                size="large"
                type="primary"
                style={{ marginBottom: 15 }}
                loading={loading}
                onClick={this.submitFeedback}
              >
                Submit feedback
              </Button>

              {error && (
                <Alert
                  message={error}
                  type="error"
                  style={{ marginBottom: 15 }}
                />
              )}

              {didSubmit && (
                <Alert
                  message="Your feedback has been successfully received. Thank you."
                  type="success"
                  style={{ marginBottom: 15 }}
                />
              )}
            </div>

            <Divider />

            <p>
              For your reference, the correspondence you received is shown
              below:
            </p>

            <div className="view_email">
              <div className="field">Subject:</div>
              <div className="value">{feedback.subject}</div>
              <div className="field">Date/Time:</div>
              <div className="value">
                {moment(feedback.email_datetime).format("DD/MM/YYYY, HH:mm")}
              </div>
              <div className="field">Correspondence:</div>
              <div
                style={{ marginTop: 10 }}
                className="email_content"
                dangerouslySetInnerHTML={{
                  __html: feedback.content
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Form.create()(Feedback);
