import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Send } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { FeedbackError, submitFeedback, type FeedbackCategory } from "@/lib/feedback";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    meta: [{ title: "联系我们 · SupDiver" }, { name: "robots", content: "noindex" }],
  }),
  component: FeedbackPage,
});

export function FeedbackPage() {
  const { user } = Route.useRouteContext();
  const { language } = useLanguage();
  const en = language === "en";
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    document.title = en ? "Contact us · SupDiver" : "联系我们 · SupDiver";
  }, [en]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      requestId.current ??= crypto.randomUUID();
      await submitFeedback(requestId.current, { category, body }, user.id);
      if (!alive.current) return;
      requestId.current = null;
      setBody("");
      setSent(true);
    } catch (cause) {
      if (!alive.current) return;
      const code = cause instanceof FeedbackError ? cause.code : "save";
      setError(
        code === "invalid"
          ? en
            ? "Choose a feedback type and enter 1–3,000 characters."
            : "请选择反馈类型，并填写 1–3000 个字符。"
          : code === "rate"
            ? en
              ? "Too many submissions. Your text is kept; please try again later."
              : "提交过于频繁，内容已保留，请稍后再试。"
            : code === "account"
              ? en
                ? "Your account changed. Reopen this page after signing in."
                : "登录账号已变化，请登录后重新打开本页。"
              : code === "conflict"
                ? en
                  ? "This request was already saved with different text. Your current text is kept; copy it before reopening the page to send a new suggestion."
                  : "此请求已保存过其他内容。当前文字已保留，请先复制，再重新打开本页提交新建议。"
                : en
                  ? "Submission not confirmed. Your text is kept; retrying the same content will not create a duplicate."
                  : "未能确认提交，内容已保留；重试相同内容不会重复提交。",
      );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="do-feedback-page">
      <section className="do-feedback-intro">
        <span className="do-feedback-kicker">
          <MessageSquare aria-hidden="true" /> SUPDIVER / CONTACT US
        </span>
        <h1>{en ? "Contact us" : "联系我们"}</h1>
        <p>
          {en
            ? "Tell us what you would improve, what went wrong, or what you hope to see next."
            : "无论是功能建议、使用中遇到的问题，还是你期待的新体验，都欢迎告诉我们。"}
        </p>
      </section>
      <form className="do-feedback-form" onSubmit={submit} aria-busy={busy}>
        <h2>{en ? "Suggestions and comments" : "建议与意见"}</h2>
        <p id="feedback-privacy">
          {en
            ? "Your feedback is not posted to the forum. It is available only to you and website administrators. Do not include passwords, verification codes or other sensitive information."
            : "反馈不会发布到论坛，仅你本人及网站管理员可查看。请勿填写密码、验证码或其他敏感信息。"}
        </p>
        <fieldset disabled={busy}>
          <label htmlFor="feedback-category">{en ? "Feedback type" : "反馈类型"}</label>
          <select
            id="feedback-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as FeedbackCategory);
              setSent(false);
            }}
          >
            <option value="suggestion">{en ? "Feature suggestion" : "功能建议"}</option>
            <option value="issue">{en ? "Report a problem" : "问题反馈"}</option>
            <option value="other">{en ? "Other feedback" : "其他意见"}</option>
          </select>
          <label htmlFor="feedback-body">{en ? "Suggestions and comments" : "建议与意见"}</label>
          <textarea
            id="feedback-body"
            value={body}
            required
            maxLength={3000}
            rows={9}
            aria-describedby="feedback-privacy feedback-length feedback-draft"
            onChange={(e) => {
              setBody(e.target.value);
              setSent(false);
            }}
            placeholder={
              en
                ? "Describe your suggestion. For a problem, tell us the page and steps that led to it."
                : "请描述你的想法。如遇到问题，可写下所在页面、操作步骤及发生的情况。"
            }
          />
          <span id="feedback-length" className="do-feedback-count">
            {body.length} / 3000
          </span>
          <small id="feedback-draft">
            {en
              ? "Submit at most once per minute, up to 20 times per 24 hours. Unsaved text is not retained when you leave or refresh this page."
              : "每分钟最多提交一次，24 小时内最多 20 次。离开或刷新页面不会保留尚未提交的文字。"}
          </small>
          <button type="submit" disabled={busy || !body.trim()}>
            <Send aria-hidden="true" />
            {busy ? (en ? "Submitting…" : "提交中…") : en ? "Submit feedback" : "提交反馈"}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="do-feedback-error">
            {error}
          </p>
        )}
        {sent && (
          <p role="status" className="do-feedback-success">
            {en
              ? "Feedback received. Thank you for helping improve SupDiver!"
              : "反馈已收到，感谢你帮助 SupDiver 改善体验！"}
          </p>
        )}
      </form>
    </main>
  );
}
