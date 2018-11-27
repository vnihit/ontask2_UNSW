import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import {
  Table,
  Icon,
  Menu,
  Dropdown,
  Popover,
  Tooltip,
  Button,
  Input,
  notification
} from "antd";
import moment from "moment";

import * as DataLabActionCreators from "../DataLabActions";

import VisualisationModal from "../visualisation/VisualisationModal";

import EditableField from "../data-manipulation/EditableField";

import QueryBuilder from "../../action/interfaces/QueryBuilder";

import apiRequest from "../../shared/apiRequest";

const Search = Input.Search;

const methodMap = {
  POST: "created",
  PUT: "updated",
  DELETE: "deleted"
};

class Data extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      DataLabActionCreators,
      dispatch
    );

    this.state = {
      sort: {},
      editable: {},
      edit: { field: null, primary: null },
      saved: {},
      searchTerm: "",
      querybuilder: {
        visible: false
      }
    };
  }

  initialiseData = () => {
    const { filteredData, build } = this.props;
    const { searchTerm } = this.state;

    if (!filteredData || !build) return [];

    const { data } = filteredData;

    const term = searchTerm.trim().toLowerCase();

    const tableData =
      term === ""
        ? data
        : data.filter(row =>
            String(Object.values(row))
              .toLowerCase()
              .includes(term)
          );

    return tableData;
  };

  initialiseColumns = () => {
    const { build } = this.props;

    if (!build) return [];

    // Initialise the columns of the data table
    const columns = [];
    build.steps.forEach((step, stepIndex) => {
      if (step.type === "datasource")
        columns.push(...this.DatasourceColumns(stepIndex));

      if (step.type === "form") columns.push(...this.FormColumns(stepIndex));

      if (step.type === "computed")
        columns.push(...this.ComputedColumns(stepIndex));
    });

    // Order the columns
    const unPinnedColumns = [];
    const pinnedColumns = [];
    build.order.forEach(orderItem => {
      const column = columns.find(
        column =>
          column.stepIndex === orderItem.stepIndex &&
          column.field === orderItem.field
      );
      if (column && orderItem.visible) {
        if (!orderItem.pinned) unPinnedColumns.push(column);
        if (orderItem.pinned) pinnedColumns.push({ ...column, fixed: "left" });
      }
    });

    const orderedColumns = pinnedColumns.concat(unPinnedColumns);

    // Identify the first non-primary field
    const firstNonPrimaryField = orderedColumns.find(column => {
      const step = build.steps[column.stepIndex];
      return column.field !== step[step.type].primary;
    });

    // Only show the row-wise visualisations column if we have at
    // least one non-primary field in the dataset
    if (firstNonPrimaryField) {
      const defaultVisualisation = {
        stepIndex: firstNonPrimaryField.stepIndex,
        field: firstNonPrimaryField.field
      };

      orderedColumns.unshift({
        className: "column",
        title: "Action",
        fixed: "left",
        dataIndex: 0,
        key: 0,
        render: (index, value) => (
          <a>
            <Icon
              type="area-chart"
              onClick={() =>
                this.boundActionCreators.openVisualisationModal(
                  defaultVisualisation,
                  true,
                  value
                )
              }
            />
          </a>
        )
      });
    }

    return orderedColumns;
  };

  handleHeaderClick = (e, stepIndex, field, primary) => {
    switch (e.key) {
      case "visualise":
        this.boundActionCreators.openVisualisationModal({ stepIndex, field });
        break;

      case "edit":
        this.setState({ edit: { field: field.name, primary } });
        break;

      default:
        break;
    }
  };

  TruncatedLabel = label =>
    label.length > 15 ? (
      <Popover content={label}>{`${label.slice(0, 15)}...`}</Popover>
    ) : (
      label
    );

  DatasourceColumns = stepIndex => {
    const { build } = this.props;
    // const { sort } = this.state;

    const step = build.steps[stepIndex]["datasource"];
    const columns = [];

    step.fields.forEach(field => {
      const label = step.labels[field];
      const truncatedLabel = this.TruncatedLabel(label);

      const isPrimaryOrMatching = [step.matching, step.primary].includes(field);

      const title = isPrimaryOrMatching ? (
        truncatedLabel
      ) : (
        <div className="column_header">
          <Dropdown
            trigger={["click"]}
            overlay={
              <Menu onClick={e => this.handleHeaderClick(e, stepIndex, field)}>
                <Menu.Item key="visualise">
                  <Icon type="area-chart" style={{ marginRight: 5 }} />
                  Visualise
                </Menu.Item>
              </Menu>
            }
          >
            <a className="datasource">{label}</a>
          </Dropdown>
        </div>
      );

      columns.push({
        className: "column",
        stepIndex,
        field,
        dataIndex: label,
        key: label,
        // sorter: (a, b) => {
        //   a = label in a && a[label];
        //   b = label in b && b[label];
        //   return a.localeCompare(b);
        // },
        // sortOrder: sort && sort.field === label && sort.order,
        title,
        render: text => text
      });
    });

    return columns;
  };

  FormColumns = stepIndex => {
    const { build } = this.props;
    // const { sort, edit } = this.state;
    const { edit } = this.state;

    const step = build.steps[stepIndex]["form"];
    const columns = [];

    let isActive = true;
    if (step.activeFrom && !moment().isAfter(step.activeFrom)) isActive = false;
    if (step.activeTo && !moment().isBefore(step.activeTo)) isActive = false;

    step.fields.forEach(field => {
      const label = field.name;
      const truncatedLabel = this.TruncatedLabel(label);

      const title = (
        <div className="column_header">
          <Dropdown
            trigger={["click"]}
            overlay={
              <Menu
                onClick={e =>
                  this.handleHeaderClick(e, stepIndex, field, step.primary)
                }
              >
                <Menu.Item key="edit" disabled={!isActive}>
                  <Tooltip
                    title={
                      !isActive &&
                      "This column cannot be edited as it belongs to a form that is no longer active"
                    }
                  >
                    <Icon type="edit" style={{ marginRight: 5 }} />
                    Enter data
                  </Tooltip>
                </Menu.Item>

                {/* <Menu.Item key="visualise">
                  <Icon type="area-chart" style={{ marginRight: 5 }} />
                  Visualise
                </Menu.Item> */}
              </Menu>
            }
          >
            <a className="form">{truncatedLabel}</a>
          </Dropdown>

          {edit.field === field.name && (
            <Tooltip title="Finish editing">
              <Button
                shape="circle"
                className="button"
                size="small"
                icon="check"
                style={{ marginLeft: 5 }}
                onClick={() =>
                  this.setState({ edit: { field: null, primary: null } })
                }
              />
            </Tooltip>
          )}
        </div>
      );

      columns.push({
        className: "column",
        stepIndex,
        field: label,
        title,
        dataIndex: label,
        key: label,
        // sorter: (a, b) => {
        //   a = label in a ? a[label] : "";
        //   b = label in b ? b[label] : "";
        //   if (typeof a === "number" && typeof b === "number")
        //     return a < b
        //   return a.toString().localeCompare(b.toString());
        // },
        // sortOrder: sort && sort.field === label && sort.order,
        render: (text, record) =>
          this.renderFormField(stepIndex, field, text, record[step.primary])
      });
    });

    return columns;
  };

  ComputedColumns = stepIndex => {
    const { build } = this.props;
    // const { sort } = this.state;

    const step = build.steps[stepIndex]["computed"];
    const columns = [];

    step.fields.forEach(field => {
      const label = field.name;
      const truncatedLabel = this.TruncatedLabel(label);

      const title = (
        <div className="column_header">
          {/* <Dropdown
            trigger={["click"]}
            overlay={
              <Menu onClick={e => this.handleHeaderClick(e, stepIndex, field)}>
                <Menu.Item key="visualise">
                  <Icon type="area-chart" style={{ marginRight: 5 }} />
                  Visualise
                </Menu.Item>
              </Menu>
            }
          > */}
          <a className="computed">{truncatedLabel}</a>
          {/* </Dropdown> */}
        </div>
      );

      columns.push({
        className: "column",
        stepIndex,
        field: label,
        title,
        dataIndex: label,
        key: label,
        // sorter: (a, b) => {
        //   a = label in a ? a[label] : "";
        //   b = label in b ? b[label] : "";
        //   if (typeof a === "number" && typeof b === "number")
        //     return a < b
        //   return a.toString().localeCompare(b.toString());
        // },
        // sortOrder: sort && sort.field === label && sort.order,
        render: text => {
          if (Array.isArray(text)) return text.join(", ");
          return text;
        }
      });
    });

    return columns;
  };

  renderFormField = (stepIndex, field, text, primary) => {
    const { edit } = this.state;

    return (
      <div className="editable-field">
        <EditableField
          field={field}
          originalValue={text ? text : null}
          editMode={edit.field === field.name}
          onSave={value => {
            const payload = { stepIndex, field: field.name, primary, value };
            this.handleFormUpdate(payload);
          }}
        />
      </div>
    );
  };

  handleFormUpdate = payload => {
    const { selectedId } = this.props;
    const { saved } = this.state;

    this.boundActionCreators.updateDataLabForm({
      dataLabId: selectedId,
      payload,
      onFinish: () => {
        this.setState({ saved: { ...saved, [payload.primary]: true } }, () => {
          setTimeout(
            () =>
              this.setState({ saved: { ...saved, [payload.primary]: false } }),
            1500
          );
        });
      }
    });
  };

  handleChange = (pagination, filter, sort) => {
    this.setState({ filter, sort });
  };

  createQueryModules = () => {
    // datalab has different structure with action
    // since quertBuyild component needs a "modules" parameter
    // we create it manually from build.step

    const { build } = this.props;
    if (!build) return null;

    const { steps } = build;
    const modules = [];

    let computedFiled = [];

    steps.forEach(step => {
      let fields, name, type;
      if (step.type === "datasource") {
        const { datasource } = step;
        fields = Object.values(datasource.labels);
        name = datasource.name;
        type = "datasource";
        modules.push({ fields, name, type });
      }

      if (step.type === "form") {
        const { form } = step;
        name = form.name;
        fields = form.fields.map(f => f.name);
        type = "form";
        modules.push({ fields, name, type });
      }

      if (step.type === "computed") {
        const { computed } = step;
        fields = computed.fields.map(f => f.name);
        computedFiled = computedFiled.concat(fields);
      }
    });

    modules.push({ type: "computed", fields: computedFiled });

    return modules;
  };

  createQueryTypes = () => {
    // The same with createQueryModules() function above
    // we create parameter "types" manually

    const { build } = this.props;
    if (!build) return null;

    const { steps } = build;

    let types = {};
    steps.forEach(step => {
      if (step.type === "datasource") {
        const { datasource } = step;
        let type = {};
        datasource.fields.forEach(f => {
          type[datasource.labels[f]] = datasource.types[f];
        });
        types = { ...types, ...type };
      } else {
        const dataType = step.type;
        const data = step[dataType];
        data.fields.forEach(f => {
          types[f.name] = f.type;
        });
      }
    });

    return types;
  };

  updateFilter = ({ filter, method, onSuccess, onError }) => {
    const { selectedId } = this.props;

    apiRequest(`/datalab/${selectedId}/filter/`, {
      method,
      payload: { filter },
      onSuccess: datalab => {
        notification["success"]({
          message: `Filter successfully ${methodMap[method]}.`
        });
        onSuccess();
        this.boundActionCreators.updateFilter(datalab);
      },
      onError: error => onError(error)
    });
  };

  render() {
    const { visualisation, edit, saved, searchTerm, querybuilder } = this.state;
    const { filter, filteredData } = this.props;

    // Similarly, the table data is initialised on every render, so that
    // changes to values in form columns can be reflected
    const tableData = this.initialiseData();

    // Columns are initialised on every render, so that changes to the sort
    // in local state can be reflected in the table columns. Otherwise the
    // columns would ideally only be initialised when receiving the build
    // for the first time
    const orderedColumns = this.initialiseColumns();

    const queryModules = this.createQueryModules();
    const queryTypes = this.createQueryTypes();

    return (
      <div className="data">
        {queryModules && queryTypes && (
          <QueryBuilder
            {...querybuilder}
            type={"filter"}
            modules={queryModules}
            types={queryTypes}
            onClose={() => this.setState({ querybuilder: { visible: false } })}
            onSubmit={this.updateFilter}
          />
        )}

        <div className="datalab-view">
          <Button
            className="create-filter-button"
            size="large"
            icon="edit"
            onClick={() => {
              this.setState({
                querybuilder: { visible: true, selected: filter }
              });
            }}
          >
            Filter
          </Button>
          {filter ? (
            <span>
              {filteredData.filteredLength} records selected out of{" "}
              {filteredData.unfilteredLength} (
              {filteredData.unfilteredLength - filteredData.filteredLength}{" "}
              filtered out)
            </span>
          ) : (
            <span> No filter is currently being applied </span>
          )}
        </div>
        <div className="filter">
          <Search
            className="searchbar"
            size="large"
            placeholder="Quick Search..."
            value={searchTerm}
            onChange={e => this.setState({ searchTerm: e.target.value })}
          />
        </div>
        <div className="data_manipulation">
          <VisualisationModal
            {...visualisation}
            closeModal={() =>
              this.setState({ visualisation: { visible: false } })
            }
          />

          <Table
            rowKey={(record, index) => index}
            columns={orderedColumns}
            dataSource={orderedColumns.length > 0 ? tableData : []}
            scroll={{ x: (orderedColumns.length - 1) * 175 }}
            onChange={this.handleChange}
            pagination={{
              showSizeChanger: true,
              pageSizeOptions: ["10", "25", "50", "100"]
            }}
            rowClassName={record =>
              edit.primary in record && saved[record[edit.primary]]
                ? "saved"
                : ""
            }
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => {
  const { build, selectedId, filter, filteredData } = state.dataLab;
  return { build, selectedId, filter, filteredData };
};

export default connect(mapStateToProps)(Data);
