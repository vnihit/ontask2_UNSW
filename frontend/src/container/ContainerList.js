import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { Collapse, Tabs } from "antd";
import _ from "lodash";

import * as ContainerActionCreators from "./ContainerActions";

import DatasourceTab from "./tabs/DatasourceTab";
import DataLabTab from "./tabs/DataLabTab";
import ActionTab from "./tabs/ActionTab";

import ContainerHeader from "./ContainerHeader";

const TabPane = Tabs.TabPane;
const Panel = Collapse.Panel;

class ContainerList extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      ContainerActionCreators,
      dispatch
    );
  }

  render() {
    const { containers, accordionKey, tabKey, openModal } = this.props;

    const currentUser = localStorage.getItem("email");

    return (
      <div className="container_list">
        <Collapse
          accordion
          onChange={this.boundActionCreators.changeContainerAccordion}
          activeKey={accordionKey}
        >
          {containers.map((container, i) => {
            const numDatasources = _.get(container, "datasources.length", 0);
            const numDataLabs = _.get(container, "datalabs.length", 0);
            const numActions = _.get(container, "actions.length", 0);

            return (
              <Panel
                header={
                  <ContainerHeader
                    container={container}
                    currentUser={currentUser}
                    openModal={openModal}
                  />
                }
                key={i}
              >
                <Tabs
                  activeKey={tabKey}
                  tabPosition="left"
                  tabBarStyle={{ minWidth: 160 }}
                  onChange={this.boundActionCreators.changeContainerTab}
                >
                  <TabPane tab={`Datasources (${numDatasources})`} key="1">
                    <DatasourceTab
                      containerId={container.id}
                      datasources={container.datasources}
                      openModal={openModal}
                    />
                  </TabPane>

                  <TabPane tab={`DataLabs (${numDataLabs})`} key="2">
                    <DataLabTab
                      containerId={container.id}
                      dataLabs={container.datalabs}
                      openModal={openModal}
                    />
                  </TabPane>

                  <TabPane tab={`Actions (${numActions})`} key="3">
                    <ActionTab
                      containerId={container.id}
                      dataLabs={container.datalabs}
                      actions={container.actions}
                      openModal={openModal}
                    />
                  </TabPane>
                </Tabs>
              </Panel>
            );
          })}
        </Collapse>
      </div>
    );
  }
}

const mapStateToProps = state => {
  const { containers, accordionKey, tabKey } = state.containers;

  return {
    containers,
    accordionKey,
    tabKey
  };
};

export default connect(mapStateToProps)(ContainerList);
