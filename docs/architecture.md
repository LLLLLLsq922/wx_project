# 多玩法架构设计

## 1. 设计原则

- 规则引擎不引用 `wx`、页面对象或本地存储。
- 页面只负责采集输入和展示结果，不自行实现计分公式。
- 所有分数变化均转换为可追溯的零和交易。
- 已确认事件不可被就地修改；纠错通过重建受影响事件后的状态完成。
- 玩法差异通过注册表和独立引擎隔离，公共代码不判断大量玩法分支。
- 本地持久化数据总是携带模式版本，先迁移后读取。

## 2. 目录目标

```text
core/
  variants.js              玩法元数据与稳定标识
  tiles.js                 规范牌ID、牌组、赤牌及数量校验
  ledger.js                零和交易和累计分数
  ruleEngineRegistry.js    规则引擎注册与调度
data/
  schema.js                本地根数据结构及迁移
rules/
  guobiao/engine.js        国标适配器与规则实现
  sichuan/engine.js        川麻规则实现
  riichi/engine.js         日麻规则实现
services/
  matchService.js          事件追加、撤销、历史重算
  storageService.js        微信存储适配与失败保护
  shareService.js          分享图数据与Canvas渲染
pages/                     主包公共页面
subpackages/               按玩法拆分的页面与资源
```

迁移期间保留 `util/mahjongUtil.js` 作为国标旧实现。页面先通过 `rules/guobiao/engine.js` 适配，完成审计后再按番种模块化，避免一次重写导致现有行为丢失。

## 3. 规范数据模型

### 3.1 牌

牌使用稳定英文ID存储，展示层再映射中文名称与图片：

- 数牌：`m1..m9`、`s1..s9`、`p1..p9`
- 字牌：`east`、`south`、`west`、`north`、`red`、`green`、`white`
- 赤牌：`m5r`、`s5r`、`p5r`，其 `baseId` 分别仍为普通五

持久化时不保存可以由ID推导的图片路径和显示名称，以减少体积并方便资源替换。

### 3.2 手牌输入

```js
{
  concealedTiles: ['m1', 'm2'],
  winTile: 'm3',
  melds: [{
    type: 'chi|pon|openKong|addedKong|concealedKong',
    tiles: ['m1', 'm2', 'm3'],
    fromPlayerId: 'player-id|null',
    sequence: 1
  }],
  visibleTiles: [],
  context: {}
}
```

`winTile` 是暗牌中被单独标记的一张，而不是额外的第15张牌。兼容层可以继续接收当前页面的中文牌对象。

### 3.3 规则引擎契约

每个引擎最终实现：

```js
{
  id: 'guobiao|sichuan|riichi',
  validateInput(input, rules),
  calculateWin(input, rules),
  analyzeWaits(input, rules),
  settleRound(roundInput, matchState, rules),
  getRuleCatalog(rules)
}
```

统一和牌结果：

```js
{
  canWin: true,
  isWinningShape: true,
  reason: '',
  totalValue: 24,
  valueUnit: 'fan|han',
  items: [{ id, name, value, explanation }],
  selectedCandidate: {},
  alternatives: [],
  manualConfirmations: []
}
```

适配期同时返回旧页面所需的 `canHu`、`isHuShape`、`totalFan` 和 `fanList` 字段。

### 3.4 牌局与事件

```js
{
  id,
  schemaVersion,
  variant,
  status: 'active|completed',
  rulesSnapshot,
  players: [{ id, name, color, initialSeat }],
  format,
  initialState,
  rounds: [{
    id,
    index,
    stateBefore,
    draft,
    events: [],
    transactions: [],
    stateAfter,
    modifiedAt
  }],
  scoreTotals,
  createdAt,
  updatedAt,
  completedAt
}
```

规则事件描述事实，例如和牌、杠、立直、流局和人工调整；交易描述这些事实引发的资金流。重算时从初始状态依次重放事件，不信任旧的累计缓存。

## 4. 交易账本

交易采用一条或多条 `from -> to -> amount` 转账，不直接存正负分数组：

```js
{
  id,
  type: 'win|kong|riichiDeposit|drawPenalty|manual',
  reason,
  transfers: [{ from: 'p1', to: 'p2', amount: 16 }],
  formula,
  metadata
}
```

账本层负责：

- 玩家存在性、金额为正数和付款收款不同的校验。
- 应用交易并生成各家净变化。
- 校验交易前后总分守恒。
- 从任意历史局开始重放并生成新缓存。

立直棒等桌面池使用显式系统账户，例如 `pool:riichi`；把玩家和系统账户合并计算时仍保持守恒，最终展示只显示玩家余额和桌面池状态。

## 5. 本地持久化

根数据分为：

```js
{
  schemaVersion,
  settings,
  rulePresets,
  quickCalcDrafts,
  activeMatches,
  completedMatches
}
```

写入流程采用“序列化校验 -> 写临时键 -> 读回验证 -> 更新正式键”的保护方式。迁移先深拷贝旧数据，成功后才覆盖正式键；任何异常都保留原始内容并显示可恢复提示。

## 6. 页面与分包

主包保留首页、牌局列表、历史和设置。国标、川麻、日麻的计算页、规则页及玩法专属资源分别进入独立分包。共享牌图在评估实际引用和包体积后决定放主包或分包，不复制三份相同资源。

页面通过统一控制器访问规则引擎。控制器把页面数据转换为规范输入，再把统一结果映射为展示模型。这样选牌、震动、声音、草稿保存与结果卡片可以复用。

## 7. 错误与人工确认

错误分为：

- 输入错误：牌数、重复牌、非法副露；阻止计算或提交。
- 和牌不合法：结构不成立、国标不足8番、日麻无役、川麻定缺未完成；可以展示原因但不能正常结算。
- 依赖人工确认：无法由结果录入证明的过程条件；允许提交，但结果中永久保留标记。
- 存储错误：不丢弃当前草稿，提示重试或释放空间。
- 规则异常：记录可读错误码，不用“不可和牌”掩盖程序错误。

## 8. 测试策略

- `core`：牌ID、赤牌合并计数、结构与实际张数、账本守恒。
- `rules`：每个番种或役种的正例、反例、不计及复合。
- `services`：轮庄、局序、流局、历史修改后的确定性重放。
- `data`：每个旧版本到当前版本的迁移、失败不覆盖。
- `pages`：路由、结果优先布局、设置开关与草稿恢复。
- 真机：音效、震动、触摸尺寸、无横向滚动、Canvas图片与分享权限。

规则测试数据必须写明来源或推导依据。发现资料冲突时先记录决策，不通过临时代码兼容多个相互矛盾的默认规则。
