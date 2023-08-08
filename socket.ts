import WS from "ws";
import WebSocket from "ws";
import ReconnectingWebSocket from "reconnecting-websocket";
import { gunzipSync } from "zlib";

import { formatter } from "./formatter";
import { candle } from ".";

export function createWebSocket(
	candle: candle,
	burse:
		| "bybit"
		| "okx"
		| "upbit"
		| "huobi"
		| "bitmex"
		| "coinbase"
		| "binance"
		| "futures",
) {
	let store;
	let subMessage;
	let pingMessage;
	let messageHandler = (data) => {
		return JSON.parse(data.data.toString());
	};

	if (burse === "bybit") {
		store = candle.bybit;
		subMessage = {
			req_id: "reversesosa",
			op: "subscribe",
			args: ["publicTrade.BTCUSDT", "publicTrade.BTCUSDC"],
		};
		pingMessage = JSON.stringify({ op: "ping" });
	}

	if (burse === "okx") {
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
			if (data.data.toString() === "pong") {
				return { pong: "pong" };
			} else {
				return JSON.parse(data.data.toString());
			}
		};
	}

	if (burse === "upbit") {
		store = candle.upbit;
		subMessage = [
			{ ticket: "reversesosa" },
			{ type: "trade", codes: ["KRW-BTC"], isOnlyRealtime: true },
			{ format: "SIMPLE" },
		];
		pingMessage = "PING";
	}

	if (burse === "huobi") {
		store = candle.huobi;
		subMessage = {
			sub: "market.btcusdt.trade.detail",
			id: "reversesosa",
		};
		messageHandler = (data) => {
			const compressedData = new Uint8Array(data.data);
			const uncompressedData = gunzipSync(compressedData);
			const returnData = JSON.parse(uncompressedData.toString());
			return returnData;
		};
	}

	if (burse === "bitmex") {
		store = candle.bitmex;
		pingMessage = "ping";
		messageHandler = (data) => {
			if (data.data.toString() === "pong") {
				return { pong: "pong" };
			} else {
				return JSON.parse(data.data.toString());
			}
		};
	}

	if (burse === "coinbase") {
		store = candle.coinbase;
		subMessage = {
			type: "subscribe",
			product_ids: ["BTC-USD"],
			channels: ["full"],
		};
	}

	if (burse === "binance") {
		store = candle.binance;
		subMessage = {
			method: "SUBSCRIBE",
			params: ["btctusd@trade", "btcusdt@trade"],
			id: 229,
		};
		messageHandler = (data) => {
			try {
				const result = JSON.parse(data.data);
				return result;
			} catch (error) {
				console.log(error);
			}
		};
		pingMessage = "pong";
	}

	if (burse === "futures") {
		store = candle.futures;
		subMessage = {
			method: "SUBSCRIBE",
			params: ["btcusdt@trade"],
			id: 229,
		};
		messageHandler = (data) => {
			try {
				const result = JSON.parse(data.data);
				return result;
			} catch (error) {
				console.log(error);
			}
		};
		pingMessage = "pong";
	}

	const urlProvider = (burse: string): string => {
		const urlList = {
			binance: "wss://stream.binance.com:9443/ws",
			bitmex: "wss://ws.bitmex.com/realtime?subscribe=trade:XBTUSD",
			coinbase: "wss://ws-feed.exchange.coinbase.com",
			bybit: "wss://stream.bybit.com/v5/public/spot",
			okx: "wss://wsaws.okx.com:8443/ws/v5/public",
			huobi: "wss://api-aws.huobi.pro/ws",
			upbit: "wss://api.upbit.com/websocket/v1",
			futures: "wss://fstream.binance.com/ws",
		};
		return urlList[burse];
	};

	const options = {
		WebSocket: WS,
		connectionTimeout: 30000,
	};

	const ws = new ReconnectingWebSocket(urlProvider(burse), [], options);

	const heartbeatInterval = setInterval(() => {
		if (burse !== "huobi") {
			ws.send(pingMessage);
		}
	}, 30000);

	let timeoutInterval;

	const startTimeout = () => {
		timeoutInterval = setTimeout(() => {
			if (ws && ws.readyState === ReconnectingWebSocket.OPEN) {
				console.log("Я ХУЙЛО ЕБЛИВОЕ И ЗАКРЫВАЮСЬ");
				ws.close();
				console.log("CLOSED DUE INACTIVITY");
			}
		}, 60000);
	};

	ws.addEventListener("open", () => {
		ws.send(JSON.stringify(subMessage));
	});

	const stopTimeout = () => {
		clearTimeout(timeoutInterval);
	};

	ws.addEventListener("message", (data) => {
		const message = messageHandler(data);
		//console.log(message);
		console.log(ws.readyState);
		stopTimeout();
		startTimeout();
		if (
			message?.ret_msg === "pong" ||
			message?.status === "UP" ||
			message?.ping ||
			message?.pong
		) {
			//console.log(message);
			if (burse === "huobi") {
				ws.send(JSON.stringify({ pong: message.ping }));
			}
			stopTimeout();
			startTimeout();
		} else {
			try {
				const formattedBuys = formatter(message, "Buy", burse);

				if (formattedBuys) {
					const freshBuys = store.buys?.filter(
						(order) =>
							order.date.getMinutes() === formattedBuys.date.getMinutes(),
					);
					store.buys = [...freshBuys, formattedBuys];
					//console.log(formattedBuys);
				}

				const formattedSells = formatter(message, "Sell", burse);

				if (formattedSells) {
					const freshSells = store.sells?.filter(
						(order) =>
							order.date.getMinutes() === formattedSells.date.getMinutes(),
					);
					store.sells = [...freshSells, formattedSells];
					//console.log(formattedSells);
				}
			} catch (error) {
				console.log(error);
			}
		}
	});

	ws.addEventListener("error", (error) => {
		console.log(error);
		clearInterval(heartbeatInterval);
		stopTimeout();
	});

	ws.addEventListener("close", () => {
		clearInterval(heartbeatInterval);
		stopTimeout();

		setTimeout(() => {
			createWebSocket(candle, burse);
		}, 5000);
	});
}
