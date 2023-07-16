import { WebSocket } from "ws";

import { formattedTick } from "./formatter";
import { createWebSocket } from "./socket";

export interface candle {
	bybit: {
		buys: Array<formattedTick>;
		sells: Array<formattedTick>;
	};
	okx: {
		buys: Array<formattedTick>;
		sells: Array<formattedTick>;
	};
	upbit: {
		buys: Array<formattedTick>;
		sells: Array<formattedTick>;
	};
	huobi: {
		buys: Array<formattedTick>;
		sells: Array<formattedTick>;
	};
}

const currentCandle: candle = {
	bybit: { buys: [], sells: [] },
	okx: { buys: [], sells: [] },
	upbit: { buys: [], sells: [] },
	huobi: { buys: [], sells: [] },
};

createWebSocket(currentCandle, "okx");
createWebSocket(currentCandle, "bybit");
createWebSocket(currentCandle, "upbit");
createWebSocket(currentCandle, "huobi");

function createServerSocket() {
	const wss = new WebSocket.Server({ port: 8080 });

	let connectedClients = new Set();

	wss.on("connection", (ws) => {
		connectedClients.add(ws);
		if (connectedClients.size === 1) {
			startSendingMessages();
		}

		ws.on("close", () => {
			connectedClients.delete(ws);
			if (connectedClients.size === 0) {
				stopSendingMessages();
			}
		});
	});

	let interval;

	function startSendingMessages() {
		interval = setInterval(() => {
			connectedClients.forEach((client: WebSocket) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify(currentCandle));
				}
			});
		}, 500);
	}

	function stopSendingMessages() {
		clearInterval(interval);
	}

	process.on("SIGINT", () => {
		stopSendingMessages();
		process.exit();
	});
}

createServerSocket();
