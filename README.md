# INCONTACT ADAPTER

### Table of Contents
* [Description](#description)
* [Functionalities](#functionalities)
* [Installation](#installation)
* [Configuration](#configuration)
* [Troubleshooting](#troubleshooting)
* [Integration example](#integration-example)


## Description

The purpose of this adapter is to allow Inbenta customers to connect the [Inbenta's Chatbot](https://www.inbenta.com/en/products/chatbot/) to Nice [InContact](https://www.niceincontact.com/) and thus use the Incontact chat platform instead of the default provided by Inbenta (HyperChat solution).
The adapter is an extension of how the chatbot works, so installation should be easy.

## Functionalities

The adapter creates and establishes a connection between the user and the Incontact platform using the [Patron API] (https://developer.niceincontact.com/API/PatronAPI#/) provided by NICE.
This API allows to obtain chat updates (messages only) using Long Polling technology, but is limited to the following features:

* Chat creation after bot escalation that passes the following variables to the Patron API within the javascript object called **payload**.
   * **'fromAddress'**: email provided in the escalation form.
   * **'parameters'**: all the data from the escalation form introduced by the user in JSON format.
* **Automatic chat rejection** when the agent does not accept the chat after the time specified in the field '**agentWaitTimeout**'.
* **Detection of out of business hours** using a string. This simple detection checks the label returned by the API and verifies it against the field called '**outOfTimeDetection**'. It is very important to configure this variable so that the adapter works correctly.
* The adapter can be enabled or disabled on its own, if the property called '**enabled**' is set to 'false', the escalation process will be disabled.
* The agent's name and avatar shown in the chatbot can also be configured within the property called '**agent**'. 
* A verbose log can be activated setting the variable '**debugMode**' to 'true'.

Additionally, you can have a couple extra features, like **Agents availability** and **Hours of Operation** by using **Real Time API** and **Admin API** respectively. For both of these functions, you'll need an **accessKeyId** and **accessKeySecret**, that can be getted from an Incontact active user. For more information go to: https://developer.niceincontact.com/Documentation/Createaccesskey.

## Installation
In order to add this adapter to your SDK, you need to import the file `/src/incontact-adapter.js` into the HTML/JS file where you're building the SDK. Then, append it to the SDK adapters array providing the adapter configuration as shown in the [example](#integration-example) section.
Before installing it, consider the following:

* The adapter works with version **'1.41.0'** of the SDK.
* The adapter only works with the Patron API version **'v12.0'**
* The adapter needs **cookies** to maintain the user's session with Incontact.
* The response from escalation when there is no available agents is defined in backstage, with the content titled **'No Agents Available'**. So this content should be modified in order to show the expected message.
* There are variables that must be obtained from the Incontact platform, such as **'applicationName', 'vendorName' or 'applicationSecret'**. All of them can be found in the _ACD -> ACD Configuration -> API Applications_ section within the Incontact platform.
* For the use of **'Hours of Operation'** (additonally to the  **'accessKeyId'** and **'accessKeySecret'**), a **'profileIdHoursOperation'** is needed, and it can be obtained from the Incontact platform in: _ACD -> Contact Settings -> Hours of Operation_ section, as long as there is defined hours.
* For the use of **'Agents availability'** (additonally to the  **'accessKeyId'** and **'accessKeySecret'**), a **'teamId'** is needed, and it can be obtained from the Incontact platform in: _Admin -> Teams_ section.
* The **timers** defined in the configuration shouldn't be changed.

### Configuration
This adapter expects a Javascript object with the following configuration:

This would be a valid configuration object:
```javascript
var incontactConf = {
  debugMode: false, //enable-disable debugmode for logs
  enabled: true, // Enable inContact escalation
  applicationName: '',
  vendorName: '',
  applicationSecret: '',
  accessKeyId: '',
  accessKeySecret: '',
  profileIdHoursOperation: 0,
  teamId: 0,
  version: 'v12.0',
  agentWaitTimeout: 20, // seconds
  getMessageTimeout: 20, // miliseconds
  incontactSessionLifetime: 5, // minutes
  agent: {
    name: 'Agent', // Agent name
    avatarImage: '' // Agent avatar image soure (file or base64), if empty inContact image will be used
  },
  defaultUserName: 'User', //name displayed for user in incontact in case there is no form on escalate
  defaultChatbotName: 'Chatbot', //name displayed for chatbot messages in incontact 
  defaultSystemName: 'System', //name displayed for chatbot system messages in incontact 
  payload: {
    pointOfContact: '',
    fromAddress: '',
    chatRoomID: '',
    parameters: []
  }
}
```

The backstage instance need to have the [escalationFormV2] (https://developers.inbenta.io/chatbot/javascript-sdk/sdk-adapters/nl-escalation-adapter-2) available otherwise it will not work. 
There is one thing to take into account also, for No-Results dialog, the content that must be redirected to in case the No-Results is the content of "EscalationStart" action.

### Troubleshooting

* **The out of time message is not shown to the user:** Check what is the message returned by the Patron API and verify it matches with the label defined in the configuration field called **'outOfTimeDetection'**.
* **The agents don't have enough time to accept the chats:** The time elapsed before the automatic closing of the chat is defined in **'agentWaitTimeout'** and can be increased.

### Integration example
In the following example we're creating a chatbot with the InContact adapter:
* Import the Inbenta Chatbot SDK
    ```html
    <script src="https://sdk.inbenta.io/chatbot/1.41.0/inbenta-chatbot-sdk.js"></script>
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
      // Incontact Adapter conf
      incontactConf: {
        debugMode: true, //enable-disable debugmode for logs
        enabled: true, // Enable inContact escalation
        applicationName: '',
        vendorName: '',
        applicationSecret: '',
        accessKeyId: '',
        accessKeySecret: '',
        profileIdHoursOperation: 0,
        teamId: 0,
        version: 'v12.0',
        agentWaitTimeout: 20, // seconds
        getMessageTimeout: 20,
        incontactSessionLifetime: 3, // minutes
        agent: {
          name: 'Incontact Agent', // Agent name
          avatarImage: '' // Agent avatar image soure (file or base64), if empty inContact image will be use
        },
        defaultUserName: 'User', //name displayed for user in incontact in case there is no form on escalate
        defaultChatbotName: 'Chatbot', //name displayed for chatbot messages in incontact 
        defaultSystemName: 'System', //name displayed for chatbot system messages in incontact 
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
        window.SDKNLEscalation2(inbentaPromiseAgentsAvailableTrue)
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

    <!-- Import the Inbenta Chatbot SDK (works with SDK version 1.41.0, but you can try the last one listed [here](https://developers.inbenta.io/chatbot/javascript-sdk/sdk-subresource-integrity)) -->
    <script src="https://sdk.inbenta.io/chatbot/1.41.0/inbenta-chatbot-sdk.js" integrity="sha384-JNTy/kdUAPwDBdoI7douqLBGBmjY4k7tiTpvtceCBuFDNeh/Wb0hEV4Wfjjbwlfi" crossorigin="anonymous"></script>

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
      // Incontact Adapter conf
      incontactConf: {
        debugMode: true, //enable-disable debugmode for logs
        enabled: true, // Enable inContact escalation
        applicationName: '',
        vendorName: '',
        applicationSecret: '',
        accessKeyId: '',
        accessKeySecret: '',
        profileIdHoursOperation: 0,
        teamId: 0,
        version: 'v12.0',
        agentWaitTimeout: 20, // seconds
        getMessageTimeout: 60, // seconds
        incontactSessionLifetime: 3, // minutes
        agent: {
          name: 'Incontact Agent', // Agent name
          avatarImage: '' // Agent avatar image soure (file or base64), if empty inContact image will be use
        },
        defaultUserName: 'User', //name displayed for user in incontact in case there is no form on escalate
        defaultChatbotName: 'Chatbot', //name displayed for chatbot messages in incontact 
        defaultSystemName: 'System', //name displayed for chatbot system messages in incontact 
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
       *  More info: https://developers.inbenta.io/chatbot/javascript-sdk/sdk-adapters/nl-escalation-adapter-2
       */
      window.SDKNLEscalation2(inbentaPromiseAgentsAvailableTrue)
    );

    InbentaChatbotSDK.buildWithDomainCredentials(inbApp.sdkAuth, inbApp.sdkConfig);

    </script>
  </body>
</html>
```