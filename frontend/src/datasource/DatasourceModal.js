import React from "react";
import apiRequest from "../shared/apiRequest";
import {
  Button,
  Modal,
  Form,
  Input,
  Alert,
  Select,
  Upload,
  Icon,
  Tooltip,
  message,
  notification
} from "antd";
import _ from "lodash";

import formItemLayout from "../shared/FormItemLayout";

import "./Datasource.css";
import { updateContainer } from "../container/ContainerActions";

const FormItem = Form.Item;
const { TextArea } = Input;
const Option = Select.Option;
const Dragger = Upload.Dragger;

class DatasourceModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      file: null,
      fileError: null,
      loading: false,
      error: null,
      sheetnames: null
    };
  }

  createDatasource = ({ containerId, payload, file, onError, onSuccess }) => {
    payload.container = containerId;

    const { updateContainers } = this.props;

    let data;
    if (file) {
      data = new FormData();
      data.append("file", file, file.name);
      data.append("name", payload.name);
      data.append("container", payload.container);
      data.append("payload", JSON.stringify(payload));
    } else {
      data = payload;
    }

    const parameters = {
      method: "POST",
      onError: onError,
      onSuccess: container => {
        updateContainers(container);
        notification["success"]({
          message: "Datasource created",
          description: "The datasource was successfully created."
        });
      },
      payload: data,
      isJSON: !file
    };

    apiRequest(`/datasource/`, parameters);
  };

  updateDatasource = ({ datasourceId, payload, file, onError, onSuccess }) => {
    let data;
    if (file) {
      data = new FormData();
      data.append("file", file, file.name);
      data.append("name", payload.name);
      data.append("payload", JSON.stringify(payload));
    } else {
      data = payload;
    }

    const parameters = {
      method: "PATCH",
      onError: onError,
      onSuccess: container => {
        updateContainer(container);
        notification["success"]({
          message: "Datasource updated",
          description: "The datasource was successfully updated."
        });
      },
      payload: data,
      isJSON: !file
    };

    apiRequest(`/datasource/${datasourceId}/`, parameters);
  };

  handleOk = () => {
    const { form, selected, data, closeModal } = this.props;
    const { file, fileError } = this.state;

    form.validateFields((err, payload) => {
      if (err || fileError) return;

      if (
        ["xlsXlsxFile", "csvTextFile"].includes(payload.connection.dbType) &&
        !file &&
        !selected
      ) {
        this.setState({ fileError: "File is required" });
        return;
      }

      this.setState({ loading: true });

      const parameters = {
        containerId: data && data.containerId,
        datasourceId: selected && selected.id,
        payload,
        file,
        onError: error => this.setState({ loading: false, error }),
        onSuccess: () => {
          this.setState({ loading: false, error: null });
          form.resetFields();
          closeModal();
        }
      };

      if (!selected) {
        this.createDatasource(parameters);
      } else {
        this.updateDatasource(parameters);
      }
    });
  };

  handleCancel = () => {
    const { form, closeModal } = this.props;

    this.setState({
      file: null,
      fileError: null,
      loading: false,
      error: null,
      sheetnames: null
    });
    form.resetFields();
    closeModal();
  };

  fetchSheetnames = (file, payload) => {
    this.setState({ loading: true });

    let data;
    if (file) {
      data = new FormData();
      data.append("file", file, file.name);
    } else {
      data = payload;
    }

    const parameters = {
      method: "POST",
      onError: error => this.setState({ loading: false, error }),
      onSuccess: sheetnames => {
        this.setState({ loading: false, sheetnames });
      },
      payload: data,
      isJSON: !file
    };

    apiRequest(`/datasource/get_sheetnames/`, parameters);
  };

  handleFileDrop = e => {
    const file = e.file;
    const fileName = file.name.split(".");
    const extension = fileName[fileName.length - 1].toLowerCase();
    const fileSize = file.size / Math.pow(1024, 2); // File size in MB

    if (["xlsx", "xls"].includes(extension)) {
      this.fetchSheetnames(file);
    }

    const fileError = this.validateFile(extension, fileSize);
    this.setState({
      fileError, // If there are errors, save them to the state so they can be shown in the interface
      file: fileError ? null : file // If there are no errors, then save the file in the state
    });

    if (file) this.filenameAutocomplete(file.name);
  };

  validateFile = (extension, fileSize) => {
    // Validate file type
    if (!["txt", "csv", "xlsx", "xls"].includes(extension))
      return "This file type is not supported.";

    // Validate file size
    if (fileSize > 2) return "File must not be larger than 2MB";
  };

  filenameAutocomplete = name => {
    const { containers, form, datasource } = this.props;
    if (!name || form.getFieldValue("name") || datasource.selected) return;

    const { containerId } = this.props.datasource.data;

    const container = containers.find(c => c.id === containerId);

    const datasourceNames = container.datasources.map(data => data.name);
    const sortedName = [...datasourceNames].sort();

    const lastIndex = name.lastIndexOf(".");
    const currentName = name.substring(0, lastIndex);

    let i = 0;
    let resultname = currentName;
    sortedName.forEach(n => {
      if (n === resultname) {
        i++;
        resultname = `${currentName}_${i}`;
      }
    });

    form.setFieldsValue({ name: resultname });
  };

  S3Bucket = (fileName, extension) => {
    const { form, selected } = this.props;
    const { getFieldValue, getFieldDecorator } = form;

    const bucketName = getFieldValue("connection.bucket")
      ? getFieldValue("connection.bucket")
      : _.get(selected, "connection.bucket", "YOUR_BUCKET_NAME");

    const permission = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "Ontask access permission",
          Effect: "Allow",
          Principal: {
            AWS: [process.env.REACT_APP_AWS_ID]
          },
          Action: ["s3:GetObject"],
          Resource: [
            `arn:aws:s3:::${bucketName}/${
              fileName ? fileName : "YOUR_FILE_NAME"
            }`
          ]
        }
      ]
    };

    const copyToClipboard = () => {
      var textField = document.createElement("textarea");
      textField.innerHTML = JSON.stringify(permission, null, 2);
      document.body.appendChild(textField);
      textField.select();
      document.execCommand("copy");
      textField.remove();
      message.success("Copied bucket policy to clipboard");
    };

    return (
      <div>
        <FormItem {...formItemLayout} label="Bucket name">
          {getFieldDecorator("connection.bucket", {
            initialValue: _.get(selected, "connection.bucket"),
            rules: [{ required: true, message: "Bucket name is required" }]
          })(<Input />)}
        </FormItem>

        <FormItem {...formItemLayout} label="File name">
          {getFieldDecorator("connection.fileName", {
            initialValue: _.get(selected, "connection.fileName"),
            rules: [{ required: true, message: "File name is required" }]
          })(
            <Input
              onBlur={() => {
                if (["xlsx", "xls"].includes(extension)) {
                  this.fetchSheetnames(null, {
                    bucket: bucketName,
                    fileName: fileName
                  });
                }
              }}
            />
          )}
        </FormItem>

        <Alert
          className="info"
          message="If your file is inside a folder, add the folder to the file name (e.g. 2018s1/class.csv)"
          type="info"
          showIcon
        />

        <p>
          Please copy following policy to your bucket permission:
          <Tooltip
            placement="right"
            title="Adding this policy to your bucket permission is neccessary in order to provide OnTask with access to your file."
          >
            <Icon type="question-circle-o" className="info_tooltip" />
          </Tooltip>
        </p>

        <code className="bucket_policy">
          <Button
            shape="circle"
            icon="copy"
            size="small"
            onClick={copyToClipboard}
          />
          <pre>{JSON.stringify(permission, null, 2)}</pre>
        </code>
      </div>
    );
  };

  Delimiter = () => {
    const { form, selected } = this.props;
    const { getFieldDecorator } = form;

    return (
      <FormItem {...formItemLayout} label="Delimiter">
        {getFieldDecorator("connection.delimiter", {
          initialValue: _.get(selected, "connection.delimiter", ",")
        })(
          <Select>
            <Option value=",">Comma ,</Option>
            <Option value=" ">Tabs " "</Option>
            <Option value=";">Semi-colons ;</Option>
            <Option value="|">Pipes |</Option>
            <Option value="^">Carets ^</Option>
            <Option value="~">Tildes ~</Option>
          </Select>
        )}
      </FormItem>
    );
  };

  LocalFile = fileType => (
    <Dragger
      name="file"
      multiple={false}
      onChange={this.handleFileDrop}
      beforeUpload={() => false} // Prevent immediate upload upon file drop
      action="" // The uploading URL (required) however we do not make use of
      showUploadList={false}
    >
      <p className="ant-upload-drag-icon">
        <Icon type="inbox" />
      </p>
      <p className="ant-upload-text">
        Click or drag file to this area to upload
      </p>
      <p className="ant-upload-hint">
        <span>Supported file formats: </span>
        {fileType === "xlsXlsxFile" ? "xls/xlsx" : "csv/txt"}
      </p>
    </Dragger>
  );

  SheetNames = () => {
    const { form, selected } = this.props;
    const { sheetnames } = this.state;
    const { getFieldDecorator } = form;

    return (
      <FormItem {...formItemLayout} label="Sheet name">
        {getFieldDecorator("connection.sheetname", {
          initialValue: _.get(selected, "connection.sheetname"),
          rules: [{ required: true, message: "Sheet name is required" }]
        })(
          <Select>
            {sheetnames.map((option, i) => (
              <Option key={option}>{option}</Option>
            ))}
          </Select>
        )}
      </FormItem>
    );
  };

  ConnectionSettings = () => {
    const { form, selected } = this.props;
    const { getFieldDecorator } = form;

    return (
      <div>
        <FormItem {...formItemLayout} label="Host">
          {getFieldDecorator("connection.host", {
            initialValue: _.get(selected, "connection.host"),
            rules: [{ required: true, message: "Host is required" }]
          })(<Input />)}
        </FormItem>

        <FormItem {...formItemLayout} label="Database">
          {getFieldDecorator("connection.database", {
            initialValue: _.get(selected, "connection.database"),
            rules: [{ required: true, message: "Database is required" }]
          })(<Input />)}
        </FormItem>

        <FormItem {...formItemLayout} label="User">
          {getFieldDecorator("connection.user", {
            initialValue: _.get(selected, "connection.user"),
            rules: [{ required: true, message: "Database user is required" }]
          })(<Input />)}
        </FormItem>

        <FormItem {...formItemLayout} label="Password">
          {getFieldDecorator("connection.password", {
            rules: [
              { required: !selected, message: "Database password is required" }
            ]
          })(
            <Input
              type="password"
              placeholder={selected && "Change password"}
            />
          )}
        </FormItem>

        <FormItem {...formItemLayout} label="Query">
          {getFieldDecorator("connection.query", {
            initialValue: _.get(selected, "connection.query"),
            rules: [{ required: true, message: "Database query is required" }]
          })(<TextArea rows={2} />)}
        </FormItem>
      </div>
    );
  };

  render() {
    const { visible, selected, form } = this.props;
    const { loading, error, file, fileError, sheetnames } = this.state;

    const { getFieldValue, getFieldDecorator } = form;

    const fileType = getFieldValue("connection.dbType")
      ? getFieldValue("connection.dbType")
      : _.get(selected, "connection.dbType");

    const fileName = getFieldValue("connection.fileName")
      ? getFieldValue("connection.fileName")
      : _.get(selected, "connection.fileName");

    const extension = fileName
      ? fileName
          .split(".")
          .pop()
          .toLowerCase()
      : null;

    const requiresDelimiter =
      fileType === "csvTextFile" || ["csv", "txt"].includes(extension);
    const requiresSheetname =
      fileType === "xlsXlsxFile" || ["xlsx", "xls"].includes(extension);
    const requiresUpload = ["xlsXlsxFile", "csvTextFile"].includes(fileType);
    const requiresConnection = [
      "mysql",
      "postgresql",
      "sqlite",
      "mssql"
    ].includes(fileType);

    return (
      <Modal
        visible={visible}
        className="datasource"
        title={selected ? "Update datasource" : "Create datasource"}
        okText={selected ? "Update" : "Create"}
        onCancel={this.handleCancel}
        onOk={this.handleOk}
        confirmLoading={loading}
      >
        <Form layout="horizontal">
          <FormItem {...formItemLayout} label="Type">
            {getFieldDecorator("connection.dbType", {
              initialValue: _.get(selected, "connection.dbType"),
              rules: [{ required: true, message: "Type is required" }],
              onChange: () => this.setState({ sheetnames: null })
            })(
              <Select>
                <Option value="mysql">MySQL</Option>
                <Option value="postgresql">PostgreSQL</Option>
                <Option value="csvTextFile">csv/text file</Option>
                <Option value="xlsXlsxFile">xls/xlsx file</Option>
                <Option value="s3BucketFile">S3 bucket file</Option>
                <Option value="sqlite" disabled>
                  SQLite
                </Option>
                <Option value="mssql" disabled>
                  MSSQL
                </Option>
              </Select>
            )}
          </FormItem>

          <FormItem {...formItemLayout} label="Datasource name">
            {getFieldDecorator("name", {
              initialValue: _.get(selected, "name"),
              rules: [{ required: true, message: "Name is required" }]
            })(<Input />)}
          </FormItem>

          {fileType === "s3BucketFile" && this.S3Bucket(fileName, extension)}

          {requiresDelimiter && this.Delimiter()}

          {requiresUpload && this.LocalFile(fileType)}

          {file && (
            <div>
              <Icon type="paper-clip" />
              {file.name}
            </div>
          )}

          {requiresSheetname && sheetnames && this.SheetNames()}

          {requiresConnection && this.ConnectionSettings()}

          {fileError && (
            <Alert className="error" message={fileError} type="error" />
          )}
          {error && <Alert className="error" message={error} type="error" />}
        </Form>
      </Modal>
    );
  }
}

export default Form.create()(DatasourceModal);
