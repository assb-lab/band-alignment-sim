# AGENTS.md — band-alignment-sim

このファイルは、エージェント（および共同開発者）が本リポジトリで作業するときの前提・方針・既知課題をまとめたものです。

## プロジェクト概要

**1D 多層半導体スタック**の平衡ポアソン＋ボルツマンキャリアを解き、導電帯 \(E_c\)、価電帯 \(E_v\)、準フェルミ準位を D3.js で可視化する Web アプリ（React + TypeScript + Vite）。

- **実装の中心**: `src/physics/`（React 非依存。ここに物理・数値の正しさを置く）
- **UI**: `src/components/`, `src/hooks/useSimulation.ts`, Web Worker（`src/workers/simulation.worker.ts`）
- **プリセット**: `src/presets/materials.ts`
- **単位**: 内部は SI（m, V, m⁻³）。UI は nm / eV / cm⁻³ / cm²/Vs。変換は `src/physics/units.ts` と `src/lib/layerForm.ts`

## コマンド

```bash
pnpm install
pnpm dev              # 開発サーバ
pnpm test             # Vitest（カバレッジ閾値 80%）
pnpm test:coverage
pnpm build
pnpm lint
```

パッケージマネージャは **pnpm**。ルートは `band-alignment-sim/`（`package.json` があるディレクトリ）。

## アーキテクチャ（データの流れ）

1. `LayerTable` + `layerForm` → `Layer` / `LayerStack`（SI）
2. `inferContacts`（`stackContacts.ts`）→ 両端が半導体ならオーミック、端に Metal 行があれば Schottky
3. `buildMesh` → 半導体層のみメッシュ（金属行はメッシュ外・境界条件のみ）
4. `solveStack`（`gummel.ts`）→ 平衡 Poisson → バイアス時は電位シフト + 接触電流（完全 drift-diffusion Gummel ではない）
5. `BandDiagram` が `SimulationResult` を描画

金属接触は **Contact 専用 UI ではなく層テーブルの Metal 行**で表現する（レガシーの ContactControls は削除済み）。

## 物理モデル（コードと README の対応）

| 項目 | 実装の要点 |
|------|------------|
| ポアソン | 1D 有限差分、三対角（`poisson.ts`） |
| キャリア（バルク中性・オーミック BC） | **Nc / Nv** ボルツマン（`bulkNeutral.ts`, `contacts.ts` の `ohmicSurfacePhi`） |
| キャリア（Poisson 連成・`bands.ts`） | `carriers.ts` の `electronDensity` / `holeDensity`（Nc/Nv と等価なスケール付き ni 形式） |
| 平衡ソルバ | Gummel（凍結キャリア Picard）+ Newton 仕上げ（`gummel.ts`）。Schottky+オーミックは Newton のみ |
| 高ドーピング pn | **ドーピング continuation**（実装途中・下記「未解決」参照） |
| Vbi 表示 | `builtInVoltageV = phi_right - phi_left`（接触電位差。バンドギャップを引かない） |

README の式が古い場合は、**コードとこの AGENTS.md を優先**し、必要なら README を追随更新する。

## 開発スタイル・遵守事項

### 変更の粒度

- **最小差分**。依頼と無関係なリファクタ・README 大量改稿・過剰な抽象化はしない。
- 物理修正は `src/physics/` に閉じ、UI は表示・単位変換・Worker 配線に留める。

### コーディング規約

- 既存ファイルの命名・import パス（`.ts` 拡張子付き ESM）・型定義（`types.ts`）に合わせる。
- コメントは非自明な物理・数値理由だけ（自明な処理にコメントを足さない）。
- 新規テストは **意味のある物理挙動**（収束、Vbi、界面不連続、EF の禁制帯内など）。自明な assert は避ける。

### 単位・層データ

- UI 行 ↔ `Layer` の変換は **必ず** `layerForm.ts`（`rowToLayer` / `layerToRow`）経由。
- 過去に `NaM3` を `row.NaM3`（常に 0）から読んで NaN 化したバグあり。**ドーピングは `NdCm3` / `NaCm3` から `perCm3ToPerM3` すること。**

### ソルバ変更時のチェックリスト

1. `pnpm test` 全通過（特に `poisson.test.ts`, `gummel.test.ts`, `contacts.test.ts`, `carriers.test.ts`, `App.test.tsx`）
2. プリセット: **Si pn（1e16 cm⁻³）**, **p-Si 単層**, **Si Schottky（Au + n-Si）** をブラウザまたは `solveStack` で目視
3. p 型単層で **\(E_F\) が \(E_v\) より上**（禁制帯内）であること
4. pn で **Vbi ≈ kT ln(Na Nd / ni²)**（符号・定義に注意）

### Git

- **コミットはユーザー明示時のみ**。勝手に commit / push しない。

### 言語

- ユーザー向け説明は **日本語**。
- コード識別子・コミットメッセージ（依頼時）は英語でよい。

