import SockJS from "sockjs-client";
import Stomp from "webstomp-client";

var isConnected;
var stompClient;
var socket;
var subscriptions = {};


export function connect(plugin, handler, connectionHandler) {

    if (isConnected) {

      if (!subscriptions.hasOwnProperty(plugin)) {
        registerHandler(plugin, handler);
      }

      return;
    }

    socket = new SockJS("dashboard_api");
    stompClient = Stomp.over(socket);

    stompClient.connect(
        {},
        () => {
            registerHandler(plugin, handler);
            updateConnectionState(true);
            connectionHandler(true, null);
        },
        (error) => {
            if (error.type === "close") {
                updateConnectionState(false);
                connectionHandler(false, error);
                stompClient.unsubscribe(subscriptions[plugin]);
                stompClient.disconnect();
            }
        }
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


export function disconnect() {
  if (stompClient) {
    stompClient.disconnect();
  }

  updateConnectionState(false, null);
}

export function send(command, data) {
  stompClient.send(
    "/v1.0/command",
    JSON.stringify({ command: command, data: data }),
    {}
  );
}

/*************************************************************
 * Implementation of the connection handler
 *************************************************************/

async function updateConnectionState(connected) {
  isConnected = connected;

  if (connected) {
    send("client/attached");
  } else if (!connected) {
    await _sleep(5000);
    connect();
  } else {
    send("client/detached");
  }
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
