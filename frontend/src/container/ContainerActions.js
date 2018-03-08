import requestWrapper from '../shared/requestWrapper';

export const REQUEST_CONTAINERS = 'REQUEST_CONTAINERS';
export const RECEIVE_CONTAINERS = 'RECEIVE_CONTAINERS';
export const CHANGE_CONTAINER_ACCORDION = 'CHANGE_CONTAINER_ACCORDION';

export const OPEN_CONTAINER_MODAL = 'OPEN_CONTAINER_MODAL';
export const CLOSE_CONTAINER_MODAL = 'CLOSE_CONTAINER_MODAL';
export const BEGIN_REQUEST_CONTAINER = 'BEGIN_REQUEST_CONTAINER';
export const FAILURE_REQUEST_CONTAINER = 'FAILURE_CREATE_CONTAINER';
export const SUCCESS_CREATE_CONTAINER = 'SUCCESS_CREATE_CONTAINER';
export const SUCCESS_UPDATE_CONTAINER = 'SUCCESS_UPDATE_CONTAINER';
export const SUCCESS_DELETE_CONTAINER = 'SUCCESS_DELETE_CONTAINER';

export const OPEN_WORKFLOW_MODAL = 'OPEN_WORKFLOW_MODAL';
export const CLOSE_WORKFLOW_MODAL = 'CLOSE_WORKFLOW_MODAL';
export const BEGIN_REQUEST_WORKFLOW = 'BEGIN_REQUEST_WORKFLOW';
export const FAILURE_REQUEST_WORKFLOW = 'FAILURE_REQUEST_WORKFLOW';
export const SUCCESS_CREATE_WORKFLOW = 'SUCCESS_CREATE_WORKFLOW';
export const SUCCESS_UPDATE_WORKFLOW = 'SUCCESS_UPDATE_WORKFLOW';
export const SUCCESS_DELETE_WORKFLOW = 'SUCCESS_DELETE_WORKFLOW';


const requestContainers = () => ({
  type: REQUEST_CONTAINERS
});

const receiveContainers = (containers) => ({
  type: RECEIVE_CONTAINERS,
  containers
});

export const changeContainerAccordion = (key) => ({
  type: CHANGE_CONTAINER_ACCORDION,
  key
});

export const fetchContainers = () => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(requestContainers());
    },
    url: `/container/retrieve_containers/`,
    method: 'GET',
    errorFn: (error) => {
      console.error(error);
    },
    successFn: (containers) => {
      dispatch(receiveContainers(containers));
    }
  }

  requestWrapper(parameters);
};

export const openContainerModal = (container) => ({
  type: OPEN_CONTAINER_MODAL,
  container
});

export const closeContainerModal = () => ({
  type: CLOSE_CONTAINER_MODAL
});

const beginRequestContainer = () => ({
  type: BEGIN_REQUEST_CONTAINER
});

const failureRequestContainer = (error) => ({
  type: FAILURE_REQUEST_CONTAINER,
  error
});

const successCreateContainer = () => ({
  type: SUCCESS_CREATE_CONTAINER
});

export const createContainer = (payload) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(beginRequestContainer());
    },
    url: `/container/`,
    method: 'POST',
    errorFn: (error) => {
      dispatch(failureRequestContainer(error));
    },
    successFn: () => {
      dispatch(successCreateContainer());
      dispatch(fetchContainers());
    },
    payload: payload
  }

  requestWrapper(parameters);
};

const successUpdateContainer = () => ({
  type: SUCCESS_UPDATE_CONTAINER
});

export const updateContainer = (containerId, payload) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(beginRequestContainer());
    },
    url: `/container/${containerId}/`,
    method: 'PUT',
    errorFn: (error) => {
      dispatch(failureRequestContainer(error));
    },
    successFn: () => {
      dispatch(successUpdateContainer());
      dispatch(fetchContainers());
    },
    payload: payload
  }

  requestWrapper(parameters);
};

const successDeleteContainer = () => ({
  type: SUCCESS_DELETE_CONTAINER
});

export const deleteContainer = (containerId) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(beginRequestContainer());
    },
    url: `/container/${containerId}/`,
    method: 'DELETE',
    errorFn: (error) => {
      dispatch(failureRequestContainer(error));
    },
    successFn: () => {
      dispatch(successDeleteContainer());
      dispatch(fetchContainers());
    }
  }

  requestWrapper(parameters);
};

export const openWorkflowModal = (containerId, workflow) => ({
  type: OPEN_WORKFLOW_MODAL,
  containerId,
  workflow
});

export const closeWorkflowModal = () => ({
  type: CLOSE_WORKFLOW_MODAL
});

const beginRequestWorkflow = () => ({
  type: BEGIN_REQUEST_WORKFLOW
});

const failureRequestWorkflow = (error) => ({
  type: FAILURE_REQUEST_WORKFLOW,
  error
});

const successCreateWorkflow = () => ({
  type: SUCCESS_CREATE_WORKFLOW
});

export const createWorkflow = (containerId, payload) => dispatch => {
  payload.container = containerId;

  const parameters = {
    initialFn: () => {
      dispatch(beginRequestWorkflow());
    },
    url: `/workflow/`,
    method: 'POST',
    errorFn: (error) => {
      dispatch(failureRequestWorkflow(error));
    },
    successFn: () => {
      dispatch(successCreateWorkflow());
      dispatch(fetchContainers());
    },
    payload: payload
  }

  requestWrapper(parameters);
};

const successUpdateWorkflow = () => ({
  type: SUCCESS_UPDATE_WORKFLOW
});

export const updateWorkflow = (workflowId, payload) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(beginRequestWorkflow());
    },
    url: `/workflow/${workflowId}/`,
    method: 'PATCH',
    errorFn: (error) => {
      dispatch(failureRequestWorkflow(error));
    },
    successFn: () => {
      dispatch(successUpdateWorkflow());
      dispatch(fetchContainers());
    },
    payload: payload
  }

  requestWrapper(parameters);
};

const successDeleteWorkflow = () => ({
  type: SUCCESS_DELETE_WORKFLOW
});

export const deleteWorkflow = (workflowId) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(beginRequestWorkflow());
    },
    url: `/workflow/${workflowId}/`,
    method: 'DELETE',
    errorFn: (error) => {
      dispatch(failureRequestWorkflow(error));
    },
    successFn: () => {
      dispatch(successDeleteWorkflow());
      dispatch(fetchContainers());
    }
  }

  requestWrapper(parameters);
};
