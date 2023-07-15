interface order {
	i: string;
	T: number;
	p: string;
	v: string;
	S: string;
	s: string;
	BT: boolean;
}

interface message {
	topic: string;
	ts: number;
	type: string;
	data: Array<order>;
}

export interface formattedTick {
	date: Date;
	timestamp: number;
	q: number;
}

export const formatter = (
	data: message,
	side: "Buy" | "Sell",
	preset: "bybit" | "okx",
): formattedTick | null => {
	if (preset === "bybit") {
		const timestamp = data.ts;
		const trades = data.data?.filter((trade) => trade.S === side);
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
	} else console.log("preset doesnt exists");
};
