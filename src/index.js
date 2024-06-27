import SockJS from "sockjs-client";
import Stomp from "webstomp-client";

var isConnected;
var stompClient;
var socket;
var subscriptions = {};

/*************************************************************
 * Connects to the plugin backend
 *************************************************************/
export function connect(plugin, handler, connectionHandler) {

    if (!isConnected) {
        socket = new SockJS("dashboard_api");
        stompClient = Stomp.over(socket);

        stompClient.connect(
            {},
            () => {
                registerHandler(plugin, handler);
                updateConnectionState(true, plugin, handler, connectionHandler);
                connectionHandler(true, null);
            },
            (error) => {
                console.log(error)
                if (error.type === "close") {
                    updateConnectionState(
                      false,
                      plugin,
                      handler,
                      connectionHandler
                    );
                    connectionHandler(false, error);
                    stompClient.unsubscribe(subscriptions[plugin]);
                    stompClient.disconnect();
                }
            }
        );
    } else {
        if (!subscriptions.hasOwnProperty(plugin)) {
          registerHandler(plugin, handler);
        }
    }
}

/*************************************************************
 * Disconnects from the backend
 *************************************************************/
export function disconnect(plugin) {
  if (stompClient) {
    stompClient.disconnect();
    if (subscriptions.hasOwnProperty(plugin)) {
      delete subscriptions[plugin]
    }
  }

  updateConnectionState(false, plugin);
}

/*************************************************************
 * Sends a command to the dashboard backend
 *************************************************************/
export function send(command, data) {
  stompClient.send(
    "/v1.0/command",
    JSON.stringify({ command: command, data: data }),
    {}
  );
}


function registerHandler(plugin, handler) {
  subscriptions[plugin] = stompClient.subscribe("/v1.0/" + plugin, (tick) => {
    handler(
      JSON.parse(tick.body, (key, value) =>
        value === null || value === "" ? undefined : value
      )
    );
  });
}

async function updateConnectionState(
  connected,
  plugin,
  handler,
  connectionHandler
) {
  isConnected = connected;

  if (connected) {
    send(plugin + "/attached");
  } else if (!connected && connectionHandler) {
    await _sleep(5000);
    connect(plugin, handler, connectionHandler);
  } else {
    send(plugin + "/detached");
  }
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
