import React from "react";

import { Link } from "react-router-dom";
import { Layout, Breadcrumb, Icon, Button, Spin } from "antd";


import ContainerModal from "./ContainerModal";
import ContainerList from "./ContainerList";
import ContainerShare from "./ContainerShare";
import DatasourceModal from "../datasource/DatasourceModal";
import ActionModal from "../action/ActionModal";


import "./Container.css";

const { Content } = Layout;

class Container extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      container: { visible: false, selected: null },
      datasource: { visible: false, selected: null, data: {} },
      action: { visible: false, selected: null, data: {} },
      sharing: { visible: false, selected: null }
    };
  }

  componentDidMount() {
    this.boundActionCreators.fetchContainers();
  }

  openModal = ({ type, selected, data }) => {
    // Opens a model of the specified type
    // E.g. create/edit container, modify sharing permissions of a container
    this.setState({
      [type]: {
        visible: true,
        selected,
        data
      }
    });
  };

  closeModal = type => {
    // Close the model of the specified type, and clear the parameters
    this.setState({
      [type]: {
        visible: false,
        selected: null,
        data: {}
      }
    });
  };



  render() {
    const { isFetching, containers } = this.props;
    const {
      container,
      datasource,
      scheduler,
      action,
      sharing,
      dataPreview
    } = this.state;

    return (
      <div className="container">
        <Content className="wrapper">
          <Breadcrumb className="breadcrumbs">
            <Breadcrumb.Item>
              <Link to="/">Dashboard</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>Containers</Breadcrumb.Item>
          </Breadcrumb>

          <Layout className="layout">
            <Content className="content">
              <h1>Containers</h1>

              {isFetching ? (
                <Spin size="large" />
              ) : (
                <div>
                  <Button
                    onClick={() => this.openModal({ type: "container" })}
                    type="primary"
                    icon="plus"
                    size="large"
                    className="create_container"
                  >
                    New container
                  </Button>

                  <ContainerModal
                    {...container}
                    closeModal={() => this.closeModal("container")}
                  />

                  <DatasourceModal
                    {...datasource}
                    closeModal={() => this.closeModal("datasource")}
                    datasource={datasource}
                    containers={containers}
                  />



                  <ActionModal
                    {...action}
                    closeModal={() => this.closeModal("action")}
                  />

                  <ContainerShare
                    {...sharing}
                    closeModal={() => this.closeModal("sharing")}
                  />



                  {containers && containers.length > 0 ? (
                    <ContainerList openModal={this.openModal} />
                  ) : (
                    <h2>
                      <Icon type="info-circle-o" className="info_icon" />
                      Get started by creating your first container.
                    </h2>
                  )}
                </div>
              )}
            </Content>
          </Layout>
        </Content>
      </div>
    );
  }
}

const mapStateToProps = state => {
  const { isFetching, containers } = state.containers;

  return {
    isFetching,
    containers
  };
};

export default Container;
