/* Simple Google API OAuth 2.0 Client flow library

  Author: timdream

  Usage:
  var go2 = new GO2(options)
    Create an instance for the library.
    options is an object with the following properties:
    - clientId (required)
    - redirectUri (optional, default to the current page)
      To use the current page as the redirectUri,
      put this script before Analytics so that the second load won't result
      a page view register.
    - scope (optional, default to 'https://www.googleapis.com/auth/plus.me')
      A string or array indicates the Google API access your application is
      requesting.
    - popupWidth
    - popupHeight
  go2.login(approvalPrompt, immediate): Log in.
    Set immediate to true to attempt to login with a invisible frame.
    Set approvalPrompt to true to force the popup prompt.
  go2.logout(): Log out. Note that this does not invalidate access token.
  go2.getAccessToken(): return the token.
  go2.onlogin: callback(accessToken)
  go2.onlogout: callback()
  go2.destory: remove external references in the DOM for this instance.
*/

'use strict';

var GO2 = function GO2(options) {
  if (!options || !options.clientId)
    throw 'You need to at least set the clientId';

  // Save the client id
  this._clientId = options.clientId;

  // if scope is an array, convert it into a string.
  if (options.scope) {
    this._scope =
      Array.isArray(options.scope) ? options.scope.join(' ') : options.scope;
  }

  // rewrite redirect_uri
  if (options.redirectUri)
    this._redirectUri = options.redirectUri;

  // popup dimensions
  if (options.popupHeight)
    this._popupHeight = options.popupHeight;
  if (options.popupWidth)
    this._popupWidth = options.popupWidth;

  if (options.loginHint)
    this._loginHint = options.loginHint;
};

GO2.receiveMessage = function GO2_receiveMessage() {
  var go2;
  if (window.opener && window.opener.__windowPendingGO2)
    go2 = window.opener.__windowPendingGO2;
  if (window.parent && window.parent.__windowPendingGO2)
    go2 = window.parent.__windowPendingGO2;

  if (go2 && window.location.hash.indexOf('access_token') !== -1) {
    go2._handleMessage(
      window.location.hash.replace(/^.*access_token=([^&]+).*$/, '$1'),
      parseInt(window.location.hash.replace(/^.*expires_in=([^&]+).*$/, '$1')),
      window.location.hash.replace(/^.*state=go2_([^&]+).*$/, '$1')
    );
  }
  if (go2 && window.location.search.indexOf('error=')) {
    go2._handleMessage(false);
  }
};

GO2.prototype = {
  WINDOW_FRAME_NAME: 'google_oauth2_login_frame',
  WINDOW_POPUP_NAME: 'google_oauth2_login_popup',

  _clientId: undefined,
  _scope: 'https://www.googleapis.com/auth/plus.me',
  _redirectUri: window.location.href.substr(0,
                                            window.location.href.length -
                                            window.location.hash.length)
                                    .replace(/#$/, ''),

  _popupWindow: null,
  _immediateFrame: null,

  _stateId: Math.random().toString(32).substr(2),
  _accessToken: undefined,
  _timer: undefined,

  _popupWidth: 500,
  _popupHeight: 400,

  onlogin: null,
  onlogout: null,

  login: function go2_login(forceApprovalPrompt, immediate) {
    if (this._accessToken)
      return;

    this._removePendingWindows();

    window.__windowPendingGO2 = this;

    var url = 'https://accounts.google.com/o/oauth2/auth' +
      '?response_type=token' +
      '&redirect_uri=' + encodeURIComponent(this._redirectUri) +
      '&scope=' + encodeURIComponent(this._scope) +
      '&state=go2_' + this._stateId +
      '&client_id=' + encodeURIComponent(this._clientId);

    if (this._loginHint) {
        url += '&login_hint=' + encodeURIComponent(this._loginHint);
    }
    if (!immediate && forceApprovalPrompt) {
      url += '&approval_prompt=force';
    }

    if (immediate) {
      url += '&approval_prompt=auto';

      // Open up an iframe to login
      // We might not be able to hear any of the callback
      // because of X-Frame-Options.
      var immediateFrame =
        this._immediateFrame = document.createElement('iframe');
      immediateFrame.src = url;
      immediateFrame.hidden = true;
      immediateFrame.width = immediateFrame.height = 1;
      immediateFrame.name = this.WINDOW_FRAME_NAME;
      document.body.appendChild(immediateFrame);

      return;
    }

    // Open the popup
    var left =
      window.screenX + (window.outerWidth / 2) - (this._popupWidth / 2);
    var top =
      window.screenY + (window.outerHeight / 2) - (this._popupHeight / 2);
    var windowFeatures = 'width=' + this._popupWidth +
                   ',height=' + this._popupHeight +
                   ',top=' + top +
                   ',left=' + left +
                   ',location=yes,toolbar=no,menubar=no';
    this._popupWindow = window.open(url, this.WINDOW_POPUP_NAME, windowFeatures);
  },

  logout: function go2_logout() {
    if (!this._accessToken)
      return;

    this._removePendingWindows();

    clearTimeout(this._timer);
    this._accessToken = undefined;
    if (this.onlogout)
      this.onlogout();
  },

  getAccessToken: function go2_getAccessToken() {
    return this._accessToken;
  },

  // receive token from popup / frame
  _handleMessage: function go2_handleMessage(token, expiresIn, stateId) {
    if (this._stateId !== stateId)
      return;

    this._removePendingWindows();

    // Do nothing if there is no token received.
    if (!token)
      return;

    this._accessToken = token;

    if (this.onlogin)
      this.onlogin(this._accessToken, expiresIn);

    // Remove the token if timed out.
    /*
    clearTimeout(this._timer);
    this._timer = setTimeout(
      function tokenTimeout() {
        this._accessToken = undefined;
        if (this.onlogout)
          this.onlogout();
      }.bind(this),
      expiresIn * 1000
    );
    */
  },

  destroy: function go2_destory() {
    clearTimeout(this._timer);
    this._removePendingWindows();
  },

  _removePendingWindows: function go2_removePendingWindows() {
    if (this._immediateFrame) {
      document.body.removeChild(this._immediateFrame);
      this._immediateFrame = null;
    }

    if (this._popupWindow) {
      this._popupWindow.close();
      this._popupWindow = null;
    }

    if (window.__windowPendingGO2 === this) {
      delete window.__windowPendingGO2;
    }
  }
};

// If the script loads in a popup matches the WINDOW_NAME,
// we need to handle the request instead.
if (window.name === GO2.prototype.WINDOW_FRAME_NAME ||
    window.name === GO2.prototype.WINDOW_POPUP_NAME) {
  GO2.receiveMessage();
}

// Expose the library as an AMD module
if (typeof define === 'function' && define.amd) {
  define('google-oauth2-web-client', [], function() { return GO2; });
} else {
  window.GO2 = GO2;
}
