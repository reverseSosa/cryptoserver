export interface formattedTick {
	date: Date;
	timestamp: number;
	q: number;
}

export const formatter = (
	data,
	side: "Buy" | "Sell",
	preset:
		| "bybit"
		| "okx"
		| "upbit"
		| "huobi"
		| "bitmex"
		| "coinbase"
		| "bitforex"
		| "binance",
): formattedTick | null => {
	if (preset === "bybit") {
		const timestamp = data.ts;
		const trades = data.data?.filter(
			(trade) => trade.S === side && trade.v > 0.01,
		);

		if (trades?.length > 0) {
			const tickQ: number = trades
				.map((trade) => Number(trade.v))
				.reduce((prev, curr) => prev + curr);
			const formattedTick = {
				date: new Date(timestamp),
				timestamp: timestamp,
				q: tickQ,
				side: data.data[0].S,
				pair: data.topic,
			};
			return formattedTick;
		}
		return null;
	} else if (preset === "upbit") {
		const timestamp = data.tms;
		const tickQ: number = data.tv;
		const tradeSide = data.ab === "BID" ? "Buy" : "Sell";

		if (tradeSide === side) {
			const formattedTick = {
				date: new Date(timestamp),
				timestamp: timestamp,
				q: tickQ,
				side: tradeSide,
				pair: data.cd,
			};
			return formattedTick;
		}
		return null;
	} else if (preset === "okx") {
		if (data.data) {
			const timestamp = Number(data.data[0]?.ts);
			const curSide = side === "Buy" ? "buy" : "sell";
			const trades = data.data?.filter((trade) => trade.side === curSide);

			if (trades?.length > 0) {
				const tickQ: number = trades
					.map((trade) => Number(trade.sz))
					.reduce((prev, curr) => prev + curr);
				const formattedTick = {
					date: new Date(timestamp),
					timestamp: timestamp,
					q: tickQ,
					side: side,
					pair: data.data[0]?.instId,
				};
				return formattedTick;
			}
		}

		return null;
	} else if (preset === "huobi") {
		const timestamp = data.tick?.ts;
		const curSide = side === "Buy" ? "buy" : "sell";
		const trades = data.tick?.data?.filter(
			(trade) => trade.direction === curSide,
		);

		if (trades?.length > 0) {
			const tickQ: number = trades
				.map((trade) => trade.amount)
				.reduce((prev, curr) => prev + curr);
			const formattedTick = {
				date: new Date(timestamp),
				timestamp: timestamp,
				q: tickQ,
				side: side,
				pair: data.ch,
			};
			return formattedTick;
		}
		return null;
	} else if (preset === "bitmex") {
		if (data.data) {
			const timestamp = Date.parse(data.data[0].timestamp);
			const trades = data.data.filter(
				(trade) => trade.side === side && trade.homeNotional > 0.01,
			);

			if (trades.length > 0 && data.action === "insert") {
				const tickQ: number = trades
					.map((trade) => trade.homeNotional)
					.reduce((prev, curr) => prev + curr);
				const formattedTick = {
					date: new Date(timestamp),
					timestamp: timestamp,
					q: tickQ,
					side: side,
					pair: data.data[0]?.symbol,
				};
				return formattedTick;
			}
		}

		return null;
	} else if (preset === "coinbase") {
		const curSide = side === "Buy" ? "sell" : "buy";
		if (data.type === "match" && data.side === curSide) {
			const timestamp = Date.parse(data.time);
			const tickQ = Number(data.size);
			const formattedTick = {
				date: new Date(timestamp),
				timestamp: timestamp,
				q: tickQ,
				side: side,
				pair: data.product_id,
			};
			return formattedTick;
		}

		return null;
	} else if (preset === "bitforex") {
		if (data.data) {
			const timestamp = data.data[0].time;
			const curSide = side === "Buy" ? 1 : 2;
			const trades = data.data.filter(
				(trade) => trade.direction === curSide && trade.amount > 0.1,
			);
			if (trades.length > 0) {
				const tickQ: number = trades
					.map((trade) => Number(trade.amount))
					.reduce((prev, curr) => prev + curr);
				const formattedTick = {
					date: new Date(timestamp),
					timestamp: timestamp,
					q: tickQ,
					side: side,
					pair: data.param?.businessType,
				};
				return formattedTick;
			}
		}
		return null;
	} else if (preset === "binance") {
		const timestamp = data.T;
		const curSide = data.m ? "Sell" : "Buy";
		const tickQ = Number(data.q);

		if (side === curSide) {
			const formattedTick = {
				date: new Date(timestamp),
				timestamp: timestamp,
				q: tickQ,
				side: side,
				pair: data.s,
			};

			return formattedTick;
		}

		return null;
	} else console.log("preset doesnt exists");
};
