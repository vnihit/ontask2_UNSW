import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import {
  Modal,
  Form,
  Alert,
  Row,
  Tree,
  Select,
  Button,
  Input,
  Cascader,
  Icon
} from "antd";

import * as ActionActions from "../ActionActions";

import panelLayout from "../../shared/panelLayout";
import FormItemLayout from "../../shared/FormItemLayout";
import "./QueryBuilder.css";

const TreeNode = Tree.TreeNode;
const Option = Select.Option;
const FormItem = Form.Item;

class ConditionGroupModal extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      ActionActions,
      dispatch
    );

    this.state = { loading: false, error: null };
  }

  handleOk = () => {
    const { form, action, conditionGroupIndex, updateAction } = this.props;
    form.validateFields((err, conditionGroup) => {
      if (err) return;

      this.setState({ loading: true });

      conditionGroup.conditions.forEach(condition => {
        condition.formulas = condition.formulas.map(formula => ({
          field: formula.fieldOperator[0],
          operator: formula.fieldOperator[1],
          comparator: formula.comparator
        }));
      });

      if (conditionGroupIndex !== undefined)
        action.condition_groups[conditionGroupIndex] = conditionGroup;

      ActionActions.updateAction({
        actionId: action.id,
        payload: {
          condition_groups:
            conditionGroupIndex !== undefined
              ? action.condition_groups
              : [...action.condition_groups, conditionGroup]
        },
        onError: error => this.setState({ loading: false, error }),
        onSuccess: action => {
          updateAction(action);
          this.handleClose();
        }
      });
    });
  };

  handleClose = () => {
    const { closeModal } = this.props;

    this.setState({ loading: false, error: null });
    closeModal();
  };

  render() {
    const {
      form,
      formState,
      action,
      conditionGroupIndex,
      visible
    } = this.props;

    const { loading, error } = this.state;

    if (!action) return null;

    let options = [];
    action.datalab.steps.forEach(step => {
      if (step.type === "datasource") {
        step = step.datasource;
        step.fields.forEach(field => {
          const label = step.labels[field];
          const type = step.types[field];
          options.push({
            value: label,
            label: label,
            children:
              type === "text"
                ? [
                    { value: "==", label: "equal" },
                    { value: "!=", label: "not equal" }
                  ]
                : [
                    { value: "==", label: "equal" },
                    { value: "!=", label: "not equal" },
                    { value: "<", label: "less" },
                    { value: "<=", label: "less or equal" },
                    { value: ">", label: "greater" },
                    { value: ">=", label: "greater or equal" }
                  ]
          });
        });
      }
      if (step.type === "form") {
      }
    });

    let hasError; // Flag used to show an error that formulas must not be incomplete
    let formErrors = form.getFieldsError();
    if ("conditions" in formErrors) {
      // If an error is not present in a particular field, Ant Design stores the error value as undefined
      // We can easily remove these undefined errors by using JSON.parse(JSON.stringify(obj))
      formErrors = JSON.parse(JSON.stringify(formErrors.conditions));
      formErrors.forEach(condition => {
        if ("name" in condition) hasError = true;
        // Therefore, if there are actually keys present in the object, then there must be an error
        condition.formulas.forEach(formula => {
          if (Object.keys(formula).length > 0) hasError = true;
        });
      });
    }

    return (
      <Modal
        visible={visible}
        title={
          conditionGroupIndex !== undefined
            ? "Edit condition group"
            : "Create condition group"
        }
        okText={conditionGroupIndex !== undefined ? "Update" : "Create"}
        onCancel={this.handleClose}
        onOk={this.handleOk}
        confirmLoading={loading}
      >
        <Form layout="horizontal">
          <FormItem {...FormItemLayout} label="Name">
            {form.getFieldDecorator("name", {
              rules: [{ required: true, message: "Name is required" }]
            })(<Input />)}
          </FormItem>

          <QueryBuilder
            form={form}
            options={options}
            formState={formState}
            addCondition={this.boundActionCreators.addConditionToConditionGroup}
            addFormula={this.boundActionCreators.addFormulaToConditionGroup}
            deleteCondition={
              this.boundActionCreators.deleteConditionFromConditionGroup
            }
            deleteFormula={
              this.boundActionCreators.deleteFormulaFromConditionGroup
            }
          />

          {error && <Alert message={error} type="error" />}
          {hasError && (
            <Alert message="Formulas cannot be incomplete" type="error" />
          )}
        </Form>
      </Modal>
    );
  }
}

const QueryBuilder = ({
  form,
  options,
  formState,
  addCondition,
  addFormula,
  deleteCondition,
  deleteFormula
}) => {
  return (
    <div>
      <Button
        onClick={e => {
          e.stopPropagation();
          addCondition();
        }}
        style={{ textAlign: "right", marginBottom: "5px" }}
      >
        <Icon type="plus" />
        Add Condition
      </Button>

      <Row style={{ ...panelLayout }}>
        {formState &&
        formState.conditions &&
        formState.conditions.length > 0 ? (
          <Tree
            showLine
            defaultExpandAll={true}
            className="queryBuilder"
            expandedKeys={formState.conditions.map((_, i) => {
              return i.toString();
            })}
          >
            {formState.conditions.map((condition, i) => {
              const conditionCount = formState.conditions.length;
              const formulaCount = condition.formulas.length;
              return (
                <TreeNode
                  title={
                    <Condition
                      form={form}
                      conditionCount={conditionCount}
                      formulaCount={formulaCount}
                      addFormula={addFormula}
                      deleteCondition={deleteCondition}
                      index={i}
                    />
                  }
                  key={i}
                >
                  {condition.formulas &&
                    condition.formulas.map((formula, j) => (
                      <TreeNode
                        title={
                          <Field
                            form={form}
                            formula={formula}
                            i={i}
                            j={j}
                            options={options}
                            formulaCount={formulaCount}
                            deleteFormula={deleteFormula}
                          />
                        }
                        key={`${i}_${j}`}
                      />
                    ))}
                </TreeNode>
              );
            })}
          </Tree>
        ) : (
          <div>Get started by adding the first condition.</div>
        )}
      </Row>
    </div>
  );
};

