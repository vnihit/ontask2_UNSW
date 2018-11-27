import {
  START_FETCHING,
  FINISH_FETCHING,
  STORE_DATALAB,

  OPEN_VISUALISATION_MODAL,
  CLOSE_VISUALISATION_MODAL,

  UPDATE_BUILD,
  REFRESH_DATA,

  BEGIN_REQUEST_FORM_FIELD,
  FINISH_REQUEST_FORM_FIELD
} from './DataLabActions';


function dataLab(state = {}, action) {
  switch (action.type) {
    case START_FETCHING:
      return Object.assign({}, state, {
        isFetching: true
      });
    case FINISH_FETCHING:
      return Object.assign({}, state, {
        isFetching: false
      });
    case STORE_DATALAB:
      return Object.assign({}, state, {
        selectedId: action.selectedId,
        build: action.build,
        data: action.data,
        datasources: action.datasources,
        actions: action.actions,
        filter: action.filter,
        filteredData: action.filteredData
      });

      case OPEN_VISUALISATION_MODAL:
      return Object.assign({}, state, {
        visualisation_visible: true,
        visualise: action.visualise,
        isRowWise: action.isRowWise,
        record: action.record
      });
    case CLOSE_VISUALISATION_MODAL:
      return Object.assign({}, state, {
        visualisation_visible: false,
        visualise: null,
        isRowWise: null,
        error: null
      });

    case UPDATE_BUILD:
      return Object.assign({}, state, {
        build: action.build
      });
    case REFRESH_DATA:
      return Object.assign({}, state, {
        data: action.data
      });

    case BEGIN_REQUEST_FORM_FIELD:
      return Object.assign({}, state, {
        formFieldLoading: true
      });
    case FINISH_REQUEST_FORM_FIELD:
      return Object.assign({}, state, {
        formFieldLoading: false
      });
      
    default:
      return state;
  }
};

export default dataLab;
