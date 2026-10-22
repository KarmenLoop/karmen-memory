export const seedMemories = [
  ['m01','项目默认使用 TypeScript 严格模式','新增代码开启 strict，公共接口声明输入和返回类型。','代码规范','KODER','Codex',98,18,'全设备'],
  ['m02','提交信息使用自然、具体的英文','提交信息和 README 使用自然、具体的美式英语，直接描述改动。','个人偏好','全部项目','Claude Code',99,24,'全设备'],
  ['m03','产品采用本地优先与 BYOK','本地内容默认留在设备上，远程模型由用户自行配置 API。','项目需求','KODER','Hermes',97,12,'全设备'],
  ['m04','先完成修复，再准备发布包','修复未解决的失败和不可用功能后，再进入打包及独立验收。','工作方式','KODER','Qoder',96,9,'全设备'],
  ['m05','回答先给出结论，再补充证据','使用简洁、具体的中文，说明完成情况、验证依据与未验证边界。','个人偏好','全部项目','Workbody',99,32,'全设备'],
  ['m06','跨设备同步需要主动开启','局域网共享由用户显式开启，访问令牌、API 密钥和执行权限独立保管。','项目需求','Memory Console','Codex',99,8,'全设备'],
  ['m07','后台的主要用户是开发者','桌面端高频查看记忆来源、检索命中和工具接入状态，移动端支持查阅及审核。','项目需求','Memory Console','DSH',95,7,'全设备'],
  ['m08','界面优先保证键盘可操作','交互提供清晰焦点，表单有可见标签，弹窗支持 Escape 关闭。','代码规范','Memory Console','Claude Code',98,11,'全设备'],
  ['m09','复用同一套 Core 与数据权威','在已有产品中复用身份、任务、授权和记忆所有权，避免独立维护第二份权威。','架构决策','KODER','Hermes',97,6,'全设备'],
  ['m10','同步冲突保留双方版本','相同事实发生冲突时，保留来源、时间与版本，用户选择后记录处理结果。','架构决策','Memory Console','Qoder',96,8,'全设备'],
  ['m11','CI 只读取项目范围的记忆','CI 使用短期、只读、项目范围的访问配置，个人偏好由项目配置显式选择。','工作方式','Memory Console','DSH',98,4,'仅本机'],
  ['m12','动画需要有明确反馈目的','动画用于状态变化和层级关系，并响应减少动态效果设置。','代码规范','Memory Console','Workbody',94,5,'全设备'],
  ['m13','任务交付需要可验证的结果','提供产物、实际执行的命令及结果，将本地验证与真实设备验收分别说明。','工作方式','全部项目','Codex',99,21,'全设备'],
  ['m14','优先使用现有组件和依赖','修改前检查现有组件和依赖，保持与项目原有结构及设计规范一致。','代码规范','KODER','Claude Code',96,15,'全设备'],
  ['m15','当前控制台暂名 KARMEN Memory','控制台统一呈现跨工具的结构化个人记忆、来源和局域网设备共享。','项目需求','Memory Console','Codex',100,3,'全设备'],
  ['m17','现有 KODER 项目沿用 npm','现有 KODER 项目使用 npm，保留 package-lock.json。','架构决策','KODER','Claude Code',98,5,'全设备'],
  ['m16','记忆按相关性进入上下文','按当前项目、任务及权限筛选记忆，展示每条命中的依据和来源。','架构决策','Memory Console','Hermes',97,13,'全设备'],
].map(([id,title,body,type,project,source,confidence,uses,scope],i)=>({id,title,body,type,project,source,confidence,uses,scope,favorite:i===1||i===4,status:'active',updated:`2026-10-${String(22-Math.floor(i/4)).padStart(2,'0')}T${String(14-i%5).padStart(2,'0')}:24:00+08:00`,provenance:'产品需求讨论 · 演示来源',revision:1}));

