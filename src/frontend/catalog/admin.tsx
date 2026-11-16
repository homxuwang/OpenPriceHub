import { useState } from "react";
import { PageTitle, Section, useCopy } from "./components";
import { useCatalog } from "./context";
import LegacyAdmin from "../pages/Admin";
export function CatalogAdmin() {
  const catalog = useCatalog();
  const t = useCopy();
  const [key, setKey] = useState("");
  const [text, setText] = useState(JSON.stringify(catalog, null, 2));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [validated, setValidated] = useState(false);
  const [data, setData] = useState<any>(null);
  const [legacy, setLegacy] = useState(false);
  async function call(action: string, body?: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/catalog/admin" + action, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": key },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await r.json();
      if (!r.ok || !result.success)
        throw new Error(result.error || "Request failed");
      setMessage(result.message || t("Loaded successfully", "读取成功"));
      return result.data;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const parse = () => {
    try {
      return JSON.parse(text);
    } catch {
      setMessage(t("Invalid JSON", "JSON 格式错误"));
      return null;
    }
  };
  return (
    <>
      <PageTitle
        title={t("Catalog data management", "目录数据管理")}
        description={t(
          "Review evidence, validate the full catalog, then publish a version. Publishing updates the database, price history and audit log atomically.",
          "审阅来源、校验完整目录后发布版本；数据库、价格历史与审计日志在同一事务中更新。",
        )}
      />
      <div className="card space-y-4 p-5">
        <label className="block text-sm">
          {t(
            "Administrator key (kept in memory only)",
            "管理员密钥（仅保存在内存）",
          )}
          <input
            className="input mt-2"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setValidated(false);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || !key}
            className="btn-primary"
            onClick={async () => {
              const d = await call("");
              if (d) {
                setData(d);
                setText(JSON.stringify(d.catalog, null, 2));
                setValidated(false);
              }
            }}
          >
            {t("Load live catalog & audit", "读取实时目录与审计")}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              const blob = new Blob([text], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "openpricehub-catalog.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t("Export JSON", "导出 JSON")}
          </button>
        </div>
        <label className="block text-sm">
          {t(
            "Catalog JSON — includes sources, plans and directed alternatives",
            "目录 JSON — 包含来源、套餐和定向平替",
          )}
          <textarea
            className="input mt-2 h-80 font-mono text-xs"
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setValidated(false);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy || !key}
            className="btn-secondary"
            onClick={async () => {
              const body = parse();
              if (body) {
                const d = await call("/validate", body);
                setValidated(!!d);
              }
            }}
          >
            {t("Validate draft", "校验草稿")}
          </button>
          <button
            disabled={!validated || busy || !key}
            className="btn-primary"
            onClick={async () => {
              const body = parse();
              if (body) {
                const d = await call("/publish", body);
                if (d) {
                  setValidated(false);
                  window.dispatchEvent(new Event("oph:catalog-published"));
                }
              }
            }}
          >
            {t("Publish verified catalog", "发布已核验目录")}
          </button>
        </div>
        <p className="whitespace-pre-wrap text-sm" role="status">
          {message}
        </p>
        <p className="text-xs text-ink-2">
          {t(
            "Validation checks data shape and evidence references. The reviewer must actually verify vendor facts before setting a record to verified. The previous catalog remains active if publication fails.",
            "校验检查数据结构和来源引用；标记已核验前，审核者必须实际核对厂商事实。发布失败时旧版本继续生效。",
          )}
        </p>
      </div>
      {data && (
        <>
          <Section title={t("Submissions awaiting review", "待审核提交")}>
            <div className="space-y-3">
              {data.submissions.length ? (
                data.submissions.map((s: any) => (
                  <article className="card p-4" key={s.id}>
                    <div className="flex justify-between gap-3">
                      <h3 className="font-semibold">{s.product_name}</h3>
                      <span className="badge bg-surface-2">{s.status}</span>
                    </div>
                    <a
                      className="mt-2 block break-all text-sm text-primary"
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.source_url}
                    </a>
                    <p className="my-2 whitespace-pre-wrap text-sm">
                      {s.notes}
                    </p>
                    <details className="mb-3 text-xs">
                      <summary>{t("Submitted data", "提交数据")}</summary>
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap">
                        {s.payload_json}
                      </pre>
                    </details>
                    {s.status === "pending" && (
                      <div className="flex gap-2">
                        {["reviewed", "rejected"].map((status) => (
                          <button
                            disabled={busy}
                            className="btn-secondary"
                            key={status}
                            onClick={async () => {
                              const d = await call("/review", {
                                id: s.id,
                                status,
                              });
                              if (d)
                                setData((v: any) => ({
                                  ...v,
                                  submissions: v.submissions.map((x: any) =>
                                    x.id === s.id ? { ...x, status } : x,
                                  ),
                                }));
                            }}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <p className="text-sm text-ink-2">
                  {t("No submissions yet.", "暂无提交。")}
                </p>
              )}
            </div>
          </Section>
          <Section title={t("Sync log & price history", "同步日志与价格历史")}>
            <details className="card p-4">
              <summary>
                {data.logs.length} {t("sync records", "条同步记录")} ·{" "}
                {data.history.length} {t("price history records", "条价格记录")}
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(
                  { logs: data.logs, history: data.history },
                  null,
                  2,
                )}
              </pre>
            </details>
          </Section>
        </>
      )}
      <button className="btn-ghost mt-6" onClick={() => setLegacy((v) => !v)}>
        {t("Toggle legacy submission management", "展开 / 收起原有提交管理")}
      </button>
      {legacy && <LegacyAdmin />}
    </>
  );
}
