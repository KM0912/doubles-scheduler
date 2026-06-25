# Doubles Scheduler Implementation Plan

このファイルは `docs/SPEC.md` を正本として、実装を小さな単位で進めるための進捗トラッカーです。

## 運用ルール

- 仕様の正本は常に `docs/SPEC.md`。
- API、型、データモデル、ビジネスルール、アルゴリズムを変更する場合は、先に `docs/SPEC.md` を更新し、必要に応じて `README.md` も同期する。
- 各タスクは「実装」「テスト」「ドキュメント同期確認」まで終わってから `done` にする。
- `blocked` にする場合は、理由と解消に必要な判断を `Notes` に書く。
- 進捗は小さなコミット単位で区切る。

## Status

| Status    | 意味                       |
| --------- | -------------------------- |
| `todo`    | 未着手                     |
| `doing`   | 作業中                     |
| `blocked` | 判断待ち・依存待ち         |
| `done`    | 実装・テスト・同期確認済み |

## Phase 0 - Project Setup

| ID    | Scope                   | SPEC | Status | Tests / Check           | Notes                          |
| ----- | ----------------------- | ---- | ------ | ----------------------- | ------------------------------ |
| P0-01 | npm package 初期化      | §16  | done   | `npm test` が実行できる | npm                            |
| P0-02 | TypeScript / build 設定 | §16  | done   | `npm run build`         | tsup / `src/index.ts` から公開 |
| P0-03 | test runner 設定        | §19  | done   | sample test             | Vitest / `tests/smoke.test.ts` |
| P0-04 | lint / format 方針      | §16  | done   | lint command            | ESLint + Prettier（最小構成）  |

## Phase 1 - MVP

| ID    | Scope                            | SPEC            | Status | Tests / Check                | Notes                                                                             |
| ----- | -------------------------------- | --------------- | ------ | ---------------------------- | --------------------------------------------------------------------------------- |
| P1-01 | public types 定義                | §5, §7, §14     | done   | typecheck                    | `PlayerId`, `Round`, `SchedulerState`, error/warning types                        |
| P1-02 | `createSchedulerState`           | §6.1            | done   | `tests/state.test.ts`        | JSON-friendly state を返す                                                        |
| P1-03 | state 更新 API                   | §6.5, §8.4      | done   | `tests/state.test.ts`        | `addPlayer`, `removePlayer`, `setCourtCount`, `setPlayerResting`, `setFixedPairs` |
| P1-04 | canonical key utilities          | §12.1           | done   | `tests/stats.test.ts`        | pair / team / match key                                                           |
| P1-05 | `computePlayerStats`             | §12             | done   | `tests/stats.test.ts`        | `games`, `rests`, `sitOuts`, wins/losses                                          |
| P1-06 | `computePairStats`               | §12             | done   | `tests/stats.test.ts`        | pair order normalization                                                          |
| P1-07 | `validateRound` hard constraints | §6.3, §9, §14   | done   | `tests/validation.test.ts`   | manual edit flow の土台                                                           |
| P1-08 | `selectSittingOut`               | §8.1, §8.2      | done   | `tests/generator.test.ts`    | games 昇順 / rests 降順 / id 昇順                                                 |
| P1-09 | seed 対応 random utility         | §7, §11         | done   | deterministic test           | 同じ state/options で同じ結果                                                     |
| P1-10 | `generateNextRound` baseline     | §6.2, §10, §11  | done   | `tests/generator.test.ts`    | 4人/8人/6人/4人未満                                                               |
| P1-11 | fixed pair 対応                  | §9.3            | done   | generator + validation tests | 片方だけ出場は invalid                                                            |
| P1-12 | `applyRound`                     | §6.4, §13       | done   | `tests/state.test.ts`        | invalid 時は `ApplyRoundError` を throw（D-01 確定）                              |
| P1-13 | `balanced` strategy              | §11, §19.3      | done   | `tests/strategies.test.ts`   | 複合スコアで候補を選択                                                            |
| P1-14 | strategy surface rollback        | §7, §11         | done   | `tests/strategies.test.ts`   | 公開 built-in strategy は `balanced` のみに限定                                   |
| P1-15 | public exports 整理              | §16             | done   | import smoke test            | `src/index.ts`                                                                    |
| P1-16 | README quick start 更新          | README, §6, §15 | done   | docs review                  | MVP API に合わせて同期                                                            |

## Phase 2 - Extensions

| ID    | Scope                        | SPEC        | Status | Tests / Check  | Notes                                   |
| ----- | ---------------------------- | ----------- | ------ | -------------- | --------------------------------------- |
| P2-01 | 追加 built-in strategy       | §11         | todo   | TBD            | 品質基準確定後に再検討                  |
| P2-02 | `balanced` strategy          | §11.1       | done   | strategy tests | weight と複合ペナルティ、デフォルト戦略 |
| P2-03 | `custom` scorer              | §11.2       | todo   | TBD            | 品質基準確定後に再検討                  |
| P2-04 | rating / wins-losses balance | §9.2, §11.1 | done   | strategy tests | rating 優先、なければ win rate          |
| P2-05 | edit helpers                 | §13, §17    | done   | helper tests   | `swapPlayers`, `movePlayer`             |
| P2-06 | optional class wrapper       | §6.6        | done   | wrapper tests  | pure functions の薄い wrapper           |

## Phase 3 - Optional

| ID    | Scope                 | SPEC     | Status | Tests / Check       | Notes                       |
| ----- | --------------------- | -------- | ------ | ------------------- | --------------------------- |
| P3-01 | match result 記録 API | §15, §17 | todo   | result tests        | score / winner update       |
| P3-02 | 複数ラウンド一括生成  | §17      | todo   | generator tests     | Phase 1/2 の安定後          |
| P3-03 | round undo            | §17      | todo   | state tests         | 履歴操作 API                |
| P3-04 | export/import helper  | §17      | todo   | serialization tests | state は既に JSON-friendly  |
| P3-05 | advanced constraints  | §17      | todo   | constraint tests    | group / level / affiliation |

## Open Decisions

SPEC §18.2 の未決事項。決定した場合は、このファイルだけでなく `docs/SPEC.md` と必要に応じて `README.md` を更新する。

| ID   | Decision                                                                         | Needed Before | Status   | Notes                             |
| ---- | -------------------------------------------------------------------------------- | ------------- | -------- | --------------------------------- |
| D-01 | `applyRound` は invalid round に対して throw するか result object を返すか       | P1-12         | resolved | `ApplyRoundError` を throw        |
| D-02 | `Round.id` / `Match.id` をライブラリが生成するか、アプリ側から渡せるようにするか | P1-10         | resolved | `round-{n}` / `match-{n}-{court}` |
| D-03 | `createdAt` をライブラリが付与するか、アプリ側の責務にするか                     | P1-10         | resolved | v1 ではアプリ側                   |
| D-04 | `state.players` から remove された player の表示名を履歴表示でどう扱うか         | P1-03         | open     | v1 では app 側 archive でもよい   |
| D-05 | 公開する built-in strategy を複数にするか                                        | P1 completion | resolved | v1 では `balanced` のみに限定     |

## Completion Checklist

各タスク完了時に確認する。

- 対象 SPEC 節と実装が矛盾していない。
- 該当テストが追加または更新されている。
- `npm test` が通る。
- 公開 API / 型 / ルールを変えた場合、`docs/SPEC.md` と `README.md` が同期されている。
- 進捗表の `Status` と `Notes` が更新されている。
