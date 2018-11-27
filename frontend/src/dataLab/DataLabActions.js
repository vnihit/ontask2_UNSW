import { notification, message } from "antd";
import requestWrapper from "../shared/requestWrapper";
import { fetchContainers } from "../container/ContainerActions";
import _ from "lodash";
import moment from "moment";

export const START_FETCHING = "START_FETCHING";
export const FINISH_FETCHING = "FINISH_FETCHING";
export const STORE_DATALAB = "STORE_DATALAB";

export const OPEN_VISUALISATION_MODAL = "OPEN_VISUALISATION_MODAL";
export const CLOSE_VISUALISATION_MODAL = "CLOSE_VISUALISATION_MODAL";

export const UPDATE_BUILD = "UPDATE_BUILD";
export const REFRESH_DATA = "REFRESH_DATA";

export const BEGIN_REQUEST_FORM_FIELD = "BEGIN_REQUEST_FORM_FIELD";
export const FINISH_REQUEST_FORM_FIELD = "FINISH_REQUEST_FORM_FIELD";

export const deleteDataLab = ({ dataLabId, onFinish }) => dispatch => {
  const parameters = {
    url: `/datalab/${dataLabId}/`,
    method: "DELETE",
    errorFn: error => {
      onFinish();
      notification["error"]({
        message: "DataLab deletion failed",
        description: error
      });
    },
    successFn: () => {
      onFinish();
      dispatch(fetchContainers());
      notification["success"]({
        message: "DataLab deleted",
        description: "The DataLab was successfully deleted."
      });
    }
  };

  requestWrapper(parameters);
};

export const cloneDataLab = ({ dataLabId, onFinish }) => dispatch => {
  const parameters = {
    url: `/datalab/${dataLabId}/clone_datalab/`,
    method: "POST",
    errorFn: error => {
      onFinish();
      notification["error"]({
        message: "DataLab clone failed",
        description: error
      });
    },
    successFn: () => {
      onFinish();
      dispatch(fetchContainers());
      notification["success"]({
        message: "DataLab clone",
        description: "The DataLab was successfully cloned."
      });
    }
  };

  requestWrapper(parameters);
};

const storeDataLab = dataLab => {
  // Convert DatePicker field timestamps to moment.js objects (required by DatePicker component)
  if ("steps" in dataLab)
    dataLab.steps.forEach(step => {
      if (step.type === "form") {
        if (step.form.activeFrom)
          step.form.activeFrom = moment(step.form.activeFrom);
        if (step.form.activeTo) step.form.activeTo = moment(step.form.activeTo);
      }
    });

  return {
    type: STORE_DATALAB,
    selectedId: dataLab.id,
    build: {
      name: dataLab.name,
      steps: dataLab.steps ? dataLab.steps : [],
      order: dataLab.order ? dataLab.order : [],
      errors: { steps: [] }
    },
    data: dataLab.data ? dataLab.data : [],
    datasources: dataLab.datasources,
    actions: dataLab.actions,
    filter: dataLab.filter,
    filteredData: dataLab.filteredData ? dataLab.filteredData : {} 
  };
};

export const fetchDataLab = dataLabId => dispatch => {
  dispatch({ type: START_FETCHING });

  const parameters = {
    url: `/datalab/${dataLabId}/`,
    method: "GET",
    errorFn: error => {
      dispatch({ type: FINISH_FETCHING });
      console.log(error);
    },
    successFn: response => {
      dispatch({ type: FINISH_FETCHING });
      dispatch(storeDataLab(response));
    }
  };

  requestWrapper(parameters);
};

export const fetchDatasources = containerId => dispatch => {
  dispatch({ type: START_FETCHING });

  const parameters = {
    url: `/container/${containerId}/retrieve_datasources/`,
    method: "GET",
    errorFn: error => {
      dispatch({ type: FINISH_FETCHING });
      console.log(error);
    },
    successFn: response => {
      const { datasources } = response;
      dispatch({ type: FINISH_FETCHING });
      dispatch(storeDataLab({ datasources }));
    }
  };

  requestWrapper(parameters);
};

export const addModule = mod => (dispatch, getState) => {
  const { dataLab } = getState();
  let build = Object.assign({}, dataLab.build);

  // Force the first module to be a datasource
  if (build.steps.length === 0 && mod.type !== "datasource") {
    message.error("The first module of a DataLab must be a datasource.");
    return;
  }

  // Initialize an object that represents this type of module
  const newModule = { type: mod.type, [mod.type]: { fields: [] } };

  // If the module is a datasource, add a label and type map
  if (mod.type === "datasource") {
    newModule.datasource.labels = {};
    newModule.datasource.types = {};
  }

  build.steps.push(newModule);

  // Initialize an object that will store errors for this module
  build.errors.steps.push({});

  dispatch({
    type: UPDATE_BUILD,
    build
  });
};

