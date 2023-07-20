import { WebSocket } from "ws";

import { formatter } from "./formatter";
import { candle } from ".";
import { InputType, gunzipSync } from "zlib";

export function createWebSocket(
	candle: candle,
	burse:
		| "bybit"
		| "okx"
		| "upbit"
		| "huobi"
		| "bitmex"
		| "coinbase"
		| "bitforex"
		| "binance",
) {
	let socketUrl;
	let store;
	let subMessage;
	let pingMessage;
	let messageHandler = (data) => {
		return JSON.parse(data.toString());
	};

	if (burse === "bybit") {
		socketUrl = "wss://stream.bybit.com/v5/public/spot";
		store = candle.bybit;
		subMessage = {
			req_id: "reversesosa",
			op: "subscribe",
			args: ["publicTrade.BTCUSDT", "publicTrade.BTCUSDC"],
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
		pingMessage = "ping";
		messageHandler = (data) => {
			if (data.toString() === "pong") {
				return { pong: "pong" };
			} else {
				return JSON.parse(data.toString());
			}
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

	if (burse === "huobi") {
		socketUrl = "wss://api-aws.huobi.pro/ws";
		store = candle.huobi;
		subMessage = {
			sub: "market.btcusdt.trade.detail",
			id: "reversesosa",
		};
		messageHandler = (data) => {
			const compressedData = new Uint8Array(data);
			const uncompressedData = gunzipSync(compressedData);
			const returnData = JSON.parse(uncompressedData.toString());
			return returnData;
		};
	}

	if (burse === "bitmex") {
		socketUrl = "wss://ws.bitmex.com/realtime?subscribe=trade:XBTUSD";
		store = candle.bitmex;
		pingMessage = "ping";
		messageHandler = (data) => {
			if (data.toString() === "pong") {
				return { pong: "pong" };
			} else {
				return JSON.parse(data.toString());
			}
		};
	}

	if (burse === "coinbase") {
		socketUrl = "wss://ws-feed.exchange.coinbase.com";
		store = candle.coinbase;
		subMessage = {
			type: "subscribe",
			product_ids: ["BTC-USD"],
			channels: ["full"],
		};
	}

	if (burse === "bitforex") {
		socketUrl = "wss://www.bitforex.com/mkapi/coinGroup1/ws";
		store = candle.bitforex;
		subMessage = [
			{
				type: "subHq",
				event: "trade",
				param: {
					businessType: "coin-usdt-btc",
					size: 1,
				},
			},
		];
		pingMessage = "ping_p";
		messageHandler = (data) => {
			if (data.toString() === "pong_p") {
				return { pong: "pong" };
			} else {
				return JSON.parse(data.toString());
			}
		};
	}

	if (burse === "binance") {
		socketUrl = "wss://stream.binance.com:9443/ws/btcusdt@trade";
		store = candle.binance;
	}

	const ws = new WebSocket(socketUrl);

	const heartbeatInterval = setInterval(() => {
		if (burse !== "huobi") {
			ws.send(pingMessage);
		}
	}, 30000);

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

	ws.on("message", (data: InputType) => {
		const message = messageHandler(data);
		console.log(message);
		stopTimeout();
		startTimeout();
		if (
			message?.ret_msg === "pong" ||
			message?.status === "UP" ||
			message?.ping ||
			message?.pong
		) {
			console.log(message);
			if (burse === "huobi") {
				ws.send(JSON.stringify({ pong: message.ping }));
			}
			stopTimeout();
			startTimeout();
		} else {
			try {
				//console.log("-----");

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

	ws.onerror = () => {
		//clearInterval(heartbeatInterval);
		stopTimeout();

		setTimeout(() => {
			createWebSocket(candle, burse);
		}, 5000);
	};

	ws.onclose = () => {
		//clearInterval(heartbeatInterval);
		stopTimeout();

		setTimeout(() => {
			createWebSocket(candle, burse);
		}, 5000);
	};
}
