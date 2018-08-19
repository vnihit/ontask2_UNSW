import {
  REFRESH_FORM_STATE,
  UPDATE_FORM_STATE,

  OPEN_FILTER_MODAL,
  CLOSE_FILTER_MODAL,

  OPEN_CONDITION_GROUP_MODAL,
  CLOSE_CONDITION_GROUP_MODAL
} from './ActionActions';

import _ from 'lodash';


function action(state = {}, action) {
  switch (action.type) {
    // Used when a condition or formula is added to a condition group/filter
    case REFRESH_FORM_STATE:
      return Object.assign({}, state, {
        formState: action.payload
      });
    // Used when a field is changed in the condition group/filter form
    case UPDATE_FORM_STATE:
      return Object.assign({}, state, {
        // By design in ant design forms, if a field belonging to a list is updated, then the payload is given by:
        // [null, null, updated_field, null] where null are the unchanged fields in the list
        // Therefore, when updating the form state we must ensure that the null fields do not overwrite the values of those fields in the state
        // This is handled by the merge function from lodash, a third party plugin
        formState: _.merge(state.formState, action.payload)
      });
    
    case OPEN_FILTER_MODAL:
      return Object.assign({}, state, {
        formState: action.formState
      });
    case CLOSE_FILTER_MODAL:
      return Object.assign({}, state, {
        formState: null
      });

    case OPEN_CONDITION_GROUP_MODAL:
      return Object.assign({}, state, {
        formState: action.formState,
        conditionGroupIndex: action.conditionGroupIndex,
      });
    case CLOSE_CONDITION_GROUP_MODAL:
      return Object.assign({}, state, {
        formState: null,
        conditionGroupIndex: undefined
      });

    default:
      return state;
  }
};

export default action;