export const deleteModule = (isFeedbackTracking) => (dispatch, getState) => {
  const { dataLab } = getState();
  let build = Object.assign({}, dataLab.build);

  if (isFeedbackTracking) {
    build.includeTrackingFeedback = false;
  } else {
    // Delete the last module (only the righter-most module can be deleted)
    build.steps = build.steps.slice(0, -1);

    // Remove the last module's errors
    build.errors.steps = build.errors.steps.slice(0, -1);
  }

  dispatch({
    type: UPDATE_BUILD,
    build
  });
};

export const checkForDiscrepencies = ({ dataLabId, stepIndex, onFinish }) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  let build = Object.assign({}, dataLab.build);

  // Extract the build up until (and not including) the module to be checked for discrepencies
  const partialBuild = build.steps.slice(0, stepIndex);
  // Extract the specific module that is being checked for discrepencies
  const checkModule = build.steps[stepIndex];
  if (checkModule.datasource.discrepencies === null)
    delete checkModule.datasource.discrepencies;

  const parameters = {
    url: `/datalab/check_discrepencies/`,
    method: "POST",
    errorFn: error => console.log(error),
    successFn: result => onFinish(result),
    payload: { dataLabId, partialBuild, checkModule }
  };

  requestWrapper(parameters);
};

export const checkForUniqueness = ({ dataLabId, stepIndex, primaryKey, onFinish }) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  let build = Object.assign({}, dataLab.build);

  // Extract the build up until (and not including) the form module
  const partialBuild = build.steps.slice(0, stepIndex);

  const parameters = {
    url: `/datalab/check_uniqueness/`,
    method: "POST",
    errorFn: error => console.log(error),
    successFn: result => onFinish(result),
    payload: { dataLabId, partialBuild, primaryKey }
  };

  requestWrapper(parameters);
};

const performLogic = (step, field, value) => {
  const moduleType = step.type;
  step = step[step.type];

  if (moduleType === "datasource") {
    if (field === "id") {
      // The datasource was changed, so reset the fields
      delete step.primary;
      delete step.matching;
      step.fields = [];
      step.labels = {};
    }

    if (field === "edit" || field === "remove") {
      // Remove the field from the list of fields (if it's there)
      step.fields = step.fields.filter(field => field !== value);
      // Delete the field's label
      if (value in step.labels) delete step.labels[value];
    }
  }

  if (moduleType === "form") {
    if (field === "add") step.fields.push(value);
    if (field === "delete") step.fields.splice(value, 1);
    if (field === "import") {
      if (!value) {
        message.error("Failed to import fields - no data provided");
        return;
      }

      let fields;
      try {
        fields = JSON.parse(value);
      } catch (ex) {
        message.error("Failed to import fields - invalid JSON provided");
        return;
      }

      const existingFields = step.fields.map(field => field.name);
      fields.forEach((field, fieldIndex) => {
        if (!existingFields.includes(field.name)) return;

        let i = 1;
        while (existingFields.includes(`${field.name}_${i}`)) {
          i += 1;
        }
        fields[fieldIndex].name = `${field.name}_${i}`;
      });

      step.fields.push(...fields);
      message.success("Form fields imported");
    }
  }

  if (moduleType === "computed") {
    if (field === "add") step.fields.push(value);
    if (field === "delete") step.fields.splice(value, 1);
  }
};

export const updateBuild = ({ stepIndex, field, value, isNotField }) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  let build = Object.assign({}, dataLab.build);

  // Any field related to a module will call this function with a step index
  let step = _.get(build, `steps[${stepIndex}]`);

  // If this relates to a specific module
  if (step) {
    // Perform any specific logic required for this module type & field
    performLogic(step, field, value);

    if (!isNotField) {
      _.set(step[step.type], field, value);
      _.set(build.errors.steps[stepIndex], field, false);
    }
    // If this is a field for the DataLab itself (e.g. DataLab name), i.e. has no stepIndex
  } else {
    _.set(build, field, value);
    _.set(build.errors, field, false);
  }

  dispatch({
    type: UPDATE_BUILD,
    build
  });
};

