import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Languages, MessageSquare, Send } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { ContactError, contactVisitorKey, sendGuestContact } from "@/lib/guest-contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [{ title: "联系我们 · SupDiver" }, { name: "robots", content: "noindex" }],
  }),
  component: GuestContactPage,
});
export function GuestContactPage() {
  const { language, toggleLanguage } = useLanguage(),
    en = language === "en";
  const [category, setCategory] = useState("issue"),
    [body, setBody] = useState("");
  const [email, setEmail] = useState(""),
    [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const locked = useRef(false),
    alive = useRef(true);
  const request = useRef<string | null>(null),
    visitor = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    document.title = en ? "Contact us · SupDiver" : "联系我们 · SupDiver";
  }, [en]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      request.current ??= crypto.randomUUID();
      visitor.current ??= contactVisitorKey();
      await sendGuestContact(request.current, visitor.current, {
        category,
        body,
        reply_email: email,
        website,
      });
      if (!alive.current) return;
      request.current = null;
      setBody("");
      setEmail("");
      setSent(true);
    } catch (cause) {
      if (!alive.current) return;
      const code = cause instanceof ContactError ? cause.code : "save";
      setError(
        code === "invalid"
          ? en
            ? "Check your message and optional email address."
            : "请检查留言内容及选填的邮箱地址。"
          : code === "rate"
            ? en
              ? "Too many submissions. Your text is kept; please try again later."
              : "提交过于频繁，文字已保留，请稍后再试。"
            : code === "conflict"
              ? en
                ? "This request already contains different text. Copy your draft and reopen the page for a new message."
                : "此请求已保存过其他内容。请先复制当前文字，再重新打开本页提交新留言。"
              : en
                ? "Submission not confirmed. Your text is kept; retrying the same content will not duplicate it."
                : "未能确认提交，文字已保留；重试相同内容不会重复提交。",
      );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="do-contact-public">
      <header className="do-header">
        <Link to="/" className="do-brand" aria-label="SupDiver home">
          <span className="do-brand-mark">
            <img src="/images/supdiver-wave-mark.svg" alt="" />
          </span>
          <b>SupDiver</b>
        </Link>
        <div className="do-header-actions">
          <Link to="/" className="do-contact-home">
            <ArrowLeft aria-hidden="true" />
            {en ? "Home" : "返回首页"}
          </Link>
          <button
            className="do-language"
            type="button"
            onClick={toggleLanguage}
            aria-label={en ? "切换到中文" : "Switch to English"}
          >
            <Languages aria-hidden="true" />
            <span>{en ? "中文" : "EN"}</span>
          </button>
        </div>
      </header>
      <main className="do-feedback-page">
        <section className="do-feedback-intro">
          <span className="do-feedback-kicker">
            <MessageSquare aria-hidden="true" /> SUPDIVER / CONTACT US
          </span>
          <h1>{en ? "Contact us" : "联系我们"}</h1>
          <p>
            {en
              ? "No sign-in needed. Tell us about login problems, suggestions or anything else we can improve."
              : "无需登录。无论是无法登录、使用中遇到的问题，还是对网站的建议，都可以在这里告诉我们。"}
          </p>
        </section>
        <form className="do-feedback-form" onSubmit={submit} aria-busy={busy}>
          <h2>{en ? "Leave a message" : "给我们留言"}</h2>
          <p id="contact-privacy">
            {en
              ? "Only website administrators can read your message; it will not appear on the forum. Do not send passwords, verification codes or other sensitive information. Email is optional and used only to contact you about this message; replies are not guaranteed."
              : "留言仅网站管理员可查看，不会发布到论坛。请勿填写密码、验证码或其他敏感信息。邮箱选填，仅用于就此留言联系你，不保证每条留言均获回复。"}
          </p>
          <fieldset disabled={busy}>
            <label htmlFor="contact-category">{en ? "Message type" : "留言类型"}</label>
            <select
              id="contact-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSent(false);
              }}
            >
              <option value="issue">{en ? "Login or usage problem" : "登录或使用问题"}</option>
              <option value="suggestion">{en ? "Feature suggestion" : "功能建议"}</option>
              <option value="other">{en ? "Other" : "其他"}</option>
            </select>
            <label htmlFor="contact-email">
              {en ? "Email for a reply (optional)" : "回复邮箱（选填）"}
            </label>
            <input
              id="contact-email"
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              aria-describedby="contact-privacy"
              onChange={(e) => {
                setEmail(e.target.value);
                setSent(false);
              }}
            />
            <label htmlFor="contact-body">{en ? "Your message" : "留言内容"}</label>
            <textarea
              id="contact-body"
              required
              rows={9}
              maxLength={3000}
              value={body}
              aria-describedby="contact-privacy contact-count contact-draft"
              placeholder={
                en
                  ? "Describe the page, steps and problem. Do not include your password."
                  : "请描述所在页面、操作步骤及遇到的情况，不要填写密码。"
              }
              onChange={(e) => {
                setBody(e.target.value);
                setSent(false);
              }}
            />
            <span id="contact-count" className="do-feedback-count">
              {body.length} / 3000
            </span>
            <div className="do-contact-trap" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <small id="contact-draft">
              {en
                ? "Basic anti-spam limits apply. This browser can submit at most once per minute and five times per 24 hours; shared networks may have additional limits. An anonymous browser identifier and hashed network identifier are used for these checks. Unsent text is lost when you leave or refresh."
                : "为防止垃圾留言，本浏览器每分钟最多提交一次、24 小时最多五次，共享网络可能另有限制。限频使用匿名浏览器标识及网络地址的不可逆摘要。离开或刷新页面不会保留未提交的文字。"}
            </small>
            <button type="submit" disabled={busy || !body.trim()}>
              <Send aria-hidden="true" />
              {busy ? (en ? "Sending…" : "发送中…") : en ? "Send message" : "发送留言"}
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
                ? "Message received. Thank you for contacting us!"
                : "留言已收到，感谢你联系我们！"}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
