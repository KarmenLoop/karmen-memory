import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Blocks,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Code2,
  Copy,
  Database,
  FileText,
  Filter,
  Folder,
  GitBranch,
  HardDrive,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Monitor,
  MousePointer2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  TriangleAlert,
  Unplug,
  Upload,
  Workflow,
  X,
  ChartNoAxesCombined,
  Cloud,
} from "lucide-react";
import { catalog, navItems } from "./catalog";
import { api, connect, download } from "./api";
import "@fontsource-variable/manrope";
import "./style.css";
import "./workbench.css";
import "./service.css";

const types = ["个人偏好", "项目需求", "代码规范", "架构决策", "工作方式"];
const icons = {
  overview: LayoutDashboard,
  database: Database,
  search: Search,
  blocks: Blocks,
  network: Network,
  sparkles: Sparkles,
  activity: Activity,
  chart: ChartNoAxesCombined,
  settings: Settings,
  terminal: Terminal,
  code: Code2,
  workflow: Workflow,
  layers: Layers,
  cloud: Cloud,
  monitor: Monitor,
  cursor: MousePointer2,
};
const when = (time) =>
  time ? new Date(time).toLocaleString("zh-CN", { hour12: false }) : "尚无请求";
function Icon({ name, size = 18 }) {
  const C = icons[name] || Database;
  return <C size={size} strokeWidth={1.65} aria-hidden="true" />;
}
function Tag({ children, tone = "" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function AgentMark({ agent }) {
  return (
    <span aria-hidden="true" className={`agent-mark ${agent.color}`}>
      <span className={agent.firstParty ? "koder-monogram" : "agent-glyph"}>
        {agent.firstParty ? (
          <span>K{agent.name === "Koder CLI" && <small>_</small>}</span>
        ) : (
          <Icon name={agent.icon} size={21} />
        )}
      </span>
    </span>
  );
}
function Empty({ title, body, action }) {
  return (
    <div className="empty">
      <Database size={28} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      disabled={disabled}
      className={`switch ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
function Modal({ children, onClose, title, drawer = false }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : "modal"}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-top">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-btn" aria-label="关闭" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function FormFields({ memory = {}, prefix = "" }) {
  return (
    <>
      <label>
        标题
        <input
          name={`${prefix}title`}
          required
          maxLength={120}
          defaultValue={memory.title}
          placeholder="一条明确、可复用的事实"
        />
      </label>
      <label>
        内容
        <textarea
          name={`${prefix}body`}
          required
          maxLength={6000}
          rows={5}
          defaultValue={memory.body}
          placeholder="补充适用条件与边界"
        />
      </label>
      <div className="form-grid">
        <label>
          类型
          <select
            name={`${prefix}type`}
            defaultValue={memory.type || "项目需求"}
          >
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          项目
          <input
            name={`${prefix}project`}
            required
            maxLength={80}
            defaultValue={memory.project || "全部项目"}
          />
        </label>
      </div>
      <label>
        共享范围
        <select name={`${prefix}scope`} defaultValue={memory.scope || "仅本机"}>
          <option>仅本机</option>
          <option>全设备</option>
        </select>
      </label>
      <label>
        来源依据
        <textarea
          name={`${prefix}provenance`}
          required
          maxLength={6000}
          rows={2}
          defaultValue={memory.provenance || "用户手动创建"}
        />
      </label>
    </>
  );
}
const fields = (form) => Object.fromEntries(new FormData(form));

function App() {
  const [data, setData] = useState(null),
    [connectionError, setConnectionError] = useState(""),
    [busy, setBusy] = useState(false);
  const [view, setView] = useState(
    navItems.some((n) => n.id === location.hash.slice(1))
      ? location.hash.slice(1)
      : "overview",
  );
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("全部记忆"),
    [typeFilter, setTypeFilter] = useState("全部类型"),
    [project, setProject] = useState("全部项目");
  const [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState(""),
    [queryProject, setQueryProject] = useState("全部项目"),
    [result, setResult] = useState(null),
    [retrieving, setRetrieving] = useState(false),
    [legacy, setLegacy] = useState(null);
  const uploadRef = useRef(),
    searchRef = useRef(),
    pending = useRef(false);
  async function refresh() {
    const next = await api("/state");
    setData(next);
    setConnectionError("");
    return next;
  }
  async function boot() {
    try {
      await connect();
      await refresh();
    } catch (e) {
      setConnectionError(e.message);
    }
  }
  useEffect(() => {
    boot();
    const timer = setInterval(() => {
      if (!document.hidden && !pending.current)
        refresh().catch((e) => setConnectionError(e.message));
    }, 8000);
    const focus = () => {
      if (!pending.current)
        refresh().catch((e) => setConnectionError(e.message));
    };
    window.addEventListener("focus", focus);
    try {
      const old = JSON.parse(
        localStorage.getItem("karmen-memory-console-demo-v1"),
      );
      if (old?.version === 1 && old.data?.memories?.length)
        setLegacy({
          schema: "karmen-memory-console-demo",
          version: 1,
          memories: old.data.memories,
        });
    } catch {}
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    const f = () => {
      const v = location.hash.slice(1);
      if (navItems.some((n) => n.id === v)) setView(v);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    const f = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const chosen = data?.memories.find((m) => m.id === selected);
  useEffect(() => {
    let current = true;
    setHistory([]);
    if (selected)
      api(`/memories/${selected}/history`)
        .then((value) => {
          if (current) setHistory(value);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [selected, chosen?.revision]);
  const go = (id) => {
    setView(id);
    location.hash = id;
    setMobile(false);
    setError("");
    window.scrollTo({ top: 0 });
  };
  async function mutate(
    path,
    input,
    method = "POST",
    message = "已保存",
    close = true,
  ) {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await api(path, input, method);
      try {
        await refresh();
      } catch (e) {
        setConnectionError(`操作已提交，刷新失败：${e.message}`);
      }
      if (close) setModal(null);
      setToast(message);
      return value;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("已复制");
    } catch {
      setError("剪贴板不可用，请直接选择文本复制");
    }
  }
  async function fileDownload(path, input, name) {
    setBusy(true);
    setError("");
    try {
      await download(path, input, name);
      if (input) await refresh();
      setToast("文件已准备，已请求浏览器下载");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveMemory(e) {
    e.preventDefault();
    const value = fields(e.currentTarget);
    await mutate(
      modal.edit ? `/memories/${modal.edit.id}` : "/memories",
      { ...value, ...(modal.edit ? { revision: modal.edit.revision } : {}) },
      modal.edit ? "PATCH" : "POST",
      "记忆已写入 SQLite",
    );
  }
  async function searchMemory(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setRetrieving(true);
    setError("");
    try {
      setResult(await api("/search", { query, project: queryProject }));
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setRetrieving(false);
    }
  }
  async function importFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error("JSON 文件超过 2 MB");
      const value = JSON.parse(await file.text());
      setModal({ type: "import", value, name: file.name });
    } catch (e) {
      setError(e.message);
    }
  }
  function credentialStatus(c) {
    return c.status === "revoked"
      ? "已撤销"
      : c.status === "paused"
        ? "已暂停"
        : c.lastSeen
          ? "已收到请求"
          : "等待首次请求";
  }
  function agentStatus(a) {
    const all = data.credentials.filter(
      (c) => c.name === a.name && c.kind !== "device" && c.status !== "revoked",
    );
    const valid = all.filter((c) => c.status === "active");
    return {
      all,
      valid,
      observed: valid.filter((c) => c.lastSeen),
      calls: all.reduce((s, c) => s + c.calls, 0),
    };
  }
  if (!data)
    return (
      <div className="service-loading">
        <Layers size={35} />
        <h1>KARMEN Memory</h1>
        <p role="status">{connectionError || "正在连接本地记忆服务…"}</p>
        {connectionError && (
          <>
            <code>npm run build &amp;&amp; npm start</code>
            <button className="btn primary" onClick={boot}>
              重新连接
            </button>
          </>
        )}
      </div>
    );
  const active = data.memories.filter((m) => m.status === "active"),
    candidates = data.candidates.filter((c) => c.status === "pending");
  const observed = data.credentials.filter(
    (c) => c.status === "active" && c.lastSeen && c.kind !== "device",
  );
  const devices = data.credentials.filter((c) => c.kind === "device");
  const projects = [
    ...new Set(
      data.memories.map((m) => m.project).filter((p) => p !== "全部项目"),
    ),
  ];
  const filtered = data.memories.filter(
    (m) =>
      (filter === "已归档" ? m.status === "archived" : m.status === "active") &&
      (filter !== "已收藏" || m.favorite) &&
      (typeFilter === "全部类型" || m.type === typeFilter) &&
      (project === "全部项目" || m.project === project) &&
      `${m.title} ${m.body} ${m.source} ${m.project}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const mcpConfig = {
    mcpServers: {
      "karmen-memory": {
        type: "stdio",
        command: data.service.node,
        args: [data.service.mcpPath],
        env: {
          KARMEN_MEMORY_TOKEN_FILE: "/PRIVATE/PATH/memory-token",
          KARMEN_MEMORY_URL: data.service.url,
        },
      },
    },
  };
  const evaluations = data.evaluations,
    baseline = evaluations.reduce((s, r) => s + r.baseline, 0),
    total = evaluations.reduce((s, r) => s + r.total, 0),
    saving = baseline
      ? (((baseline - total) / baseline) * 100).toFixed(1)
      : null;
  const title = navItems.find((n) => n.id === view)?.label;
  function pageHeader(heading, description, action) {
    return (
      <div className="page-heading">
        <div>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
    );
  }
  function addButton() {
    return (
      <button
        className="btn primary"
        onClick={() => {
          setError("");
          setModal({ type: "memory" });
        }}
      >
        <Plus size={17} />
        添加记忆
      </button>
    );
  }
  function table(items, compact = false) {
    return items.length ? (
      <div className="table-scroll">
        <table className={`memory-table ${compact ? "compact" : ""}`}>
          <thead>
            <tr>
              <th>记忆内容</th>
              <th>类型</th>
              <th>来源</th>
              {!compact && <th>项目</th>}
              <th>更新</th>
              <th>
                <span className="sr-only">收藏</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>
                  <button
                    className="memory-open"
                    onClick={() => {
                      setError("");
                      setSelected(m.id);
                    }}
                  >
                    <span className="memory-symbol">
                      <FileText size={16} />
                    </span>
                    <span>
                      <strong>{m.title}</strong>
                      <small>{compact ? m.project : m.body}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <Tag
                    tone={
                      m.type === "个人偏好"
                        ? "purple"
                        : m.type === "代码规范"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {m.type}
                  </Tag>
                </td>
                <td>{m.source}</td>
                {!compact && <td>{m.project}</td>}
                <td className="muted">
                  {m.updated.slice(5, 10).replace("-", "/")}
                </td>
                <td>
                  <button
                    disabled={busy}
                    className={`icon-btn favorite ${m.favorite ? "selected" : ""}`}
                    aria-label={`${m.favorite ? "取消收藏" : "收藏"}：${m.title}`}
                    onClick={() =>
                      mutate(
                        `/memories/${m.id}`,
                        { revision: m.revision, favorite: !m.favorite },
                        "PATCH",
                        "收藏状态已保存",
                        false,
                      )
                    }
                  >
                    <Star
                      size={16}
                      fill={m.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="这里还没有记忆"
        body="添加明确事实，或从上下文提炼后审核入库。"
        action={addButton()}
      />
    );
  }
  function agentCard(a, featured = false) {
    const status = agentStatus(a);
    return (
      <section
        className={`panel agent-card ${featured ? "featured-agent" : ""} ${a.firstParty ? "first-party-agent" : ""}`}
        key={a.name}
      >
        <div className="agent-card-top">
          <AgentMark agent={a} />
          <Tag tone={a.firstParty ? "green" : "neutral"}>
            {a.firstParty ? "KARMEN" : featured ? "常用编辑器" : "接入目标"}
          </Tag>
        </div>
        <h2>{a.name}</h2>
        <span className="agent-role">{a.role || a.kind}</span>
        <p className="agent-description">
          {a.description ||
            "使用统一 API 或 MCP 桥接；宿主支持方式需单独确认。"}
        </p>
        <div className="agent-card-status">
          <span className={status.observed.length ? "positive" : "muted"}>
            <span
              className={`status-dot ${status.observed.length ? "" : "off"}`}
            />
            {status.observed.length
              ? "已收到凭证请求"
              : status.valid.length
                ? "等待首次请求"
                : "尚未配置"}
          </span>
          <span>{status.valid.length} 个有效凭证</span>
        </div>
        <div className="agent-card-footer">
          <span>{status.calls} 次真实请求</span>
          <button
            className="btn"
            onClick={() => {
              setError("");
              setModal({ type: "agent", agent: a });
            }}
            aria-label={`配置 ${a.name}`}
          >
            配置接入
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }
  function topology() {
    const left = catalog.filter((a) => a.featured),
      right = catalog.filter((a) => !a.featured).slice(0, 3);
    const node = (a, priority) => (
      <button
        className={`agent-node ${priority ? "priority-node" : ""}`}
        key={a.name}
        onClick={() => setModal({ type: "agent", agent: a })}
        aria-label={`${a.name} 接入配置`}
      >
        <AgentMark agent={a} />
        <span>
          <strong>{a.name}</strong>
          <small>
            {agentStatus(a).observed.length ? "已收到请求" : "尚待宿主接入"}
          </small>
        </span>
        <span
          className={`status-dot ${agentStatus(a).observed.length ? "" : "off"}`}
        />
      </button>
    );
    return (
      <>
        <div className="topology-captions">
          <span>优先工作工具</span>
          <span>共享记忆</span>
          <span>更多 Agent</span>
        </div>
        <div className="topology">
          <svg
            className="topology-lines"
            viewBox="0 0 700 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="priority-path"
              d="M155 47 H235 Q260 47 260 73 V115 H340 M155 130 H340 M155 213 H235 Q260 213 260 187 V145 H340"
            />
            <path d="M360 115 H440 V73 Q440 47 465 47 H545 M360 130 H545 M360 145 H440 V187 Q440 213 465 213 H545" />
          </svg>
          <div className="node-column priority-column">
            {left.map((a) => node(a, true))}
          </div>
          <button
            className="memory-core"
            onClick={() => go("memories")}
            aria-label="打开共享记忆库"
          >
            <span className="core-orbit">
              <span>
                <Layers size={32} strokeWidth={1.45} />
              </span>
            </span>
            <strong>个人记忆库</strong>
            <small>One memory. Every agent.</small>
            <span className="core-count">{active.length} 条已确认记忆</span>
          </button>
          <div className="node-column">{right.map((a) => node(a))}</div>
        </div>
      </>
    );
  }
  function credentialRow(c) {
    return (
      <div className="credential-row" key={c.id}>
        <div>
          <strong>{c.name}</strong>
          <small>
            {c.project} · {c.permission === "read" ? "只读" : "提议与读取"} ·{" "}
            {c.calls} 次请求
          </small>
          <small>
            {credentialStatus(c)} · {when(c.lastSeen)}
          </small>
        </div>
        {c.status !== "revoked" && (
          <div className="button-row">
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                mutate(
                  `/credentials/${c.id}`,
                  { status: c.status === "paused" ? "active" : "paused" },
                  "PATCH",
                  "权限已变更",
                  false,
                )
              }
            >
              {c.status === "paused" ? "恢复" : "暂停"}
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => setModal({ type: "revoke", credential: c })}
            >
              撤销
            </button>
          </div>
        )}
      </div>
    );
  }
  const errorBox = error && (
    <div className="form-error" role="alert">
      <TriangleAlert size={17} />
      {error}
    </div>
  );
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        跳到主内容
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="关闭导航"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <button className="brand" onClick={() => go("overview")}>
          <span className="brand-symbol">
            <Layers size={23} />
          </span>
          <span>
            KARMEN<span className="brand-sub">MEMORY</span>
          </span>
        </button>
        <button className="workspace-btn" onClick={() => go("settings")}>
          <span className="workspace-avatar">K</span>
          <span>
            <strong>我的个人空间</strong>
            <small>Local workspace</small>
          </span>
          <ChevronsUpDown size={15} />
        </button>
        <nav aria-label="主导航">
          {navItems.map((n, i) => (
            <React.Fragment key={n.id}>
              {(i === 0 || n.group !== navItems[i - 1].group) && (
                <div className="nav-group">{n.group}</div>
              )}
              <button
                className={`nav-item ${view === n.id ? "active" : ""}`}
                aria-current={view === n.id ? "page" : undefined}
                onClick={() => {
                  go(n.id);
                  setSearch("");
                }}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {n.id === "pipeline" && candidates.length > 0 && (
                  <b className="count-badge">{candidates.length}</b>
                )}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-engine">
            <span className="engine-icon">
              <HardDrive size={18} />
            </span>
            <div>
              <strong>
                本地记忆服务{" "}
                <span
                  className={`status-dot ${connectionError ? "off" : ""}`}
                />
              </strong>
              <small>
                SQLite · {connectionError ? "连接中断" : "本机运行中"}
              </small>
            </div>
          </div>
          <button
            className="help-link"
            onClick={() => setModal({ type: "help" })}
          >
            <CircleHelp size={17} />
            使用指南
            <ArrowUpRight size={14} />
          </button>
          <button className="user-profile" onClick={() => go("settings")}>
            <span className="profile-avatar">K</span>
            <span>
              <strong>个人记忆</strong>
              <small>由本机用户管理</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>个人空间</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="全局搜索记忆"
                placeholder="搜索你的记忆…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (view !== "memories") go("memories");
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <span className="demo-label">本地服务 0.2</span>
            <button
              className="icon-btn notifications"
              aria-label={`通知：${candidates.length} 条待审核`}
              onClick={() => go("pipeline")}
            >
              <Bell size={19} />
              {candidates.length > 0 && <span />}
            </button>
            <span className="top-avatar">K</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {connectionError && (
            <div className="form-error" role="alert">
              连接中断：{connectionError}
              <button className="btn" onClick={boot}>
                重新连接
              </button>
            </div>
          )}
          {!modal && errorBox}
          {view === "overview" && (
            <>
              {pageHeader(
                "让工作接续，让记忆共通。",
                "从 Koder、Koder CLI 到 Cursor，把确认过的事实交给下一次工作。",
                <div className="heading-actions">
                  <button
                    className="btn"
                    onClick={() => uploadRef.current.click()}
                  >
                    <Upload size={16} />
                    导入记忆
                  </button>
                  {addButton()}
                </div>,
              )}
              <div className="overview-status">
                <span>
                  <span className="live-dot" />
                  本地 SQLite
                </span>
                <i />
                <span>
                  <ShieldCheck size={14} />
                  工具权限由服务校验
                </span>
                <i />
                <span className="muted">所有数字来自实际记录</span>
              </div>
              <div className="stats-grid">
                {[
                  [
                    "已确认记忆",
                    active.length,
                    "条",
                    "保留来源、范围与修订",
                    Database,
                  ],
                  [
                    "有请求的凭证",
                    observed.length,
                    "个",
                    "请求来源由凭证标识，宿主需另验",
                    Blocks,
                  ],
                  [
                    "真实检索",
                    data.stats.queries,
                    "次",
                    `命中 ${data.stats.hits} 次 · 本机词项检索`,
                    Search,
                  ],
                  [
                    "评估样本",
                    evaluations.length,
                    "组",
                    saving === null
                      ? "尚无 Token 成本评估记录"
                      : `用户记录的总成本变化 ${saving}%`,
                    ChartNoAxesCombined,
                  ],
                ].map(([label, value, unit, detail, C]) => (
                  <div className="stat" key={label}>
                    <div>
                      <span>{label}</span>
                      <C size={17} />
                    </div>
                    <strong>
                      {value}
                      <small>{unit}</small>
                    </strong>
                    <p>{detail}</p>
                  </div>
                ))}
              </div>
              <div className="overview-main">
                <section className="panel connections-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>围绕你的 Koder 工作流</h2>
                      <p>桌面、终端与编辑器，访问同一份已确认上下文。</p>
                    </div>
                    <button className="text-link" onClick={() => go("agents")}>
                      管理接入
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {topology()}
                  <div className="connection-footer">
                    <span>{observed.length} 个凭证已发起请求</span>
                    <span>
                      <LockKeyhole size={14} />
                      逐凭证控制项目范围
                    </span>
                    <button onClick={() => go("devices")}>
                      局域网{" "}
                      <span
                        className={`status-dot ${data.lan.enabled ? "" : "off"}`}
                      />
                      {data.lan.enabled ? "HTTPS 已启动" : "未开启"}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </section>
                <section className="panel health-panel">
                  <div className="panel-heading">
                    <h2>记忆状态</h2>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="storage-row">
                    <span className="storage-icon">
                      <Database size={22} />
                    </span>
                    <div>
                      <strong>个人记忆库</strong>
                      <small>SQLite · 事务写入</small>
                    </div>
                    <Tag tone="green">可用</Tag>
                  </div>
                  <dl className="health-details">
                    <div>
                      <dt>数据库与 WAL</dt>
                      <dd>{(data.stats.size / 1024).toFixed(1)} KB</dd>
                    </div>
                    <div>
                      <dt>项目</dt>
                      <dd>{projects.length} 个独立项目</dd>
                    </div>
                    <div>
                      <dt>待审核</dt>
                      <dd>{candidates.length} 条候选</dd>
                    </div>
                  </dl>
                  <div className="review-callout">
                    <span>
                      <Sparkles size={17} />
                      让记忆先经过确认
                    </span>
                    <p>工具提议只进入候选，审核后才参与检索。</p>
                    <button
                      className="text-link"
                      onClick={() => go("pipeline")}
                    >
                      提炼与审核
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="privacy-note">
                    <ShieldCheck size={15} />
                    <span>记忆内容不授予工具执行权限</span>
                  </div>
                </section>
              </div>
              <div className="overview-bottom">
                <section className="panel recent-panel">
                  <div className="panel-heading">
                    <h2>
                      最近的记忆{" "}
                      <span className="heading-count">{active.length}</span>
                    </h2>
                    <button
                      className="text-link"
                      onClick={() => go("memories")}
                    >
                      查看全部
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {table(active.slice(0, 4), true)}
                </section>
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <h2>实际动态</h2>
                    <button
                      className="icon-btn"
                      aria-label="查看全部调用记录"
                      onClick={() => go("activity")}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  {data.events.length ? (
                    <div className="timeline">
                      {data.events.slice(0, 3).map((e) => (
                        <div className="timeline-item" key={e.id}>
                          <span className="timeline-symbol">
                            <Activity size={15} />
                          </span>
                          <div>
                            <strong>
                              {e.agent}
                              <span>{e.action}</span>
                            </strong>
                            <p>{e.detail}</p>
                            <small>{when(e.time)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="等待第一次操作"
                      body="创建记忆、审核和工具请求都会留下记录。"
                    />
                  )}
                </section>
              </div>
              <div className="page-foot">
                <span>
                  <Layers size={14} />
                  One memory. Every agent.
                </span>
                <span>本地优先 · 按需检索 · 由你确认</span>
              </div>
            </>
          )}
          {view === "memories" && (
            <>
              {pageHeader(
                "记忆库",
                "每条事实都有来源、范围和真实修订历史。",
                addButton(),
              )}
              <div className="memory-toolbar">
                <div className="tabs">
                  {["全部记忆", "已收藏", "已归档"].map((t) => (
                    <button
                      key={t}
                      className={filter === t ? "active" : ""}
                      onClick={() => setFilter(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="toolbar-controls">
                  <label className="filter-select">
                    <Filter size={15} />
                    <select
                      aria-label="按记忆类型筛选"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    >
                      {["全部类型", ...types].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <select
                    aria-label="按项目筛选"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    {["全部项目", ...projects].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    onClick={() =>
                      fileDownload("/export", null, "karmen-memory.json")
                    }
                  >
                    <ArrowDownToLine size={15} />
                    导出
                  </button>
                </div>
              </div>
              <section className="panel">
                <div className="list-info">
                  <span>
                    你的个人记忆 <b>{filtered.length} 条</b>
                  </span>
                  <label className="inline-search">
                    <Search size={16} />
                    <input
                      aria-label="搜索记忆库"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜索内容、来源、项目"
                    />
                  </label>
                </div>
                {table(filtered)}
                <div className="table-footer">
                  共 {filtered.length} 条<span>从本地数据库读取</span>
                </div>
              </section>
            </>
          )}
          {view === "agents" && (
            <>
              {pageHeader(
                "Agent 接入",
                "签发独立凭证，通过统一 API、CLI 或 MCP 使用记忆。",
                <button
                  className="btn primary"
                  onClick={() => setModal({ type: "credential" })}
                >
                  <Plus size={17} />
                  新建访问凭证
                </button>,
              )}
              <div className="featured-section-title">
                <div>
                  <h2>优先工作工具</h2>
                  <p>先接桌面、终端和编辑器。配置步骤与请求记录始终可查。</p>
                </div>
                <span className="tool-total">
                  {observed.length} 个凭证收到请求
                </span>
              </div>
              <div className="featured-agent-grid">
                {catalog
                  .filter((a) => a.featured)
                  .map((a) => agentCard(a, true))}
              </div>
              <div className="section-line more-tools-heading">
                <h2>更多工具</h2>
                <span>协议支持需在各自宿主核实</span>
              </div>
              <div className="agent-grid">
                {catalog.filter((a) => !a.featured).map((a) => agentCard(a))}
              </div>
              <section className="panel credential-panel">
                <div className="panel-heading">
                  <h2>访问凭证</h2>
                  <span>首次请求会更新最后访问时间</span>
                </div>
                {data.credentials.filter((c) => c.kind !== "device").length ? (
                  data.credentials
                    .filter((c) => c.kind !== "device")
                    .map(credentialRow)
                ) : (
                  <Empty
                    title="还没有访问凭证"
                    body="先为工具签发项目范围和读写权限，再配置客户端。"
                  />
                )}
              </section>
              <div className="info-banner">
                <ShieldCheck size={19} />
                <p>
                  调用次数表示凭证收到的真实请求。凭证名称由你填写，不能据此证明对应宿主已完成集成。
                </p>
              </div>
            </>
          )}
          {view === "retrieve" && (
            <>
              {pageHeader(
                "检索体验",
                "检索已确认事实，检查匹配词、来源与交给 Agent 的上下文。",
              )}
              <section className="panel retrieval-query">
                <div className="retrieval-icon">
                  <Search size={25} />
                </div>
                <h2>这个任务需要记住什么？</h2>
                <p>本机多语言词项检索，不调用外部模型。</p>
                <form onSubmit={searchMemory}>
                  <input
                    aria-label="检索问题"
                    maxLength={500}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="输入你要查找的规范、偏好或项目需求"
                  />
                  <button
                    className="btn primary"
                    disabled={!query.trim() || retrieving}
                  >
                    {retrieving ? (
                      <RefreshCw size={17} className="spinning" />
                    ) : (
                      <ArrowRight size={18} />
                    )}
                    检索
                  </button>
                </form>
                <label className="query-project">
                  项目范围
                  <select
                    value={queryProject}
                    onChange={(e) => setQueryProject(e.target.value)}
                  >
                    {["全部项目", ...projects].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <div className="retrieval-disclaimer">
                  按词项和标题加权排序 · 未配置向量或语义模型
                </div>
              </section>
              {result && (
                <>
                  <div className="section-line">
                    <h2>检索结果 · {result.hits.length} 条</h2>
                    <span>
                      {result.duration} ms · {result.project}
                    </span>
                  </div>
                  {result.hits.length ? (
                    result.hits.map((m) => (
                      <section className="panel result-card" key={m.id}>
                        <div className="result-meta">
                          <Tag tone="green">匹配分 {m.score}</Tag>
                          <span>
                            {m.project} · r{m.revision}
                          </span>
                        </div>
                        <button
                          className="result-title"
                          onClick={() => setSelected(m.id)}
                        >
                          {m.title}
                          <ArrowUpRight size={15} />
                        </button>
                        <p>{m.body}</p>
                        <small>
                          匹配：{m.matched.join("、")} · 来源：{m.source}
                        </small>
                      </section>
                    ))
                  ) : (
                    <section className="panel">
                      <Empty
                        title="没有相关记忆"
                        body="尝试已有标题中的关键词，或先添加并确认事实。"
                      />
                    </section>
                  )}
                  {result.context && (
                    <section className="panel context-panel">
                      <div className="panel-heading">
                        <h2>准备给 Agent 的上下文</h2>
                        <button
                          className="btn"
                          onClick={() => copy(result.context)}
                        >
                          <Copy size={14} />
                          复制
                        </button>
                      </div>
                      <pre>{result.context}</pre>
                      <p className="small-note">
                        这些内容是上下文数据，不能覆盖工具权限或执行审批。
                      </p>
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {view === "pipeline" && (
            <>
              {pageHeader(
                "记忆提炼",
                "输入明确需求，用本地规则生成候选；确认范围后再入库。",
                <Tag tone="green">{candidates.length} 条待审核</Tag>,
              )}
              <section className="panel extraction-panel">
                <form
                  className="memory-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const value = await mutate(
                      "/extract",
                      fields(form),
                      "POST",
                      "提炼结果已保存",
                      false,
                    );
                    if (value) {
                      form.reset();
                      setToast(
                        `生成 ${value.candidates.length} 条候选，跳过 ${value.duplicates} 条重复${value.truncated ? "；本次最多处理 20 句" : ""}`,
                      );
                    }
                  }}
                >
                  <label>
                    上下文
                    <textarea
                      name="text"
                      required
                      minLength={8}
                      maxLength={20000}
                      rows={4}
                      placeholder="例如：提交信息必须使用英文。新项目使用 TypeScript strict 模式。"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      项目
                      <input
                        name="project"
                        required
                        defaultValue="全部项目"
                        maxLength={80}
                      />
                    </label>
                    <label>
                      共享范围
                      <select name="scope">
                        <option>仅本机</option>
                        <option>全设备</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    <span className="muted">
                      识别明确偏好、要求与约定，保留逐句依据。
                    </span>
                    <button className="btn primary" disabled={busy}>
                      <Sparkles size={16} />
                      提炼候选
                    </button>
                  </div>
                </form>
              </section>
              <div className="section-line">
                <h2>待确认的记忆</h2>
                <span>规则提炼 · 审核后参与检索</span>
              </div>
              {candidates.length ? (
                candidates.map((c) => (
                  <section
                    className={`panel candidate ${c.related.length ? "has-conflict" : ""}`}
                    key={c.id}
                  >
                    <div className="candidate-meta">
                      <Tag tone={c.related.length ? "amber" : "green"}>
                        {c.related.length ? "发现相近记忆" : "建议审核"}
                      </Tag>
                      <span>
                        {c.source} · {when(c.created)}
                      </span>
                    </div>
                    <h2>{c.title}</h2>
                    <p>{c.body}</p>
                    <div className="evidence">
                      <FileText size={16} />
                      <span>来源依据：{c.provenance}</span>
                    </div>
                    {c.related.length > 0 && (
                      <div className="conflict-box">
                        <strong>
                          <TriangleAlert size={16} />
                          请核对是否重复或冲突
                        </strong>
                        {c.related.map((r) => (
                          <p key={r.id}>
                            {r.title}：{r.body}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="candidate-actions">
                      <span>
                        <Folder size={14} />
                        {c.project} · {c.type} · {c.scope}
                      </span>
                      <div>
                        <button
                          disabled={busy}
                          className="btn"
                          onClick={() =>
                            mutate(
                              `/candidates/${c.id}`,
                              { revision: c.revision, decision: "reject" },
                              "POST",
                              "已排除候选",
                            )
                          }
                        >
                          排除
                        </button>
                        <button
                          className="btn primary"
                          onClick={() =>
                            setModal({ type: "review", candidate: c })
                          }
                        >
                          <Check size={15} />
                          编辑并确认
                        </button>
                      </div>
                    </div>
                  </section>
                ))
              ) : (
                <section className="panel">
                  <Empty
                    title="没有待处理候选"
                    body="输入上下文，或让获准工具通过 memory_propose 提交事实。"
                  />
                </section>
              )}
              <p className="small-note muted">
                规则可能遗漏隐含信息，也不能可靠判断语义冲突。原始整段输入不留存，只保存候选的逐句依据。
              </p>
            </>
          )}
          {view === "devices" && (
            <>
              {pageHeader(
                "局域网设备",
                "通过 HTTPS 访问这台电脑的主记忆库，逐台配对与撤权。",
                <button
                  className="btn primary"
                  disabled={!data.lan.enabled}
                  onClick={() => setModal({ type: "pair" })}
                >
                  <Plus size={17} />
                  生成配对码
                </button>,
              )}
              <section className="panel setting-row lan-setting">
                <span className="large-icon">
                  <Network size={25} />
                </span>
                <div>
                  <h2>局域网记忆共享</h2>
                  <p>
                    {data.lan.enabled
                      ? `HTTPS 正在监听端口 ${data.lan.port}，仅配对设备可访问。`
                      : "仅本机使用。开启时生成私有 TLS 证书并启动共享端口。"}
                  </p>
                </div>
                <Switch
                  label="局域网记忆共享"
                  checked={data.lan.enabled}
                  disabled={busy}
                  onChange={(enabled) =>
                    mutate(
                      "/lan",
                      { enabled },
                      "POST",
                      enabled ? "HTTPS 共享服务已启动" : "共享端口已关闭",
                      false,
                    )
                  }
                />
              </section>
              {data.lan.error && (
                <div className="form-error">{data.lan.error}</div>
              )}
              {data.lan.enabled && (
                <section className="panel connection-details">
                  <h2>共享地址与信任证书</h2>
                  <div className="code-box">
                    <pre>
                      {data.lan.addresses.join("\n") ||
                        `https://127.0.0.1:${data.lan.port}`}
                    </pre>
                    <button
                      className="icon-btn"
                      aria-label="复制共享地址"
                      onClick={() => copy(data.lan.addresses.join("\n"))}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <p>
                    将证书通过你信任的方式复制到另一台电脑，核对下面的 SHA-256
                    指纹，再执行配对。
                  </p>
                  <code className="fingerprint">{data.lan.fingerprint}</code>
                  <button
                    className="btn"
                    onClick={() =>
                      fileDownload("/certificate", null, "karmen-memory-ca.pem")
                    }
                  >
                    <ArrowDownToLine size={15} />
                    下载公开证书
                  </button>
                </section>
              )}
              <div className="devices-grid">
                <section className="panel device-card">
                  <div className="device-illustration">
                    <Monitor size={65} strokeWidth={1.1} />
                    <Tag tone="green">主节点</Tag>
                  </div>
                  <h2>{data.service.hostname}</h2>
                  <p>{data.service.platform} · SQLite 源数据库</p>
                  <dl>
                    <div>
                      <dt>共享状态</dt>
                      <dd>{data.lan.enabled ? "HTTPS 运行中" : "仅本机"}</dd>
                    </div>
                    <div>
                      <dt>已配对凭证</dt>
                      <dd>{data.lan.paired} 个</dd>
                    </div>
                  </dl>
                </section>
                {devices.map((c) => (
                  <section className="panel device-card" key={c.id}>
                    <div className="device-illustration">
                      <Server size={59} strokeWidth={1.1} />
                      <Tag>{credentialStatus(c)}</Tag>
                    </div>
                    <h2>{c.name}</h2>
                    <p>
                      {c.project} ·{" "}
                      {c.permission === "read" ? "只读" : "提议与读取"}
                    </p>
                    <dl>
                      <div>
                        <dt>最近请求</dt>
                        <dd>{when(c.lastSeen)}</dd>
                      </div>
                      <div>
                        <dt>真实请求</dt>
                        <dd>{c.calls} 次</dd>
                      </div>
                      <div>
                        <dt>可见范围</dt>
                        <dd>仅全设备记忆</dd>
                      </div>
                    </dl>
                    {c.status !== "revoked" && (
                      <button
                        className="btn danger"
                        onClick={() =>
                          setModal({ type: "revoke", credential: c })
                        }
                      >
                        移除设备
                        <Unplug size={14} />
                      </button>
                    )}
                  </section>
                ))}
              </div>
              <div className="info-banner">
                <ShieldCheck size={19} />
                <p>
                  这是主节点共享访问。主节点离线时，其他电脑无法检索；尚未实现离线副本同步。API
                  密钥和执行授权不随记忆共享。
                </p>
              </div>
            </>
          )}
          {view === "activity" && (
            <>
              {pageHeader(
                "调用记录",
                "保存服务实际处理的操作、检索与拒绝结果。",
                <button
                  className="btn"
                  onClick={() => refresh().catch((e) => setError(e.message))}
                >
                  <RefreshCw size={15} />
                  刷新
                </button>,
              )}
              <section className="panel">
                <div className="list-info">
                  <span>
                    最近 {data.events.length} 条{" "}
                    <b>共 {data.stats.eventCount} 条</b>
                  </span>
                  <Tag>持久化审计</Tag>
                </div>
                {data.events.length ? (
                  <div className="table-scroll">
                    <table className="memory-table activity-table">
                      <thead>
                        <tr>
                          <th>时间</th>
                          <th>调用方 / 操作</th>
                          <th>结果</th>
                          <th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.events.map((e) => (
                          <tr key={e.id}>
                            <td>{when(e.time)}</td>
                            <td>
                              <strong>{e.agent}</strong>
                              <small>{e.action}</small>
                            </td>
                            <td>
                              <Tag
                                tone={e.status === "成功" ? "green" : "amber"}
                              >
                                {e.status}
                              </Tag>
                            </td>
                            <td>
                              {e.detail}
                              {e.duration !== undefined && (
                                <small>{e.duration} ms</small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="还没有调用记录"
                    body="记录来自实际操作，不会预填示例活动。"
                  />
                )}
              </section>
            </>
          )}
          {view === "analytics" && (
            <>
              {pageHeader(
                "效果评估",
                "分开观察实际检索与任务成本，先记录依据，再比较结果。",
                <button
                  className="btn primary"
                  onClick={() => setModal({ type: "evaluation" })}
                >
                  <Plus size={16} />
                  记录对照样本
                </button>,
              )}
              <div className="stats-grid">
                <div className="stat">
                  <div>实际检索</div>
                  <strong>
                    {data.stats.queries}
                    <small>次</small>
                  </strong>
                  <p>服务记录的词项检索</p>
                </div>
                <div className="stat">
                  <div>非空结果</div>
                  <strong>
                    {data.stats.queries
                      ? ((data.stats.hits / data.stats.queries) * 100).toFixed(
                          1,
                        )
                      : "—"}
                    <small>{data.stats.queries ? "%" : ""}</small>
                  </strong>
                  <p>表示找到词项，不代表答案准确率</p>
                </div>
                <div className="stat">
                  <div>平均检索耗时</div>
                  <strong>
                    {data.stats.queries ? data.stats.averageMs.toFixed(2) : "—"}
                    <small>ms</small>
                  </strong>
                  <p>服务内排序，不包含网络与模型</p>
                </div>
                <div className="stat">
                  <div>已记录总成本变化</div>
                  <strong>
                    {saving ?? "—"}
                    <small>{saving === null ? "" : "%"}</small>
                  </strong>
                  <p>{evaluations.length} 组用户录入样本</p>
                </div>
              </div>
              <section className="panel benchmark-panel">
                <div className="panel-heading">
                  <h2>可追溯的任务对照</h2>
                  <Tag>用户记录 · 非自动基准</Tag>
                </div>
                {evaluations.length ? (
                  <div className="table-scroll">
                    <table className="memory-table">
                      <thead>
                        <tr>
                          <th>任务 / 模型</th>
                          <th>无记忆 Token</th>
                          <th>记忆总成本</th>
                          <th>结果依据</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluations.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.task}</strong>
                              <small>{r.model}</small>
                            </td>
                            <td>{r.baseline}</td>
                            <td>
                              {r.total}
                              <small>
                                上下文 {r.context} + 提炼 {r.extraction} + 索引{" "}
                                {r.indexing} + 检索 {r.retrieval}
                              </small>
                            </td>
                            <td>{r.evidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="还没有对照样本"
                    body="使用相同模型、任务和配置，记录全链路 Token 成本与结果依据。"
                  />
                )}
              </section>
              <div className="info-banner">
                <ChartNoAxesCombined size={20} />
                <p>
                  当前没有跨工具准确率或“节省
                  1/3”的实测结论。这里的百分比仅由已录入样本计算，负值表示成本增加。
                </p>
              </div>
            </>
          )}
          {view === "settings" && (
            <>
              {pageHeader("设置", "管理真实存储、数据备份和 CI 访问边界。")}
              <section className="panel settings-section">
                <h2>
                  <Database size={19} />
                  本地存储
                </h2>
                <dl className="service-facts">
                  <div>
                    <dt>数据库</dt>
                    <dd>
                      <code>{data.service.database}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>服务版本</dt>
                    <dd>
                      {data.service.version} · SQLite schema{" "}
                      {data.service.schema}
                    </dd>
                  </div>
                  <div>
                    <dt>实例编号</dt>
                    <dd>
                      <code>{data.service.instance}</code>
                    </dd>
                  </div>
                </dl>
                <p className="small-note">
                  数据库文件由本机用户保护，未实现应用层静态加密。工具凭证只保存哈希，原始凭证不进入备份导出
                  JSON。
                </p>
              </section>
              <section className="panel settings-section">
                <h2>
                  <ArrowDownToLine size={19} />
                  导入、导出与恢复
                </h2>
                <p>
                  JSON 包含事实、来源与生命周期；SQLite
                  快照保留完整历史和审计。导入按内容去重，使用新编号。
                </p>
                <div className="button-row">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      fileDownload("/export", null, "karmen-memory.json")
                    }
                  >
                    导出记忆 JSON
                  </button>
                  <button
                    className="btn"
                    onClick={() => uploadRef.current.click()}
                  >
                    导入 JSON
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      fileDownload("/backup", {}, "karmen-memory-backup.sqlite")
                    }
                  >
                    创建 SQLite 快照
                  </button>
                </div>
                {legacy && (
                  <div className="legacy-banner">
                    <p>
                      检测到旧浏览器原型中的 {legacy.memories.length}{" "}
                      条记录。请先确认内容，再导入正式记忆库。
                    </p>
                    <button
                      className="btn"
                      onClick={() =>
                        setModal({
                          type: "import",
                          value: legacy,
                          name: "旧浏览器原型",
                        })
                      }
                    >
                      检查并导入旧数据
                    </button>
                    <button
                      className="text-link"
                      onClick={() => setLegacy(null)}
                    >
                      暂时隐藏
                    </button>
                  </div>
                )}
              </section>
              <section className="panel settings-section">
                <h2>
                  <KeyRound size={19} />
                  CI 访问
                </h2>
                <div className="setting-row">
                  <div>
                    <h3>允许项目只读凭证访问</h3>
                    <p>
                      CI 凭证必须限定具体项目；关闭后既有 CI
                      凭证也会立即被拒绝。
                    </p>
                  </div>
                  <Switch
                    label="允许 CI 访问"
                    checked={data.settings.ci}
                    disabled={busy}
                    onChange={(ci) =>
                      mutate(
                        "/settings",
                        { ci },
                        "PATCH",
                        "CI 访问策略已生效",
                        false,
                      )
                    }
                  />
                </div>
                <button
                  className="btn"
                  onClick={() => setModal({ type: "credential", ci: true })}
                >
                  创建 CI 只读凭证
                </button>
              </section>
              <section className="panel settings-section">
                <h2>
                  <ShieldCheck size={19} />
                  使用边界
                </h2>
                <p>
                  提炼采用本地句子规则，检索采用词项排序。联网模型、向量索引、宿主原生集成、离线副本同步与桌面安装包尚需单独实现及验收。
                </p>
                <button
                  className="text-link"
                  onClick={() => setModal({ type: "help" })}
                >
                  查看真实使用流程
                  <ArrowRight size={14} />
                </button>
              </section>
            </>
          )}
          <input
            ref={uploadRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={importFile}
          />
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {chosen && !modal && (
        <Modal drawer title="记忆详情" onClose={() => setSelected(null)}>
          <div className="detail-content">
            {errorBox}
            <div className="detail-tags">
              <Tag>{chosen.type}</Tag>
              <Tag tone={chosen.status === "active" ? "green" : "neutral"}>
                {chosen.status === "active" ? "生效中" : "已归档"}
              </Tag>
            </div>
            <h3>{chosen.title}</h3>
            <p className="memory-body">{chosen.body}</p>
            <dl className="detail-meta">
              <div>
                <dt>项目</dt>
                <dd>{chosen.project}</dd>
              </div>
              <div>
                <dt>共享范围</dt>
                <dd>{chosen.scope}</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{chosen.source}</dd>
              </div>
              <div>
                <dt>修订</dt>
                <dd>
                  r{chosen.revision} · {when(chosen.updated)}
                </dd>
              </div>
              <div>
                <dt>编号</dt>
                <dd>
                  <code>{chosen.id}</code>
                </dd>
              </div>
            </dl>
            <div className="evidence">
              <FileText size={16} />
              <span>{chosen.provenance}</span>
            </div>
            <div className="button-row">
              <button
                className="btn primary"
                onClick={() => setModal({ type: "memory", edit: chosen })}
              >
                编辑记忆
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  mutate(
                    `/memories/${chosen.id}`,
                    {
                      revision: chosen.revision,
                      status:
                        chosen.status === "active" ? "archived" : "active",
                    },
                    "PATCH",
                    "记忆状态已保存",
                    false,
                  )
                }
              >
                {chosen.status === "active" ? "归档" : "恢复"}
              </button>
            </div>
            <h3 className="history-heading">
              <History size={17} />
              修订历史
            </h3>
            <div className="revision-list">
              {history.map((h) => (
                <details key={h.revision}>
                  <summary>
                    r{h.revision} · {when(h.updated)} ·{" "}
                    {h.status === "active" ? "生效" : "归档"}
                  </summary>
                  <strong>{h.title}</strong>
                  <p>{h.body}</p>
                  <small>
                    {h.project} · {h.scope}
                  </small>
                </details>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "memory"
              ? modal.edit
                ? "编辑记忆"
                : "添加记忆"
              : modal.type === "agent"
                ? `${modal.agent.name} 接入`
                : modal.type === "credential"
                  ? "新建访问凭证"
                  : modal.type === "token"
                    ? "保存访问凭证"
                    : modal.type === "pair"
                      ? "配对另一台电脑"
                      : modal.type === "pairCode"
                        ? "一次性配对码"
                        : modal.type === "review"
                          ? "确认候选记忆"
                          : modal.type === "import"
                            ? "导入记忆"
                            : modal.type === "revoke"
                              ? "撤销访问权限"
                              : modal.type === "evaluation"
                                ? "记录任务对照"
                                : "使用指南"
          }
          onClose={() => {
            if (!busy) {
              setModal(null);
              setError("");
            }
          }}
        >
          {errorBox}
          {modal.type === "memory" && (
            <form className="memory-form" onSubmit={saveMemory}>
              <fieldset disabled={busy}>
                <FormFields memory={modal.edit} />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setModal(null)}
                  >
                    取消
                  </button>
                  <button className="btn primary">
                    {busy ? "保存中…" : "保存到记忆库"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {modal.type === "review" && (
            <form
              className="memory-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = fields(e.currentTarget),
                  target = data.memories.find((m) => m.id === f.supersedes);
                await mutate(
                  `/candidates/${modal.candidate.id}`,
                  {
                    revision: modal.candidate.revision,
                    decision: f.decision,
                    fact: {
                      title: f.title,
                      body: f.body,
                      type: f.type,
                      project: f.project,
                      scope: f.scope,
                      provenance: f.provenance,
                    },
                    supersedes: f.supersedes,
                    targetRevision: target?.revision,
                  },
                  "POST",
                  "候选已审核并入库",
                );
              }}
            >
              <fieldset disabled={busy}>
                <FormFields memory={modal.candidate} />
                <label>
                  处理方式
                  <select name="decision">
                    <option value="append">
                      独立保留（请在内容中写清适用范围）
                    </option>
                    <option value="supersede">
                      替换同项目旧记忆（旧版本归档）
                    </option>
                  </select>
                </label>
                <label>
                  如需替换，选择旧记忆
                  <select name="supersedes">
                    <option value="">不替换</option>
                    {active.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.project} · {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button className="btn primary">确认入库</button>
                </div>
              </fieldset>
            </form>
          )}
          {modal.type === "agent" && (
            <div className="setup-content">
              <div className="setup-identity">
                <AgentMark agent={modal.agent} />
                <div>
                  <h3>{modal.agent.name}</h3>
                  <p>{modal.agent.kind}</p>
                </div>
              </div>
              <ol>
                <li>签发一个独立凭证，指定项目和读取/提议权限。</li>
                <li>在宿主支持的 MCP、CLI 或 HTTP 扩展中配置服务地址。</li>
                <li>
                  执行一次检索，在本页核对最后请求时间和实际返回的记忆编号。
                </li>
              </ol>
              <div className="info-banner">
                <p>
                  尚未更改此工具的本机配置。服务提供可运行的客户端，宿主协议与功能仍需单独核验。
                </p>
              </div>
              {agentStatus(modal.agent).all.map(credentialRow)}
              <button
                className="btn primary"
                onClick={() =>
                  setModal({ type: "credential", name: modal.agent.name })
                }
              >
                <KeyRound size={16} />
                签发新凭证
              </button>
              <h3>MCP stdio 启动入口</h3>
              <pre>{`${data.service.node} ${data.service.mcpPath}`}</pre>
              <p>
                使用 <code>KARMEN_MEMORY_TOKEN_FILE</code> 指向权限为 0600
                的私有凭证文件，或通过宿主的环境变量配置凭证。
              </p>
              <h3>CLI 检索</h3>
              <pre>
                node bin/memory.mjs search "项目规范" --project YOUR_PROJECT
              </pre>
            </div>
          )}
          {modal.type === "credential" && (
            <form
              className="memory-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = fields(e.currentTarget);
                const value = await mutate(
                  "/credentials",
                  f,
                  "POST",
                  "凭证已签发",
                  false,
                );
                if (value) setModal({ type: "token", ...value });
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  工具名称
                  <input
                    name="name"
                    required
                    defaultValue={modal.name || (modal.ci ? "CI" : "")}
                    list="tool-names"
                    maxLength={80}
                  />
                  <datalist id="tool-names">
                    {catalog.map((a) => (
                      <option key={a.name}>{a.name}</option>
                    ))}
                  </datalist>
                </label>
                <label>
                  客户端类型
                  <select name="kind" defaultValue={modal.ci ? "ci" : "agent"}>
                    <option value="agent">工具 / Agent</option>
                    <option value="ci">CI（仅限具体项目只读）</option>
                  </select>
                </label>
                <label>
                  获准项目
                  <input
                    name="project"
                    required
                    maxLength={80}
                    defaultValue={modal.ci ? "" : "*"}
                    placeholder="具体项目；* 表示全部项目"
                  />
                </label>
                <label>
                  访问权限
                  <select name="permission">
                    <option value="read">只读</option>
                    <option value="readwrite">读取与提议（写入需审核）</option>
                  </select>
                </label>
                <p className="small-note">
                  令牌只显示一次。名称用于你的记录，不是宿主身份认证。
                </p>
                <div className="form-actions">
                  <button className="btn primary">签发凭证</button>
                </div>
              </fieldset>
            </form>
          )}
          {modal.type === "token" && (
            <div className="setup-content">
              <Tag tone="green">已签发 · 等待首次请求</Tag>
              <p>
                {modal.credential.name} · {modal.credential.project} ·{" "}
                {modal.credential.permission === "read" ? "只读" : "读取与提议"}
              </p>
              <p>
                立即保存到你的私有凭证文件。关闭后无法再次查看，丢失时撤销并重新签发。
              </p>
              <div className="code-box secret">
                <pre>{modal.token}</pre>
                <button
                  className="icon-btn"
                  aria-label="复制访问凭证"
                  onClick={() => copy(modal.token)}
                >
                  <Copy size={16} />
                </button>
              </div>
              <h3>MCP 配置示例</h3>
              <pre>{JSON.stringify(mcpConfig, null, 2)}</pre>
              <button
                className="btn"
                onClick={() => copy(JSON.stringify(mcpConfig, null, 2))}
              >
                复制配置模板
              </button>
            </div>
          )}
          {modal.type === "revoke" && (
            <div className="setup-content">
              <p>
                撤销 {modal.credential.name}{" "}
                的凭证后，下一次请求会立即被拒绝。重新接入需要签发新凭证。
              </p>
              <div className="form-actions">
                <button className="btn" onClick={() => setModal(null)}>
                  取消
                </button>
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    mutate(
                      `/credentials/${modal.credential.id}`,
                      { status: "revoked" },
                      "PATCH",
                      "访问权限已撤销",
                    )
                  }
                >
                  确认撤销
                </button>
              </div>
            </div>
          )}
          {modal.type === "pair" && (
            <form
              className="memory-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const value = await mutate(
                  "/pairing",
                  fields(e.currentTarget),
                  "POST",
                  "已生成一次性配对码",
                  false,
                );
                if (value) setModal({ type: "pairCode", ...value });
              }}
            >
              <label>
                允许共享的项目
                <input
                  name="project"
                  required
                  defaultValue="*"
                  maxLength={80}
                />
              </label>
              <label>
                设备权限
                <select name="permission">
                  <option value="read">只读</option>
                  <option value="readwrite">读取与提议</option>
                </select>
              </label>
              <p className="small-note">
                只共享“全设备”范围事实。新配对码会使旧码失效，5
                分钟内仅可使用一次。
              </p>
              <div className="form-actions">
                <button className="btn primary" disabled={busy}>
                  生成配对码
                </button>
              </div>
            </form>
          )}
          {modal.type === "pairCode" && (
            <div className="setup-content">
              <div className="pair-code-display">{modal.code}</div>
              <p>有效期至 {when(modal.expiresAt)} · 一次使用 · 最多 5 次尝试</p>
              <p>先在另一台电脑保存证书文件，并核对指纹，再执行：</p>
              <pre>{`node bin/memory.mjs pair --url ${modal.lan.addresses[0] || `https://127.0.0.1:${modal.lan.port}`} --ca ./karmen-memory-ca.pem --code ${modal.code} --name "My other computer"`}</pre>
              <p>
                配对成功会创建权限为 0600
                的客户端配置；客户端与主节点使用同一个数据库服务。
              </p>
            </div>
          )}
          {modal.type === "import" && (
            <div className="setup-content">
              <p>文件：{modal.name}</p>
              <p>
                待校验{" "}
                {Array.isArray(modal.value?.memories)
                  ? modal.value.memories.length
                  : "未知"}{" "}
                条记录。导入会校验完整文件、跳过内容重复项，并分配新编号。
              </p>
              <p>旧原型包含演示内容，请确认这些记录确实是你要保留的事实。</p>
              <div className="form-actions">
                <button className="btn" onClick={() => setModal(null)}>
                  取消
                </button>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    const value = await mutate(
                      "/import",
                      modal.value,
                      "POST",
                      "导入完成",
                    );
                    if (value)
                      setToast(
                        `已导入 ${value.imported.length} 条，跳过重复 ${value.duplicates} 条`,
                      );
                  }}
                >
                  确认导入
                </button>
              </div>
            </div>
          )}
          {modal.type === "evaluation" && (
            <form
              className="memory-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = fields(e.currentTarget);
                for (const key of [
                  "baseline",
                  "context",
                  "extraction",
                  "indexing",
                  "retrieval",
                ])
                  f[key] = Number(f[key]);
                await mutate("/evaluations", f, "POST", "对照样本已保存");
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  任务
                  <input name="task" required maxLength={120} />
                </label>
                <label>
                  模型与配置
                  <input name="model" required maxLength={160} />
                </label>
                <div className="form-grid">
                  {[
                    ["baseline", "无记忆基线 Token"],
                    ["context", "有记忆上下文 Token"],
                    ["extraction", "提炼 Token"],
                    ["indexing", "索引 Token"],
                    ["retrieval", "检索 Token"],
                  ].map(([name, label]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={name}
                        type="number"
                        min={name === "baseline" ? 1 : 0}
                        max={1000000000}
                        step={1}
                        required
                        defaultValue={
                          name === "baseline" || name === "context" ? "" : 0
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  实际结果与依据
                  <textarea
                    name="evidence"
                    required
                    rows={3}
                    maxLength={2000}
                    placeholder="记录任务是否完成、输出质量与可追溯运行编号"
                  />
                </label>
                <p className="small-note">
                  这里保存你输入的测量结果，不会自动执行模型评估。
                </p>
                <div className="form-actions">
                  <button className="btn primary">保存样本</button>
                </div>
              </fieldset>
            </form>
          )}
          {modal.type === "help" && (
            <div className="setup-content">
              <ol>
                <li>
                  在记忆库直接保存事实，或在“记忆提炼”粘贴明确上下文，编辑并确认候选。
                </li>
                <li>
                  在 Agent 接入为工具签发独立凭证，设置项目和读取/提议权限。
                </li>
                <li>
                  配置 CLI 或 MCP 桥接，执行检索；在调用记录核对返回和拒绝结果。
                </li>
                <li>
                  共享到其他电脑时开启
                  HTTPS、复制公开证书并核对指纹，然后生成配对码。
                </li>
                <li>
                  定期导出 JSON 或创建 SQLite
                  快照。恢复完整快照前停止服务，备份旧数据库，再替换
                  memory.sqlite；不要覆盖运行中的 WAL 数据库。
                </li>
              </ol>
              <p>
                当前不自动读取聊天历史、不修改宿主配置。宿主集成、两台实体电脑互通、语义检索与成本收益需要各自验证。
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