const isBuildValid = build => {
  // Validate non-module fields
  build.errors.name = !build.name;

  // Validate module fields
  build.steps.forEach((step, stepIndex) => {
    if (step.type === "datasource") {
      const datasource = step.datasource;
      build.errors.steps[stepIndex] = {
        id: !datasource.id,
        primary: !datasource.primary,
        matching: stepIndex > 0 && !datasource.matching,
        fields: !("fields" in datasource && datasource.fields.length > 0)
      };
    }

    if (step.type === "form") {
      const form = step.form;
      build.errors.steps[stepIndex] = {
        primary: !form.primary,
        name: !form.name,
        fields: !("fields" in form && form.fields.length > 0),
        activeTo:
          form.activeFrom &&
          form.activeTo &&
          form.activeTo.isBefore(step.form.activeFrom),
        webForm: {
          permission:
            _.get(form, "webForm.active") && !_.get(form, "webForm.permission"),
          layout:
            _.get(form, "webForm.active") && !_.get(form, "webForm.layout")
        }
      };
    }

    if (step.type === "computed") {
      const computed = step.computed;
      build.errors.steps[stepIndex] = {
        fields: !("fields" in computed && computed.fields.length > 0)
      };
    }
  });

  let didError = true && build.errors.name;
  build.errors.steps.forEach(step =>
    // Iterate over the fields of the module and see if any returned an error
    Object.values(step).forEach(value => {
      // If the field is an object (e.g. web form), then iterate over that object's fields
      // and see if any returned an error. No need to do this recursively since there isn't
      // any deeper levels of nesting.
      if (Object(value) === value) {
        if (Object.values(value).includes(true)) didError = true;
      } else {
        // Otherwise just simply check if the field returned an error
        if (value) didError = true;
      }
    })
  );

  return !didError;
};

const cleanupBuild = build => {
  build.steps.forEach(step => {
    if (step.type === "datasource") {
      delete step.form;
      delete step.computed;

      if (_.get(step, "datasource.discrepencies") === null) {
        delete step.datasource.discrepencies;
      } else {
        if (_.get(step, "datasource.discrepencies.matching") === null)
          delete step.datasource.discrepencies.matching;
        if (_.get(step, "datasource.discrepencies.primary") === null)
          delete step.datasource.discrepencies.primary;
      }
    }

    if (step.type === "form") {
      delete step.datasource;
      delete step.computed;

      if (_.get(step, "form.activeFrom"))
        step.form.activeFrom = moment.utc(step.form.activeFrom);
      if (_.get(step, "form.activeTo"))
        step.form.activeTo = moment.utc(step.form.activeTo);

      if (
        !_.get(step, "form.webForm") ||
        _.get(step, "form.webForm.active") === false
      )
        delete step.form.webForm;
    }

    if (step.type === "computed") {
      delete step.datasource;
      delete step.form;
    }
  });
};

export const saveBuild = ({ containerId, onStart, onError, onSuccess }) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  const build = Object.assign({}, dataLab.build);
  const selectedId = dataLab.selectedId;
  const datasources = dataLab.datasources;

  if (containerId) build.container = containerId;

  // If no modules have been added, then return an error
  if (build.steps.length === 0) {
    message.error(
      "DataLab cannot be saved unless there is at least one module."
    );
    return;
  }

  // If errors are detected then prevent saving, and propagate the errors to the view
  if (!isBuildValid(build)) {
    message.error(
      "DataLab cannot be saved until all required fields are provided and any issues are resolved."
    );
    onError();
    dispatch({
      type: UPDATE_BUILD,
      build
    });
    return;
  }

  // Remove the errors from the payload
  delete build.errors;

  // Call onStart so that the model interface shows a loading indicator
  onStart();

  // Run custom functionality for each step depending on the module type
  cleanupBuild(build);

  // Perform save API call
  const parameters = {
    url: selectedId ? `/datalab/${selectedId}/` : "/datalab/",
    method: selectedId ? "PATCH" : "POST",
    errorFn: error => {
      onError();
      notification["error"]({
        message: `DataLab ${selectedId ? "update" : "creation"} failed`,
        description: error
      });
    },
    successFn: dataLab => {
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
      onSuccess(dataLab.id);
      notification["success"]({
        message: `DataLab ${selectedId ? "updated" : "created"}`,
        description: `The DataLab was successfully ${
          selectedId ? "updated" : "created"
        }.`
      });
    },
    payload: build
  };

  requestWrapper(parameters);
};

const beginRequestFormField = () => ({
  type: BEGIN_REQUEST_FORM_FIELD
});

const finishRequestFormField = () => ({
  type: FINISH_REQUEST_FORM_FIELD
});

export const updateFormValues = (dataLabId, payload, callback) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    initialFn: () => {
      dispatch(beginRequestFormField());
    },
    url: `/datalab/${dataLabId}/update_form_values/`,
    method: "PATCH",
    errorFn: error => {
      dispatch(finishRequestFormField());
      notification["error"]({
        message: "Failed to update form",
        description: error
      });
    },
    successFn: dataLab => {
      dispatch(finishRequestFormField());
      message.success("Form successfully updated.");
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
      callback();
    },
    payload
  };

  requestWrapper(parameters);
};

