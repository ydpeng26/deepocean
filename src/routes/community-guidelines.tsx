import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({ meta: [{ title: "深蓝论坛社区规范 · SupDiver" }, { name: "description", content: "深蓝论坛的发帖规范与要求。尊重海洋，也尊重每一位分享者。" }] }),
  component: CommunityGuidelines,
});

const sections = [
  { title: "一、我们欢迎什么内容", paragraphs: ["欢迎分享与潜水及海洋生活有关的真实内容，包括："], items: ["潜水日志、潜水旅行与水下摄影。", "潜点介绍、水况观察及出行经验。", "海洋生物观察与海洋保护行动。", "装备使用体验、保养经验与选购讨论。", "潜店、向导、船宿及住宿的亲身体验。", "潜水学习中的问题、心得与经验交流。"] },
  { title: "二、让分享真实、有参考价值", paragraphs: ["请根据亲身经历或已被授权的他人经历发帖，涉及到虚假信息或者侵权行为我们将坚决抵制并且严肃处理。", "禁止编造经历、冒充他人、伪造资质，以及通过虚假互动误导其他用户。"] },
  { title: "三、尊重每一位社区成员", paragraphs: ["禁止辱骂、人身攻击、歧视、威胁、性骚扰，以及持续纠缠或煽动他人围攻。请勿因他人的经验、证书级别、装备或消费选择而贬低对方。", "未经允许，请勿公开他人的联系方式、证件、住址、私人聊天记录或其他敏感信息。"] },
  { title: "四、图片、视频与内容使用", paragraphs: ["请上传自己拍摄、创作，或已获得使用许可的内容。转载时请注明来源；注明来源不等于取得授权。", "照片和视频中如出现可识别的他人，请尊重其意愿。涉及儿童、私人空间或敏感信息时，请谨慎上传。", "禁止发布色情、血腥暴力、诈骗及其他违法内容。"] },
  { title: "五、保护海洋与海洋生物", paragraphs: ["请遵守当地保护规定，尊重海洋生物的自然行为。", "社区不支持为了拍摄、互动或获取流量而追逐、围堵、触摸、搬动、投喂或伤害野生海洋生物，也不支持破坏珊瑚、采集受保护生物或带走海洋遗物。", "如分享相关行为是为了科普、记录问题或开展保护讨论，请说明背景，避免将其包装成值得模仿的体验。", "涉及脆弱生态或受保护物种时，请谨慎公开精确位置。"] },
  { title: "六、潜水安全与经验交流", paragraphs: ["论坛内容用于交流，请各位潜水员谨慎对待他人发帖，任何发帖内容不能代替专业技能培训或者课程。", "遇到紧急情况，请及时寻求当地救援及专业帮助，不要等待论坛回复。"] },
  { title: "七、商业推广与利益关系", paragraphs: ["如果你与所推荐的品牌、潜店、住宿或服务存在雇佣、合作、赞助、赠品或佣金关系，请在帖子中清楚注明。", "禁止伪装成普通用户发布广告、重复刷屏、批量私信营销，以及发布诈骗链接或误导性交易信息。", "未经平台开放或许可，请勿将论坛用于商品交易、收费招募或收取订金。"] },
  { title: "八、举报与处理", paragraphs: ["发现疑似违规内容，可以通过帖子菜单提交举报，并尽量说明原因。请勿通过公开围攻或曝光个人信息的方式处理争议。", "平台会根据内容、情节和影响进行核实，可能采取提醒修改、限制展示、移除内容或限制账号功能等措施。严重或反复违规的账号可能被暂停使用。", "如果你对处理结果有异议，可以通过平台提供的反馈渠道申请复核。请勿恶意举报或伪造证据。"] },
];

function CommunityGuidelines() {
  return <div className="do-community-page">
    <header className="do-community-header"><Link to="/" className="do-brand" aria-label="SupDiver"><span className="do-brand-mark"><img src="/images/supdiver-wave-mark.svg" alt="" /></span><b>SupDiver</b></Link><Link to="/forum"><ArrowLeft size={16} />返回深蓝论坛</Link></header>
    <main className="do-community-main"><article>
      <header className="do-community-intro"><ShieldCheck aria-hidden="true" /><span>DEEP BLUE COMMUNITY</span><h1>深蓝论坛社区规范</h1><p>尊重海洋，也尊重每一位分享者。</p></header>
      <nav className="do-community-contents" aria-label="规范目录">{sections.map((section, index) => <a key={section.title} href={`#guideline-${index + 1}`}>{section.title}</a>)}</nav>
      {sections.map((section, index) => <section className="do-community-section" id={`guideline-${index + 1}`} key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}
      <footer className="do-community-closing"><p>感谢你认真分享，也认真对待海洋。</p><p>愿每一段被记录的经历，都能帮助另一位潜水员更好地出发。</p><Link to="/forum"><ArrowLeft size={16} />返回深蓝论坛</Link></footer>
    </article></main>
  </div>;
}
