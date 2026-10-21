# 半導体バンドアライメントシミュレータ

1D 多層半導体スタックの平衡ポアソン + Boltzmann キャリアを解き、導電帯 `Ec`、価電子帯 `Ev`、フェルミ準位/準フェルミ準位を D3.js で可視化する React + TypeScript + Vite アプリです。金属接触は専用 UI ではなく、層テーブルの `Metal` 行として扱います。

## セットアップ

```bash
pnpm install
pnpm dev
pnpm test
pnpm test:coverage
pnpm build
pnpm lint
```

## 使い方

1. `Materials` で材料定数、`Interfaces` でスタック一式を管理します。
2. テーブルの `+ Add` で行を追加し、`Type` で `Semiconductor` / `Metal` を切り替えます。
3. `On` チェックで層を一時的に無効化できます。緩衝層あり/なし比較に使います。
4. `Mode` を選び、必要なら `Run simulation` を押します。`Live` が有効なら入力変更で再計算します。
5. plot はドラッグで範囲ズーム、ダブルクリックでリセット、右クリックで SVG/PNG/ITX を出力できます。

## 電極モード

| Mode | 意味 | `Vapp` |
|------|------|--------|
| `Shorted equilibrium` | 両端金属が短絡され、左右の金属 EF を一致させる | 無効 |
| `Open circuit` | 左右金属 EF を各金属の仕事関数/電極電位で保持する | 無効 |
| `Applied bias` | 左端基準で右端 EF を `Vapp` だけずらす | 有効 |

`Shorted equilibrium` と `Open circuit` では `Vapp` 入力は UI 上も solver 入力上も無効です。`Vapp` がバンド構造に効くのは `Applied bias` のときだけです。

## 物理モデル

### 支配方程式

| 項目 | 実装 |
|------|------|
| ポアソン | `d/dx(epsilon dphi/dx) = -q(p - n + Nd - Na)` |
| 電子密度 | `n = Nc exp(-(Ec - EFn) / kBT)` |
| 正孔密度 | `p = Nv exp(-(EFp - Ev) / kBT)` |
| バンド | `Ec = Ec_ref - phi`, `Ev = Ev_ref - phi` |

内部計算は SI 単位です。UI では nm、eV、cm^-3 を使い、`src/lib/layerForm.ts` と `src/physics/units.ts` で変換します。

### 境界条件

- 両端が半導体ならオーミック接触として扱います。
- 端に `Metal` 行がある場合、その端は Schottky 接触として扱います。
- 金属厚みは表示・エクスポート上の領域幅には反映しますが、半導体メッシュと Poisson 計算には入りません。
- 理想 Schottky-Mott を仮定し、界面状態・イメージフォース・トンネルは未実装です。

### バイアス計算

平衡時は非線形 Poisson を自己無撞着に解きます。

`Applied bias` は現在、実験的な近似です。平衡解を初期値にして biased boundary condition の非線形 Poisson を再求解し、SG 形の抵抗座標で `Efn` / `Efp` を更新します。ただし、完全な drift-diffusion 連成ではありません。

特に注意点:

- applied bias 時の黒破線は平衡 EF ではなく、実質的に `Efn` です。
- `Efn` と `Efp` の分離表示は今後の改善対象です。
- `Vapp ~= Vbi` の flat-band 比較は、物理解釈と表示設計をまだ整理中です。
- 電流値は表示・出力していません。移動度列も現在のテーブルからは除外しています。

## 入力列

| Type | 主な列 |
|------|--------|
| `Semiconductor` | `Material`, `t [nm]`, `epsilon_r`, `EA [eV]`, `IP [eV]`, `Eg [eV]`, `Nc`, `Nv`, `Doping`, `Phi [eV]`, `Nd`, `Na` |
| `Metal` | `Material`, `t [nm]`, `Phi_m [eV]` |

`EA` は電子親和力、`IP` はイオン化ポテンシャルです。`Eg = IP - EA` は重要な派生値として表示しますが、直接編集列ではありません。

半導体の doping は次のどちらかで指定できます。

- `Phi`: 仕事関数 `Phi [eV]` から 300 K 基準で `Nd` / `Na` を換算
- `Nd/Na`: `Nd` / `Na` から 300 K 基準で `Phi [eV]` を換算

## 図とエクスポート

- 接合前バンド図は Run 前でも現在の table rows から live preview します。
- 接合前バンド図は材料幅を `Equal` / `Thickness` で切り替えできます。デフォルトは `Equal` です。
- 接合後バンド図は `Ec` を赤、`Ev` を青、金属 EF を黒実線で表示します。
- 右クリックメニューから `Export SVG` / `Export PNG` / `Export ITX` を出力できます。
- ITX は Igor Pro 用に、データ wave と基本 plot command を含みます。

## 材料・界面ライブラリ