export const seedAgents = [
 {name:'Koder',mark:'K',icon:'monitor',color:'koder',firstParty:true,featured:true,role:'桌面工作台',description:'在桌面任务中保留项目需求、代码规范和个人偏好。',status:'connected',kind:'Core / Skill · 接入设计',permission:'readwrite',calls:72},
 {name:'Koder CLI',mark:'K_',icon:'terminal',color:'koder-cli',firstParty:true,featured:true,role:'终端与自动化',description:'把同一份项目上下文带入终端，按需用于自动化流程。',status:'connected',kind:'CLI / Skill · 接入设计',permission:'readwrite',calls:56},
 {name:'Cursor',mark:'C',icon:'cursor',color:'cursor',featured:true,role:'代码编辑器',description:'在编辑器中延续记忆，衔接需求讨论与代码实现。',status:'connected',kind:'MCP / Skill · 接入设计',permission:'readwrite',calls:48},
 {name:'Codex',mark:'C',icon:'terminal',color:'ink',status:'connected',kind:'MCP / Skill',permission:'readwrite',calls:42},
 {name:'Claude Code',mark:'✳',icon:'code',color:'clay',status:'connected',kind:'MCP / Skill',permission:'readwrite',calls:36},
 {name:'Hermes',mark:'H',icon:'workflow',color:'gold',status:'connected',kind:'Adapter',permission:'readwrite',calls:28},
 {name:'Qoder',mark:'Q',icon:'code',color:'violet',status:'connected',kind:'MCP',permission:'read',calls:18},
 {name:'Workbody',mark:'W',icon:'layers',color:'blue',status:'connected',kind:'Adapter',permission:'readwrite',calls:14},
 {name:'DSH',mark:'D',icon:'terminal',color:'green',status:'connected',kind:'CLI / CI',permission:'read',calls:9},
 {name:'Cloud Code',mark:'CC',icon:'cloud',color:'slate',status:'pending',kind:'待核实工具与协议',permission:'read',calls:0},
 {name:'Open Cloud PI',mark:'PI',icon:'cloud',color:'slate',status:'pending',kind:'待核实工具与协议',permission:'read',calls:0},
];

// Upgrade the preview's tool catalog without replacing user data or access settings.
export function reconcileAgents(saved=[]) {
 const valid=Array.isArray(saved)?saved.filter(a=>a&&typeof a.name==='string'):[];
 const known=new Set(seedAgents.map(a=>a.name));
 return [...seedAgents.map(seed=>{
   const previous=valid.find(a=>a.name===seed.name);
   return {...seed,...previous,name:seed.name,icon:seed.icon,color:seed.color,mark:seed.mark,firstParty:!!seed.firstParty,featured:!!seed.featured,role:seed.role,description:seed.description,kind:seed.kind};
 }),...valid.filter(a=>!known.has(a.name))];
}
export const seedCandidates = [
 {id:'c1',title:'界面采用浅色、紧凑的桌面工具风格',body:'控制台以浅色、紧凑、清晰的桌面操作体验为主。',type:'个人偏好',project:'Memory Console',source:'Codex',confidence:95,status:'pending',evidence:'“我需要设计一套后台页面” · 产品设计讨论',conflict:null},
 {id:'c2',title:'KODER 包管理器更新为 pnpm',body:'KODER 项目的默认包管理器使用 pnpm。',type:'架构决策',project:'KODER',source:'Qoder',confidence:86,status:'pending',evidence:'“新项目改用 pnpm，已有项目沿用原有 lockfile。” · 演示输入',conflict:'现有项目记录使用 npm。新信息可能仅适用于新项目。',old:'现有 KODER 项目使用 npm，保留 package-lock.json。'},
 {id:'c3',title:'记忆效果评估使用固定任务集',body:'比较相同模型和任务集的有记忆与无记忆结果，并计入检索及提炼成本。',type:'工作方式',project:'Memory Console',source:'Hermes',confidence:97,status:'pending',evidence:'效果评估方案 · 演示输入',conflict:null},
];
export const seedEvents = Array.from({length:24},(_,i)=>({id:`e${i}`,time:`${String(14-Math.floor(i/6)).padStart(2,'0')}:${String(48-i%6*7).padStart(2,'0')}:12`,agent:['Codex','Claude Code','Hermes','Qoder','Workbody','DSH'][i%6],action:['检索记忆','读取项目规范','提炼候选记忆','调用个人偏好'][i%4],detail:['命中 4 条记忆 · KODER','命中 3 条记忆 · Memory Console','新增 1 条待审核记忆','命中 2 条记忆 · 全部项目'][i%4],status:'成功',duration:18+i%7*4}));
export const navItems = [
 {id:'overview',label:'记忆总览',icon:'overview',group:'工作空间'},
 {id:'memories',label:'记忆库',icon:'database',group:'工作空间'},
 {id:'retrieve',label:'检索体验',icon:'search',group:'工作空间'},
 {id:'agents',label:'Agent 接入',icon:'blocks',group:'连接与共享'},
 {id:'devices',label:'局域网设备',icon:'network',group:'连接与共享'},
 {id:'pipeline',label:'记忆提炼',icon:'sparkles',group:'记忆管理'},
 {id:'activity',label:'调用记录',icon:'activity',group:'记忆管理'},
 {id:'analytics',label:'效果评估',icon:'chart',group:'记忆管理'},
 {id:'settings',label:'设置',icon:'settings',group:'其他'},
];
