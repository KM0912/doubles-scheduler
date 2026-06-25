# doubles-scheduler

ラケットスポーツ（バドミントン、テニス、卓球、ピックルボールなど）のソーシャルダブルス向けに、**次の1ラウンド分のコート割り当て**を自動生成する TypeScript ライブラリです。

このライブラリは UI や永続化を持ちません。アプリ側が保持する `state` を受け取り、次の組み合わせ候補を生成し、検証し、確定した round を履歴に追加します。

詳細な仕様、制約、アルゴリズムの判断は [`docs/SPEC.md`](docs/SPEC.md) を参照してください。

## インストール

```bash
npm install doubles-scheduler
```

## 基本の流れ

1. `createSchedulerState` で現在の参加者・コート数・履歴を state にする
2. `generateNextRound` で次ラウンド候補を生成する
3. 必要ならアプリ側 UI で round を手動編集する
4. `validateRound` で編集後の round を検証する
5. `applyRound` で確定 round を履歴に追加する
6. 返ってきた state を `JSON.stringify` して保存する

```ts
import {
  applyRound,
  createSchedulerState,
  generateNextRound,
  validateRound,
} from "doubles-scheduler";

let state = createSchedulerState({
  players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
  courtCount: 1,
});

const proposal = generateNextRound(state, {
  seed: 123,
});

console.log(proposal.round);
// {
//   id: "round-1",
//   matches: [
//     { id: "match-1-1", court: 1, teamA: [1, 2], teamB: [3, 4] }
//   ],
//   restingPlayers: [],
//   sittingOutPlayers: [5, 6]
// }

const validation = validateRound(state, proposal.round);

if (!validation.valid) {
  console.error(validation.errors);
} else {
  state = applyRound(state, proposal.round);
}
```

`applyRound` 後の `state.rounds` が履歴です。次に `generateNextRound` を呼ぶと、この履歴をもとに試合数、待機回数、過去のペア、過去の対戦相手を考慮します。

## State の作り方

`players` と `courtCount` が最小入力です。プレイヤー ID は `string | number` で、表示名やレーティングも持てます。

```ts
import { createSchedulerState } from "doubles-scheduler";

const state = createSchedulerState({
  players: [
    { id: "a", name: "Aki", rating: 4.5 },
    { id: "b", name: "Ben", rating: 3.8 },
    { id: "c", name: "Chika", rating: 4.1 },
    { id: "d", name: "Dai", rating: 3.6 },
  ],
  courtCount: 1,
});
```

`state` は JSON-friendly な plain object です。`Map`、`Set`、`Date`、class instance を含まないため、そのまま保存できます。

```ts
localStorage.setItem("scheduler", JSON.stringify(state));

const restored = createSchedulerState(
  JSON.parse(localStorage.getItem("scheduler")!),
);
```

すでに `SchedulerState` として保存した object をそのまま使う場合は、再生成せず `generateNextRound(restoredState)` に渡しても構いません。

## 休憩と待機

このライブラリでは、ユーザーが明示する休憩と、人数超過で自動的に外れる待機を分けています。

| 概念         | 意味                                         | 格納先                                            |
| ------------ | -------------------------------------------- | ------------------------------------------------- |
| `resting`    | ユーザーが「このラウンドは休み」と指定した人 | `state.restingPlayerIds` / `round.restingPlayers` |
| `sittingOut` | 定員に入らずライブラリが待機にした人         | `round.sittingOutPlayers`                         |

```ts
import {
  createSchedulerState,
  generateNextRound,
  setPlayerResting,
} from "doubles-scheduler";

let state = createSchedulerState({
  players: [1, 2, 3, 4, 5].map((id) => ({ id })),
  courtCount: 1,
});

state = setPlayerResting(state, 5, true);

const { round } = generateNextRound(state);

console.log(round.restingPlayers); // [5]
console.log(round.sittingOutPlayers); // 5 は含まれない
```

`resting` は生成対象外です。`sittingOut` は公平性計算に入り、次回以降に優先して出場しやすくなります。

