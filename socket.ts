import { WebSocket } from "ws";

import { formatter } from "./formatter";
import { candle } from ".";

export function createWebSocket(
	candle: candle,
	burse: "bybit" | "okx" | "upbit",
) {
	let socketUrl;
	let store;
	let subMessage;
	let pingMessage;
	let pongMessage;

	if (burse === "bybit") {
		socketUrl = "wss://stream.bybit.com/v5/public/spot";
		store = candle.bybit;
		subMessage = {
			req_id: "reversesosa",
			op: "subscribe",
			args: ["publicTrade.BTCUSDT"],
		};
		pingMessage = JSON.stringify({ op: "ping" });
	}
	if (burse === "okx") {
		socketUrl = "wss://wsaws.okx.com:8443/ws/v5/public";
		store = candle.okx;
		subMessage = {
			op: "subscribe",
			args: [
				{
					channel: "trades",
					instId: "BTC-USDT",
				},
			],
		};
	}
	if (burse === "upbit") {
		socketUrl = "wss://api.upbit.com/websocket/v1";
		store = candle.upbit;
		subMessage = [
			{ ticket: "reversesosa" },
			{ type: "trade", codes: ["KRW-BTC"], isOnlyRealtime: true },
			{ format: "SIMPLE" },
		];
		pingMessage = "PING";
	}

	const ws = new WebSocket(socketUrl);

	/* const heartbeatInterval = setInterval(() => {
		ws.send(pingMessage);
	}, 20000); */

	let timeoutInterval;

	const startTimeout = () => {
		timeoutInterval = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.close();
				console.log("CLOSED DUE INACTIVITY");
			}
		}, 60000);
	};

	ws.on("open", () => {
		ws.send(JSON.stringify(subMessage));
	});

	const stopTimeout = () => {
		clearInterval(timeoutInterval);
	};

	ws.on("message", (data) => {
		const message = JSON.parse(data.toString());
		if (message.ret_msg === "pong" || message.status === "UP") {
			console.log(message);
			stopTimeout();
			startTimeout();
		} else {
			try {
				console.log("-----");

				const formattedBuys = formatter(message, "Buy", burse);

				if (formattedBuys) {
					const freshBuys = store.buys?.filter(
						(order) =>
							order.date.getMinutes() === formattedBuys.date.getMinutes(),
					);
					store.buys = [...freshBuys, formattedBuys];
					console.log(formattedBuys);
				}

				const formattedSells = formatter(message, "Sell", burse);

				if (formattedSells) {
					const freshSells = store.sells?.filter(
						(order) =>
							order.date.getMinutes() === formattedSells.date.getMinutes(),
					);
					store.sells = [...freshSells, formattedSells];
					console.log(formattedSells);
				}
			} catch (error) {
				console.log(error);
			}
		}
	});

	ws.onclose = () => {
		//clearInterval(heartbeatInterval);
		stopTimeout();

		setTimeout(() => {
			createWebSocket(candle, burse);
		}, 5000);
	};
}