export const changeColumnOrder = (dataLabId, payload) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    initialFn: () => {},
    url: `/datalab/${dataLabId}/change_column_order/`,
    method: "PATCH",
    errorFn: error => {
      console.log(error);
      // notification['error']({
      //   message: 'Failed to update form',
      //   description: error
      // });
    },
    successFn: dataLab => {
      message.success("Column order successfully updated.");
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
    },
    payload
  };

  requestWrapper(parameters);
};

export const changeColumnVisibility = (dataLabId, payload) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    initialFn: () => {},
    url: `/datalab/${dataLabId}/change_column_visibility/`,
    method: "PATCH",
    errorFn: error => {
      console.log(error);
      // notification['error']({
      //   message: 'Failed to update form',
      //   description: error
      // });
    },
    successFn: dataLab => {
      message.success("Column visibility successfully updated.");
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
    },
    payload
  };

  requestWrapper(parameters);
};

export const updateFieldType = (dataLabId, payload) => (dispatch, getState) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    initialFn: () => {},
    url: `/datalab/${dataLabId}/update_field_type/`,
    method: "PATCH",
    errorFn: error => {
      console.log(error);
      // notification['error']({
      //   message: 'Failed to update form',
      //   description: error
      // });
    },
    successFn: dataLab => {
      message.success("Field type successfully updated.");
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
    },
    payload
  };

  requestWrapper(parameters);
};

export const openVisualisationModal = (visualise, isRowWise, record) => ({
  type: OPEN_VISUALISATION_MODAL,
  visualise,
  isRowWise,
  record
});

export const closeVisualisationModal = () => ({
  type: CLOSE_VISUALISATION_MODAL
});

export const updateVisualisationChart = (viewId, chartParams) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    // The 'retrieve_view' endpoint includes the datasources from the view's container, as 'datasources' in the response object
    // The datasources are used in the 'add imported column' interface of the view
    url: `/datalab/${viewId}/update_chart/`,
    method: "PATCH",
    errorFn: error => {
      console.log(error);
    },
    successFn: dataLab => {
      notification["success"]({
        message: "Chart successfully saved",
        description: "This chart were successfully saved."
      });

      dataLab.steps.forEach(step => {
        if (step.type === "form") {
          if (step.form.activeFrom)
            step.form.activeFrom = moment(step.form.activeFrom);
          if (step.form.activeTo)
            step.form.activeTo = moment(step.form.activeTo);
        }
      });

      dataLab.datasources = datasources;
      dispatch(closeVisualisationModal());
      dispatch(storeDataLab(dataLab));
    },
    payload: chartParams
  };
  requestWrapper(parameters);
};

export const updateDataLabForm = ({ dataLabId, payload, onFinish }) => (
  dispatch,
  getState
) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    url: `/datalab/${dataLabId}/update_datalab_form/`,
    method: "PATCH",
    errorFn: error => {
      notification["error"]({
        message: "Failed to update form",
        description: error
      });
      onFinish();
    },
    successFn: dataLab => {
      message.success("Form successfully updated.");
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
      onFinish();
    },
    payload
  };

  requestWrapper(parameters);
};

export const fetchForm = ({ payload, onFinish }) => dispatch => {
  const parameters = {
    url: `/datalab/retrieve_form/`,
    method: "POST",
    errorFn: error => console.log(error),
    successFn: result => onFinish(result),
    payload
  };

  requestWrapper(parameters);
};

export const updateWebForm = ({ payload, onFinish }) => dispatch => {
  const parameters = {
    url: `/datalab/update_web_form/`,
    method: "PATCH",
    errorFn: error => {
      console.log(error);
    },
    successFn: form => {
      onFinish(form);
      message.success("Form successfully updated.");
    },
    payload
  };

  requestWrapper(parameters);
};

export const changePinState = (dataLabId, payload) => (dispatch, getState) => {
  const { dataLab } = getState();
  const datasources = dataLab.datasources;

  const parameters = {
    initialFn: () => {},
    url: `/datalab/${dataLabId}/change_pinned_status/`,
    method: "PATCH",
    errorFn: error => {
      console.log(error);
    },
    successFn: dataLab => {
      message.success("Pinned status successfully updated.");
      dataLab.datasources = datasources;
      dispatch(storeDataLab(dataLab));
    },
    payload
  };

  requestWrapper(parameters);
};

export const updateFilter = dataLab => dispatch => {
  dispatch(storeDataLab(dataLab));
};