## 固定ペア

固定ペアは「両方が同じ round に出るなら必ず同じ team にする」という制約です。必ず出場させる指定ではありません。

```ts
import {
  createSchedulerState,
  generateNextRound,
  setFixedPairs,
} from "doubles-scheduler";

let state = createSchedulerState({
  players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
  courtCount: 2,
});

state = setFixedPairs(state, [[1, 2]]);

const { round } = generateNextRound(state, {
  seed: 10,
});

const teams = round.matches.flatMap((match) => [match.teamA, match.teamB]);
console.log(teams.some((team) => team.includes(1) && team.includes(2))); // true
```

固定ペアの片方が休憩中の場合、そのペアは分割されません。必要に応じて `fixedPairUnavailable` warning が返ります。

## 人数とコート数

1試合は4人、1コートにつき1試合です。参加可能人数がコート定員より少ない場合は、作れる最大数の試合だけを作ります。

```ts
const state = createSchedulerState({
  players: [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
  courtCount: 2,
});

const proposal = generateNextRound(state);

console.log(proposal.round.matches.length); // 1
console.log(proposal.round.sittingOutPlayers.length); // 2
console.log(proposal.warnings);
// [{ type: "unusedCourts", unusedCourtCount: 1 }]
```

4人未満で試合を作れない場合、`round.matches` は空になり、`notEnoughPlayers` warning が返ります。

## ラウンドの手動編集

アプリ側でドラッグ操作などにより組み合わせを編集したい場合は、編集後の round を必ず `validateRound` してから `applyRound` してください。

```ts
import {
  applyRound,
  generateNextRound,
  movePlayer,
  swapPlayers,
  validateRound,
} from "doubles-scheduler";

const proposal = generateNextRound(state);

let editedRound = proposal.round;

// コート上の2人を入れ替える
editedRound = swapPlayers(editedRound, 1, 4);

// sittingOut の人を特定スロットへ入れる
editedRound = movePlayer(editedRound, 5, {
  matchId: editedRound.matches[0]!.id,
  team: "teamA",
  slot: 0,
});

const validation = validateRound(state, editedRound);

if (validation.valid) {
  state = applyRound(state, editedRound);
} else {
  console.error(validation.errors);
}
```

`validateRound` は重複出場、存在しない player、休憩者の出場、固定ペアの分割、コート数超過などを検出します。`applyRound` は内部でも検証し、invalid な round では `ApplyRoundError` を throw します。

## 途中参加・途中離脱・設定変更

セッション中の変更は state 更新 API で行います。各関数は元の state を直接変更せず、新しい state を返します。

```ts
import {
  addPlayer,
  removePlayer,
  setCourtCount,
  setFixedPairs,
  setPlayerResting,
} from "doubles-scheduler";

state = addPlayer(state, {
  id: 9,
  name: "New Player",
  stats: { games: 2, wins: 1, losses: 1 },
});

state = removePlayer(state, 3);
state = setCourtCount(state, 3);
state = setPlayerResting(state, 5, true);
state = setFixedPairs(state, [
  [1, 2],
  [7, 8],
]);
```

`removePlayer` しても過去の `rounds` からは削除されません。履歴は実績として残り、次回以降の生成対象からだけ外れます。

## 統計を見る

統計は `state.rounds` から計算します。保存済み state に重複した集計値を持たせないため、手動編集後も履歴と統計がズレにくい設計です。

```ts
import {
  computeOpponentStats,
  computePairStats,
  computePlayerStats,
} from "doubles-scheduler";

const playerStats = computePlayerStats(state);
const pairStats = computePairStats(state);
const opponentStats = computeOpponentStats(state);

console.table(playerStats);
// playerId, games, rests, sitOuts, wins, losses, lastRoundPlayed, lastRoundRested

console.table(pairStats);
// pair, gamesTogether

console.table(opponentStats);
// players, gamesAgainst
```

