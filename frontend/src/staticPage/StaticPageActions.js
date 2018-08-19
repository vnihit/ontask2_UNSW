import requestWrapper from '../shared/requestWrapper';

export const REQUEST_EMAIL_HISTORY = 'REQUEST_EMAIL_HISTORY';
export const RECEIVE_EMAIL_HISTORY = 'RECEIVE_EMAIL_HISTORY';
export const UPDATE_EMAIL_DATA = 'UPDATE_EMAIL_DATA';
export const FAILURE_REQUEST_EMAIL_HISTORY = 'FAILURE_REQUEST_EMAIL_HISTORY';
export const FAILURE_FIND_WORKFLOW = 'FAILURE_FIND_WORKFLOW';
export const FOUND_WORKFLOW = 'FOUND_WORKFLOW';
export const REQUEST_SEARCH_WORKFLOW = 'REQUEST_SEARCH_WORKFLOW';
export const RECEIVE_WORKFLOW_LIST = 'RECEIVE_WORKFLOW_LIST';
export const REQUEST_WORKFLOW_LIST = 'REQUEST_WORKFLOW_LIST';
export const FAILURE_BIND_WORKFLOW = 'FAILURE_BIND_WORKFLOW';
export const SUCCESS_BIND_WORKFLOW = 'SUCCESS_BIND_WORKFLOW';
export const FOUND_CONTENT = 'FOUND_CONTENT';
export const REQUEST_SEARCH_CONTENT = 'REQUEST_SEARCH_CONTENT';
export const ERROR_WORKFLOW = 'ERROR_WORKFLOW';
export const ERROR_CONTENT = 'ERROR_CONTENT';
export const REQUEST_BIND_WORKFLOW = 'REQUEST_BIND_WORKFLOW';


const requestEmailHistory = () => ({
  type: REQUEST_EMAIL_HISTORY
});

const receiveEmailHistory = (data, columns) => ({
  type: RECEIVE_EMAIL_HISTORY,
  data,
  columns
});

//matchReg is for highlighting matched text
const updateEmailData = (data, matchingData) => ({
  type: UPDATE_EMAIL_DATA,
  data,
  matchingData
});

const failureRequestEmailHistory = (error) => ({
  type: FAILURE_REQUEST_EMAIL_HISTORY,
  error
});

const foundWorkflow = (workflowId) => ({
  type: FOUND_WORKFLOW,
  workflowId
});

const failureFindWorkflow = (linkId) => ({
  type: FAILURE_FIND_WORKFLOW,
  linkId
});

const receiveWorkflowList = (containers) => ({
  type: RECEIVE_WORKFLOW_LIST,
  containers
});

const requestSearchWorkflow = () => ({
  type: REQUEST_SEARCH_WORKFLOW
});

const requestWorkflowList = () => ({
  type: REQUEST_WORKFLOW_LIST
});

const successBindWorkflow = () => ({
  type: SUCCESS_BIND_WORKFLOW
});

const foundContent = (content) => ({
  type: FOUND_CONTENT,
  content
});

const requestSearchContent = (zid) => ({
  type: REQUEST_SEARCH_CONTENT,
  zid
});

const errorWorkflow = (error) => ({
  type: ERROR_WORKFLOW,
  error
});

const errorContent = (error) => ({
  type: ERROR_CONTENT,
  error
});

const requestBindWorkflow = () =>({
  type: REQUEST_BIND_WORKFLOW,
});


//fetch email history for pass in worflowId
export const fetchWorkflowEmailHistory = (workflowId) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(requestEmailHistory());
    },
    url: `/action/${workflowId}/retrieve_history/`,
    method: 'GET',
    errorFn: (error) => {
      dispatch(failureRequestEmailHistory(error));
    },
    successFn: (response) => {
      dispatch(receiveEmailHistory(response['data'], response['columns']));
    }
  };
  requestWrapper(parameters);
};

//fetch all email history for student
export const fetchEmailHistory = () => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(requestEmailHistory());
    },
    url: `/audit/retrieve_history/`,
    method: 'GET',
    errorFn: (error) => {
      dispatch(failureRequestEmailHistory(error));
    },
    successFn: (response) => {
      dispatch(receiveEmailHistory(response['data'], response['columns']));
    }
  };
  requestWrapper(parameters);
};

//store matched row to data, matching item type can be text or date
//matchingData is a date string if isSeaerchDate is true or a regex is isSearchDate is false
export const onSearchColumn = (matchingData, field, data, isSearchDate) => dispatch => {
  if(isSearchDate){
    const updatedData = data.map((record) => {
      const date = record[field].split(" ")[1];
      if (date === matchingData[field]) {
        return {
          ...record
        };
      }
      return null;
    }).filter(record => !!record);
    dispatch(updateEmailData(updatedData, matchingData, field));
  }
  else{
    const updatedData = data.map((record) => {
      const match = record[field].match(matchingData[field]);
      if (!match) {
        return null;
      }
      return {
        ...record,
      };
    }).filter(record => !!record);
    dispatch(updateEmailData(updatedData, matchingData, field));
  }
};

export const fetchWorkflowList = () => dispatch => {
  const parameters = {
    initialFn: () => { dispatch(requestWorkflowList()); },
    url: `/container/retrieve_workflows/`,
    method: 'GET',
    errorFn: (error) => { console.log(error); },
    successFn: (containers) => {
      dispatch(receiveWorkflowList(containers));
    }
  }
  requestWrapper(parameters);
} 

//search content with linkId and zid
export const searchContent = (linkId, zid) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(requestSearchContent(zid));
    },
    url: `/action/search_content/`,
    method: 'POST',
    errorFn: (error) => {
      dispatch(errorContent(error));
    },
    successFn: (response) => {
      if(response['mismatch']){
        dispatch(errorContent("Content is not found."));
      }
      else{
        dispatch(foundContent(response['content']));
      }
    },
    payload: {
      'link_id': linkId,
      'zid': zid
    }
  };
  requestWrapper(parameters);
}

const print = (s) => {
  console.log(s);
};

//search workflow with linkId
export const searchWorkflow = (linkId) => dispatch => {
  const parameters = {
    initialFn: () => {
      dispatch(requestSearchWorkflow());
    },
    url: `/action/search_workflow/`,
    method: 'POST',
    errorFn: (error) => {
      dispatch(errorWorkflow(error));
    },
    successFn: (response) => {
      if(response['mismatch']){
        print(response['mismatch']);
        print(linkId)
        dispatch(fetchWorkflowList());
        dispatch(failureFindWorkflow(linkId));
      }
      else{
        dispatch(foundWorkflow(response['workflowId']));
      }
    },
    payload: {'link_id': linkId}
  };
  requestWrapper(parameters);
}

//bind workflow with link_id
export const bindWorkflow = (linkId, workflowId) => dispatch => {
  print("biding"+workflowId+"with"+linkId);
  const parameters = {
    initialFn: () => {
      dispatch(requestBindWorkflow());
    },
    url: `/action/${workflowId}/`,
    method: 'PATCH',
    errorFn: (error) => {
      dispatch(errorWorkflow(error));
    },
    successFn: (response) => {
      dispatch(successBindWorkflow());
    },
    payload: {'linkId': linkId}
  };
  requestWrapper(parameters);
}