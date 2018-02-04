const authenticatedRequest = (initialFn, fetchUrl, method, payload, errorFn, successFn, customContentType) => {
  initialFn();

  let fetchInit = { 
    headers: {
      'Authorization': `Token ${localStorage.getItem('token')}`,
      'Content-Type': customContentType ? customContentType : 'application/json'
    }
  };
  if (payload) fetchInit.body = JSON.stringify(payload);
  
  fetch(fetchUrl, {
    method: method,
    ...fetchInit
  })
  .then(response => {
    if (response.status === 401) {
      // localStorage.removeItem('token');
    }
    if (response.status >= 400 && response.status < 600) {
      response.json().then(error => {
        errorFn(error[0]);
      });
    } else {
      if (response.status == 204) { // Api call was a DELETE, therefore response is empty
        successFn();
      } else {
        response.json().then(response => {
          successFn(response);
        });  
      }
    }
  })
  .catch(error => {
    errorFn('Failed to contact server. Please try again.');
  });

};

export default authenticatedRequest;