`Player.stats` に初期値を入れると、途中参加者の過去実績として統計計算の起点にできます。

```ts
state = addPlayer(state, {
  id: "guest",
  stats: {
    games: 4,
    rests: 1,
    wins: 2,
    losses: 2,
  },
});
```

## Strategy と調整

組み込み strategy は `balanced` のみです。`strategy` を省略した場合も `balanced` が使われます。

`balanced` は以下をなるべく満たす候補を選びます。

- 試合数が少ない人を優先する
- 連続待機を避ける
- 同じペア・同じ対戦相手の繰り返しを避ける
- 同じ出場者セットの循環を避ける
- 4人ちょうどの場合、3通りのペアを偏りなく回す
- `rating` や勝敗履歴がある場合、チーム間の強さを近づける

生成時に `seed` を渡すと、同じ state と options から同じ候補を再現しやすくなります。

```ts
const proposal = generateNextRound(state, {
  strategy: "balanced",
  seed: "round-2026-06-25-1",
  candidateCount: 64,
  weights: {
    balanceGames: 8,
    avoidRepeatedPair: 10,
    avoidRepeatedOpponent: 4,
    avoidConsecutiveRest: 6,
    avoidConsecutivePlay: 2,
    balanceRating: 5,
    randomness: 1,
  },
});
```

`candidateCount` を増やすと、より多くの候補を比較します。通常は未指定で十分です。重みの意味や詳細な優先順位は [`docs/SPEC.md`](docs/SPEC.md) を確認してください。

## Class wrapper を使う

pure function で state を明示的に受け渡しする代わりに、薄い class wrapper も使えます。内部では同じ API を呼んでいます。

```ts
import { createScheduler } from "doubles-scheduler";

const scheduler = createScheduler({
  players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })),
  courtCount: 2,
});

scheduler.setFixedPairs([[1, 2]]);

const proposal = scheduler.generateNextRound({
  seed: 3,
});

const validation = scheduler.validateRound(proposal.round);

if (validation.valid) {
  scheduler.applyRound(proposal.round);
}

const stateToSave = scheduler.getState();
```

保存済み state から復元する場合も `createScheduler(savedState)` で開始できます。

## 公開 API

| API                                | 説明                                |
| ---------------------------------- | ----------------------------------- |
| `createSchedulerState`             | 初期 state を作成                   |
| `generateNextRound`                | 次ラウンド候補を生成                |
| `validateRound`                    | 生成または手動編集した round を検証 |
| `applyRound`                       | 有効な round を履歴に適用           |
| `addPlayer` / `removePlayer`       | 途中参加・離脱                      |
| `setCourtCount`                    | コート数を変更                      |
| `setPlayerResting`                 | 明示休憩を切り替え                  |
| `setFixedPairs`                    | 固定ペアを置き換え                  |
| `computePlayerStats`               | プレイヤー別統計を履歴から計算      |
| `computePairStats`                 | ペア履歴を計算                      |
| `computeOpponentStats`             | 対戦相手履歴を計算                  |
| `swapPlayers`                      | round 内の2人を入れ替え             |
| `movePlayer`                       | player を指定スロットへ移動         |
| `createScheduler` / `Scheduler`    | class wrapper                       |
| `pairKey` / `teamKey` / `matchKey` | 履歴キー正規化 helper               |

## 型の概要

```ts
type PlayerId = string | number;

type Player<ID extends PlayerId = PlayerId> = {
  id: ID;
  name?: string;
  rating?: number;
  stats?: {
    games?: number;
    rests?: number;
    wins?: number;
    losses?: number;
  };
  metadata?: Record<string, unknown>;
};

type Round<ID extends PlayerId = PlayerId> = {
  id: string;
  matches: {
    id: string;
    court: number;
    teamA: [ID, ID];
    teamB: [ID, ID];
  }[];
  restingPlayers: ID[];
  sittingOutPlayers: ID[];
};
```

正確な型定義は [`src/types.ts`](src/types.ts) を参照してください。

## 開発

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```
