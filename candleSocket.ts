import WebSocket from "ws";
import { candle } from ".";

export function createCandleSocket(candle: candle) {
	const url = "wss://fstream.binance.com/ws";

	const subMessage = {
		method: "SUBSCRIBE",
		params: ["btcusdt@kline_1m"],
		id: 230,
	};

	const ws = new WebSocket(url);

	ws.on("open", () => {
		ws.send(JSON.stringify(subMessage));
	});

	ws.on("message", (data) => {
		const message = JSON.parse(data.toString());
		if (message.k) {
			candle.candleStatus = {
				open: Number(message.k.o),
				close: Number(message.k.c),
				high: Number(message.k.h),
				low: Number(message.k.l),
			};
		}

		//console.log(candle.candleStatus);
	});

	ws.on("error", () => {
		createCandleSocket(candle);
	});
}
