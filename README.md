# doubles-scheduler

ラケットスポーツ（バドミントン、テニス、卓球など）のソーシャルダブルス向けに、**次の1ラウンド分のコート割り当て**を自動生成する TypeScript ライブラリ。

詳細仕様は [`docs/SPEC.md`](docs/SPEC.md) を参照。

## クイックスタート

```ts
import {
  applyRound,
  createSchedulerState,
  generateNextRound,
  setFixedPairs,
  setPlayerResting,
  validateRound,
} from "doubles-scheduler";

let state = createSchedulerState({
  players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
  courtCount: 1,
});

state = setPlayerResting(state, 6, true);
state = setFixedPairs(state, [[1, 2]]);

const proposal = generateNextRound(state, {
  strategy: "avoidRepeatedPair",
  seed: 123,
});

const validation = validateRound(state, proposal.round);
if (validation.valid) {
  state = applyRound(state, proposal.round);
}
```

## 公開 API（MVP）

| 関数 | 説明 |
| --- | --- |
| `createSchedulerState` | 初期 state を作成 |
| `generateNextRound` | 次ラウンド候補を生成 |
| `validateRound` | 手動編集後の round を検証 |
| `applyRound` | 有効な round を履歴に適用 |
| `addPlayer` / `removePlayer` | 途中参加・離脱 |
| `setCourtCount` / `setPlayerResting` / `setFixedPairs` | 設定更新 |
| `computePlayerStats` / `computePairStats` | 履歴から統計を計算 |

組み込み strategy: `random` / `leastPlayed` / `avoidRepeatedPair`

## 開発

```bash
npm install
npm test
npm run build
npm run lint
```
