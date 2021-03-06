import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { Input, Icon, Tooltip, Button, Card, Modal } from "antd";
import { Link } from "react-router-dom";

import { deleteDataLab, cloneDataLab } from "../../dataLab/DataLabActions";

const { Meta } = Card;
const confirm = Modal.confirm;

class DataLabTab extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      { deleteDataLab, cloneDataLab },
      dispatch
    );

    this.state = { filter: null, deleting: {}, cloning: {} };
  }

  deleteDataLab = dataLabId => {
    confirm({
      title: "Confirm DataLab deletion",
      content:
        "All associated actions will be irrevocably deleted with the DataLab.",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { [dataLabId]: true }
        });

        this.boundActionCreators.deleteDataLab({
          dataLabId,
          onFinish: () => {
            this.setState({ deleting: { [dataLabId]: false } });
          }
        });
      }
    });
  };

  cloneDataLab = dataLabId => {
    confirm({
      title: "Confirm DataLab clone",
      content: "Are you sure you want to clone this DataLab?",
      onOk: () => {
        this.setState({
          cloning: { [dataLabId]: true }
        });

        this.boundActionCreators.cloneDataLab({
          dataLabId,
          onFinish: () => {
            this.setState({ cloning: { [dataLabId]: false } });
          }
        });
      }
    });
  };

  render() {
    const { containerId, dataLabs } = this.props;
    const { filter, deleting, cloning } = this.state;

    return (
      <div className="tab">
        {dataLabs &&
          dataLabs.length > 0 && (
            <div className="filter_wrapper">
              <div className="filter">
                <Input
                  placeholder="Filter DataLabs by name"
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

        {dataLabs &&
          dataLabs.map((dataLab, i) => {
            if (filter && !dataLab.name.includes(filter)) return null;

            return (
              <Card
                className="item"
                bodyStyle={{ flex: 1 }}
                title={dataLab.name}
                actions={[
                  <Link to={{ pathname: `/datalab/${dataLab.id}/data` }}>
                    <Tooltip title="Enter DataLab">
                      <Button icon="arrow-right" />
                    </Tooltip>
                  </Link>,
                  <Tooltip title="Clone DataLab">
                    <Button
                      icon="copy"
                      loading={dataLab.id in cloning && cloning[dataLab.id]}
                      onClick={() => this.cloneDataLab(dataLab.id)}
                    />
                  </Tooltip>,
                  <Tooltip title="Delete DataLab">
                    <Button
                      type="danger"
                      icon="delete"
                      loading={dataLab.id in deleting && deleting[dataLab.id]}
                      onClick={() => this.deleteDataLab(dataLab.id)}
                    />
                  </Tooltip>
                ]}
                key={i}
              >
                <Meta
                  description={
                    <div>
                      {`${dataLab.modules} module${dataLab.modules > 1 && "s"}`}
                    </div>
                  }
                />
              </Card>
            );
          })}
        <Link
          to={{
            pathname: `/datalab`,
            state: { containerId }
          }}
        >
          <div className="add item">
            <Icon type="plus" />
            <span>Create DataLab</span>
          </div>
        </Link>
      </div>
    );
  }
}

export default connect()(DataLabTab);
