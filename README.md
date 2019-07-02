# INCONTACT CONNECTOR CHATBOT ADAPTER

### Table of Contents
* [Description](#description)
* [Installation](#installation)
* [Configuration](#configuration)
* [Integration example](#integration-example)

## Description
This adapter connects [Inbenta's Chatbot](https://www.inbenta.com/en/products/chatbot/) SDK with [InContact](https://www.niceincontact.com/)'s chat solution.

## Installation
In order to add this adapter to your SDK, you need to import the file `/src/adapters/incontact-adapter.js` into the HTML/JS file where you're building the SDK. Then, append it to the SDK adapters array providing the adapter configuration as shown in the [example](#integration-example) section.

## InContact adapter Configuration
This adapter expects a Javascript object with the following configuration:

This would be a valid configuration object:
```javascript
var incontactConf = {
  enabled: true, // Enable inContact escalation
  applicationName: '',
  vendorName: '',
  applicationSecret: '',
  version: 'v12.0',
  agentWaitTimeout: 20, // seconds
  getMessageTimeout: 20,
  incontactSessionLifetime: 3, // minutes
  agent: {
    name: 'InContact Agent', // Agent name
    avatarImage: '' // Agent avatar image soure (file or base64), if empty inContact image will be used
  },
  payload: {
    pointOfContact: '',
    fromAddress: '',
    chatRoomID: '',
    parameters: []
  }
}
```

InContact configuration properties (applicationName, applicationSecret, vendorName) can be found in the _Admin -> Account Settings -> API Applications_ section.

## Integration example
In the following example we're creating a chatbot with the InContact adapter:
* Import the Inbenta Chatbot SDK (works with SDK version 1.26.0, but you can try the last one listed [here](https://developers.inbenta.io/chatbot/javascript-sdk/sdk-subresource-integrity))
    ```html
    <script src="https://sdk.inbenta.io/chatbot/1.26.0/inbenta-chatbot-sdk.js"></script>
    ```
* Import the InContact adapter from `src/incontact-adapter.js`
    ```html
     <script src="./src/incontact-adapter.js"></script>
    ```
* Create a configuration object with both SDK and our custom adapter configuration. Get more information about how to get your instance credentials [here](https://help.inbenta.io/general/administration/finding-your-api-credentials/).
    ```javascript
    var inbApp = {
      // Inbenta Chatbot SDK credentials
      sdkAuth: {
        inbentaKey: '<your-api-key>',
        domainKey: '<your-domain-key>'
      },
      // Inbenta Chatbot SDK configuration
      sdkConfig: {
        chatbotId: 'incontact_chatbot',
        labels: {
            en: {
                'interface-title': 'InContact Adapter'
            }
        },
        closeButton: { visible: true },
        html: { 'custom-window-header': '<div></div>' },
        adapters: []
      },
      // Inbenta escalation adapters conf
      inbAppConfig: {
        noAgentsAvailable: {
          action: 'displayChatbotMessage',
          value: 'no-agents' // If value is 'no-agents' (default), this label will be translated or else, custom text can be set here too
        },
        rejectedEscalation: {
          action: 'displayChatbotMessage',
          value: 'enter-question' // If value is 'enter-question' (default), this label will be translated or else, custom text can be set here too
        },
        maxNotFound: 2,
        contentForm: 'ChatWithLiveAgentContactForm', // Chatbot instance nl-escalation form content
        questions: [ // Array of question objects
          {
            label: 'FIRST_NAME', // Example question
            text: 'What\'s your first name?',
            validationErrorMessage: 'Your first name is not correct',
            validate: function (value) {
              return value !== '';
            }
          }
        ]
      },
      // Incontact Adapter conf
      incontactConf: {
        enabled: true, // Enable inContact escalation
        applicationName: '',
        vendorName: '',
        applicationSecret: '',
        version: 'v12.0',
        agentWaitTimeout: 20, // seconds
        getMessageTimeout: 20,
        incontactSessionLifetime: 3, // minutes
        agent: {
          name: 'Incontact Agent', // Agent name
          avatarImage: '' // Agent avatar image soure (file or base64), if empty inContact image will be use
        },
        payload: {
          pointOfContact: '',
          fromAddress: '',
          chatRoomID: '',
          parameters: []
        }
      }
    };
    ```
* Add the adapter to the SDK adapters array (passing the adapter configuration object)
    ```javascript
    inbApp.sdkConfig.adapters.push(inbentaIncontactAdapter(inbApp.incontactConf));
    ```
* Add the adapter escalation adapter to be used (passing the adapter configuration object). This adapter must be pushed after the InContact adapter
    ```javascript
    inbApp.sdkConfig.adapters.push(
        SDKcreateHtmlEscalationForm(inbentaPromiseAgentsAvailableTrue, inbApp.inbAppConfig.questions, inbApp.inbAppConfig.rejectedEscalation.value, inbApp.inbAppConfig.noAgentsAvailable.value, true)
    );
    ```

* Build the chatbot with our SDK configuration and credentials
    ```javascript
    InbentaChatbotSDK.buildWithDomainCredentials(inbApp.sdkAuth, inbApp.sdkConfig);
    ```
Here is the full integration code:
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Inbenta Incontact Adapter demo</title>
    <link rel="icon" href="https://www.inbenta.com/favicon.ico" type="image/x-icon">

    <!-- Import the Inbenta Chatbot SDK (works with SDK version 1.26.0, but you can try the last one listed [here](https://developers.inbenta.io/chatbot/javascript-sdk/sdk-subresource-integrity)) -->
    <script src="https://sdk.inbenta.io/chatbot/1.26.0/inbenta-chatbot-sdk.js" integrity="sha384-JNTy/kdUAPwDBdoI7douqLBGBmjY4k7tiTpvtceCBuFDNeh/Wb0hEV4Wfjjbwlfi" crossorigin="anonymous"></script>

    <!-- Import InContact adapter -->
    <script type="text/javascript" src="../src/incontact-adapter.js"></script>

  </head>
  <body>
    <!-- INBENTA CHATBOT SDK-->
    <script type="text/javascript">

    /*** Inbenta chatbot SDK configuration and build ***/

    var inbApp = {
      // Inbenta chatbot SDK credentials
      sdkAuth: {
        inbentaKey: '<YOUR_API_KEY>',
        domainKey: '<YOUR_DOMAIN_KEY>'
      },
      // Inbenta chatbot SDK configuration
      sdkConfig: {
        chatbotId: 'incontact_chatbot',
        environment: 'development',
        userType: 0,
        lang:'en',
        labels: {
          en: { 'interface-title': 'InContact Adapter' }
        },
        closeButton: { visible: true },
        html: { 'custom-window-header': '<div></div>' },
        adapters: []
      },
      // Inbenta escalation adapters conf
      inbAppConfig: {
        noAgentsAvailable: {
          action: 'displayChatbotMessage',
          value: 'no-agents' // If value is 'no-agents' (default), this label will be translated or else, custom text can be set here too
        },
        rejectedEscalation: {
          action: 'displayChatbotMessage',
          value: 'enter-question' // If value is 'enter-question' (default), this label will be translated or else, custom text can be set here too
        },
        maxNotFound: 2,
        contentForm: 'ChatWithLiveAgentContactForm',
        questions: [
          {
            label: 'FIRST_NAME',
            text: 'What\'s your first name?',
            validationErrorMessage: 'Your first name is not correct',
            validate: function(value) {
              return value !== '';
            }
          }
        ],
      },
      // Incontact Adapter conf
      incontactConf: {
        enabled: true, // Enable inContact escalation
        applicationName: '',
        vendorName: '',
        applicationSecret: '',
        version: 'v12.0',
        agentWaitTimeout: 20, // seconds
        getMessageTimeout: 60, // seconds
        incontactSessionLifetime: 3, // minutes
        agent: {
          name: 'Incontact Agent', // Agent name
          avatarImage: '' // Agent avatar image soure (file or base64), if empty inContact image will be use
        },
        payload: {
          pointOfContact: '',
          fromAddress: '',
          chatRoomID: '',
          parameters: []
        }
      }
    }

    // Add adapters
    window.inbApp.sdkConfig.adapters.push(
      /*
       * InContact adapter must be pushed before escalation adapters
       * Uncomment below the escalation adatper to use
       */
      inbentaIncontactAdapter(inbApp.incontactConf),

      /*
       * Escalate to InContact with natural language form
       *  More info: https://developers.inbenta.io/chatbot/javascript-sdk/sdk-adapters/nl-escalation-adapter
       */
      // window.SDKlaunchNLEsclationForm(inbentaPromiseAgentsAvailableTrue, inbApp.inbAppConfig.contentForm, inbApp.inbAppConfig.rejectedEscalation, inbApp.inbAppConfig.noAgentsAvailable, inbApp.inbAppConfig.maxNotFound),

      /*
       * Escalate to InContact with html form
       * More info: https://developers.inbenta.io/chatbot/javascript-sdk/sdk-adapters/html-escalation-adapter
       */
      SDKcreateHtmlEscalationForm(inbentaPromiseAgentsAvailableTrue, inbApp.inbAppConfig.questions, inbApp.inbAppConfig.rejectedEscalation.value, inbApp.inbAppConfig.noAgentsAvailable.value, true)
    );

    InbentaChatbotSDK.buildWithDomainCredentials(inbApp.sdkAuth, inbApp.sdkConfig);

    </script>
  </body>
</html>
```
