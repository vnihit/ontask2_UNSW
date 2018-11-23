import React from "react";
//import { bindActionCreators } from "redux";
//import { connect } from "react-redux";
import { Input, Icon, Tooltip, Button, Card, Modal } from "antd";
import apiRequest from "../../shared/apiRequest";
import { notification } from "antd";
import SchedulerModal from "../../scheduler/SchedulerModal";
import DataPreview from "../../datasource/DataPreview";

const { Meta } = Card;
const confirm = Modal.confirm;

class DatasourceTab extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      filter: null,
      loading: {},
      fetching: {},
      scheduler: { visible: false, selected: null, data: {} },
      dataPreview: { visible: false, selected: null, data: {} }
    };

  }

  getDatasourceData = ({
    datasourceId,
    onError,
    onSuccess
  })  => {
    const parameters = {
      
      method: 'GET',
      onError: onError,
      onSuccess: response => onSuccess(response.data)
    }
    apiRequest(`/datasource/${datasourceId}/`,parameters);
  }

  updateSchedule = ({ selected, payload, onError, onSuccess, isCreate }) => {
    const { updateContainers } = this.props;

    const parameters = {
      method: "PATCH",
      onError: onError,
      onSuccess: containers => {
        updateContainers(containers);
        notification["success"]({
          message: `Schedule ${isCreate ? "created" : "updated"}`,
          description: `The schedule was successfully ${
            isCreate ? "created" : "updated"
          }.`
        });
      },
      payload
    };

    apiRequest(`/datasource/${selected}/update_schedule/`, parameters);
  };

  deleteSchedule = ({ selected, onError, onSuccess }) => {
    const { updateContainers } = this.props;

    const parameters = {
      method: "PATCH",
      onError: onError,
      onSuccess: containers => {
        updateContainers(containers);
        notification["success"]({
          message: "Schedule deleted",
          description: "The schedule was successfully deleted."
        });
      }
    };
    apiRequest(`/datasource/${selected}/delete_schedule/`, parameters);
  };

  previewDatasource = datasourceId => {
    const { openModal } = this.props;

    this.setState({
      fetching: { [datasourceId]: true }
    });

    let onError = error => console.log(error);
    let onSuccess = datasource => {
      let columns = {};
      if (datasource.length !== 0) {
        columns = Object.keys(datasource[0]).map(k => {
          return { title: k, dataIndex: k };
        });
      }
      
      this.setState({ fetching: { [datasourceId]: false } });

      openModal({
        type: "dataPreview",
        data: { columns, datasource }
      });
    };

    const parameters = {
      method: 'GET',
      onError: onError,
      onSuccess: response => onSuccess(response.data)
    }

    apiRequest(`/datasource/${datasourceId}/`,parameters);
  };

  deleteDatasource = datasourceId => {
    const { updateContainers } = this.props;

    confirm({
      title: "Confirm datasource deletion",
      content: "Are you sure you want to delete this datasource?",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          loading: { [datasourceId]: true }
        });

        apiRequest(`/datasource/${datasourceId}/`, {
          method: "DELETE",
          onError: error => {
            this.setState({ loading: { [datasourceId]: false } });
            notification["error"]({
              message: "Datasource deletion failed",
              description: error
            });
          },
          onSuccess: containers => {
            this.setState({ loading: { [datasourceId]: false } });
            updateContainers(containers);
            notification["success"]({
              message: "Datasource deleted",
              description: "The datasource was successfully deleted."
            });
          }
        });
      }
    });
  };

  render() {
    const { containerId, datasources, openModal } = this.props;
    const { filter, loading, fetching, scheduler, dataPreview } = this.state;

    const typeMap = {
      mysql: "MySQL",
      postgresql: "PostgreSQL",
      xlsXlsxFile: "Excel file",
      csvTextFile: "CSV/text file",
      s3BucketFile: "S3 bucket file",
      sqlite: "SQLite",
      mssql: "MSSQL"
    };



    return (
      <div className="tab">
        {datasources && datasources.length > 0 && (
          <div className="filter_wrapper">
            <div className="filter">
              <Input
                placeholder="Filter datasources by name"
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
            </div>
          </div>
        )}

        {datasources &&
          datasources.map((datasource, i) => {
            if (filter && !datasource.name.includes(filter)) return null;

            let actions = [];
            actions.push(
              <Tooltip title="Edit datasource">
                <Button
                  icon="edit"
                  onClick={() => {
                    openModal({ type: "datasource", selected: datasource });
                  }}
                />
              </Tooltip>
            );

            if (
              [
                "mysql",
                "postgresql",
                "sqlite",
                "mssql",
                "s3BucketFile"
              ].includes(datasource.connection.dbType)
            )
              actions.push(
                <Tooltip
                  title={
                    "schedule" in datasource
                      ? "Update schedule"
                      : "Create schedule"
                  }
                >
                  <Button
                    icon="calendar"
                    onClick={() => {
                      openModal({
                        type: "scheduler",
                        selected: datasource.id,
                        data: {
                          schedule: datasource.schedule
                        }
                      });
                    }}
                  />
                </Tooltip>
              );

            actions.push(
              <Tooltip title="Preview datasource">
                <Button
                  icon="search"
                  loading={datasource.id in fetching && fetching[datasource.id]}
                  onClick={() => this.previewDatasource(datasource.id)}
                />
              </Tooltip>
            );

            actions.push(
              <Tooltip title="Delete datasource">
                <Button
                  type="danger"
                  icon="delete"
                  loading={datasource.id in loading && loading[datasource.id]}
                  onClick={() => this.deleteDatasource(datasource.id)}
                />
              </Tooltip>
            );

            return (
              <Card
                className="item"
                bodyStyle={{ flex: 1 }}
                title={datasource.name}
                actions={actions}
                key={i}
              >
                <Meta
                  description={
                    <span>{typeMap[datasource.connection.dbType]}</span>
                  }
                />
              </Card>
            );
          })}

        <SchedulerModal
          {...scheduler}
          onUpdate={this.updateSchedule}
          onDelete={this.deleteSchedule}
          closeModal={() => this.closeModal("scheduler")}
        />

        <DataPreview
          {...dataPreview}
          closeModal={() => this.closeModal("dataPreview")}
        />

        <div
          className="add item"
          onClick={() => {
            openModal({ type: "datasource", data: { containerId } });
          }}
        >
          <Icon type="plus" />
          <span>Add datasource</span>
        </div>
      </div>
    );
  }
}

export default DatasourceTab;
