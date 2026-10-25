import { useEffect } from "react";
import { useLanguage, type Language } from "@/i18n/LanguageProvider";

// Presentation only: persisted category/weather values and user text never change.
export const liveEnglish: Record<string, string> = {
  "登录 · SupDiver": "Sign in · SupDiver",
  "无信号记录 · SupDiver": "Offline log · SupDiver",
  "离线草稿与同步 · SupDiver": "Offline drafts & sync · SupDiver",
  请先登录: "Please sign in first",
  "账号已变化，请重新载入": "Your account changed. Please reload.",
  请填写品牌或型号: "Enter a brand or model",
  使用次数须为有效的非负整数: "Dive count must be a valid non-negative integer",
  "此请求已保存不同内容，请重新载入后编辑":
    "This request saved different content. Reload before editing.",
  "未确认保存，请重试": "Save not confirmed. Please retry.",
  "未确认删除，请重新载入": "Deletion not confirmed. Please reload.",
  只能编辑自己的记录: "You can only edit your own records",
  "请填写有效的生物名称、日期和地点": "Enter a valid species name, date and location",
  请选择图片文件: "Choose an image file",
  "原始图片请大于 0 且不超过 20MB": "The original image must be larger than 0 and at most 20 MB",
  请上传相遇照片: "Upload an encounter photo",
  "建议请填写 1 至 1000 个字符": "Enter a suggestion between 1 and 1000 characters",
  "这次建议可能已保存不同内容，请重新载入核对":
    "This suggestion may have saved different content. Reload to check.",
  "未确认建议保存，请重试": "Suggestion save not confirmed. Please retry.",
  只能转发自己的记录: "You can only share your own records",
  "无法确认相遇照片，请重新载入": "The encounter photo could not be verified. Please reload.",
  "未确认转发，请重试": "Sharing not confirmed. Please retry.",
  "新增潜水记录 · 深蓝": "New dive log · SupDiver",
  "我的潜水装备 · SupDiver": "My dive gear · SupDiver",
  "我的海洋生物展览墙 · SupDiver": "Ocean encounters · SupDiver",
  返回日志: "Back to dive logs",
  新增潜水记录: "New dive log",
  "请填写潜水国家、潜点名称和日期": "Enter the country, dive site and date",
  水上温度: "Surface temperature",
  水下温度: "Water temperature",
  最大深度: "Maximum depth",
  潜水时长: "Dive duration",
  "照片和视频合计最多 6 个，请先移除部分附件":
    "Up to 6 photos and videos in total. Remove an attachment first.",
  记录已更新: "Dive log updated",
  记录已保存: "Dive log saved",
  "保存失败，请重试": "Save failed. Please retry.",
  地点与时间: "Place and time",
  潜水国家: "Country",
  "例如：Indonesia / 印度尼西亚": "For example: Indonesia",
  "地区 / 岛屿": "Region / island",
  "例如：Komodo / 科莫多": "For example: Komodo",
  潜点名称: "Dive site",
  "例如：Apo Reef": "For example: Apo Reef",
  潜水日期: "Dive date",
  当天天气: "Weather",
  选择天气: "Select weather",
  水温与数据: "Temperature and dive data",
  "水上温度 °C": "Surface temperature °C",
  "水下温度 °C": "Water temperature °C",
  "最大深度 m": "Maximum depth (m)",
  "时长 分钟": "Duration (minutes)",
  类型与潜伴: "Dive type and buddy",
  潜水类型: "Dive type",
  潜伴身份: "Buddy role",
  "教练 / 同伴": "Instructor / buddy",
  潜伴姓名: "Buddy name",
  照片与备注: "Photos and notes",
  移除照片: "Remove attachment",
  "照片 / 视频": "Photos / videos",
  "请选择 JPG、PNG 或 WebP 图片": "Choose a JPG, PNG or WebP image",
  "上传照片 / 视频": "Upload photos / videos",
  "图片支持 JPG、PNG、WebP，HEIC/HEIF 请先转换。最多 6 个文件；单个视频不超过 100MB":
    "JPG, PNG and WebP supported. Convert HEIC/HEIF first. Up to 6 files; each video up to 100 MB.",
  已选择: "Selected",
  个文件: "files",
  个人备注: "Personal notes",
  "看到了什么？感受如何？": "What did you see? How did it feel?",
  "保存中…": "Saving…",
  保存记录: "Save dive log",
  取消: "Cancel",
  附件: "Attachment",
  休闲水肺: "Recreational scuba",
  自由潜: "Freediving",
  技术潜水: "Technical diving",
  教练: "Instructor",
  同伴: "Buddy",
  晴: "Sunny",
  多云: "Cloudy",
  阴: "Overcast",
  小雨: "Light rain",
  大雨: "Heavy rain",
  有风: "Windy",
  浮力控制装置: "BCD",
  调节器: "Regulator",
  潜水电脑: "Dive computer",
  面镜: "Mask",
  脚蹼: "Fins",
  潜水服: "Wetsuit",
  水下相机: "Underwater camera",
  其他装备: "Other gear",
  潜水装备: "Dive gear",
  "放弃尚未保存的装备修改？": "Discard unsaved gear changes?",
  新装备已添加: "New gear added",
  装备资料已更新: "Gear updated",
  "装备已在其他页面修改或删除。当前输入已保留，请先复制需要的内容，再加载最新记录。":
    "This gear changed or was deleted elsewhere. Your input is kept. Copy what you need before loading the latest record.",
  "加载最新记录将替换当前输入。请先复制需要的内容，是否继续？":
    "Loading the latest record will replace your input. Copy what you need first. Continue?",
  加载最新装备记录: "Load latest gear record",
  "保存失败，修改已保留，请重试": "Save failed. Your changes are kept; please retry.",
  "确定删除这件装备吗？": "Delete this gear item?",
  装备已删除: "Gear deleted",
  "删除失败，请重新载入后重试": "Delete failed. Reload and retry.",
  暂时无法读取装备资料: "Gear is unavailable",
  "读取失败不代表没有装备；未保存的修改仍保留在当前页面。":
    "A read failure does not mean you have no gear. Unsaved changes remain on this page.",
  重新加载: "Reload",
  返回海洋护照: "Back to ocean passport",
  "正在载入装备…": "Loading gear…",
  我的潜水装备: "My dive gear",
  "记录常用装备、使用次数与下一次保养日期。":
    "Track your gear, dive counts and next service dates.",
  新增装备: "Add gear",
  未填写品牌: "No brand specified",
  "还没有登记装备。点击“新增装备”建立你的第一条装备档案。":
    "No gear registered yet. Choose Add gear to create your first entry.",
  编辑装备档案: "Edit gear",
  登记新装备: "Register new gear",
  "资料只对当前账号显示。": "Visible only to your account.",
  装备类型识别: "Gear category",
  "选择装备类型后会自动切换对应图标，不再展示与实际装备不符的固定照片。品牌和型号将用于后续产品目录匹配。":
    "The icon follows your selected gear category. Brand and model can be used for future product catalogue matching.",
  装备类型: "Category",
  品牌: "Brand",
  型号: "Model",
  购入日期: "Purchase date",
  下次保养日期: "Next service date",
  累计使用次数: "Dive count",
  备注: "Notes",
  删除装备: "Delete gear",
  保存装备: "Save gear",
  "请填写生物名称、相遇时间和地点；不认识时可勾选寻求帮助":
    "Enter the species, date and location. If unsure of the species, select identification help.",
  海洋相遇已保存: "Encounter saved",
  "保存未确认，内容与照片已保留，请重试":
    "Save not confirmed. Your text and photo are kept; please retry.",
  "← 返回海洋护照": "← Back to ocean passport",
  海洋生物展览墙: "Ocean encounters",
  "收藏每一次与海洋生命相遇的瞬间。": "Keep every encounter with ocean life.",
  记录一次相遇: "Record an encounter",
  我的展览墙: "My encounters",
  帮助识别: "Help identify",
  "看看其他潜水员遇见了谁，分享你的识别建议。":
    "Explore other divers' encounters and share identification suggestions.",
  "个人记录仅自己可见；开启识别求助的记录会向已登录的潜水员展示。":
    "Personal encounters are private. Enabling identification help shares the encounter with signed-in divers.",
  "正在载入海洋相遇…": "Loading encounters…",
  暂时无法载入展览墙: "Encounters could not be loaded",
  暂时没有待识别的相遇: "No encounters awaiting identification",
  "你的海洋相遇，值得被收藏": "Your ocean encounters are worth keeping",
  "遇到不认识的生物时，可以上传照片并寻求帮助。":
    "Upload a photo and ask for help when you cannot identify a species.",
  "上传第一张照片，记录生物名称、相遇时间和地点。":
    "Upload your first photo with the species, date and location.",
  上传照片: "Upload photo",
  寻求识别帮助: "Identification help requested",
  关闭: "Close",
  编辑海洋相遇: "Edit encounter",
  记录一次海洋相遇: "Record an ocean encounter",
  相遇照片预览: "Encounter photo preview",
  相遇照片: "Encounter photo",
  更换照片: "Replace photo",
  "已保存相遇照片，可点击按钮更换": "A photo is saved. Use the button to replace it.",
  尚未上传照片: "No photo uploaded",
  "请选择自己拍摄或获授权的照片，原图不超过 20MB。":
    "Use your own photo or one you have permission to share. Original up to 20 MB.",
  生物名称: "Species name",
  "不确定可留空，将保存为待识别": "Leave blank if unsure; saved as unidentified",
  "例如：绿海龟": "For example: Green sea turtle",
  相遇时间: "Encounter date",
  相遇地点: "Location",
  "例如：Indonesia · Komodo · Batu Bolong": "For example: Indonesia · Komodo · Batu Bolong",
  寻求其他潜水员帮助识别: "Ask other divers for identification help",
  "此照片、生物名称、相遇时间、地点和你的显示名称将向已登录用户展示。请避免公开敏感物种的精确位置；你可以随时编辑并关闭求助。":
    "This photo, species name, date, location and display name will be visible to signed-in users. Avoid sharing precise locations of sensitive species. You can edit and turn off help at any time.",
  "此条相遇只会显示在你自己的展览墙。": "This encounter is visible only on your private wall.",
  "正在保存…": "Saving…",
  保存相遇: "Save encounter",
  "记录者：": "Recorded by: ",
  "· 正在寻求识别帮助": "· Identification help requested",
  "编辑名称与记录 / 关闭求助": "Edit encounter / turn off help",
  "删除这次海洋相遇和相关留言？": "Delete this encounter and its suggestions?",
  "删除失败，请重试": "Delete failed. Please retry.",
  删除记录: "Delete record",
  "可将这张照片、生物名称、相遇时间和地点转发至深蓝论坛「生物百科」，请潜水员一起交流识别。论坛帖子独立保留，关闭展览墙求助或删除相遇不会删除已转发的帖子。":
    "Share this photo, species, date and location to the forum's Creatures topic for identification. The forum post is independent: disabling help or deleting the encounter does not delete the shared post.",
  "将此照片、生物名称、相遇时间和地点发布至深蓝论坛「生物百科」？论坛成员将能查看和评论。":
    "Publish this photo, species, date and location to the forum's Creatures topic? Members can view and comment.",
  "已转发至深蓝论坛 · 生物百科": "Shared to forum · Creatures",
  "转发失败，请重试": "Sharing failed. Please retry.",
  "处理中…": "Working…",
  转发至深蓝论坛: "Share to forum",
  "查看论坛帖子 →": "View forum post →",
  识别建议: "Identification suggestions",
  "建议仅供参考，请结合可信资料核实生物种类。":
    "Suggestions are for reference. Verify species using reliable sources.",
  "正在载入建议…": "Loading suggestions…",
  "建议加载失败，点击重试": "Suggestions could not be loaded. Retry",
  "还没有识别建议。": "No identification suggestions yet.",
  识别建议已发送: "Suggestion sent",
  "发送未确认，建议已保留，请重试或重新载入核对":
    "Send not confirmed. Your suggestion is kept; retry or reload to check.",
  提供识别建议: "Suggest an identification",
  "你认为是什么生物？可以补充识别特征与依据。":
    "What species might it be? Include identifying features and evidence.",
  "发送中…": "Sending…",
  发送建议: "Send suggestion",
};

export function liveText(language: Language, text: string) {
  if (language !== "en") return text;
  if (liveEnglish[text]) return liveEnglish[text];
  if (liveEnglish[text.trim()]) return text.replace(text.trim(), liveEnglish[text.trim()]);
  const numeric = text.match(
    /^(.*)请填写(非负整数|非负数字（最多一位小数）|数字（最多一位小数）)$/,
  );
  if (numeric)
    return `${liveEnglish[numeric[1]] ?? numeric[1]}: ${numeric[2] === "非负整数" ? "enter a non-negative integer" : numeric[2].startsWith("非负") ? "enter a non-negative number with at most one decimal place" : "enter a number with at most one decimal place"}.`;
  if (text.includes(" / ") && /[\u4e00-\u9fff]/.test(text.split(" / ")[0]))
    return text.split(" / ").slice(1).join(" / ");
  return text;
}

export function useLiveCopy(title?: string) {
  const { language } = useLanguage();
  useEffect(() => {
    if (title) document.title = liveText(language, title);
  }, [language, title]);
  return (text: string) => liveText(language, text);
}
