# doubles-scheduler

ラケットスポーツ（バドミントン、テニス、卓球など）のソーシャルダブルス向けに、**次の1ラウンド分のコート割り当て**を自動生成する TypeScript ライブラリ。

詳細仕様は [`docs/SPEC.md`](docs/SPEC.md) を参照。

## クイックスタート

```ts
import {
  applyRound,
  createScheduler,
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
  strategy: "balanced",
  seed: 123,
});

const validation = validateRound(state, proposal.round);
if (validation.valid) {
  state = applyRound(state, proposal.round);
}

// optional class wrapper
const scheduler = createScheduler(state);
scheduler.generateNextRound({ strategy: "balanced" });
```

## 公開 API

| 関数                                                               | 説明                               |
| ------------------------------------------------------------------ | ---------------------------------- |
| `createSchedulerState`                                             | 初期 state を作成                  |
| `generateNextRound`                                                | 次ラウンド候補を生成               |
| `validateRound`                                                    | 手動編集後の round を検証          |
| `applyRound`                                                       | 有効な round を履歴に適用          |
| `addPlayer` / `removePlayer`                                       | 途中参加・離脱                     |
| `setCourtCount` / `setPlayerResting` / `setFixedPairs`             | 設定更新                           |
| `computePlayerStats` / `computePairStats` / `computeOpponentStats` | 履歴から統計を計算                 |
| `swapPlayers` / `movePlayer`                                       | 手動編集ヘルパー                   |
| `createScheduler`                                                  | pure function の薄い class wrapper |

組み込み strategy: `balanced` のみ（デフォルト）

`balanced` は `weights` と `candidateCount` で調整可能。

`balanced` の基本挙動:

- 初期状態では入力順を優先し、例として `1,2 vs 3,4` から割り当てる。
- 待機者は、全員同条件なら大きい ID から選ぶ。
- 連続待機、同じペア・対戦相手、同じ出場者セットの循環をなるべく避ける。
- 4人ちょうどでは3通りのペア/対戦パターンを偏りなく回す。
- rating や勝敗履歴がある場合は、チーム間の強さの偏りもスコアに反映する。

詳細な優先順位と例外条件は [`docs/SPEC.md`](docs/SPEC.md) を参照。

## 開発

```bash
npm install
npm test
npm run build
npm run lint
```