const Condition = ({
  form,
  index,
  conditionCount,
  formulaCount,
  addFormula,
  deleteCondition
}) => {
  return (
    <div style={{ display: "flex" }}>
      {form.getFieldDecorator(`conditions[${index}].name`, {
        rules: [{ required: true, message: "Name is required" }]
      })(<Input size="small" placeholder="Condition name" />)}
      <ConditionControls
        form={form}
        index={index}
        conditionCount={conditionCount}
        formulaCount={formulaCount}
        addFormula={addFormula}
        deleteCondition={deleteCondition}
      />
    </div>
  );
};

const ConditionControls = ({
  form,
  type,
  index,
  conditionCount,
  formulaCount,
  addFormula,
  deleteCondition
}) => {
  return (
    <div style={{ display: "flex" }}>
      {/* 
      <Dropdown overlay={
        <Menu>
          <Menu.Item key="0">Add field</Menu.Item>
          <Menu.Item key="1">Add group</Menu.Item>
        </Menu>
      } trigger={['click']}>
        <Button size="small" icon="plus" shape="circle" style={{ marginLeft:'3px' }}/>
      </Dropdown>
      */}
      <Button
        onClick={e => {
          e.stopPropagation();
          addFormula(index);
        }}
        size="small"
        icon="plus"
        shape="circle"
        style={{ marginLeft: "3px" }}
      />
      {formulaCount > 1 &&
        form.getFieldDecorator(`conditions[${index}].type`, {
          rules: [{ required: true, message: "Type is required" }],
          initialValue: "and"
        })(
          <Select size="small" style={{ marginLeft: "3px", width: "66px" }}>
            <Option value="and">AND</Option>
            <Option value="or">OR</Option>
          </Select>
        )}
      {conditionCount > 1 && (
        <Button
          disabled={conditionCount < 2}
          size="small"
          type="danger"
          icon="delete"
          shape="circle"
          style={{ marginLeft: "3px" }}
          onClick={e => {
            e.stopPropagation();
            deleteCondition(index);
          }}
        />
      )}
    </div>
  );
};

const Field = ({
  form,
  options,
  formula,
  i,
  j,
  formulaCount,
  deleteFormula
}) => {
  return (
    <div style={{ display: "flex" }}>
      {form.getFieldDecorator(`conditions[${i}].formulas[${j}].fieldOperator`, {
        rules: [{ required: true, message: "Formula is required" }]
      })(<Cascader size="small" options={options} placeholder="Formula" />)}
      {form.getFieldDecorator(`conditions[${i}].formulas[${j}].comparator`, {
        rules: [{ required: true, message: "Comparator is required" }]
      })(
        <Input
          size="small"
          placeholder="Comparator"
          style={{ marginLeft: "3px" }}
        />
      )}
      {formulaCount > 1 && (
        <Button
          onClick={e => {
            e.stopPropagation();
            deleteFormula(i, j);
          }}
          size="small"
          type="danger"
          icon="delete"
          shape="circle"
          style={{ marginLeft: "3px" }}
        />
      )}
    </div>
  );
};

const mapStateToProps = state => {
  const { formState, conditionGroupIndex } = state.action;

  return {
    formState,
    conditionGroupIndex
  };
};

export default connect(mapStateToProps)(
  Form.create({
    onFieldsChange(props, payload) {
      const { dispatch } = props;
      dispatch(ActionActions.updateFormState(payload));
    },
    mapPropsToFields(props) {
      const { formState } = props;
      let fields = {};

      // These are fields that may have their values in the form state directly edited while they are still visible in the DOM
      // Therefore, when receiving a new prop (formState) mapPropsToFields updates the form values for us properly
      if (formState) {
        fields["name"] = formState.name && Form.createFormField(formState.name);

        formState.conditions &&
          formState.conditions.forEach((condition, i) => {
            fields[`conditions[${i}].name`] = Form.createFormField(
              formState.conditions[i].name ? formState.conditions[i].name : {}
            );

            fields[`conditions[${i}].type`] = Form.createFormField(
              formState.conditions[i].type ? formState.conditions[i].type : {}
            );

            condition.formulas &&
              condition.formulas.forEach((formula, j) => {
                fields[
                  `conditions[${i}].formulas[${j}].fieldOperator`
                ] = Form.createFormField(
                  formState.conditions[i].formulas[j].fieldOperator
                    ? formState.conditions[i].formulas[j].fieldOperator
                    : {}
                );

                fields[
                  `conditions[${i}].formulas[${j}].comparator`
                ] = Form.createFormField(
                  formState.conditions[i].formulas[j].comparator
                    ? formState.conditions[i].formulas[j].comparator
                    : {}
                );
              });
          });
      }
      return fields;
    }
  })(ConditionGroupModal)
);