- `Materials`: 単一材料の定数を CRUD します。built-in は読み取り専用です。
- built-in 半導体は `n-Si` / `p-Si` のように p/n variant として登録しています。
- `Interfaces`: 完全な layer stack と電極 `Mode` を CRUD します。材料定数ではなく、界面・積層構造の保存先です。
- 保存済み material/interface の上書き・削除はアプリ内モーダルで確認します。ブラウザ標準 dialog は使いません。

## プロジェクト構成

```text
src/
  physics/     React 非依存の物理・数値ソルバ
  components/  テーブル、モーダル、plot UI
  hooks/       useSimulation
  lib/         UI/物理変換、template、export helper
  presets/     built-in materials / interface examples
  workers/     simulation worker
```

## AI からの操作（WebMCP）

WebMCP を有効にした対応ブラウザで HTTPS または localhost のページを開くと、以下のツールを自動登録します。ヘッダーの `WebMCP: 5 tools ready` が登録完了の目印です。未対応なら `unavailable in this browser` と表示し、通常の画面操作を継続できます。登録が拒否された場合も理由を表示し、通常 UI は利用できます。

最新の [`document.modelContext` Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api) を優先します。旧 `navigator.modelContext` 実装もサポートします。最新 API は登録用 AbortSignal、旧 API は `unregisterTool` でアンマウント時に解除します。外部依存・外部送信・MCP サーバは追加していません。ブラウザ上の WebMCP 対応エージェント／Inspector から利用する仕組みで、任意の AI チャットが自動接続されるわけではありません。ブラウザの対応・有効化方法は [Chrome の WebMCP ドキュメント](https://developer.chrome.com/docs/ai/webmcp) を参照してください。

| ツール | 操作 |
| --- | --- |
| `list_presets` | UI と共通の組込プリセット一覧 |
| `get_simulation_state` | 層、温度、電極モード、電圧、数値設定、計算状態・エラー・結果の有効性 |
| `configure_simulation` | プリセット読込、層の全置換、計算条件の部分変更。変更は画面にも反映 |
| `run_simulation` | 現在の条件を既存 Worker/ソルバで計算し、収束・Vbi・接触情報を返す |
| `get_simulation_results` | 現在の計算結果からバンド、電位、電界、電荷・キャリア密度を JSON 取得 |

呼出し例（ツール名と JSON 引数）:

```text
list_presets             {}
configure_simulation    {"preset":"Si pn","temperatureK":300,"electrodeMode":"bias","Vapp":0.1}
run_simulation          {}
get_simulation_results  {"maxPoints":200}
```

`configure_simulation` は `preset` と `rows` を同時には受け付けません。プリセットは層・温度・モード・Vapp を既定値に戻し、同時指定した条件を上書きします。それ以外の省略した条件は維持します。`rows` は `get_simulation_state` の行を編集して全体を渡してください（追加・削除・並べ替えもこの配列で指定）。行 ID は省略可能で、指定する場合は重複不可です。無効な入力は設定全体を適用せず、`{error: "修正に役立つ説明"}` を返します。層は最大 32、推定メッシュは最大 20,000 ノードです。各フィールドの数値範囲は公開 inputSchema を参照してください。

層の単位は UI と同じ nm・eV・cm⁻³、`fermiLevelVacuumEv` は真空基準の符号付きエネルギーです。`dopingInputMode: "direct"` なら `NdCm3` / `NaCm3`、`"fermi"` なら Fermi 値からドーピングを決めます。金属は端の行として表し、厚さ 0 を許容します。電極モードは `shorted` / `open` / `bias`、`Vapp` が計算に使われるのは `bias` のみです。Live が有効なら条件変更でも自動計算が走ります。

結果は既定で各プロファイル最大 200 点（`maxPoints`: 2–1000）を、両端を含む等間隔のインデックスで抽出します。細い界面構造は抽出から漏れる場合があり、全点エクスポートの代用にはなりません。`mesh` は半導体内、`bands` は金属を含む表示バンドの座標を持つ独立した配列です。単位を結果内に明記し、定義されない金属のバンド端は `null` にします。設定が変わった結果や計算中の結果は返しません。実行キャンセルは Worker を停止し、新しい実行に置き換わった計算も成功として返しません。バイアスの物理的制限は通常 UI と同じです。

## 既知の制限

- 非縮退 Boltzmann のみです。縮退半導体・高ドーピング補正は未対応です。
- 完全電離、1D、定常、トラップなし、光生成なしです。
- Schottky は理想 Schottky-Mott です。
- bias 下の drift-diffusion は実験的近似で、完全な電流連続・再結合・移動度依存の DD solver ではありません。
- applied bias の `EF` 表示は今後 `Efn` / `Efp` に分けて整理する必要があります。
- 強ヘテロ接合、高ドーピング、強バイアスでは収束が遅い、または失敗する場合があります。

## テスト

Vitest + Testing Library を使います。物理コアはモックせず `solveStack` を直接呼びます。カバレッジ閾値は 80% です。

```bash
pnpm test
pnpm test:coverage
```

## ライセンス

MIT
