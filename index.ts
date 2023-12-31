import { WebSocket } from "ws";

import { formattedTick } from "./formatter";
import { createWebSocket } from "./socket";
import { createCandleSocket } from "./candleSocket";

export interface candle {
	futures: { buys: Array<formattedTick>; sells: Array<formattedTick> };
	candleStatus: {
		open: number;
		close: number;
		high: number;
		low: number;
	};
	shortHistory: boolean;
	signal: boolean;
	diver: boolean;
}

const currentCandle: candle = {
	futures: { buys: [], sells: [] },
	candleStatus: {
		open: 0,
		close: 0,
		high: 0,
		low: 0,
	},
	shortHistory: false,
	get signal() {
		const short = this.candleStatus.open > this.candleStatus.close;
		const body = this.candleStatus.open - this.candleStatus.close;
		const bottomWick = this.candleStatus.open - this.candleStatus.low;
		const currentSecond = new Date().getSeconds();
		const wick = bottomWick / body >= 4;
		let sum;
		if (this.futures.sells.length > 0) {
			sum = this.futures?.sells
				?.map((trade) => trade.q)
				.reduce((prev, curr) => prev + curr);
		}

		if (short && wick && currentSecond >= 50 && sum >= 700) {
			return true;
		}
		return false;
	},
	get diver() {
		let sum;

		if (this.futures.sells.length > 0) {
			sum = this.futures?.sells
				?.map((trade) => trade.q)
				.reduce((prev, curr) => prev + curr);
		}
		if (this.candleStatus.open > this.candleStatus.close) {
			this.shortHistory = true;
		}
		if (
			sum >= 700 &&
			this.shortHistory &&
			this.candleStatus.open < this.candleStatus.close
		) {
			return true;
		}
		return false;
	},
};

createWebSocket(currentCandle, "futures");

createCandleSocket(currentCandle);

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
