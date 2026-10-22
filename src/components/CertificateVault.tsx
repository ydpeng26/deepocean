import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, ShieldCheck, Upload, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useProfile } from "@/hooks/useProfile";
import {
  listCertificates,
  saveCertificate,
  archiveCertificate,
  uploadCertificateFront,
  certificatePhotoUrl,
  validateCertificate,
  type DiverCertificate,
  type CertificateInput,
} from "@/lib/certificates";

type Draft = CertificateInput & { id: string };
const empty = (): Draft => ({
  id: crypto.randomUUID(),
  agency: "PADI",
  level: "",
  certificate_number: "",
  issued_on: "",
  issued_at: "",
  is_public: false,
  front_photo_path: null,
});
export function CertificateVault() {
  const { language } = useLanguage();
  const en = language === "en",
    t = (zh: string, english: string) => (en ? english : zh);
  const { profile } = useProfile();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["certificates"], queryFn: listCertificates });
  const records = query.data ?? [];
  const [selectedId, select] = useState<string | null>(null);
  const selected = records.find((item) => item.id === selectedId) ?? records[0];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false),
    alive = useRef(true),
    input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const photoPath = draft ? draft.front_photo_path : selected?.front_photo_path;
  const photo = useQuery({
    queryKey: ["certificate-photo", photoPath],
    queryFn: () => certificatePhotoUrl(photoPath!),
    enabled: !!photoPath,
    staleTime: 240000,
    gcTime: 300000,
  });
  useEffect(() => setPhotoFailed(false), [photoPath, preview, photo.data]);
  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  async function refresh(ownerId: string) {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["certificates"] }),
      client.invalidateQueries({ queryKey: ["public-certificates", ownerId] }),
    ]);
  }
  function discard() {
    return (
      !draft ||
      window.confirm(t("放弃尚未保存的证书修改？", "Discard unsaved certificate changes?"))
    );
  }
  function start(item?: DiverCertificate) {
    if (lock.current || !discard()) return;
    setDraft(
      item
        ? {
            id: item.id,
            agency: item.agency,
            level: item.level,
            certificate_number: item.certificate_number,
            issued_on: item.issued_on,
            issued_at: item.issued_at,
            is_public: item.is_public,
            front_photo_path: item.front_photo_path,
          }
        : empty(),
    );
    setFile(null);
  }
  async function submit() {
    if (lock.current || !draft || !profile) return;
    try {
      validateCertificate(draft);
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    lock.current = true;
    setBusy(true);
    const snapshot = { ...draft },
      ownerId = profile.id;
    try {
      if (file)
        snapshot.front_photo_path = await uploadCertificateFront(snapshot.id, file, ownerId);
      const saved = await saveCertificate(snapshot.id, snapshot, ownerId);
      if (!alive.current) return;
      select(saved.id);
      setDraft(null);
      setFile(null);
      client.setQueryData<DiverCertificate[]>(["certificates"], (rows) => [
        saved,
        ...(rows ?? []).filter((row) => row.id !== saved.id),
      ]);
      toast.success(t("证书已保存", "Certificate saved"));
      await refresh(ownerId);
    } catch (error) {
      if (alive.current)
        toast.error(
          t(
            "保存失败，修改与照片仍保留，请重试。",
            "Save failed. Your edits and selected photo are kept; please retry.",
          ) + (error instanceof Error ? " " + error.message : ""),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function archive(item: DiverCertificate) {
    if (
      lock.current ||
      !profile ||
      !window.confirm(
        t(
          "移除此证书？可通过提示中的“撤销”恢复。",
          "Remove this certificate? You can undo it from the notification.",
        ),
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    const ownerId = profile.id;
    try {
      await archiveCertificate(item.id, true, ownerId);
      if (!alive.current) return;
      await refresh(ownerId);
      toast.success(t("证书已移除", "Certificate removed"), {
        duration: 10000,
        action: {
          label: t("撤销", "Undo"),
          onClick: () => {
            void archiveCertificate(item.id, false, ownerId)
              .then(() => {
                if (alive.current) return refresh(ownerId);
              })
              .catch(() => toast.error(t("恢复失败，请重试", "Restore failed")));
          },
        },
      });
    } catch {
      if (alive.current) toast.error(t("移除失败，请重试", "Removal failed"));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const shown = draft ?? selected;
  const image = preview ?? photo.data;
  const change = (key: keyof CertificateInput, value: string | boolean | null) => {
    if (!lock.current) setDraft((current) => (current ? { ...current, [key]: value } : current));
  };
  return (
    <div className="do-cert-page do-cert-live">
      <main className="do-cert-main">
        <section className="do-cert-intro">
          <div>
            <span>DIVER CREDENTIALS</span>
            <h1>{t("我的证书档案", "My certification archive")}</h1>
            <p>
              {t(
                "整理每一次学习与进阶，只上传证书正面即可。",
                "Keep your qualifications together. Only the front photo is needed.",
              )}
            </p>
          </div>
          <Award />
        </section>
        <p className="do-cert-privacy-note">
          <ShieldCheck />
          {t(
            "证书为自行登记，不代表平台或认证机构已核验。编号和照片始终仅本人可见。",
            "Self-reported credentials are not verified by SupDiver or an agency. Numbers and photos are always owner-only.",
          )}
        </p>
        {query.isPending ? (
          <p role="status">{t("正在读取证书…", "Loading certificates…")}</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{t("暂时无法读取证书，请重试。", "Certificates couldn't be loaded.")}</p>
            <button onClick={() => void query.refetch()}>{t("重新加载", "Reload")}</button>
          </div>
        ) : (
          <div className="do-cert-live-layout" aria-busy={busy}>
            <aside className="do-cert-summary-panel">
              <div className="do-cert-panel-kicker">01 / ARCHIVE</div>
              <h2>{t("认证档案", "Credential archive")}</h2>
              <p>
                {records.length} {t("张证书", "certificates")}
              </p>
              <button className="do-cert-add" disabled={busy} onClick={() => start()}>
                <Plus />
                {t("新增证书", "Add certificate")}
              </button>
              <ol className="do-cert-live-list">
                {records.map((item) => (
                  <li key={item.id}>
                    <button
                      disabled={busy}
                      data-active={!draft && selected?.id === item.id}
                      onClick={() => {
                        if (!lock.current && discard()) {
                          select(item.id);
                          setDraft(null);
                          setFile(null);
                        }
                      }}
                    >
                      <Award />
                      <span>
                        <strong>{item.level}</strong>
                        <small>
                          {item.agency} · {item.issued_on || "—"} ·{" "}
                          {item.is_public
                            ? t("公开摘要", "Public summary")
                            : t("仅自己可见", "Private")}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="do-cert-detail-hint">
                {t(
                  "海洋护照的当前最高等级仍在个人资料中设置。",
                  "Set your current highest level in your profile.",
                )}
              </p>
              <Link to="/profile">{t("返回个人资料", "Back to profile")}</Link>
            </aside>
            <section
              className="do-cert-detail-panel"
              aria-label={t("证书详情", "Certificate details")}
            >
              {!shown ? (
                <div className="do-cert-live-empty">
                  <Award />
                  <h2>{t("还没有证书档案", "No certificates yet")}</h2>
                  <p>
                    {t(
                      "新增第一张证书，记录机构、等级与签发信息。",
                      "Add your first credential with its agency, level and issue details.",
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="do-cert-section-heading">
                    <h2>{draft ? t("编辑证书", "Edit certificate") : shown.level}</h2>
                    {!draft && (
                      <button
                        className="do-cert-edit"
                        disabled={busy}
                        onClick={() => start(selected)}
                      >
                        <Pencil />
                        {t("编辑证书", "Edit certificate")}
                      </button>
                    )}
                  </div>
                  <fieldset disabled={!draft || busy} className="do-cert-live-fields">
                    <label>
                      {t("认证机构", "Agency")}
                      <input
                        maxLength={60}
                        list="certificate-agencies"
                        value={shown.agency}
                        onChange={(event) => change("agency", event.target.value)}
                      />
                    </label>
                    <datalist id="certificate-agencies">
                      {["PADI", "SSI", "NAUI", "CMAS", "AIDA", "MOLCHANOVS", "SDI", "TDI"].map(
                        (agency) => (
                          <option key={agency} value={agency} />
                        ),
                      )}
                    </datalist>
                    <label>
                      {t("证书等级", "Certification")}
                      <input
                        maxLength={120}
                        value={shown.level}
                        onChange={(event) => change("level", event.target.value)}
                      />
                    </label>
                    <label>
                      {t("证书编号（仅本人可见）", "Certificate number (private)")}
                      <input
                        maxLength={120}
                        value={shown.certificate_number ?? ""}
                        onChange={(event) => change("certificate_number", event.target.value)}
                      />
                    </label>
                    <label>
                      {t("签发日期", "Issue date")}
                      <input
                        type="date"
                        value={shown.issued_on ?? ""}
                        onChange={(event) => change("issued_on", event.target.value)}
                      />
                    </label>
                    <label>
                      {t("签发地点", "Place of issue")}
                      <input
                        maxLength={160}
                        value={shown.issued_at ?? ""}
                        onChange={(event) => change("issued_at", event.target.value)}
                      />
                    </label>
                    <label>
                      {t("展示权限", "Visibility")}
                      <select
                        value={shown.is_public ? "public" : "private"}
                        onChange={(event) => change("is_public", event.target.value === "public")}
                      >
                        <option value="private">{t("仅自己可见", "Only me")}</option>
                        <option value="public">
                          {t("向已登录潜水员公开摘要", "Show summary to signed-in divers")}
                        </option>
                      </select>
                    </label>
                  </fieldset>
                  <p className="do-cert-privacy-note">
                    {t(
                      "公开摘要仅含机构、等级与签发信息，不含证书编号和照片。",
                      "Public summaries contain agency, level and issue details only, never the number or photo.",
                    )}
                  </p>
                  <section
                    className="do-cert-live-photo"
                    aria-label={t("证书正面照片", "Certificate front photo")}
                  >
                    <h3>
                      {t(
                        "证书正面照片（可选，仅本人可见）",
                        "Certificate front (optional, private)",
                      )}
                    </h3>
                    {image && !photoFailed ? (
                      <img
                        src={image}
                        alt={t("证书正面", "Certificate front")}
                        onError={() => setPhotoFailed(true)}
                      />
                    ) : (
                      <p>
                        {photo.isPending && photoPath
                          ? t("正在读取照片…", "Loading photo…")
                          : t("尚未上传正面照片", "No front photo uploaded")}
                      </p>
                    )}
                    {(photo.isError || photoFailed) && (
                      <button
                        onClick={() => {
                          setPhotoFailed(false);
                          void photo.refetch();
                        }}
                      >
                        {t("照片读取失败，点击重试", "Photo failed to load; retry")}
                      </button>
                    )}
                    {draft && (
                      <>
                        <input
                          ref={input}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy}
                          hidden
                          onChange={(event) => {
                            const selectedFile = event.target.files?.[0];
                            event.target.value = "";
                            if (!selectedFile || lock.current) return;
                            if (
                              !["image/jpeg", "image/png", "image/webp"].includes(
                                selectedFile.type,
                              ) ||
                              selectedFile.size > 10485760 ||
                              !selectedFile.size
                            ) {
                              toast.error(
                                t(
                                  "请选择 10 MB 以内的 JPG、PNG 或 WebP",
                                  "Choose a JPG, PNG or WebP up to 10 MB",
                                ),
                              );
                              return;
                            }
                            setFile(selectedFile);
                          }}
                        />
                        <button disabled={busy} onClick={() => input.current?.click()}>
                          <Upload />
                          {t("选择正面照片", "Choose front photo")}
                        </button>
                        <button
                          disabled={busy || (!image && !photoPath)}
                          onClick={() => {
                            setFile(null);
                            change("front_photo_path", null);
                          }}
                        >
                          {t("移除正面照片", "Remove front photo")}
                        </button>
                        <small>
                          {t(
                            "JPG、PNG、WebP，单张最多 10 MB；点击保存后才上传。",
                            "JPG, PNG or WebP, up to 10 MB. Upload starts only when you save.",
                          )}
                        </small>
                      </>
                    )}
                  </section>
                  {draft ? (
                    <div className="do-cert-form-actions">
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (!lock.current && discard()) {
                            setDraft(null);
                            setFile(null);
                          }
                        }}
                      >
                        {t("取消", "Cancel")}
                      </button>
                      <button disabled={busy || !profile} onClick={() => void submit()}>
                        {busy ? t("保存中…", "Saving…") : t("保存证书", "Save certificate")}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="do-cert-live-remove"
                      disabled={busy}
                      onClick={() => void archive(selected)}
                    >
                      <Trash2 />
                      {t("移除此证书", "Remove certificate")}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
      <footer className="do-passport-footer">
        <span>SupDiver</span>
        <small>YOUR OCEAN. YOUR STORY.</small>
      </footer>
    </div>
  );
}
