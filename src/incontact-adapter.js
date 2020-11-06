/*
 * This adapter function connects Inbenta's chatbot solution with InContact
 * InContact documentation: https://developer.niceincontact.com/API/PatronAPI
 *
 * @param {Object} incontactConf [InContact APP configuration]
 *
 */
var inbentaIncontactAdapter = function (incontactConf) {

  let workingTime = true;
  let agentActive = false;

  if (!incontactConf.enabled) {
    return function () {};
  } else if (!incontactConf.applicationName || !incontactConf.applicationSecret || !incontactConf.vendorName || !incontactConf.payload.pointOfContact) {
    console.warn('InContact adapter is misconfigured, therefore it has been disabled.');
    console.warn('Make sure applicationName, applicationSecret, pointOfContact and  vendorName are congifured.');
  }

  // Initialize inContact session on/off variable
  var incontactSessionOn;
  // Construct auth code from conf parameters
  incontactConf.authCode = window.btoa(incontactConf.applicationName + '@' + incontactConf.vendorName + ':' + incontactConf.applicationSecret);

  if(typeof incontactConf.outOfTimeDetection === "undefined"){
    incontactConf.outOfTimeDetection = "department is currently closed";
    console.warn('The variable "incontactConf.outOfTimeDetection" is not defined, getting the default value.');
  }

  /*
   * InContact session cookies management function
   */
  var IncontactSession = {
    get: function (key) {
      var cookieObj = {};
      document.cookie.split(';').forEach(function (cookiePair) {
        let index = cookiePair.indexOf('=');
        cookieObj[cookiePair.slice(0, index).trim()] = cookiePair.slice(index + 1, cookiePair.length).trim();
      });
      dd('cookies.get: ' + key + ':' + cookieObj[key], 'background: #222; color: #BADA55');
      return cookieObj[key];
    },
    set: function (key, value) {
      const currentTime = new Date().getTime();
      dd('cookies.set: ' + key + ':' + value, 'background: #222; color: #BADA55');
      const expires = new Date(currentTime + incontactConf.incontactSessionLifetime * 60000);
      document.cookie = key + '=' + value + '; expires=' + expires + '; path=/';
    },
    delete: function (key) {
      var expired = new Date().getTime() - 3600; // Set it to 1h before to auto-expire it
      dd('cookies.delete: ' + key, 'background: #222; color: #BADA55');
      document.cookie = key + '=; expires=' + expired + '; path=/';
    }
  };

  var fromName = IncontactSession.get('incontactUserName');
    if(typeof fromName !== "undefined"){
      incontactConf.payload.fromName = fromName;
    }

  // Debug function
  function dd(message = '', color = 'background: #fff; color: #000') {

    if (typeof message === 'object'){
      message = JSON.stringify(message);
    }

    if (incontactConf.debugMode && message) console.log('%c ' + message, color);
  }

  // Bulk remove InContact session cookies
  function removeIncontactCookies (cookies) {
    if (typeof cookies === 'string') {
      IncontactSession.delete(cookies);
    } else if (Array.isArray(cookies)) {
      cookies.forEach(function (cookie) {
        IncontactSession.delete(cookie);
      });
    }
  }

  return function (chatbot) {
    window.chatbotHelper = chatbot;
    // Initialize inContact auth object
    var auth = {
      tokenUrl: 'https://api.incontact.com/InContactAuthorizationServer/Token',
      accessToken: '',
      resourceBaseUrl: '',
      chatSessionId: '',
      isManagerConnected: false,
      closedOnTimeout: true,
      noResults: 1,
      firstQuestion: '',
      timers: {
        getChatText: 0
      },
      activeChat: true
    };

    /*
     * Conect to InContact function (triggered onStartEscalation)
     */
    var connectToIncontact = function () {
      incontactSessionOn = true;
      // Initiate inContact auth
      updateToken(
        function (resp) {
          auth.accessToken = resp.access_token;
          auth.resourceBaseUrl = resp.resource_server_base_uri;
          IncontactSession.set('incontactAccessToken', auth.accessToken);
          IncontactSession.set('incontactResourceBaseUrl', auth.resourceBaseUrl);
          // Get inContact chat profile info
          getChatProfile();
          // Create inContact chat room
          makeChat(function (resp) {
            workingTime = true;
            auth.chatSessionId = resp.chatSessionId;
            IncontactSession.set('inbentaIncontactActive', 'active');
            IncontactSession.set('incontactChatSessionId', auth.chatSessionId);
            getChatText();
          });
        }
      );
      auth.closedOnTimeout = false;
      // Start "no agents" timeout
      auth.timers.noAgents = setTimeout(function () {
        if (!auth.isManagerConnected) {
          endChatSession();
          chatbot.actions.displaySystemMessage({
            message: 'no-agents', // Message can be customized in SDKconf -> labels
            translate: true
          });
        }
      }, incontactConf.agentWaitTimeout * 1000);
    };

    /*
     * Update (or create) inContact token [request]
     */
    var updateToken = function (callback) {
      var options = {
        type: 'POST',
        url: auth.tokenUrl,
        async: true,
        headers: { 'Authorization': 'basic ' + incontactConf.authCode },
        data: JSON.stringify({
          'grant_type': 'client_credentials',
          'scope': 'PatronApi'
        })
      };

      requestCall(options, callback);
    };

    /*
     * Get inContact chat profile info [request]
     */
    var getChatProfile = function () {
      var options = {
        type: 'GET',
        url: auth.resourceBaseUrl + 'services/' + incontactConf.version + '/points-of-contact/' + incontactConf.payload.pointOfContact + '/chat-profile',
        async: true
      };

      var request = requestCall(options);
      request.onload = request.onerror = function () {
        if (!this.response) {
          return;
        }
        var resp = (this.response && this.response.indexOf('<!DOCTYPE') == -1)? JSON.parse(this.response) : {};
        if (!resp.chatProfile) {
          return;
        }
        if (incontactConf.agent.avatarImage === '') {
          for (var chatId in resp.chatProfile) {
            if (resp.chatProfile.hasOwnProperty(chatId) && resp.chatProfile[chatId].heroImage) {
              incontactConf.agent.avatarImage = resp.chatProfile[chatId].heroImage;
              break;
            }
          }
        }
      };
    };

    /*
     * Create inContact chat room [request]
     */
    var makeChat = function (callback) {
      var options = {
        type: 'POST',
        url: auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats',
        async: true,
        data: JSON.stringify(incontactConf.payload)
      };
      requestCall(options, callback);
    };

    /*
     * Get inContact agent responses [request]
     */
    var getChatText = function () {

      dd("workingTime: " + workingTime);
      if (!workingTime) return;

      clearTimeout(auth.timers.getChatText);
      var options = {
        type: 'GET',
        url: auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats/' + auth.chatSessionId + '?timeout=' + incontactConf.getMessageTimeout,
        async: true
      };

      var request = requestCall(options);
      request.onload = request.onerror = function () {
        if (!this.response) {
          return;
        }
        var resp = (this.response)? JSON.parse(this.response) : {};
        if (resp.chatSession) auth.chatSessionId = resp.chatSession;
        if (workingTime && auth.activeChat) IncontactSession.set('incontactChatSessionId', auth.chatSessionId);
        resp.messages.forEach(function (message) {
          if (typeof message.Type !== 'undefined' && typeof message.Status !== 'undefined' && message.Status === 'Waiting') {
            // in waiting we send chat, to connect with incontact
            retrieveLastMessages();
          } else if (typeof message.Type !== 'undefined' && typeof message.Status !== 'undefined' && message.Status === 'Active') {
            dd("agent Joined");
            clearTimeout(auth.timers.noAgents);
            auth.isManagerConnected = true;
            chatbot.actions.displaySystemMessage({
              message: 'agent-joined', // Message can be customized in SDKconf -> labels
              replacements: { agentName: incontactConf.agent.name },
              translate: true
            });
            chatbot.actions.hideChatbotActivity();
            chatbot.actions.enableInput();
            if (auth.firstQuestion) {
              chatbot.actions.displayChatbotMessage({ type: 'answer', message: auth.firstQuestion });
              auth.firstQuestion = '';
            }
          } else if (typeof message.Type !== 'undefined' && typeof message.Status !== 'undefined' && message.Status === 'Disconnected') {
            clearTimeout(auth.timers.getChatText);
          }

          if (typeof message.Text !== 'undefined' && typeof message.PartyTypeValue !== 'undefined') {
            switch (message.PartyTypeValue) {
              case '1':
              case 'Agent':
                chatbot.actions.hideChatbotActivity();
                chatbot.actions.displayChatbotMessage({ type: 'answer', message: message.Text });
                break;
              case 'System':
                if (message.Type === 'Ask') {
                    if (message.Text !== 'Hello, what is your name?') {
                        auth.firstQuestion = message.Text;
                    }
                }
            }
          }
          else if (typeof message.PartyTypeValue !== 'undefined' && typeof message.Type !== 'undefined' && message.Type === 'AgentTyping') {
            if (message.IsTextEntered === 'True' || message.IsTyping === 'True') {
              chatbot.actions.displayChatbotActivity();
            }
            else {
              chatbot.actions.hideChatbotActivity();
            }
          }
          
        });
      };
    };

    /*
     * Send a single message to Incontact [request]
     */
    var sendMessageToIncontact = function (message, author, async, callback, callbackData) {
      if (auth.chatSessionId === '') return;

      async = typeof async === 'boolean' ? async : false;

      var options = {
        type: 'POST',
        url: auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats/' + auth.chatSessionId + '/send-text',
        async: async,
        data: JSON.stringify({
          'label': (author === 'undefined') ? incontactConf.defaultUserName : author,
          'message': message
        })
      };

      requestCall(options, callback, callbackData);
    };

    /*
     * Send multiple message to Incontact [request] (recursive, ordered)
     */
    var sendMultipleMessagesToIncontact = function(messageArray) {

      dd("--- sendMultipleMessagesToIncontact ---");
      dd(messageArray);
      if (messageArray.length > 0) {
        var messageObj = messageArray[0];
        var author = '';
        switch (messageObj.user) {
          case 'assistant':
            author = incontactConf.defaultChatbotName;
            break;
          case 'guest':
            author = incontactConf.payload.fromName ? incontactConf.payload.fromName : incontactConf.defaultUserName;
            break;
          case 'system':
          default:
            author = incontactConf.defaultSystemName;
        }

        messageArray.shift();
        if (workingTime) {
          sendMessageToIncontact(messageObj.message, author, false, sendMultipleMessagesToIncontact, messageArray);
        }
      }
    };

    /*
     * Close InContact chat session [request]
     */
    var endChatSession = function () {
      dd("---endChatSession---");
      dd("auth.chatSessionId: " + auth.chatSessionId);
      dd("workingTime: " + workingTime);

      if (auth.chatSessionId === '' || !workingTime) return;

      var options = {
        type: 'DELETE',
        url: auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats/' + auth.chatSessionId,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      };
      auth.activeChat = false;
      requestCall(options, finishChat);
    };

    var finishChat = function(){
        auth.chatSessionId = '';
        auth.isManagerConnected = false;
        incontactSessionOn = false;
        auth.closedOnTimeout = true;
        agentActive = false;
        clearTimeout(auth.timers.noAgents);
        clearTimeout(auth.timers.getChatText);
        removeIncontactCookies(['inbentaIncontactActive', 'incontactAccessToken', 'incontactResourceBaseUrl', 'incontactChatSessionId']);
        chatbot.actions.hideChatbotActivity();
        enterQuestion();
        chatbot.actions.enableInput();
    }
    /*
     * InContact http [request] template
     */
    var requestCall = function (requestOptions, callback, callbackData) {
      var xmlhttp = new XMLHttpRequest();
      requestOptions.async = true;
      if (!requestOptions.headers) requestOptions.headers = {};
      if (!requestOptions.headers['Authorization']) {
        requestOptions.headers['Authorization'] = 'bearer ' + auth.accessToken;
      }
      requestOptions.headers['Content-Type'] = 'application/json; charset=utf-8';

      xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState === XMLHttpRequest.DONE) {
          var response = (this.responseText && this.responseText.indexOf('<!DOCTYPE') == -1)? JSON.parse(this.responseText) : {messages: []};
          dd("Request completed:" + " "+requestOptions.url, 'background: #222; color: #BA55BA');
          dd(response);

          var handle = httpResponseHandler(requestOptions.url, response.messages);
          if (typeof handle[xmlhttp.status] === 'function') {
            handle[xmlhttp.status]();
          }

          if (callback) {
            if (callbackData) {
              callback(callbackData);
            } else {
              callback(xmlhttp.response ? JSON.parse(xmlhttp.response) : {});
            }
          }
        }
      };

      xmlhttp.open(requestOptions.type, requestOptions.url, requestOptions.async);

      for (var key in requestOptions.headers) {
        if (requestOptions.headers.hasOwnProperty(key)) {
          xmlhttp.setRequestHeader(key, requestOptions.headers[key]);
        }
      }
      xmlhttp.send(requestOptions.data);

      return xmlhttp;
    };

    /*
     * InContact http response handler
     */
    var httpResponseHandler = function (url, messages) {
      var httpCodeErrors = {
        200: function () {
          if(messages && messages.length > 0){
            messages.forEach(function(message){
              var text = message.Text;
              if (text && text.includes(incontactConf.outOfTimeDetection)) return outOfTime(text);
            });
          }
          if (!auth.closedOnTimeout) auth.timers.getChatText = setTimeout(getChatText, incontactConf.getMessageTimeout);
        },
        202: {},
        304: function () {
          if (!auth.closedOnTimeout) auth.timers.getChatText = setTimeout(getChatText, incontactConf.getMessageTimeout);
        },
        400: genericError,
        401: genericError,
        404: agentLeft
      };
      switch (url) {
        case auth.tokenUrl:
          return {};
        case auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats': // post-/contacts/chats
        case auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats/' + auth.chatSessionId + '?timeout=' + incontactConf.getMessageTimeout: // get-/contacts/chats/{chatSession}
        case auth.resourceBaseUrl + 'services/' + incontactConf.version + '/contacts/chats/' + auth.chatSessionId + '/send-text': // post-/contacts/chats/{chatSession}/send-text
          return httpCodeErrors;
        default:
          return {};
      }
    };

    /*
     * Display a chatbot "Enter your question" message (after inContat session is closed, manually or on error)
     * Message can be customized in SDKconf -> labels
     */
    function outOfTime (text) {
      endChatSession();
      chatbot.actions.displayChatbotMessage({
        type: 'answer',
        message: text,
      });
      workingTime = false;
      return {};
    }

    /*
     * Generic message on unexpected inContact session error
     * Message can be customized in SDKconf -> labels
     */
    function genericError () {
      return chatbot.actions.displaySystemMessage({
        translate: true,
        message: 'alert-title',
        id: 'incontact-error',
        options: [{
          label: 'alert-button',
          value: 'try-again'
        }]
      });
    }

    /*
     * Display a chatbot "Enter your question" message (after inContat session is closed, manually or on error)
     * Message can be customized in SDKconf -> labels
     */
    function enterQuestion () {
      return chatbot.actions.displayChatbotMessage({
        type: 'answer',
        message: 'enter-question',
        translate: true
      });
    }

    /*
     * Close inContact session, remove InContact cookies, diplay an "Agent left" message, set default chatbotIcon
     * Message can be customized in SDKconf -> labels
     */
    function agentLeft () {
      incontactSessionOn = false;
      auth.activeChat = false;
      chatbot.actions.setChatbotIcon({ source: 'default' });
      chatbot.actions.setChatbotName({ source: 'default' });
      agentActive = false;
      if (workingTime){
        chatbot.actions.displaySystemMessage({
          message: 'agent-left',
          replacements: { agentName: incontactConf.agent.name },
          translate: true
        });
        finishChat();
      }
    }

    /**
     * Get the token to validate the availability of agents
     * @param {Object} response 
     */
    function tokenForActiveAgents(response) {
        if (response.resource_server_base_uri !== undefined && response.resource_server_base_uri !== '') {
            auth.resourceBaseUrl = response.resource_server_base_uri;
            const chatBotmessageData = {
                type:'answer',
                message:'<em>Looking for agents</em>',
            }
            chatbot.actions.displayChatbotMessage(chatBotmessageData);
            
            var options = {
                type: 'POST',
                url: auth.tokenUrl + '/access-key',
                async: true,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    'accessKeyId': incontactConf.accessKeyId,
                    'accessKeySecret': incontactConf.accessKeySecret
                })
            };
            requestCall(options, function(response) {
                if (response.access_token !== undefined && response.access_token !== '') {
                    lookForOperationHours(response.access_token);
                }
                else { //Continue with the escalation if there is no access_token
                    continueWithEscalation();
                }
            });
        }
        else { //Continue with the escalation if we can't check for the token and url
            continueWithEscalation();
        }
    }

    /**
     * Validate the operation hours
     * @param {String} access_token 
     */
    function lookForOperationHours(access_token) {
        var options = {
            type: 'GET',
            url: auth.resourceBaseUrl + '/services/' + incontactConf.version + '/hours-of-operation',
            async: true,
            headers: { 
                'Authorization': 'bearer ' + access_token,
                'Content-Type': 'application/json'
            },
            data: {}
        };
        requestCall(options, function(response) {
            var validHours = true;
            if (response.resultSet !== undefined && response.resultSet.hoursOfOperationProfiles !== undefined && response.resultSet.hoursOfOperationProfiles[0] !== undefined) {
                var currentD = new Date();
                var weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                var closed = false;
                var outOfTime = false;
                var outOfTimeMessage = '';
                var days = null;
                for (var i = 0; i < response.resultSet.hoursOfOperationProfiles.length; i++) {
                    days = response.resultSet.hoursOfOperationProfiles[i].days;
                    Object.keys(days).forEach(key => {
                        if (weekday[currentD.getDay()] === days[key].day) {
                            if (days[key].isClosedAllDay === 'True') {
                                closed = true;
                                return false;
                            }
                            var start = days[key].openTime.split(':');
                            var end = days[key].closeTime.split(':');
                            var opStart = new Date();
                            var opEnd = new Date();
                            opStart.setHours(start[0], start[1], start[2]);
                            opEnd.setHours(end[0], end[1], end[2]);
                            
                            var additionlTime = false;
                            var additionlTimeText = '';
                            if (days[key].additionalOpenTime !== '' && days[key].additionalCloseTime !== '') {
                                var startAdditional = days[key].additionalOpenTime.split(':');
                                var endAdditional = days[key].additionalCloseTime.split(':');
                                var opStartAdditional = new Date();
                                var opEndAdditional = new Date();
                                opStartAdditional.setHours(startAdditional[0], startAdditional[1], startAdditional[2]);
                                opEndAdditional.setHours(endAdditional[0], endAdditional[1], endAdditional[2]);
                                if (currentD >= opStartAdditional && currentD < opEndAdditional) {
                                    additionlTime = true;
                                }
                                additionlTimeText = ' and from ' + days[key].additionalOpenTime.substring(0,5) + ' to ' + days[key].additionalCloseTime.substring(0,5);
                            }
                            if ((currentD >= opStart && currentD < opEnd) || additionlTime) {
                                validHours = true;
                                closed = false;
                                outOfTime = false;
                                i = response.resultSet.hoursOfOperationProfiles.length;
                                return false;
                            }
                            outOfTimeMessage = 'Our Agents are available between '+days[key].openTime.substring(0,5)+' and '+days[key].closeTime.substring(0,5) + additionlTimeText;
                            outOfTime = true;
                            return false;
                        }
                    });
                }
                if (closed) {
                    validHours = false;
                    sendMessageToUser('The operation for today is CLOSED');
                    return false;
                }
                if (outOfTime) {
                    validHours = false;
                    sendMessageToUser(outOfTimeMessage);
                    return false;
                }
            }
            if (validHours) {
                lookForActiveAgents(access_token);
            }
        });
    }

    /**
     * Search if there are agents available
     * @param {String} access_token 
     */
    function lookForActiveAgents(access_token) {
        var queryString = 'fields=agentStateId,isActive,agentStateName,firstName&top=200'
        var options = {
            type: 'GET',
            url: auth.resourceBaseUrl + '/services/' + incontactConf.version + '/agents/states?'+queryString,
            async: true,
            headers: { 
                'Authorization': 'bearer ' + access_token,
                'Content-Type': 'application/json'
            },
            data: {}
        };
        requestCall(options, function(response) {
            agentActive = false;
            if (response.agentStates !== undefined) {
                Object.keys(response.agentStates).forEach(key => {
                    if (response.agentStates[key].agentStateId === 1 && response.agentStates[key].agentStateName === 'Available') {
                        agentActive = true;
                        return false;
                    }
                });
                if (agentActive) {
                    continueWithEscalation();
                }
                else {
                    sendMessageToUser('No agents available');
                }
            }
            else { //Continue with escalation if we can't validate the availability 
                continueWithEscalation();
            }
        });
    }

    /**
     * Continue executig the escalation
     */
    function continueWithEscalation() {
      agentActive = true;
      var messageData = {
        directCall: 'escalationStart',
      }
      chatbot.actions.sendMessage(messageData);
    }

    /**
     * Send a message to the user, after validate the agents availability
     * @param {String} message 
     */
    function sendMessageToUser(message) {
        chatbot.actions.hideChatbotActivity();
        chatbot.actions.enableInput();
        var chatBotmessageData = {
            type:'answer',
            message:'<em>'+message+'</em>',
        }
        chatbot.actions.displayChatbotMessage(chatBotmessageData);
    }

    /*
     * Get chatbot conversation mesages and prepare them to be sent to InContact agent
     */
    var retrieveLastMessages = function () {
      var transcript = chatbot.actions.getConversationTranscript();
      sendMultipleMessagesToIncontact(transcript);
      auth.timers.getChatText = setTimeout(getChatText, incontactConf.getMessageTimeout);
    };

    /*
     * If one of the fields is assigned to the label 'EMAIL_ADDRESS', the value provided by the user will replace the 'fromAdress' field.
     * The rest of the escalation data will be inserted in the 'parameters' array.
     */
    var updateChatInfo = function(escalateData) {

      for (var field in escalateData) {
        var fieldName = field.toLowerCase();
        if(fieldName == 'email_address') {
          incontactConf.payload.fromAddress = escalateData[field];
        }else if(fieldName == 'first_name') {
          incontactConf.payload.fromName = escalateData[field];
          IncontactSession.set('incontactUserName', escalateData[field]);
        }
        incontactConf.payload.parameters.push(escalateData[field]);
      }

      dd(incontactConf.payload);
    };

    /*
     *
     * CHATBOT SUBSCIPTIONS
     *
     */

    // Initiate escalation to inContact
    chatbot.subscriptions.onEscalateToAgent(function (escalateData, next) {
      dd("---onEscalationStart--- payload:");
      //Update chat payload before creating the chat
      updateChatInfo(escalateData);
      chatbot.actions.displaySystemMessage({ message: 'wait-for-agent', translate: true }); // Message can be customized in SDKconf -> labels
      chatbot.actions.displayChatbotActivity();
      chatbot.actions.disableInput();

      //Creation fo the chat
      connectToIncontact();
    });

    // Route messages to inContact
    chatbot.subscriptions.onSendMessage(function (messageData, next) {
      dd("---onSendMessage---:");
      dd(messageData);
      dd("---incontactSessionOn---: " + incontactSessionOn);
      if (incontactSessionOn) {
        sendMessageToIncontact(messageData.message, incontactConf.payload.fromName, true);
      } else {
        if (messageData.directCall !== undefined && messageData.directCall === 'escalationStart' && !agentActive) {
          chatbot.actions.disableInput();
          chatbot.actions.displayChatbotActivity();
          updateToken(tokenForActiveAgents); //Execute in order to get the "resourceBaseUrl"
          return false;
        }
        return next(messageData);
      }
    });

    var agentIconSet = false;
    // Show custom agent's picture
    chatbot.subscriptions.onDisplayChatbotMessage(function (messageData, next) {
      if ((incontactSessionOn && incontactConf.agent && !agentIconSet) || auth.isManagerConnected) {
        if (incontactConf.agent.avatarImage !== '') chatbot.actions.setChatbotIcon({ source: 'url', url: incontactConf.agent.avatarImage });
        if (incontactConf.agent.name !== '') chatbot.actions.setChatbotName({ source: 'name', name: incontactConf.agent.name });
        agentIconSet = true;
      }
      else {
        //Set the name empty when the chatbot is responding
        chatbot.actions.setChatbotName({ source: 'name', name: ' ' });
      }
      return next(messageData);
    });

    // Handle generic error
    chatbot.subscriptions.onSelectSystemMessageOption(function (optionData, next) {
      dd("---onSelectSystemMessageOption---");
      if (optionData.option.value === 'try-again') {
        enterQuestion();
      } else {
        return next(optionData);
      }
    });

    // Finish looking for agents Timeout
    chatbot.subscriptions.onResetSession(function (next) {
      dd("---onResetSession---");
      agentActive = false;
      clearTimeout(auth.timers.noAgents);
      clearTimeout(auth.timers.getChatText);
      return next();
    });

    // Handle inContact session/no-session on refresh
    chatbot.subscriptions.onReady(function (next) {
      dd("---onReady---");
      var statusChat = IncontactSession.get('inbentaIncontactActive');

      if (statusChat === 'active') {
        auth.accessToken = IncontactSession.get('incontactAccessToken');
        auth.resourceBaseUrl = IncontactSession.get('incontactResourceBaseUrl');
        auth.chatSessionId = IncontactSession.get('incontactChatSessionId');
        incontactSessionOn = true;
        auth.closedOnTimeout = false;
        getChatProfile();
        auth.timers.getChatText = setTimeout(getChatText, incontactConf.getMessageTimeout);
      }
    });

    // Clear inContact chatSession on exitConversation
    chatbot.subscriptions.onSelectSystemMessageOption(function (optionData, next) {
      if (optionData.id === 'exitConversation' && optionData.option.value === 'yes' && incontactSessionOn === true) {
        clearTimeout(auth.timers.getChatText);
        incontactSessionOn = false;
        auth.closedOnTimeout = true;
        endChatSession();
        chatbot.actions.setChatbotIcon({ source: 'default' });
        chatbot.actions.setChatbotName({ source: 'default' });
        chatbot.actions.displaySystemMessage({
          message: 'chat-closed', // Message can be customized in SDKconf -> labels
          translate: true
        });
      } else {
        return next(optionData);
      }
    });

    // DATA KEYS LOG
    // Contact Attended log on agent join conversation system message
    chatbot.subscriptions.onDisplaySystemMessage(function (messageData, next) {
      if (messageData.message === 'agent-joined') {
        chatbot.api.track('CHAT_ATTENDED', { value: 'TRUE' });
      }
      return next(messageData);
    });
    // Contact Unattended log on no agent available system message
    chatbot.subscriptions.onDisplaySystemMessage(function (messageData, next) {
      if (messageData.message === 'no-agents') {
        chatbot.api.track('CHAT_UNATTENDED', { value: 'TRUE' });
      }
      return next(messageData);
    });
  }
}

/**
 *
 * HELPER: Returns Promise resolving to dummy Object { agentsAvailable: true }
 *
 */
var inbentaPromiseAgentsAvailableTrue = function () {
  return new Promise(function (resolve, reject) {
    resolve({ 'agentsAvailable': true });
  });
}