## テスト方針

- Vitest + Testing Library。物理はモックせず `solveStack` を直接呼ぶ。
- カバレッジ 80% 閾値あり（`vite.config.ts`）。
- 統合テストは `App.test.tsx` / `useSimulation.test.ts`（Worker 含む）— ソルバが落ちると連鎖失敗する。

## 既知の制限（意図したスコープ外）

- 非縮退 Boltzmann のみ（高ドーピング・縮退は未対応）
- 完全電離、1D 定常、トラップ / SRH / 光生成なし
- バイアスは平衡解 + 接触シフト + SG 電流の近似（完全 Gummel DD ではない）
- 理想 Schottky–Mott（界面状態・イメージフォース・トンネルなし）

---

## 現在うまくいっていないこと（2026-05 時点）

作業途中でストップした状態。以下は **未解決または不安定** な項目。

### 1. Si pn 接合（Nd = Na ≈ 1e16 cm⁻³）の平衡 Poisson 収束

- **症状**: `solveStack(siPnStack())` が `ConvergenceError` になる、または Poisson 相対残差が ~0.16 で止まり、テスト（`poisson.test.ts`, `gummel.test.ts`, App 連鎖）が落ちる。
- **原因の整理**:
  - 旧 **Gummel（凍結キャリア Picard）** は 1e16 cm⁻³ 付近で発散（残差 ~10⁸〜10¹²）。
  - **Newton のみ**でも、良い初期値なしでは相対残差 ~0.16 で停滞（電気的には Vbi やバンド曲率はそれっぽいが、離散 Poisson 残差基準では未収束）。
  - **ドーピング continuation**（1e12 → 1e16 に log ステップで ramp）は 15.99 まで ~1e-10 まで行けるが、**最終 1e16 ステップで再び ~0.2 に悪化**しやすい。
- **進行中のコード**: `gummel.ts` に `solveEquilibriumDopingContinuation`, `withScaledDoping`, 高ドーピング時の分岐あり。**完成・高速化・テスト通過は未確認**。

### 2. キャリア統計の「二系統」

- **オーミック境界・バルク中性**（`contacts.ts`, `bulkNeutral.ts`）: Nc/Nv 明示式（p 型で \(E_F > E_v\) になるよう修正済み）。
- **Poisson 連成**（`carriers.ts`, `poisson.ts`, `bands.ts`）: Nc/Nv 等価の `boltzmannCarrier` スケール形式。
- **注意**: 素の **ni 参照のみ**（`n = ni exp((EF−Ec)/kT)`）だと p 型バルクで \(p \neq N_a\) になり、単層 p-Si や pn で破綻。**Poisson と BC で式を混在させないこと。**

### 3. README と実装の乖離

- README はまだ \(n_i\) 基準の式を主に記載。実装は **Nc/Nv 主体**。
- エージェントは README を信じず、上記ファイルを読んでから直す。

### 4. テストスイート

- Nc/Nv 修正・ソルバ変更の途中で **複数テスト失敗**の状態で停止。再開時は `pnpm test` から確認。
- continuation 導入後は **1 ケースあたり十数秒〜分単位**になりうる（全テストが遅い可能性）。

### 5. builtInVoltageV の定義（修正済みだが要確認）

- 誤: `right.phi - left.phi - (Ec - Ev)` → Vbi が ~0.4 V 程度に潰れる。
- 正: `right.phi - left.phi`（同質 pn で解析 Vbi と符号・大きさを照合）。

### 6. バイアス付き gummel テスト

- 平衡 pn が落ちると `gummel.test.ts`（小さい順バイアス）も連鎖失敗。

---

## 再開時の推奨順序

1. `pnpm test` で失敗一覧を取得
2. `solveStack(siPnStack())` のみ Node で実行し、残差・Vbi・`bands.efpEv` vs `evEv` を確認
3. pn 1e16: continuation の最終ステップ戦略（より細かい ramp / 別収束判定 / メッシュ refinement）か、残差閾値の物理根拠を決める
4. README のキャリア統計を Nc/Nv に合わせて更新
5. 全テスト通過後、ブラウザで 3 プリセットを確認

## 主要ファイル早見表

| ファイル | 役割 |
|----------|------|
| `src/physics/gummel.ts` | `solveStack`, 平衡 Poisson, continuation |
| `src/physics/poisson.ts` | 離散 Poisson, Picard, Newton |
| `src/physics/contacts.ts` | オーミック / Schottky 境界, `resolveContacts` |
| `src/physics/bulkNeutral.ts` | バルク中性, `findFermiForBulkPhi`, `analyticVbi` |
| `src/physics/carriers.ts` | Poisson 用 n/p 密度 |
| `src/physics/stackContacts.ts` | 金属行から接触推論 |
| `src/lib/layerForm.ts` | UI ↔ Layer 変換 |
| `src/presets/materials.ts` | Si pn, ヘテロ, Schottky プリセット |
