import React from "react";
import { Input, Icon, Tooltip, Button, Card, Modal, Select, notification } from "antd";
import { Link } from "react-router-dom";

import apiRequest from "../../shared/apiRequest";

const { Meta } = Card;
const confirm = Modal.confirm;
const InputGroup = Input.Group;
const Option = Select.Option;

class ActionTab extends React.Component {
  state = { filter: null, filter_category: "name", deleting: {}, cloning: {} };

  deleteAction = actionId => {
    const { updateContainers } = this.props;

    confirm({
      title: "Confirm action deletion",
      content: "Are you sure you want to delete this action?",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { [actionId]: true }
        });

        apiRequest(`/action/${actionId}`, {
          method: "DELETE",
          onSuccess: containers => {
            this.setState({ deleting: { [actionId]: false } });
            updateContainers(containers);
            notification["success"]({
              message: "Action deleted",
              description: "The action was successfully deleted."
            });
          },
          onError: error => {
            this.setState({ deleting: { [actionId]: false } });
            notification["error"]({
              message: "Action deletion failed",
              description: error
            });
          }
        });
      }
    });
  };

  cloneAction = actionId => {
    const { updateContainers } = this.props;

    confirm({
      title: "Confirm action clone",
      content: "Are you sure you want to clone this action?",
      onOk: () => {
        this.setState({
          cloning: { [actionId]: true }
        });

        apiRequest(`/action/${actionId}/clone_action/`, {
          method: "POST",
          onSuccess: containers => {
            this.setState({ cloning: { [actionId]: false } });
            updateContainers(containers);
            notification["success"]({
              message: "Action cloned",
              description: "The action was successfully cloned."
            });
          },
          onError: error => {
            this.setState({ cloning: { [actionId]: false } });
            notification["error"]({
              message: "Action cloning failed",
              description: error
            });
          }
        });
      }
    });
  };

  render() {
    const { containerId, actions, dataLabs, openModal } = this.props;
    const { filter, deleting, cloning, filter_category } = this.state;

    return (
      <div className="tab">
        {actions && actions.length > 0 && (
          <div className="filter_wrapper">
            <div className="filter">
              <InputGroup compact>
                <Select
                  defaultValue="Name"
                  onChange={value => this.setState({ filter_category: value })}
                >
                  <Option value="name">Name</Option>
                  <Option value="datalab">DataLab</Option>
                </Select>
                <Input
                  style={{ width: "80%" }}
                  placeholder="Enter a value to filter by"
                  value={filter}
                  addonAfter={
                    <Tooltip title="Clear filter">
                      <Icon
                        type="close"
                        onClick={() => this.setState({ filter: null })}
                      />
                    </Tooltip>
                  }
                  onChange={e => this.setState({ filter: e.target.value })}
                />
              </InputGroup>
            </div>
          </div>
        )}
        {actions &&
          actions.map((action, i) => {
            const name = action.name.toLowerCase();
            const datalab = action.datalab.toLowerCase();
            if (
              (filter &&
                !name.includes(filter.toLowerCase()) &&
                filter_category === "name") ||
              (filter &&
                !datalab.includes(filter.toLowerCase()) &&
                filter_category === "datalab")
            )
              return null;

            return (
              <Card
                className="item"
                bodyStyle={{ flex: 1 }}
                title={action.name}
                actions={[
                  <Tooltip title="Enter action">
                    <Link to={`/action/${action.id}`}>
                      <Button icon="arrow-right" />
                    </Link>
                  </Tooltip>,
                  <Tooltip title="Edit action">
                    <Button
                      icon="edit"
                      onClick={() => {
                        openModal({
                          type: "action",
                          selected: action
                        });
                      }}
                    />
                  </Tooltip>,
                  <Tooltip title="Clone action">
                    <Button
                      icon="copy"
                      loading={action.id in cloning && cloning[action.id]}
                      onClick={() => this.cloneAction(action.id)}
                    />
                  </Tooltip>,
                  <Tooltip title="Delete action">
                    <Button
                      type="danger"
                      icon="delete"
                      loading={action.id in deleting && deleting[action.id]}
                      onClick={() => this.deleteAction(action.id)}
                    />
                  </Tooltip>
                ]}
                key={i}
              >
                <Meta
                  description={
                    <div>
                      {action.description
                        ? action.description
                        : "No description provided"}
                    </div>
                  }
                />
              </Card>
            );
          })}
        <div
          className="add item"
          onClick={() => {
            openModal({ type: "action", data: { containerId, dataLabs } });
          }}
        >
          <Icon type="plus" />
          <span>Create action</span>
        </div>
      </div>
    );
  }
}

export default ActionTab;
