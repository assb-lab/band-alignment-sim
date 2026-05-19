# 半導体バンドアライメントシミュレータ

1D 多層半導体スタックの **ポアソン方程式数値解** から導電帯 \(E_c\)、価電帯 \(E_v\)、準フェルミ準位 \(E_{Fn}, E_{Fp}\) を計算し、D3.js で可視化する Web アプリです。

## セットアップ

```bash
pnpm install
pnpm dev      # 開発サーバ
pnpm test     # 単体・統合テスト
pnpm test:coverage
pnpm build
```

## 物理モデル

### 支配方程式（定常 1D）

| 式 | 内容 |
|----|------|
| ポアソン | \(\dfrac{d}{dx}\left(\varepsilon \dfrac{d\phi}{dx}\right) = -q(p - n + N_d^+ - N_a^-)\) |
| キャリア統計 | 非縮退 Boltzmann: \(n = n_i \exp\dfrac{E_{Fn}-E_c}{k_BT}\), \(p = n_i \exp\dfrac{E_v-E_{Fp}}{k_BT}\) |
| 連続性（バイアス） | Scharfetter–Gummel 離散化による drift-diffusion 電流（第1版は平衡解ベースの近似） |

### 境界条件

- **オーミック接触**: スタックの両端が半導体層のとき、両端をバルク準中性（準フェルミ準位はデバイス全体で共通）
- **Schottky 金属接触**: 層テーブルで **Metal** 行をスタックの先頭または末尾に置く（厚みは表示用、メッシュには含めない）。隣接半導体界面で Schottky–Mott 則を適用
  - 電子バリア \(\Phi_{Bn} = \Phi_m - \chi\)
  - 正孔バリア \(\Phi_{Bp} = (\chi + E_g) - \Phi_m\)
  - 表面で \(E_F = \Phi_m\)（バイアス時は右端金属で \(\Phi_m + V_{app}\)）、\(\phi_s = E_{c,\mathrm{ref}} + \chi - 2\Phi_m\)
- **印加バイアス \(V_{app}\)**: 右端 Schottky 金属の準フェルミを \(+V_{app}\) シフト
- **界面**: 電位 \(\phi\) は連続、\(E_c, E_v\) は \(\Delta E_c, \Delta E_v\) で不連続（半導体同士）。金属はスタック中間に置けない

### 数値解法

1. 多層メッシュ生成（厚さ・`nodes/nm` からノード数決定）
2. 平衡: 非線形ポアソンを Picard + 三対角求解（Newton も利用可能）
3. バイアス: 平衡解を接触電位に合わせてシフトし、SG 式で接触電流密度を評価
4. 組込電位 \(V_{bi} = \phi_n - \phi_p - E_g\)（同質 pn 接合で解析式と照合済み）

内部計算は **SI 単位**（m, V, m\(^{-3}\)）。UI では nm、eV、cm\(^{-3}\)、cm\(^2\)/Vs を使用し、入出力境界で変換します。

## 入力パラメータ

各層（行）の **Type** で半導体 / 金属を選択:

| Type | 主な列 |
|------|--------|
| Semiconductor | Material, 厚さ \(t\) [nm], \(\varepsilon_r\), \(E_g\), \(\chi\), \(N_c,N_v\), \(N_d,N_a\), \(\mu_n,\mu_p\), \(\Delta E_c,\Delta E_v\) |
| Metal | Material, **\(\Phi_m\)** [eV]（仕事関数。厚みは表示のみ） |

半導体行の詳細:

| 列 | 記号 | UI 単位 |
|----|------|---------|
| Material | label | — |
| 厚さ | \(t\) | nm |
| 誘電率 | \(\varepsilon_r\) | — |
| バンドギャップ | \(E_g\) | eV |
| 電子親和力 | \(\chi\) | eV |
| 有効状態密度 | \(N_c, N_v\) | cm\(^{-3}\) |
| 本征キャリア | \(n_i\) | cm\(^{-3}\)（任意、未指定時は \(N_c,N_v,E_g,T\) から算出） |
| ドーピング | \(N_d, N_a\) | cm\(^{-3}\) |
| 移動度 | \(\mu_n, \mu_p\) | cm\(^2\)/Vs |
| 界面オフセット | \(\Delta E_c, \Delta E_v\) | eV（最上層は 0） |

グローバル: 温度 \(T\) [K]、\(V_{app}\) [V]、メッシュ密度 `nodes/nm`

## プリセット

- **Si pn 接合** — 半導体 2 層（両端オーミック）
- **GaAs/AlGaAs ヘテロ** — 半導体 3 層
- **Si Schottky** — Metal（Au, \(\Phi_m=4.8\) eV）+ n-Si、右端オーミック

`src/presets/materials.ts` に定義されています。

## プロジェクト構成

```
src/
  physics/     # React 非依存のソルバ（テスト重点）
  components/  # LayerTable, GlobalControls, BandDiagram
  hooks/       # useSimulation
  presets/     # 材料プリセット
```

## 既知の制限

- **非縮退 Boltzmann のみ**（高ドーピング・量子効果は対象外）
- **完全電離** \(N_d^+ = N_d\), \(N_a^- = N_a\)
- **1D・定常**。トラップ・光生成・SRH 再結合は第1版未実装
- **平衡**はポアソン連成の数値解。**バイアス**は平衡解 + 接触電位シフト + SG 電流評価の近似（完全 Gummel drift-diffusion 連成ではない）
- **Schottky** は理想 Schottky–Mott（界面状態・イメージフォース・トンネルは未実装）
- 強ヘテロ・高ドーピングでは収束が遅い、または失敗する場合あり（UI にエラー表示）
- 強バイアスで数値不安定になることがある

## テスト

古典派 TDD。物理コアは実ソルバを直接呼び出し、モックは最小限（DOM サイズ取得など）です。Vitest カバレッジ閾値: **80%**（lines / branches / functions / statements）。

## ライセンス

MIT（テンプレートに準拠）
