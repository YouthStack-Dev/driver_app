import * as React from 'react';

export const navigationRef = React.createRef();

function navigate(name, params) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
}

function resetToLogin() {
  if (navigationRef.current) {
    navigationRef.current.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }
}

export default {
  navigationRef,
  navigate,
  resetToLogin,
};
